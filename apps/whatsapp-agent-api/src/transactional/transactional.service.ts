import { BadGatewayException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppSenderService } from '../whatsapp-sender/whatsapp-sender.service';
import { SendTransactionalMessageDto } from './dto/send-transactional-message.dto';

@Injectable()
export class TransactionalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappSenderService: WhatsAppSenderService,
  ) {}

  async send(clientId: string, apiKeyId: string, dto: SendTransactionalMessageDto) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.status !== 'active') throw new ForbiddenException();

    try {
      await this.whatsappSenderService.sendTemplate({
        client,
        to: dto.to,
        templateName: dto.templateName,
        parameters: dto.parameters,
        languageCode: dto.languageCode,
      });
      const message = await this.prisma.transactionalMessage.create({
        data: {
          clientId,
          apiKeyId,
          to: dto.to,
          templateName: dto.templateName,
          languageCode: dto.languageCode || 'en',
          status: 'sent',
        },
      });
      return { id: message.id, status: 'sent' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send template';
      await this.prisma.transactionalMessage.create({
        data: {
          clientId,
          apiKeyId,
          to: dto.to,
          templateName: dto.templateName,
          languageCode: dto.languageCode || 'en',
          status: 'failed',
          error: message,
        },
      });
      throw new BadGatewayException(message);
    }
  }

  async createApiKey(clientId: string, name: string) {
    const key = `trk_${randomBytes(16).toString('hex')}`;
    const prefix = key.slice(0, 12);
    const keyHash = createHash('sha256').update(key).digest('hex');
    const apiKey = await this.prisma.apiKey.create({
      data: { clientId, name, prefix, keyHash },
    });
    return { id: apiKey.id, name: apiKey.name, prefix: apiKey.prefix, key };
  }

  listApiKeys(clientId: string) {
    return this.prisma.apiKey.findMany({
      where: { clientId },
      select: { id: true, name: true, prefix: true, lastUsedAt: true, revokedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeApiKey(clientId: string, id: string) {
    const revokedAt = new Date();
    const result = await this.prisma.apiKey.updateMany({
      where: { id, clientId },
      data: { revokedAt },
    });
    if (result.count === 0) throw new NotFoundException();
    return { id, revokedAt };
  }
}
