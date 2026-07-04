import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { Public } from '../common/decorators/public.decorator';
import { InternalAuthGuard } from '../common/guards/internal-auth.guard';
import { OnboardingService } from './onboarding.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';

@ApiTags('onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create organization and provision product admin' })
  create(@Body() dto: CreateOnboardingDto) {
    return this.onboardingService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List onboarding/provisioning records' })
  findAll() {
    return this.onboardingService.findAll();
  }

  @Get(':orgId')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get onboarding status by organization' })
  findOne(@Param('orgId') orgId: string) {
    return this.onboardingService.findOne(orgId);
  }

  @Post(':orgId/resend')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend onboarding invite email' })
  resend(@Param('orgId') orgId: string, @Body('product') product?: string) {
    return this.onboardingService.resend(orgId, product);
  }

  @Post(':orgId/retry')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retry a failed product provisioning call' })
  retry(@Param('orgId') orgId: string, @Body('product') product?: string) {
    return this.onboardingService.retry(orgId, product);
  }

  @Post(':orgId/revoke')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a pending onboarding invite' })
  revoke(@Param('orgId') orgId: string, @Body('product') product?: string) {
    return this.onboardingService.revoke(orgId, product);
  }

  @Public()
  @Post('internal/invite-accepted')
  @UseGuards(InternalAuthGuard)
  @ApiOperation({ summary: 'Internal: mark product invite accepted' })
  markAccepted(
    @Body()
    body: {
      platformOrgId?: string;
      orgId?: string;
      product: string;
      tenantId?: string;
      userId?: string;
      email?: string;
    },
  ) {
    return this.onboardingService.markAccepted(body);
  }
}
