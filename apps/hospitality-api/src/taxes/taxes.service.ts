import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTaxRateDto } from "./dto/create-tax-rate.dto";
import { UpdateTaxRateDto } from "./dto/update-tax-rate.dto";

@Injectable()
export class TaxesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.taxRate.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findActive(organizationId: string) {
    return this.prisma.taxRate.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: string, organizationId: string) {
    const taxRate = await this.prisma.taxRate.findFirst({
      where: { id, organizationId },
    });

    if (!taxRate) {
      throw new NotFoundException("Tax rate not found");
    }

    return taxRate;
  }

  async create(organizationId: string, dto: CreateTaxRateDto) {
    return this.prisma.taxRate.create({
      data: {
        ...dto,
        organizationId,
      },
    });
  }

  async update(id: string, organizationId: string, dto: UpdateTaxRateDto) {
    await this.findOne(id, organizationId);

    return this.prisma.taxRate.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);

    return this.prisma.taxRate.delete({
      where: { id },
    });
  }
}
