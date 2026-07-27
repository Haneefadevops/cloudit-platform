import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * Staff account management. JwtAuthGuard + AdminGuard restrict these to
 * staff admins/supervisors; the clientId check is belt-and-braces so a
 * portal user can never reach staff data even if roles change.
 */
@Controller('users/staff')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private assertStaffCaller(user: { clientId?: string | null }) {
    if (user.clientId) {
      throw new ForbiddenException('Staff management is not available to portal users');
    }
  }

  @Get()
  listStaff(@CurrentUser() user: { clientId?: string | null }) {
    this.assertStaffCaller(user);
    return this.usersService.listStaff();
  }

  @Post()
  createStaff(
    @CurrentUser() user: { clientId?: string | null },
    @Body() body: { name?: string; email?: string; password?: string; role?: string },
  ) {
    this.assertStaffCaller(user);
    return this.usersService.createStaff(body);
  }

  @Put(':id')
  updateStaff(
    @CurrentUser() user: { userId: string; clientId?: string | null },
    @Param('id') id: string,
    @Body() body: { role?: string; status?: string },
  ) {
    this.assertStaffCaller(user);
    return this.usersService.updateStaff(user.userId, id, body);
  }
}
