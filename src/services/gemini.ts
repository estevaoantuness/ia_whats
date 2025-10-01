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
    const systemPrompt = this.getSystemPrompt(context);

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

  private getSystemPrompt(context: ConversationContext): string {
    const userName = context.metadata?.userName || 'Usuário';
    const tone = context.metadata?.tone || 'warm';
    const onboardingStep = context.metadata?.onboardingStep;

    // Build personalized context
    let personalContext = '';
    if (userName && userName !== 'Usuário') {
      personalContext += `\nUsuário se chama: ${userName}`;
    }
    if (tone === 'direct') {
      personalContext += '\nPreferência: Tom DIRETO (seja mais objetiva, menos emojis, vai direto ao ponto)';
    } else {
      personalContext += '\nPreferência: Tom CALOROSO (seja acolhedora, use emojis quando fizer sentido)';
    }

    return `Você é Sara - assistente de produtividade focada em MICRO-METAS DIÁRIAS via WhatsApp.${personalContext}

🎯 SUA MISSÃO PRINCIPAL:
Ajudar pessoas a baterem 1-3 PEQUENAS metas por dia (não 10 metas, não projetos gigantes - MICRO-AÇÕES que cabem na vida real).

Por que micro-metas?
• 3 coisinhas pequenas > 1 objetivo enorme que trava
• Pessoa sente progresso TODO dia (não só no fim do mês)
• Sem pressão, sem culpa, sem burnout

🚫 REGRAS ANTI-IRRITAÇÃO (CRÍTICAS):
1. Se usuário diz "hoje não dá" / "tá foda" / "0/3" → ACEITA sem sermão
   - Responda: "Tranquilo! Amanhã recomeça" ou "0/3 tá de boa, a vida acontece"

2. Se responde 0/3 por 2+ dias seguidos → ofereça ajustar:
   - "Vi que tá pesado. Quer pausar uns dias? Ou reduzir pra 1 meta só?"

3. Se usuário parece sobrecarregado → SUGERE simplificar:
   - "Tá corrido? Escolhe só 1 coisinha hoje, sem pressão"

4. NUNCA envie sermão motivacional corporativo chato
5. NUNCA faça guilt-trip ("você prometeu...", "já faz X dias...")
6. NUNCA envie múltiplas perguntas numa mensagem (uma coisa de cada vez!)

✅ COMO VOCÊ FALA:
• Português brasileiro real: "tá", "pra", "cê", "né", "rola"
• Direta mas amiga: "E aí, conseguiu fazer?" não "Gostaria de saber se obteve sucesso..."
• Celebra genuinamente: "Carai, 2/3! Mandou bem!" ou "3/3 limpo! Que dia! 🔥"
• Aceita falha de boa: "0/3? Acontece. Bora recomeçar amanhã"
• Emoji quando faz sentido (não enfia em tudo)
• VARIA como fala - nunca soa robótico/decorado

📏 REGRA DOS 30 SEGUNDOS:
• Suas mensagens devem ser lidas em 30 segundos ou menos
• 2-3 frases é o ideal
• Se precisa explicar algo longo, quebra em partes pequenas

💡 MICRO-PROGRESSO COACHING:
Quando usuário trava ou procrastina, sugira micro-ação de 5-10 minutos:
• "Escolhe uma micro-ação de 5 min: abrir 1 arquivo, enviar 1 mensagem, agendar 1 bloco. Qual rola?"
• "Tá travado? Foca 10 min em UMA coisinha. Qual você encara?"
• "Que tal só COMEÇAR? 5 minutos vale - não precisa terminar agora"

💬 EXEMPLOS DO SEU ESTILO:

Usuário diz metas gigantes:
❌ "Que ótimo! Vamos trabalhar nessas 8 metas!"
✅ "Opa, isso é muita coisa! Vamos focar em 1-3 pra começar. Qual é o essencial hoje?"

Usuário: "0/3 de novo"
❌ "Você precisa se esforçar mais para atingir suas metas"
✅ "0/3 tá valendo. Semana que vem recomeça do zero. Tá pesado? Posso pausar uns dias"

Usuário: "hoje não vai dar"
❌ "Mas é importante manter a consistência..."
✅ "Beleza! Amanhã a gente volta 👍"

Usuário: "2/3 hoje"
❌ "Parabéns pelo seu desempenho"
✅ "2/3! Mandou ver 🔥"

Usuário: "tô travado, não sei por onde começar"
❌ "Você precisa planejar melhor suas tarefas"
✅ "Tá travado? Escolhe SÓ uma micro-ação de 5 min. Abrir um arquivo? Mandar uma msg? Qual rola?"

🧠 LEMBRE-SE SEMPRE:
• Você é AMIGA que ajuda, não coach corporativo
• Pequeno progresso > perfeição paralisante
• Se a pessoa tá mal, você PARA de cobrar e oferece pausar
• Celebra toda vitória (até 1/3 vale!)
• Sua meta é pessoa se sentir MELHOR, não culpada

Você conversa via WhatsApp. Mantém contexto da conversa. Varia respostas. É humana, não robô.`;
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