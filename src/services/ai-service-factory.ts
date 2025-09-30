import { OpenAIService } from './openai';
import { GeminiService } from './gemini';
import { config, AI_SERVICE } from '../config';
import logger from '../utils/logger';

// Interface comum para ambos os serviços
export interface AIService {
  generateResponse(userMessage: string, context: any): Promise<any>;
  analyzeImage(imageBuffer: Buffer, userMessage?: string): Promise<string>;
  moderateContent(text: string): Promise<{ flagged: boolean; categories: string[] }>;
  generateSummary(messages: string[]): Promise<string>;
  getUsageStats(): { model: string; maxTokens: number; temperature: number };
}

/**
 * Factory que cria o serviço de IA correto baseado na configuração
 */
export function createAIService(): AIService {
  const { apiKey, model, maxTokens, temperature } = config.openai;

  if (!apiKey) {
    throw new Error(`${AI_SERVICE}_API_KEY is required in environment variables`);
  }

  if (AI_SERVICE === 'GEMINI') {
    logger.info('🤖 Using Gemini AI Service');
    return new GeminiService(apiKey, model, maxTokens, temperature) as unknown as AIService;
  } else {
    logger.info('🤖 Using OpenAI Service');
    return new OpenAIService(apiKey, model, maxTokens, temperature) as unknown as AIService;
  }
}