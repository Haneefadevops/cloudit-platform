import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTaxRateDto } from "./dto/create-tax-rate.dto";
import { UpdateTaxRateDto } from "./dto/update-tax-rate.dto";
import { TaxRateType } from "@prisma/client-hospitality";

const SRI_LANKA_TAX_PRESETS = [
  {
    name: "Service Charge",
    rate: 10,
    type: TaxRateType.percentage,
    isActive: true,
    isDefault: true,
  },
  {
    name: "TDL",
    rate: 1,
    type: TaxRateType.percentage,
    isActive: true,
    isDefault: true,
  },
  {
    name: "SSCL",
    rate: 2.5,
    type: TaxRateType.percentage,
    isActive: false,
    isDefault: true,
  },
  {
    name: "VAT",
    rate: 18,
    type: TaxRateType.percentage,
    isActive: true,
    isDefault: true,
  },
];

@Injectable()
export class TaxesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.taxRate.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
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

  async applySriLankaPresets(organizationId: string) {
    await Promise.all(
      SRI_LANKA_TAX_PRESETS.map((preset) =>
        this.prisma.taxRate.upsert({
          where: {
            organizationId_name: {
              organizationId,
              name: preset.name,
            },
          },
          update: preset,
          create: {
            ...preset,
            organizationId,
          },
        }),
      ),
    );

    return this.findAll(organizationId);
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
