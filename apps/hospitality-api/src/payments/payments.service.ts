import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentProviderStatus,
  PaymentStatus,
} from "@prisma/client-hospitality";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async findAll(organizationId: string, invoiceId?: string) {
    return this.prisma.payment.findMany({
      where: {
        organizationId,
        ...(invoiceId ? { invoiceId } : {}),
      },
      orderBy: { transactionDate: "desc" },
      include: {
        invoice: true,
        reservation: true,
      },
    });
  }

  async findOne(id: string, organizationId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, organizationId },
      include: {
        invoice: true,
        reservation: true,
      },
    });
    if (!payment) {
      throw new NotFoundException("Payment not found");
    }
    return payment;
  }

  async create(organizationId: string, dto: CreatePaymentDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, property: { organizationId } },
      include: { reservation: true },
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    if (invoice.status === InvoiceStatus.cancelled) {
      throw new BadRequestException("Cannot record payment for cancelled invoice");
    }

    const amount = Number(dto.amount);
    const paidAmount = Number(invoice.paidAmount);
    const totalAmount = Number(invoice.totalAmount);
    if (amount <= 0) {
      throw new BadRequestException("Payment amount must be greater than zero");
    }
    if (paidAmount + amount > totalAmount) {
      throw new BadRequestException("Payment exceeds invoice balance");
    }

    const providerStatus =
      dto.providerStatus ??
      (dto.method === PaymentMethod.cash || dto.method === PaymentMethod.bank_transfer
        ? PaymentProviderStatus.succeeded
        : PaymentProviderStatus.pending);

    const payment = await this.prisma.payment.create({
      data: {
        invoice: { connect: { id: invoice.id } },
        reservation: { connect: { id: invoice.reservationId } },
        organizationId,
        amount,
        method: dto.method,
        providerStatus,
        providerRef: dto.providerRef,
        transactionDate: dto.transactionDate
          ? new Date(dto.transactionDate)
          : new Date(),
        notes: dto.notes,
        metadata: (dto.metadata ?? {}) as any,
      },
    });

    if (providerStatus === PaymentProviderStatus.succeeded) {
      await this.syncInvoiceAndReservationPayments(invoice.id, organizationId);
    }

    return payment;
  }

  async createIntent(organizationId: string, dto: CreatePaymentIntentDto) {
    if (
      dto.method !== PaymentMethod.payhere &&
      dto.method !== PaymentMethod.stripe
    ) {
      throw new BadRequestException("Payment intent requires PayHere or Stripe");
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, property: { organizationId } },
      include: { property: true, guest: true },
    });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    const amount = Number(dto.amount);
    const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    if (amount <= 0) {
      throw new BadRequestException("Payment amount must be greater than zero");
    }
    if (amount > balance) {
      throw new BadRequestException("Payment intent exceeds invoice balance");
    }

    const providerRef = `${dto.method.toUpperCase()}-${invoice.invoiceNumber}-${Date.now()}`;
    return {
      provider: dto.method,
      providerRef,
      amount,
      currency: "LKR",
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: Number(invoice.totalAmount),
        paidAmount: Number(invoice.paidAmount),
      },
      checkoutUrl:
        dto.method === PaymentMethod.payhere
          ? this.configService.get<string>("PAYHERE_CHECKOUT_URL")
          : this.configService.get<string>("STRIPE_CHECKOUT_URL"),
      customer: {
        name: `${invoice.guest.firstName} ${invoice.guest.lastName}`,
        email: invoice.guest.email,
        phone: invoice.guest.localPhone || invoice.guest.phone,
      },
    };
  }

  private async syncInvoiceAndReservationPayments(
    invoiceId: string,
    organizationId: string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, property: { organizationId } },
    });
    if (!invoice) return;

    const aggregate = await this.prisma.payment.aggregate({
      where: {
        invoiceId,
        organizationId,
        providerStatus: PaymentProviderStatus.succeeded,
      },
      _sum: { amount: true },
    });

    const paidAmount = Number(aggregate._sum.amount ?? 0);
    const totalAmount = Number(invoice.totalAmount);
    const invoiceStatus =
      paidAmount >= totalAmount ? InvoiceStatus.paid : InvoiceStatus.issued;
    const reservationPaymentStatus =
      paidAmount >= totalAmount
        ? PaymentStatus.paid
        : paidAmount > 0
          ? PaymentStatus.partial
          : PaymentStatus.pending;

    await this.prisma.$transaction([
      this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount,
          status: invoiceStatus,
        },
      }),
      this.prisma.reservation.update({
        where: { id: invoice.reservationId },
        data: {
          paidAmount,
          paymentStatus: reservationPaymentStatus,
        },
      }),
    ]);
  }
}
