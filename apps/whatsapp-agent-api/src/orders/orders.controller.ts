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
import { ScopedClientId } from '../common/decorators/scoped-client-id.decorator';

// Controller-level: any authenticated user. Catalog management is staff-only
// (portal gets read access); orders list/status are portal-accessible with
// ScopedClientId forcing the portal user's own client.
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ---- Catalog (read: portal-allowed; manage: staff-only) ----

  @Get(':clientId/products')
  findProducts(@ScopedClientId() clientId: string) {
    return this.ordersService.findProducts(clientId);
  }

  @Post(':clientId/products')
  @UseGuards(AdminGuard)
  createProduct(
    @Param('clientId') clientId: string,
    @Body() body: ProductInput,
  ) {
    return this.ordersService.createProduct(clientId, body);
  }

  @Put(':clientId/products/:id')
  @UseGuards(AdminGuard)
  updateProduct(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() body: ProductInput,
  ) {
    return this.ordersService.updateProduct(clientId, id, body);
  }

  @Delete(':clientId/products/:id')
  @UseGuards(AdminGuard)
  removeProduct(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.ordersService.removeProduct(clientId, id);
  }

  // ---- Orders (portal-allowed: list + status) ----

  @Get(':clientId/orders')
  findOrders(
    @ScopedClientId() clientId: string,
    @Query('status') status?: string,
  ) {
    return this.ordersService.findOrders(clientId, { status });
  }

  @Put(':clientId/orders/:id')
  updateOrderStatus(
    @ScopedClientId() clientId: string,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.ordersService.updateOrderStatus(clientId, id, body.status);
  }
}
