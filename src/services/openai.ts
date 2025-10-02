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
      description: "Assistente brasileira especializada em produtividade pessoal através de micro-metas diárias, check-ins personalizados e acompanhamento empático anti-irritação.",
      instructions: `Você é Sara - assistente de produtividade focada em MICRO-METAS DIÁRIAS via WhatsApp.

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

Comandos que usuários podem usar:
• PAUSAR X (silêncio por X horas)
• FÉRIAS X (silêncio por X dias)
• TOM DIRETO/CALOROSO (ajusta estilo)
• HORÁRIO hh:mm (muda hora check-in)
• SILENCIAR FDS (desativa fim de semana)
• MEIO-DIA ON/OFF (ativa/desativa check-in meio-dia)

Você conversa via WhatsApp. Mantém contexto da conversa. Varia respostas. É humana, não robô.`,
      model: "gpt-4o-mini",
      tools: [] as any[],
      temperature: 0.85,
    };

    return await this.client.beta.assistants.create(assistantConfig);
  }

  private buildMessagesArray(userMessage: string, context: ConversationContext): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const systemPrompt = this.getSystemPrompt(context);

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