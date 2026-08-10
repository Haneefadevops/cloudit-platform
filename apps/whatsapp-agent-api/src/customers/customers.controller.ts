import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CustomersService } from './customers.service';

@Controller('customers')
@UseGuards(JwtAuthGuard, AdminGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get(':clientId')
  findAll(
    @Param('clientId') clientId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.customersService.findAll(clientId, categoryId);
  }

  @Put(':clientId/:id/category')
  setCategory(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() body: { categoryId: string | null },
  ) {
    return this.customersService.setCategory(clientId, id, body.categoryId);
  }
}
