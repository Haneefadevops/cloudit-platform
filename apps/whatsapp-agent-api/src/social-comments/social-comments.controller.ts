import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { ReplySocialCommentDto } from './dto/reply-social-comment.dto';
import { SocialCommentsService } from './social-comments.service';

@Controller('social-comments')
@UseGuards(JwtAuthGuard, AdminGuard)
export class SocialCommentsController {
  constructor(private readonly socialCommentsService: SocialCommentsService) {}

  @Get(':clientId')
  findAll(@Param('clientId') clientId: string, @Query('status') status?: string) {
    return this.socialCommentsService.findAll(clientId, status);
  }

  @Post(':clientId/:id/reply')
  reply(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() body: ReplySocialCommentDto,
  ) {
    return this.socialCommentsService.reply(clientId, id, body.text);
  }

  @Post(':clientId/:id/dismiss')
  dismiss(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.socialCommentsService.dismiss(clientId, id);
  }

  @Post(':clientId/:id/hide')
  hide(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.socialCommentsService.hide(clientId, id);
  }
}
