import dotenv from 'dotenv';
import { BotConfig } from '../types';

dotenv.config();

// Determine which AI service to use based on available API keys
// PRIORITY: OpenAI first (if available), then Gemini as fallback
const useGemini = !process.env.OPENAI_API_KEY && !!process.env.GEMINI_API_KEY;
const apiKey = useGemini ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY;
const model = useGemini ? (process.env.GEMINI_MODEL || 'gemini-1.5-flash') : (process.env.OPENAI_MODEL || 'gpt-4o-mini');

export const config: BotConfig = {
  openai: {
    apiKey: apiKey || '',
    model: model,
    maxTokens: parseInt((useGemini ? process.env.GEMINI_MAX_TOKENS : process.env.OPENAI_MAX_TOKENS) || '1000'),
    temperature: parseFloat((useGemini ? process.env.GEMINI_TEMPERATURE : process.env.OPENAI_TEMPERATURE) || '0.7'),
  },
  whatsapp: {
    sessionName: process.env.WHATSAPP_SESSION_NAME || 'sara_whatsapp_session',
    adminNumbers: process.env.ADMIN_NUMBERS?.split(',') || [],
    enableGroupResponses: process.env.ENABLE_GROUP_RESPONSES === 'true',
  },
  bot: {
    name: process.env.BOT_NAME || 'IA Assistant',
    prefix: process.env.BOT_PREFIX || '!',
    maxContextMessages: parseInt(process.env.MAX_CONTEXT_MESSAGES || '10'),
  },
  features: {
    enableMediaProcessing: process.env.ENABLE_MEDIA_PROCESSING === 'true',
    rateLimitMaxMessages: parseInt(process.env.RATE_LIMIT_MAX_MESSAGES || '10'),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  },
};

// Export AI service type for debugging
export const AI_SERVICE = useGemini ? 'GEMINI' : 'OPENAI';

export function validateConfig(): void {
  if (!config.openai.apiKey) {
    throw new Error(`${AI_SERVICE}_API_KEY is required`);
  }

  console.log(`🤖 Using AI Service: ${AI_SERVICE} (${config.openai.model})`);

  if (config.whatsapp.adminNumbers.length === 0) {
    console.warn('Warning: No admin numbers configured');
  }
}