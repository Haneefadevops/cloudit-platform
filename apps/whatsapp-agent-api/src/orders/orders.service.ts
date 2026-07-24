import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppSenderService } from '../whatsapp-sender/whatsapp-sender.service';

export interface ProductInput {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  available?: boolean;
  options?: Array<{ name: string; priceDelta?: number }>;
  active?: boolean;
}

export const ORDER_STATUSES = [
  'draft',
  'pending',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'completed',
  'cancelled',
];

// Statuses that trigger an optional customer WhatsApp notification when set
// from the dashboard, with the default message for each.
const STATUS_NOTIFICATIONS: Record<string, (o: OrderWithIncludes) => string> = {
  confirmed: (o) =>
    `Your order is confirmed! Total: LKR ${formatMoney(o.total)}` +
    `${o.type === 'delivery' ? `, delivering to ${o.address}` : ' — ready for pickup'}. ` +
    `We'll message you when it's on the way. — ${o.client.name}`,
  preparing: (o) =>
    `Your order (LKR ${formatMoney(o.total)}) is now being prepared. — ${o.client.name}`,
  out_for_delivery: (o) =>
    `Your order is on the way! Total: LKR ${formatMoney(o.total)}${o.client.paymentInstructions ? `. Payment: ${o.client.paymentInstructions}` : ''}. — ${o.client.name}`,
  cancelled: (o) =>
    `Your order has been cancelled. Message us anytime to order again. — ${o.client.name}`,
};

interface OrderWithIncludes {
  id: string;
  status: string;
  type: string;
  address: string | null;
  total: number;
  customer: { name: string | null; phoneNumber: string };
  client: {
    name: string;
    paymentInstructions: string | null;
    orderConfirmationTemplate: string | null;
    metaAccessToken: string;
    whatsappPhoneNumberId: string;
  };
  items: Array<{
    quantity: number;
    unitPrice: number;
    selectedOptions: unknown;
    product: { name: string };
  }>;
}

export function formatMoney(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly senderService: WhatsAppSenderService,
  ) {}

  // ---- Catalog (admin) ----

  findProducts(clientId: string) {
    return this.prisma.product.findMany({
      where: { clientId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  createProduct(clientId: string, data: ProductInput) {
    return this.prisma.product.create({
      data: {
        clientId,
        name: data.name || '',
        description: data.description,
        price: data.price ?? 0,
        category: data.category,
        available: data.available ?? true,
        options: data.options ?? [],
        active: data.active ?? true,
      },
    });
  }

  updateProduct(clientId: string, id: string, data: ProductInput) {
    return this.prisma.product.update({
      where: { id, clientId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.available !== undefined
          ? { available: data.available }
          : {}),
        ...(data.options !== undefined ? { options: data.options } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
  }

  removeProduct(clientId: string, id: string) {
    return this.prisma.product.delete({ where: { id, clientId } });
  }

  // ---- Orders (dashboard pipeline) ----

  findOrders(clientId: string, filters: { status?: string } = {}) {
    return this.prisma.order.findMany({
      where: {
        clientId,
        status: filters.status || { not: 'draft' },
      },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async updateOrderStatus(clientId: string, id: string, status: string) {
    if (!ORDER_STATUSES.includes(status) || status === 'draft') {
      throw new BadRequestException(
        `Invalid status "${status}". Allowed: ${ORDER_STATUSES.filter((s) => s !== 'draft').join(', ')}`,
      );
    }
    const order = await this.prisma.order.update({
      where: { id, clientId },
      data: { status },
      include: {
        customer: true,
        client: true,
        items: { include: { product: true } },
      },
    });
    await this.notifyCustomerOnStatusChange(order);
    return order;
  }

  /**
   * Optional per-status customer notification on dashboard status changes.
   * Best-effort — failures are logged, not thrown.
   */
  private async notifyCustomerOnStatusChange(order: OrderWithIncludes) {
    const buildMessage = STATUS_NOTIFICATIONS[order.status];
    if (!buildMessage) return;

    let message = buildMessage(order);
    if (order.status === 'confirmed' && order.client.orderConfirmationTemplate) {
      message = order.client.orderConfirmationTemplate
        .replaceAll('{{customer_name}}', order.customer.name || '')
        .replaceAll('{{business_name}}', order.client.name)
        .replaceAll('{{total}}', formatMoney(order.total))
        .replaceAll('{{items}}', this.describeItems(order.items))
        .replaceAll('{{address}}', order.address || '');
    }

    try {
      await this.senderService.sendMessage({
        client: order.client,
        to: order.customer.phoneNumber,
        message,
      });
    } catch (error) {
      this.logger.error(
        `Failed to notify customer for order status change: ${(error as Error).message}`,
      );
    }
  }

  private describeItems(
    items: Array<{
      quantity: number;
      selectedOptions: unknown;
      product: { name: string };
    }>,
  ): string {
    return items
      .map((i) => {
        const options = Array.isArray(i.selectedOptions)
          ? (i.selectedOptions as Array<{ name?: string }>)
              .map((o) => o.name)
              .filter(Boolean)
          : [];
        return `${i.quantity}× ${i.product.name}${options.length ? ` (${options.join(', ')})` : ''}`;
      })
      .join(', ');
  }
}
