import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatMoney } from './orders.service';

export interface OrderAction {
  type: string;
  [key: string]: any;
}

export interface OrderActionContext {
  client: {
    id: string;
    name: string;
    deliveryEnabled?: boolean;
    pickupEnabled?: boolean;
    paymentInstructions?: string | null;
  };
  customer: {
    id: string;
    name?: string | null;
    phoneNumber: string;
  };
  /** Conversation the draft order is keyed on (null in the playground). */
  conversationId?: string | null;
  action: OrderAction;
}

export interface OrderActionResult {
  /** Authoritative text describing what the backend did — fed back to the AI. */
  summary: string;
  orderId?: string;
  /** Set when staff should be notified (order confirmed/cancelled). */
  staffNotification?: string;
}

interface ProductOption {
  name: string;
  priceDelta?: number;
}

const ACTIVE_ORDER_STATUSES = ['draft', 'pending', 'confirmed'];

/**
 * Executes order actions emitted by the AI. The AI decides WHEN to act;
 * this service owns the truth: items are validated against the real catalog,
 * prices and option deltas are copied from the database, and totals are
 * always computed here — never by the AI.
 */
@Injectable()
export class OrderActionsService {
  private readonly logger = new Logger(OrderActionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(ctx: OrderActionContext): Promise<OrderActionResult> {
    const { action } = ctx;
    try {
      switch (action.type) {
        case 'add_items':
          return await this.addItems(ctx);
        case 'remove_items':
          return await this.removeItems(ctx);
        case 'set_order_details':
          return await this.setOrderDetails(ctx);
        case 'confirm_order':
          return await this.confirmOrder(ctx);
        case 'check_order_status':
          return await this.checkOrderStatus(ctx);
        case 'cancel_order':
          return await this.cancelOrder(ctx);
        default:
          return { summary: `Unknown order action "${action.type}". Do not retry it; answer the customer without an action.` };
      }
    } catch (error) {
      this.logger.error(
        `Order action ${action.type} failed: ${(error as Error).message}`,
      );
      return {
        summary: `The order action "${action.type}" failed with a technical error. Apologize to the customer and offer to try again or connect them with the team.`,
      };
    }
  }

  /**
   * Catalog + current draft for the AI prompt (orders module only).
   * Shared by the WhatsApp flow and the playground.
   */
  async buildPromptContext(
    client: { id: string; deliveryEnabled?: boolean; pickupEnabled?: boolean },
    customerId: string,
    conversationId?: string | null,
  ) {
    const products = await this.prisma.product.findMany({
      where: { clientId: client.id, active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    const catalog = products.map((p) => ({
      name: p.name,
      description: p.description,
      price: p.price,
      category: p.category,
      available: p.available,
      options: Array.isArray(p.options)
        ? (p.options as unknown as ProductOption[])
        : [],
    }));

    const draft = await this.findDraft(client.id, customerId, conversationId);
    let draftText: string | undefined;
    if (draft) {
      const lines = [
        ...draft.items.map(
          (i) =>
            `- ${i.quantity}× ${i.product.name}${this.optionSuffix(i.selectedOptions)} @ LKR ${formatMoney(this.itemUnitPrice(i))} each`,
        ),
        `Total so far: LKR ${formatMoney(draft.total)}`,
        `Fulfilment: ${draft.type}${draft.type === 'delivery' ? (draft.address ? ` to ${draft.address}` : ' (address not set)') : ''}`,
      ];
      draftText = lines.join('\n');
    }

    return {
      catalog,
      fulfilment: [
        client.deliveryEnabled !== false ? 'delivery' : null,
        client.pickupEnabled !== false ? 'pickup' : null,
      ]
        .filter(Boolean)
        .join(' and '),
      currentDraft: draftText,
    };
  }

  // ---- add_items ----

  private async addItems(ctx: OrderActionContext): Promise<OrderActionResult> {
    const requested = this.normalizeItems(ctx.action.items);
    if (requested.length === 0) {
      return {
        summary: `No items were added: the action needs an "items" array like [{"product":"Chicken Kottu","quantity":2}]. Ask the customer what they'd like.`,
      };
    }

    const added: string[] = [];
    const problems: string[] = [];
    const draft = await this.getOrCreateDraft(ctx);

    for (const item of requested) {
      const product = await this.resolveProduct(ctx.client.id, item.product);
      if (!product) {
        problems.push(`"${item.product}" is not on the menu`);
        continue;
      }
      if (!product.available) {
        problems.push(`"${product.name}" is currently unavailable`);
        continue;
      }

      const productOptions = Array.isArray(product.options)
        ? (product.options as unknown as ProductOption[])
        : [];
      const selected: ProductOption[] = [];
      const unknownOptions: string[] = [];
      for (const optName of item.options) {
        const match = productOptions.find(
          (o) => o.name.toLowerCase() === optName.toLowerCase(),
        );
        if (match) selected.push(match);
        else unknownOptions.push(optName);
      }
      if (unknownOptions.length > 0) {
        problems.push(
          `"${product.name}" has no option(s): ${unknownOptions.join(', ')} (available: ${productOptions.map((o) => o.name).join(', ') || 'none'})`,
        );
      }

      await this.prisma.orderItem.create({
        data: {
          orderId: draft.id,
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.price, // copied at order time
          selectedOptions: selected as unknown as Prisma.InputJsonValue,
        },
      });
      added.push(
        `${item.quantity}× ${product.name}${this.optionSuffix(selected)}`,
      );
    }

    const updated = await this.recomputeTotal(draft.id);
    const parts: string[] = [];
    if (added.length > 0) {
      parts.push(`Added to the order: ${added.join('; ')}.`);
    }
    if (problems.length > 0) {
      parts.push(`NOT added: ${problems.join('; ')}. Offer alternatives from the real catalog instead.`);
    }
    parts.push(this.describeDraft(updated));
    return { summary: parts.join(' '), orderId: draft.id };
  }

  // ---- remove_items ----

  private async removeItems(
    ctx: OrderActionContext,
  ): Promise<OrderActionResult> {
    const draft = await this.findDraft(
      ctx.client.id,
      ctx.customer.id,
      ctx.conversationId,
    );
    if (!draft) {
      return {
        summary: `There is no draft order for this customer yet, so nothing was removed.`,
      };
    }

    const requested = this.normalizeItems(ctx.action.items);
    const removed: string[] = [];
    const notFound: string[] = [];

    for (const item of requested) {
      const product = await this.resolveProduct(ctx.client.id, item.product);
      const orderItem = product
        ? draft.items.find((i) => i.productId === product.id)
        : undefined;
      if (!orderItem) {
        notFound.push(item.product);
        continue;
      }
      const removeQty = item.quantity ?? orderItem.quantity;
      if (removeQty >= orderItem.quantity) {
        await this.prisma.orderItem.delete({ where: { id: orderItem.id } });
        removed.push(`${orderItem.quantity}× ${orderItem.product.name}`);
      } else {
        await this.prisma.orderItem.update({
          where: { id: orderItem.id },
          data: { quantity: orderItem.quantity - removeQty },
        });
        removed.push(`${removeQty}× ${orderItem.product.name}`);
      }
    }

    const updated = await this.recomputeTotal(draft.id);
    const parts: string[] = [];
    if (removed.length > 0) parts.push(`Removed: ${removed.join('; ')}.`);
    if (notFound.length > 0) {
      parts.push(`Not in the order: ${notFound.join('; ')}.`);
    }
    parts.push(this.describeDraft(updated));
    return { summary: parts.join(' '), orderId: draft.id };
  }

  // ---- set_order_details ----

  private async setOrderDetails(
    ctx: OrderActionContext,
  ): Promise<OrderActionResult> {
    const { client, action } = ctx;
    const draft = await this.findDraft(
      client.id,
      ctx.customer.id,
      ctx.conversationId,
    );
    if (!draft || draft.items.length === 0) {
      return {
        summary: `There are no items in the order yet. Add items before setting delivery/pickup details.`,
      };
    }

    const type = typeof action.type_ === 'string' ? action.type_ : action.orderType ?? action.fulfilment ?? action.deliveryType;
    const problems: string[] = [];
    let resolvedType = draft.type;
    if (typeof type === 'string') {
      const normalized = type.toLowerCase();
      if (normalized === 'delivery') {
        if (client.deliveryEnabled === false) {
          problems.push('delivery is not available for this business — offer pickup instead');
        } else {
          resolvedType = 'delivery';
        }
      } else if (normalized === 'pickup') {
        if (client.pickupEnabled === false) {
          problems.push('pickup is not available for this business — offer delivery instead');
        } else {
          resolvedType = 'pickup';
        }
      }
    }

    const address =
      typeof action.address === 'string' ? action.address : draft.address;
    if (resolvedType === 'delivery' && !address) {
      problems.push('a delivery address is required — ask the customer for it');
    }

    const order = await this.prisma.order.update({
      where: { id: draft.id },
      data: {
        type: resolvedType,
        address: resolvedType === 'delivery' ? address : null,
        customerName:
          typeof action.customerName === 'string'
            ? action.customerName
            : (draft.customerName ?? ctx.customer.name ?? null),
        phone:
          typeof action.phone === 'string'
            ? action.phone
            : (draft.phone ?? ctx.customer.phoneNumber),
        notes: typeof action.notes === 'string' ? action.notes : draft.notes,
        status: 'pending',
      },
      include: { items: { include: { product: true } } },
    });

    const summary =
      `Order details saved (status: pending review): ${this.describeDraft(order)} ` +
      `Fulfilment: ${order.type}${order.address ? ` to ${order.address}` : ''}. ` +
      (problems.length > 0
        ? `Problems: ${problems.join('; ')}.`
        : `Everything needed is captured — ask the customer to confirm the order, then use confirm_order.`);
    return { summary, orderId: order.id };
  }

  // ---- confirm_order ----

  private async confirmOrder(
    ctx: OrderActionContext,
  ): Promise<OrderActionResult> {
    const draft = await this.findDraft(
      ctx.client.id,
      ctx.customer.id,
      ctx.conversationId,
    );
    if (!draft || draft.items.length === 0) {
      return {
        summary: `There is no order to confirm — no items have been added. The order was NOT placed.`,
      };
    }
    if (draft.type === 'delivery' && !draft.address) {
      return {
        summary: `The order was NOT confirmed: a delivery address is missing. Ask the customer for it and use set_order_details.`,
      };
    }

    const order = await this.prisma.order.update({
      where: { id: draft.id },
      data: { status: 'confirmed' },
      include: { items: { include: { product: true } } },
    });

    const itemLines = order.items
      .map(
        (i) =>
          `- ${i.quantity}× ${i.product.name}${this.optionSuffix(i.selectedOptions)} — LKR ${formatMoney(this.itemUnitPrice(i) * i.quantity)}`,
      )
      .join('\n');

    const payment = ctx.client.paymentInstructions
      ? ` Payment: ${ctx.client.paymentInstructions}.`
      : '';
    const staffNotification = [
      `New order confirmed:`,
      itemLines,
      `- Total: LKR ${formatMoney(order.total)}`,
      `- ${order.type === 'delivery' ? `Delivery to: ${order.address}` : 'Pickup'}`,
      `- Customer: ${order.customerName || ctx.customer.name || 'Unknown'} (${order.phone || ctx.customer.phoneNumber})`,
      order.notes ? `- Notes: ${order.notes}` : null,
      `- Order ID: ${order.id}`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      summary:
        `Order CONFIRMED. ${this.describeDraft(order)} ` +
        `${order.type === 'delivery' ? `Delivering to ${order.address}` : 'For pickup'}.${payment} ` +
        `Confirm the total and fulfilment to the customer — staff have been notified.`,
      orderId: order.id,
      staffNotification,
    };
  }

  // ---- check_order_status ----

  private async checkOrderStatus(
    ctx: OrderActionContext,
  ): Promise<OrderActionResult> {
    const order = await this.prisma.order.findFirst({
      where: {
        clientId: ctx.client.id,
        customerId: ctx.customer.id,
        status: { notIn: ['draft', 'cancelled'] },
      },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!order) {
      return {
        summary: `This customer has no active order. If they want to order, help them add items.`,
      };
    }
    return {
      summary:
        `Order status (real, from the database): ${order.status}. ` +
        `${this.describeDraft(order)} ` +
        `${order.type === 'delivery' ? `Delivery to ${order.address || 'address on file'}` : 'Pickup'}. Relay this to the customer.`,
      orderId: order.id,
    };
  }

  // ---- cancel_order ----

  private async cancelOrder(
    ctx: OrderActionContext,
  ): Promise<OrderActionResult> {
    const order = await this.prisma.order.findFirst({
      where: {
        clientId: ctx.client.id,
        customerId: ctx.customer.id,
        status: { in: ACTIVE_ORDER_STATUSES },
      },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!order) {
      return {
        summary: `No active order found for this customer (only orders not yet being prepared can be cancelled). Nothing was cancelled.`,
      };
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'cancelled' },
    });

    return {
      summary: `Order CANCELLED: ${this.describeDraft(order)}. Confirm the cancellation to the customer.`,
      orderId: order.id,
      staffNotification: `Order cancelled by customer (${ctx.customer.name || 'Unknown'}, ${ctx.customer.phoneNumber}): ${this.describeDraft(order)} Order ID: ${order.id}`,
    };
  }

  // ---- helpers ----

  /**
   * The customer's open (draft or pending) order on this conversation, if
   * one exists. Items/details can still change until confirm_order.
   */
  private async findDraft(
    clientId: string,
    customerId: string,
    conversationId?: string | null,
  ) {
    return this.prisma.order.findFirst({
      where: {
        clientId,
        customerId,
        status: { in: ['draft', 'pending'] },
        conversationId: conversationId ?? null,
      },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getOrCreateDraft(ctx: OrderActionContext) {
    const existing = await this.findDraft(
      ctx.client.id,
      ctx.customer.id,
      ctx.conversationId,
    );
    if (existing) return existing;
    return this.prisma.order.create({
      data: {
        clientId: ctx.client.id,
        customerId: ctx.customer.id,
        conversationId: ctx.conversationId ?? null,
        status: 'draft',
      },
      include: { items: { include: { product: true } } },
    });
  }

  /** Recomputes the order total from its items and persists it. */
  private async recomputeTotal(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });
    const total = order.items.reduce(
      (sum, item) => sum + this.itemUnitPrice(item) * item.quantity,
      0,
    );
    return this.prisma.order.update({
      where: { id: orderId },
      data: { total },
      include: { items: { include: { product: true } } },
    });
  }

  /** unitPrice + selected option deltas (all backend data). */
  private itemUnitPrice(item: {
    unitPrice: number;
    selectedOptions: unknown;
  }): number {
    const options = Array.isArray(item.selectedOptions)
      ? (item.selectedOptions as ProductOption[])
      : [];
    return (
      item.unitPrice +
      options.reduce((sum, o) => sum + (o.priceDelta || 0), 0)
    );
  }

  private normalizeItems(value: unknown): Array<{
    product: string;
    quantity: number;
    options: string[];
  }> {
    if (!Array.isArray(value)) return [];
    const items: Array<{ product: string; quantity: number; options: string[] }> = [];
    for (const raw of value) {
      if (!raw || typeof raw !== 'object') continue;
      const product = (raw as any).product ?? (raw as any).name;
      if (typeof product !== 'string' || !product.trim()) continue;
      const quantity = Math.max(
        1,
        Math.floor(Number((raw as any).quantity) || 1),
      );
      const options = Array.isArray((raw as any).options)
        ? (raw as any).options.filter((o: unknown) => typeof o === 'string')
        : [];
      items.push({ product: product.trim(), quantity, options });
    }
    return items;
  }

  private async resolveProduct(clientId: string, ref: unknown) {
    if (!ref || typeof ref !== 'string') return null;
    const exact = await this.prisma.product.findFirst({
      where: {
        clientId,
        active: true,
        OR: [{ id: ref }, { name: { equals: ref, mode: 'insensitive' } }],
      },
    });
    if (exact) return exact;
    // Fallback: unique partial match ("kottu" → "Chicken Kottu").
    return this.prisma.product.findFirst({
      where: {
        clientId,
        active: true,
        name: { contains: ref, mode: 'insensitive' },
      },
      orderBy: { name: 'asc' },
    });
  }

  private optionSuffix(selectedOptions: unknown): string {
    const options = Array.isArray(selectedOptions)
      ? (selectedOptions as ProductOption[]).map((o) => o.name).filter(Boolean)
      : [];
    return options.length ? ` (${options.join(', ')})` : '';
  }

  private describeDraft(order: {
    total: number;
    items: Array<{
      quantity: number;
      unitPrice: number;
      selectedOptions: unknown;
      product: { name: string };
    }>;
  }): string {
    if (order.items.length === 0) return 'The order is empty.';
    const items = order.items
      .map(
        (i) =>
          `${i.quantity}× ${i.product.name}${this.optionSuffix(i.selectedOptions)}`,
      )
      .join(' + ');
    return `Order now: ${items} = LKR ${formatMoney(order.total)} (real total from the database).`;
  }
}
