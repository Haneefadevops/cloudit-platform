import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { StaffAlertContactsService } from './staff-alert-contacts.service';
import type { StaffAlertContactInput } from './staff-alert-contacts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/** Dashboard-managed staff alert routing — staff admins/supervisors only. */
@Controller('staff-alert-contacts')
@UseGuards(JwtAuthGuard, AdminGuard)
export class StaffAlertContactsController {
  constructor(
    private readonly contactsService: StaffAlertContactsService,
  ) {}

  private assertStaffCaller(user: { clientId?: string | null }) {
    if (user.clientId) {
      throw new ForbiddenException(
        'Alert contact management is not available to portal users',
      );
    }
  }

  @Get()
  list(@CurrentUser() user: { clientId?: string | null }) {
    this.assertStaffCaller(user);
    return this.contactsService.list();
  }

  @Post()
  create(
    @CurrentUser() user: { clientId?: string | null },
    @Body() body: StaffAlertContactInput,
  ) {
    this.assertStaffCaller(user);
    return this.contactsService.create(body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: { clientId?: string | null },
    @Param('id') id: string,
    @Body() body: StaffAlertContactInput,
  ) {
    this.assertStaffCaller(user);
    return this.contactsService.update(id, body);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: { clientId?: string | null },
    @Param('id') id: string,
  ) {
    this.assertStaffCaller(user);
    return this.contactsService.remove(id);
  }
}
