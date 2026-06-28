import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { GenerateRequestDto } from './dto/generate-request.dto';
import { SummarizeRequestDto } from './dto/summarize-request.dto';

@ApiTags('ai')
@Controller('ai')
@ApiBearerAuth()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate an AI response (placeholder)' })
  async generate(@Body() dto: GenerateRequestDto) {
    const response = await this.aiService.generateResponse(dto.prompt);
    return { response };
  }

  @Post('summarize')
  @ApiOperation({ summary: 'Summarize text (placeholder)' })
  async summarize(@Body() dto: SummarizeRequestDto) {
    const summary = await this.aiService.summarizeText(dto.text);
    return { summary };
  }

  @Post('sentiment')
  @ApiOperation({ summary: 'Analyze sentiment (placeholder)' })
  async sentiment(@Body('text') text: string) {
    const sentiment = await this.aiService.analyzeSentiment(text);
    return { sentiment };
  }
}
