import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConversationContext, OpenAIResponse } from '../types';
import logger from '../utils/logger';
import { truncateText } from '../utils/helpers';

export class GeminiService {
  private client: GoogleGenerativeAI;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(apiKey: string, model: string = 'gemini-1.5-flash', maxTokens: number = 1000, temperature: number = 0.85) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
    this.maxTokens = maxTokens;
    this.temperature = temperature;

    logger.info(`Gemini service initialized with model: ${model}`);
  }

  async generateResponse(userMessage: string, context: ConversationContext): Promise<OpenAIResponse> {
    try {
      const messages = this.buildMessagesArray(userMessage, context);

      logger.debug('Sending request to Gemini', {
        model: this.model,
        messageCount: messages.length,
        userMessage: userMessage.substring(0, 100) + '...'
      });

      const genModel = this.client.getGenerativeModel({
        model: this.model,
        generationConfig: {
          maxOutputTokens: this.maxTokens,
          temperature: this.temperature,
        }
      });

      // Combine system prompt with conversation history
      const fullPrompt = messages.map(msg => {
        if (msg.role === 'system') {
          return `INSTRUÇÕES DO SISTEMA:\n${msg.content}\n\n`;
        } else if (msg.role === 'user') {
          return `USUÁRIO: ${msg.content}\n`;
        } else {
          return `ASSISTENTE: ${msg.content}\n`;
        }
      }).join('\n');

      const result = await genModel.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      logger.debug('Gemini response received', {
        responseLength: text.length,
      });

      return {
        content: text || 'Desculpe, não consegui gerar uma resposta.',
        usage: {
          prompt_tokens: 0, // Gemini doesn't provide detailed token usage
          completion_tokens: 0,
          total_tokens: 0,
        },
        model: this.model,
      };
    } catch (error) {
      logger.error('Gemini API error:', error);

      if (error instanceof Error) {
        if (error.message.includes('quota')) {
          throw new Error('Cota da API Gemini excedida. Entre em contato com o administrador.');
        } else if (error.message.includes('API key')) {
          throw new Error('Chave da API Gemini inválida.');
        } else if (error.message.includes('rate')) {
          throw new Error('Rate limit excedido. Tente novamente em alguns minutos.');
        }
      }

      throw new Error('Erro interno do serviço de IA. Tente novamente mais tarde.');
    }
  }

  private buildMessagesArray(userMessage: string, context: ConversationContext): Array<{role: 'system' | 'user' | 'assistant'; content: string}> {
    const systemPrompt = this.getSystemPrompt();

    const messages: Array<{role: 'system' | 'user' | 'assistant'; content: string}> = [
      { role: 'system', content: systemPrompt }
    ];

    const contextMessages = context.messages
      .slice(-8)
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: truncateText(msg.content, 500)
      }));

    messages.push(...contextMessages);

    messages.push({
      role: 'user',
      content: truncateText(userMessage, 1000)
    });

    return messages;
  }

  private getSystemPrompt(): string {
    return `Você é Sara, e você conversa pelo WhatsApp com as pessoas. Seu papo é natural, brasileiro mesmo. Tipo como você falaria com um amigo - sem essa de ficar super formal ou robótico.

Sobre seu jeito: você é útil sem ser chata, amigável sem ser falsa, direta quando precisa mas sempre de boa. Fala português brasileiro de verdade - com "tá", "pra", "cê", "né". Usa emoji quando faz sentido, não enfia em todo lugar só porque sim. E o mais importante: varia como você fala. Não fica repetindo as mesmas frases decoradas.

Quando você não sabe algo, fala na boa: "ó, isso eu não sei não" ou "hmm não tenho certeza disso". Não inventa. Se a pergunta é complexa, quebra em pedaços menores. Mantém a conversa fluindo, lembrando do que foi dito antes.

O que você faz: ajuda com dúvidas gerais, explica coisas de forma simples, bate papo de boa, faz traduções rápidas, resolve uns cálculos básicos. O que você NÃO faz: acessar links, buscar coisas na internet em tempo real, mexer com arquivos. Sua base de conhecimento tem limite de data também, então coisas muito recentes você pode não saber.

Lembra sempre: seja humana nas respostas. Varia o jeito de falar. 2-3 frases costuma ser suficiente. E sem frescura - se a pessoa tá sendo direta, você também é. Se ela tá mais na conversa, você acompanha o ritmo.`;
  }

  async analyzeImage(imageBuffer: Buffer, userMessage?: string): Promise<string> {
    try {
      const base64Image = imageBuffer.toString('base64');

      const genModel = this.client.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          maxOutputTokens: 500,
        }
      });

      const result = await genModel.generateContent([
        { text: userMessage || 'Descreva esta imagem em detalhes.' },
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg'
          }
        }
      ]);

      return result.response.text() || 'Não consegui analisar a imagem.';
    } catch (error) {
      logger.error('Error analyzing image with Gemini:', error);
      return 'Desculpe, não consegui analisar a imagem. Tente novamente.';
    }
  }

  async moderateContent(text: string): Promise<{ flagged: boolean; categories: string[] }> {
    try {
      // Gemini doesn't have a built-in moderation API like OpenAI
      // We'll do basic keyword checking
      const dangerousPatterns = [
        /violência|matar|ferir/i,
        /drogas ilegais|entorpecentes/i,
        /nudez|pornografia/i,
        /ódio|discriminação/i
      ];

      const flaggedCategories: string[] = [];
      let flagged = false;

      dangerousPatterns.forEach((pattern, index) => {
        if (pattern.test(text)) {
          flagged = true;
          flaggedCategories.push(['violence', 'drugs', 'sexual', 'hate'][index]);
        }
      });

      return {
        flagged,
        categories: flaggedCategories,
      };
    } catch (error) {
      logger.error('Content moderation error:', error);
      return { flagged: false, categories: [] };
    }
  }

  async generateSummary(messages: string[]): Promise<string> {
    try {
      const conversation = messages.join('\n');

      const genModel = this.client.getGenerativeModel({
        model: this.model,
        generationConfig: {
          maxOutputTokens: 150,
          temperature: 0.3,
        }
      });

      const result = await genModel.generateContent(
        `Você é um assistente que cria resumos concisos de conversas. Resuma esta conversa em até 100 palavras em português brasileiro:\n\n${conversation}`
      );

      return result.response.text() || 'Não foi possível gerar o resumo.';
    } catch (error) {
      logger.error('Summary generation error:', error);
      return 'Erro ao gerar resumo da conversa.';
    }
  }

  getUsageStats(): { model: string; maxTokens: number; temperature: number } {
    return {
      model: this.model,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
    };
  }
}