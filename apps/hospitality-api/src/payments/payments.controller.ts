import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { PaymentsService } from "./payments.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";

@ApiTags("payments")
@Controller("payments")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: "List payments" })
  @ApiQuery({ name: "invoiceId", required: false })
  async findAll(
    @CurrentOrganization() organizationId: string,
    @Query("invoiceId") invoiceId?: string,
  ) {
    return this.paymentsService.findAll(organizationId, invoiceId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get payment by ID" })
  async findOne(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.paymentsService.findOne(id, organizationId);
  }

  @Post()
  @ApiOperation({ summary: "Record payment" })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.create(organizationId, dto);
  }

  @Post("intent")
  @ApiOperation({ summary: "Create PayHere or Stripe payment reference" })
  async createIntent(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return this.paymentsService.createIntent(organizationId, dto);
  }
}
