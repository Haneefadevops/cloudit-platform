import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import type { ProductInput } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard, AdminGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get(':clientId/products')
  findProducts(@Param('clientId') clientId: string) {
    return this.ordersService.findProducts(clientId);
  }

  @Post(':clientId/products')
  createProduct(
    @Param('clientId') clientId: string,
    @Body() body: ProductInput,
  ) {
    return this.ordersService.createProduct(clientId, body);
  }

  @Put(':clientId/products/:id')
  updateProduct(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() body: ProductInput,
  ) {
    return this.ordersService.updateProduct(clientId, id, body);
  }

  @Delete(':clientId/products/:id')
  removeProduct(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.ordersService.removeProduct(clientId, id);
  }

  @Get(':clientId/orders')
  findOrders(
    @Param('clientId') clientId: string,
    @Query('status') status?: string,
  ) {
    return this.ordersService.findOrders(clientId, { status });
  }

  @Put(':clientId/orders/:id')
  updateOrderStatus(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.ordersService.updateOrderStatus(clientId, id, body.status);
  }
}
