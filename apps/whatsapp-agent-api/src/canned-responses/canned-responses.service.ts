import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CannedResponsesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeShortcut(shortcut: string): string {
    return shortcut.trim().replace(/^\/+/, '').toLowerCase();
  }

  findAll(clientId: string) {
    return this.prisma.cannedResponse.findMany({
      where: { clientId },
      orderBy: { shortcut: 'asc' },
    });
  }

  create(
    clientId: string,
    data: { shortcut: string; title: string; content: string },
  ) {
    return this.prisma.cannedResponse.create({
      data: {
        clientId,
        shortcut: this.normalizeShortcut(data.shortcut),
        title: data.title,
        content: data.content,
      },
    });
  }

  update(
    clientId: string,
    id: string,
    data: { shortcut?: string; title?: string; content?: string },
  ) {
    return this.prisma.cannedResponse.update({
      where: { id, clientId },
      data: {
        ...(data.shortcut
          ? { shortcut: this.normalizeShortcut(data.shortcut) }
          : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
      },
    });
  }

  remove(clientId: string, id: string) {
    return this.prisma.cannedResponse.delete({
      where: { id, clientId },
    });
  }
}
