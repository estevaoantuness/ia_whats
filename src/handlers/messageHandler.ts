import { WhatsAppMessage, BotConfig } from '../types';
import { WhatsAppService } from '../services/whatsapp';
import { OpenAIService } from '../services/openai';
import { ContextManager } from '../services/contextManager';
import { RateLimiter } from '../utils/rateLimiter';
import { extractCommand, isAdminUser } from '../utils/helpers';
import logger from '../utils/logger';

export class MessageHandler {
  private whatsappService: WhatsAppService;
  private openaiService: OpenAIService;
  private contextManager: ContextManager;
  private rateLimiter: RateLimiter;
  private config: BotConfig;

  constructor(
    whatsappService: WhatsAppService,
    openaiService: OpenAIService,
    contextManager: ContextManager,
    rateLimiter: RateLimiter,
    config: BotConfig
  ) {
    this.whatsappService = whatsappService;
    this.openaiService = openaiService;
    this.contextManager = contextManager;
    this.rateLimiter = rateLimiter;
    this.config = config;
  }

  async handleMessage(message: WhatsAppMessage): Promise<void> {
    try {
      logger.info('Processing message', {
        from: message.from,
        isGroup: message.isGroup,
        messageLength: message.text.length
      });

      if (this.shouldIgnoreMessage(message)) {
        return;
      }

      await this.whatsappService.markAsRead(message.from, message.id);

      if (await this.rateLimiter.isRateLimited(message.from)) {
        await this.handleRateLimitExceeded(message);
        return;
      }

      await this.whatsappService.setPresence('composing');

      const commandResult = extractCommand(message.text, this.config.bot.prefix);
      if (commandResult) {
        await this.handleCommand(message, commandResult.command, commandResult.args);
      } else {
        await this.handleRegularMessage(message);
      }

    } catch (error) {
      logger.error('Error handling message:', error);
      await this.sendErrorMessage(message.from);
    } finally {
      await this.whatsappService.setPresence('available');
    }
  }

  private shouldIgnoreMessage(message: WhatsAppMessage): boolean {
    if (message.isGroup && !this.config.whatsapp.enableGroupResponses) {
      return true;
    }

    if (message.text.trim().length === 0 && !message.mediaType) {
      return true;
    }

    return false;
  }

  private async handleCommand(message: WhatsAppMessage, command: string, args: string[]): Promise<void> {
    logger.info(`Command received: ${command}`, { from: message.from, args });

    switch (command) {
      case 'help':
        await this.handleHelpCommand(message);
        break;

      case 'clear':
        await this.handleClearCommand(message);
        break;

      case 'status':
        await this.handleStatusCommand(message);
        break;

      case 'stats':
        if (isAdminUser(message.from, this.config.whatsapp.adminNumbers)) {
          await this.handleStatsCommand(message);
        } else {
          await this.whatsappService.sendMessage(message.from, '❌ Comando disponível apenas para administradores.');
        }
        break;

      case 'ping':
        await this.whatsappService.sendMessage(message.from, '🏓 Pong! Bot está funcionando normalmente.');
        break;

      default:
        await this.whatsappService.sendMessage(
          message.from,
          `❓ Comando desconhecido: "${command}"\n\nUse ${this.config.bot.prefix}help para ver os comandos disponíveis.`
        );
        break;
    }
  }

  private async handleRegularMessage(message: WhatsAppMessage): Promise<void> {
    try {
      const context = await this.contextManager.getContext(message.from);
      await this.contextManager.addMessage(message.from, 'user', message.text);

      if (message.mediaType === 'image') {
        await this.whatsappService.sendMessage(
          message.from,
          '🖼️ Recebi sua imagem! No momento não consigo analisar imagens, mas posso ajudar com texto.'
        );
        return;
      }

      const moderation = await this.openaiService.moderateContent(message.text);
      if (moderation.flagged) {
        logger.warn('Flagged content detected', { from: message.from, categories: moderation.categories });
        await this.whatsappService.sendMessage(
          message.from,
          '⚠️ Sua mensagem contém conteúdo inadequado. Por favor, mantenha a conversa respeitosa.'
        );
        return;
      }

      const response = await this.openaiService.generateResponse(message.text, context);
      await this.contextManager.addMessage(message.from, 'assistant', response.content);

      await this.whatsappService.sendMessage(message.from, response.content);

      logger.info('Response sent', {
        from: message.from,
        responseLength: response.content.length,
        tokensUsed: response.usage.total_tokens
      });

    } catch (error) {
      logger.error('Error in regular message handling:', error);

      if (error instanceof Error) {
        if (error.message.includes('Rate limit') || error.message.includes('Cota')) {
          await this.whatsappService.sendMessage(
            message.from,
            '⏱️ O serviço está temporariamente sobrecarregado. Tente novamente em alguns minutos.'
          );
        } else {
          await this.sendErrorMessage(message.from);
        }
      } else {
        await this.sendErrorMessage(message.from);
      }
    }
  }

  private async handleHelpCommand(message: WhatsAppMessage): Promise<void> {
    const helpText = `🤖 **${this.config.bot.name} - Ajuda**

**📱 Como usar:**
• Envie qualquer mensagem para conversar comigo
• Use comandos com o prefixo "${this.config.bot.prefix}"

**🎯 Comandos disponíveis:**
• ${this.config.bot.prefix}help - Mostra esta ajuda
• ${this.config.bot.prefix}clear - Limpa o histórico da conversa
• ${this.config.bot.prefix}status - Mostra informações do bot
• ${this.config.bot.prefix}ping - Testa se o bot está funcionando

**💡 Dicas:**
• Mantenha mensagens claras e objetivas
• O bot lembra do contexto da conversa
• Seja respeitoso nas interações

**⚠️ Limitações:**
• Limite de ${this.config.features.rateLimitMaxMessages} mensagens por minuto
• Não posso processar imagens no momento
• Não tenho acesso à internet em tempo real

Precisa de mais ajuda? Fale com o administrador!`;

    await this.whatsappService.sendMessage(message.from, helpText);
  }

  private async handleClearCommand(message: WhatsAppMessage): Promise<void> {
    await this.contextManager.clearContext(message.from);
    await this.whatsappService.sendMessage(
      message.from,
      '🗑️ Histórico da conversa limpo! Podemos começar uma nova conversa.'
    );
  }

  private async handleStatusCommand(message: WhatsAppMessage): Promise<void> {
    const connectionInfo = this.whatsappService.getConnectionInfo();
    const contextSummary = await this.contextManager.getContextSummary(message.from);
    const remainingMessages = await this.rateLimiter.getRemainingMessages(message.from);

    const statusText = `📊 **Status do Bot**

**🔌 Conexão:** ${connectionInfo.connected ? '✅ Conectado' : '❌ Desconectado'}
**🤖 Modelo:** ${this.openaiService.getUsageStats().model}
**💬 Mensagens restantes:** ${remainingMessages}

${contextSummary}

**ℹ️ Bot funcionando normalmente!**`;

    await this.whatsappService.sendMessage(message.from, statusText);
  }

  private async handleStatsCommand(message: WhatsAppMessage): Promise<void> {
    const globalStats = await this.contextManager.getGlobalStats();
    const connectionInfo = this.whatsappService.getConnectionInfo();

    const statsText = `📈 **Estatísticas do Sistema**

**👥 Usuários ativos:** ${globalStats.activeContexts}
**💬 Total de mensagens:** ${globalStats.totalMessages}
**📊 Média por usuário:** ${globalStats.avgMessagesPerContext}
**🔄 Tentativas de reconexão:** ${connectionInfo.reconnectAttempts}

**🕒 Uptime:** ${process.uptime().toFixed(0)}s
**💾 Memória:** ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB

**🎯 Configurações:**
• Rate limit: ${this.config.features.rateLimitMaxMessages}/min
• Contexto máximo: ${this.config.bot.maxContextMessages} msgs
• Grupos: ${this.config.whatsapp.enableGroupResponses ? 'Habilitado' : 'Desabilitado'}`;

    await this.whatsappService.sendMessage(message.from, statsText);
  }

  private async handleRateLimitExceeded(message: WhatsAppMessage): Promise<void> {
    const timeUntilReset = await this.rateLimiter.getTimeUntilReset(message.from);
    const minutesLeft = Math.ceil(timeUntilReset / 60000);

    await this.whatsappService.sendMessage(
      message.from,
      `⏱️ Você atingiu o limite de mensagens.\n\nTente novamente em ${minutesLeft} minuto${minutesLeft > 1 ? 's' : ''}.`
    );
  }

  private async sendErrorMessage(to: string): Promise<void> {
    await this.whatsappService.sendMessage(
      to,
      '❌ Ops! Algo deu errado. Tente novamente em alguns instantes.\n\nSe o problema persistir, entre em contato com o administrador.'
    );
  }
}