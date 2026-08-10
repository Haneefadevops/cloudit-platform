import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class SocialCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async ingest(payload: unknown): Promise<void> {
    const socialPayload = payload as {
      object?: string;
      entry?: Array<{
        id?: string;
        changes?: Array<{ field?: string; value?: Record<string, any> }>;
      }>;
    };
    const channel = socialPayload.object === 'page'
      ? 'facebook'
      : socialPayload.object === 'instagram'
        ? 'instagram'
        : null;
    if (!channel) return;

    for (const entry of socialPayload.entry || []) {
      if (!entry.id) continue;
      const client = await this.prisma.client.findFirst({
        where: channel === 'facebook'
          ? { facebookPageId: entry.id }
          : { instagramAccountId: entry.id },
      });
      if (!client) continue;

      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value) continue;
        if (channel === 'facebook') {
          if (change.field !== 'feed' || value.item !== 'comment' || value.verb !== 'add') continue;
          if (value.from?.id === entry.id) continue;
          if (!value.comment_id || !value.message) continue;
          await this.storeComment({
            clientId: client.id,
            channel,
            externalId: value.comment_id,
            postId: value.post_id,
            authorName: value.from?.name,
            authorId: value.from?.id,
            text: value.message,
          });
        } else {
          if (change.field !== 'comments') continue;
          if (value.from?.id === entry.id) continue;
          if (!value.id || !value.text) continue;
          await this.storeComment({
            clientId: client.id,
            channel,
            externalId: value.id,
            postId: value.media?.id,
            authorName: value.from?.username,
            authorId: value.from?.id,
            text: value.text,
          });
        }
      }
    }
  }

  findAll(clientId: string, status?: string) {
    return this.prisma.socialComment.findMany({
      where: { clientId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reply(clientId: string, id: string, text: string) {
    const comment = await this.findOne(clientId, id);
    const suffix = comment.channel === 'facebook' ? 'comments' : 'replies';
    await this.graphPost(
      `https://graph.facebook.com/v18.0/${comment.externalId}/${suffix}`,
      comment.client.facebookPageAccessToken,
      { message: text },
    );
    return this.prisma.socialComment.update({
      where: { id: comment.id },
      data: { status: 'replied', replyText: text, repliedAt: new Date() },
    });
  }

  async dismiss(clientId: string, id: string) {
    const comment = await this.findOne(clientId, id);
    return this.prisma.socialComment.update({
      where: { id: comment.id },
      data: { status: 'dismissed' },
    });
  }

  async hide(clientId: string, id: string) {
    const comment = await this.findOne(clientId, id);
    if (comment.channel !== 'facebook') {
      throw new BadRequestException('not supported');
    }
    await this.graphPost(
      `https://graph.facebook.com/v18.0/${comment.externalId}`,
      comment.client.facebookPageAccessToken,
      { is_hidden: true },
    );
    return this.prisma.socialComment.update({
      where: { id: comment.id },
      data: { status: 'hidden' },
    });
  }

  private async storeComment(data: {
    clientId: string;
    channel: string;
    externalId: string;
    postId?: string;
    authorName?: string;
    authorId?: string;
    text: string;
  }) {
    // Dedupe on (clientId, externalId): Meta retries must not create
    // duplicates, and only a genuinely new comment gets an AI draft.
    const existing = await this.prisma.socialComment.findUnique({
      where: {
        clientId_externalId: {
          clientId: data.clientId,
          externalId: data.externalId,
        },
      },
    });
    if (existing) return;

    const comment = await this.prisma.socialComment.create({ data });

    // Best-effort AI draft — the comment stays in the queue without one
    // when drafting fails.
    const client = await this.prisma.client.findUnique({
      where: { id: data.clientId },
    });
    if (client) {
      const draft = await this.aiService.generateCommentReply({
        client: {
          name: client.name,
          systemPrompt: client.systemPrompt,
          businessProfile: client.businessProfile,
          language: client.language,
          aiModel: client.aiModel,
        },
        commentText: data.text,
        authorName: data.authorName,
      });
      if (draft) {
        await this.prisma.socialComment.update({
          where: { id: comment.id },
          data: { aiDraft: draft },
        });
      }
    }
  }

  private async findOne(clientId: string, id: string) {
    const comment = await this.prisma.socialComment.findFirst({
      where: { id, clientId },
      include: { client: true },
    });
    if (!comment) throw new NotFoundException('Social comment not found');
    return comment;
  }

  private async graphPost(url: string, token: string | null, body: Record<string, unknown>) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (response.ok) return;

    let message = `Meta Graph API error: ${response.status}`;
    try {
      const payload = await response.json() as { error?: { message?: string } };
      message = payload.error?.message || message;
    } catch {
      // Use the status fallback when Meta returns a non-JSON error.
    }
    throw new BadRequestException(message);
  }
}
