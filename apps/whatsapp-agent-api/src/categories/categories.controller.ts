import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
@UseGuards(JwtAuthGuard, AdminGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get(':clientId')
  findAll(@Param('clientId') clientId: string) {
    return this.categoriesService.findAll(clientId);
  }

  @Post(':clientId')
  create(@Param('clientId') clientId: string, @Body() body: CreateCategoryDto) {
    return this.categoriesService.create(clientId, body);
  }

  @Put(':clientId/:id')
  update(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(clientId, id, body);
  }

  @Delete(':clientId/:id')
  remove(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.categoriesService.remove(clientId, id);
  }
}
