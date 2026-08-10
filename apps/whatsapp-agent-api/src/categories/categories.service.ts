import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(clientId: string) {
    return this.prisma.customerCategory.findMany({
      where: { clientId },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(clientId: string, data: CreateCategoryDto) {
    return this.prisma.customerCategory.create({ data: { clientId, ...data } });
  }

  async update(clientId: string, id: string, data: UpdateCategoryDto) {
    await this.findOne(clientId, id);
    return this.prisma.customerCategory.update({ where: { id }, data });
  }

  async remove(clientId: string, id: string) {
    await this.findOne(clientId, id);
    return this.prisma.customerCategory.delete({ where: { id } });
  }

  private async findOne(clientId: string, id: string) {
    const category = await this.prisma.customerCategory.findFirst({
      where: { id, clientId },
    });
    if (!category) throw new NotFoundException('Customer category not found');
    return category;
  }
}
