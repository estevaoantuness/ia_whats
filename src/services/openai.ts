import OpenAI from 'openai';
import { ConversationContext, OpenAIResponse } from '../types';
import logger from '../utils/logger';
import { truncateText } from '../utils/helpers';

export class OpenAIService {
  private client: OpenAI;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private assistantId: string | null = null;
  private threadStore = new Map<string, string>(); // Store thread IDs per user

  constructor(apiKey: string, model: string = 'gpt-4o-mini', maxTokens: number = 1000, temperature: number = 0.85) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.maxTokens = maxTokens;
    this.temperature = temperature;

    logger.info(`OpenAI service initialized with model: ${model}`);
    this.initializeSaraAssistant();
  }

  async generateResponse(userMessage: string, context: ConversationContext): Promise<OpenAIResponse> {
    try {
      // If Sara assistant is available, use it; otherwise fallback to chat completion
      if (this.assistantId && context.userId) {
        return await this.generateAssistantResponse(userMessage, context.userId);
      } else {
        return await this.generateChatResponse(userMessage, context);
      }
    } catch (error) {
      logger.error('OpenAI API error:', error);

      // Fallback to chat completion if assistant fails
      if (this.assistantId) {
        logger.warn('Assistant failed, falling back to chat completion');
        return await this.generateChatResponse(userMessage, context);
      }

      if (error instanceof Error) {
        if (error.message.includes('rate_limit_exceeded')) {
          throw new Error('Rate limit excedido. Tente novamente em alguns minutos.');
        } else if (error.message.includes('insufficient_quota')) {
          throw new Error('Cota da API OpenAI excedida. Entre em contato com o administrador.');
        } else if (error.message.includes('invalid_api_key')) {
          throw new Error('Chave da API OpenAI inválida.');
        }
      }

      throw new Error('Erro interno do serviço de IA. Tente novamente mais tarde.');
    }
  }

  private async generateAssistantResponse(userMessage: string, userId: string): Promise<OpenAIResponse> {
    try {
      // Get or create thread for this user
      let threadId = this.threadStore.get(userId);
      if (!threadId) {
        const thread = await this.client.beta.threads.create();
        threadId = thread.id;
        this.threadStore.set(userId, threadId);
        logger.debug(`Created new thread ${threadId} for user ${userId}`);
      }

      // Add user message to thread
      await this.client.beta.threads.messages.create(threadId, {
        role: 'user',
        content: userMessage
      });

      // Run the assistant
      const run = await this.client.beta.threads.runs.create(threadId, {
        assistant_id: this.assistantId!,
      });

      // Wait for completion
      let runStatus = await this.client.beta.threads.runs.retrieve(run.id, { thread_id: threadId });
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout

      while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await this.client.beta.threads.runs.retrieve(run.id, { thread_id: threadId });
        attempts++;

        if (attempts >= maxAttempts) {
          throw new Error('Assistant response timeout');
        }
      }

      if (runStatus.status === 'completed') {
        // Get the assistant's response
        const messages = await this.client.beta.threads.messages.list(threadId);
        const assistantMessages = messages.data.filter(msg =>
          msg.role === 'assistant' && msg.run_id === run.id
        );

        if (assistantMessages.length > 0) {
          const content = assistantMessages[0].content[0];
          const responseText = content.type === 'text' ? content.text.value : 'Resposta não textual recebida.';

          logger.debug('Sara assistant response received', {
            responseLength: responseText.length,
            threadId,
            runId: run.id
          });

          return {
            content: responseText,
            usage: {
              prompt_tokens: runStatus.usage?.prompt_tokens || 0,
              completion_tokens: runStatus.usage?.completion_tokens || 0,
              total_tokens: runStatus.usage?.total_tokens || 0,
            },
            model: 'sara-assistant',
          };
        }
      } else if (runStatus.status === 'requires_action') {
        // Handle function calls if needed
        logger.warn('Assistant requires action - function calls not implemented yet');
        throw new Error('Function calls not implemented');
      } else {
        logger.error('Assistant run failed', { status: runStatus.status, lastError: runStatus.last_error });
        throw new Error(`Assistant run failed: ${runStatus.status}`);
      }

      throw new Error('No assistant response received');
    } catch (error) {
      logger.error('Sara assistant error:', error);
      throw error;
    }
  }

  private async generateChatResponse(userMessage: string, context: ConversationContext): Promise<OpenAIResponse> {
    const messages = this.buildMessagesArray(userMessage, context);

    logger.debug('Sending request to OpenAI Chat', {
      model: this.model,
      messageCount: messages.length,
      userMessage: userMessage.substring(0, 100) + '...'
    });

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      stream: false,
    });

    const response = completion.choices[0]?.message?.content || 'Desculpe, não consegui gerar uma resposta.';
    const usage = completion.usage;

    logger.debug('OpenAI chat response received', {
      responseLength: response.length,
      tokensUsed: usage?.total_tokens || 0
    });

    return {
      content: response,
      usage: {
        prompt_tokens: usage?.prompt_tokens || 0,
        completion_tokens: usage?.completion_tokens || 0,
        total_tokens: usage?.total_tokens || 0,
      },
      model: this.model,
    };
  }

  private async initializeSaraAssistant(): Promise<void> {
    try {
      // Try to find existing Sara assistant
      const assistants = await this.client.beta.assistants.list({ limit: 100 });
      let saraAssistant = assistants.data.find(a =>
        a.name === 'Sara - Assistente de Produtividade'
      );

      if (!saraAssistant) {
        // Create Sara assistant if it doesn't exist
        logger.info('Creating Sara assistant...');
        saraAssistant = await this.createSaraAssistant();
      }

      this.assistantId = saraAssistant.id;
      logger.info(`Sara assistant initialized: ${this.assistantId}`);
    } catch (error) {
      logger.warn('Failed to initialize Sara assistant, will use chat completion fallback:', error);
    }
  }

  private async createSaraAssistant(): Promise<OpenAI.Beta.Assistants.Assistant> {
    const assistantConfig = {
      name: "Sara - Assistente de Produtividade",
      description: "Assistente brasileira especializada em produtividade pessoal através de metas diárias, check-ins personalizados e acompanhamento empático.",
      instructions: `Você é Sara. Brasileira, 28 anos, mora em São Paulo, trabalhou como psicóloga organizacional antes de se tornar coach de produtividade. Aprendeu que aquela cultura tóxica de "trabalhe até cair" só adoece as pessoas. Então hoje você ajuda gente normal a focar no que importa sem neuras.

Seu jeito é assim: calorosa mas real. Não fica fingindo que tá tudo perfeito quando não tá. Se a pessoa tá tendo uma semana difícil, você reconhece isso e sugere começar com algo pequeno ao invés de enfiar 10 metas goela abaixo. Você sabe que todo mundo tem dias ruins e que tá tudo bem.

Como você fala: brasileiro mesmo, sem formalidade desnecessária. "Oi" ao invés de "Olá", "tá" ao invés de "está", "pra" ao invés de "para", "cê" às vezes. Usa "né?" no fim das frases de vez em quando. Fala "bora" quando tá animando alguém. De vez em quando solta um "ó" ou "então". Não enche de emoji - usa com moderação, quando faz sentido mesmo. E varia as respostas, pelo amor, nada de ficar repetindo as mesmas frases.

Sobre check-ins: de manhã você pergunta as 1-3 metas do dia (se a pessoa só consegue 1 naquele dia, beleza). No meio do dia, pergunta como tá indo (mas tipo, casual). À noite, pergunta o placar - quantas metas saíram. E o mais importante: quando a pessoa fala que fez 0/3, você acolhe. "Dias assim acontecem" ou "tá tudo bem, amanhã recomeça" ou "que tal escolher só 1 meta pequena pra amanhã?". Zero de culpa. ZERO.

Quando a pessoa arrasa (tipo 3/3), você celebra mas sem exagero. "Boa!" ou "arrasou hoje hein" ou "adorei! como tá se sentindo?". Celebra mas não vira porra-louca com confete virtual.

Adapte-se ao ritmo da pessoa. Se ela responde sempre curto e direto, você também encurta. Se ela é mais falante, você pode alongar um pouco. Se ela usa emoji pra caramba, você usa mais. Se ela é seca, você também fica mais direta.

Coisas que você NUNCA faz: não cobra, não julga, não fica "ain você prometeu", não faz gracinha irritante, não repete a mesma frase decorada 50 vezes. Varia. Suas expressões. Seja humana.

Comandos que eles podem usar contigo: PAUSAR X (você fica X horas em silêncio), TOM DIRETO ou TOM CALOROSO (você ajusta como fala), HORÁRIO hh:mm (muda hora dos check-ins), SILENCIAR FDS (não manda nada fim de semana), MEIO-DIA ON/OFF (ativa ou desativa check-in do meio-dia).

Lembra: você tá do lado delas, não contra. Progresso > perfeição. Sempre. E por favor, varia as respostas. Não seja robô repetindo script. Você é gente.`,
      model: "gpt-4o-mini",
      tools: [] as any[],
      temperature: 0.85,
    };

    return await this.client.beta.assistants.create(assistantConfig);
  }

  private buildMessagesArray(userMessage: string, context: ConversationContext): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const systemPrompt = this.getSystemPrompt();

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
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

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userMessage || 'Descreva esta imagem em detalhes.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ];

      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 500,
      });

      return completion.choices[0]?.message?.content || 'Não consegui analisar a imagem.';
    } catch (error) {
      logger.error('Error analyzing image:', error);
      return 'Desculpe, não consegui analisar a imagem. Tente novamente.';
    }
  }

  async moderateContent(text: string): Promise<{ flagged: boolean; categories: string[] }> {
    try {
      const moderation = await this.client.moderations.create({
        input: text,
      });

      const result = moderation.results[0];
      if (!result) {
        return { flagged: false, categories: [] };
      }

      const flaggedCategories = Object.entries(result.categories || {})
        .filter(([_, flagged]) => flagged)
        .map(([category, _]) => category);

      return {
        flagged: result.flagged || false,
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

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente que cria resumos concisos de conversas. Crie um resumo em português brasileiro.'
          },
          {
            role: 'user',
            content: `Resuma esta conversa em até 100 palavras:\n\n${conversation}`
          }
        ],
        max_tokens: 150,
        temperature: 0.3,
      });

      return completion.choices[0]?.message?.content || 'Não foi possível gerar o resumo.';
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