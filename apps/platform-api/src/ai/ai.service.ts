import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private async getProvider(): Promise<string> {
    const settings = await this.prisma.integrationSetting.findFirst();
    return (
      settings?.aiProvider ||
      this.configService.get<string>('AI_PROVIDER') ||
      'openai'
    );
  }

  async generateResponse(prompt: string): Promise<string> {
    this.logger.log(
      `generateResponse called with prompt length ${prompt.length}`,
    );
    const provider = await this.getProvider();
    return `[${provider}] AI response placeholder for: ${prompt}`;
  }

  async summarizeText(text: string): Promise<string> {
    this.logger.log(`summarizeText called with text length ${text.length}`);
    const provider = await this.getProvider();
    return `[${provider}] Summary placeholder for text length ${text.length}`;
  }

  async analyzeSentiment(text: string): Promise<string> {
    this.logger.log(`analyzeSentiment called with text length ${text.length}`);
    return 'neutral';
  }
}
