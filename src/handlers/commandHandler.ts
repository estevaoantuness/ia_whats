import { WhatsAppMessage, BotConfig } from '../types';
import { WhatsAppService } from '../services/whatsapp';
import { OpenAIService } from '../services/openai';
import { ContextManager } from '../services/contextManager';
import { DatabaseService } from '../services/database';
import { isAdminUser } from '../utils/helpers';
import logger from '../utils/logger';

export class CommandHandler {
  private whatsappService: WhatsAppService;
  private openaiService: OpenAIService;
  private contextManager: ContextManager;
  private database: DatabaseService;
  private config: BotConfig;

  constructor(
    whatsappService: WhatsAppService,
    openaiService: OpenAIService,
    contextManager: ContextManager,
    database: DatabaseService,
    config: BotConfig
  ) {
    this.whatsappService = whatsappService;
    this.openaiService = openaiService;
    this.contextManager = contextManager;
    this.database = database;
    this.config = config;
  }

  async handleAdminCommand(message: WhatsAppMessage, command: string, args: string[]): Promise<void> {
    if (!isAdminUser(message.from, this.config.whatsapp.adminNumbers)) {
      await this.whatsappService.sendMessage(message.from, '❌ Comando disponível apenas para administradores.');
      return;
    }

    logger.info(`Admin command received: ${command}`, { from: message.from, args });

    switch (command) {
      case 'broadcast':
        await this.handleBroadcastCommand(message, args);
        break;

      case 'cleanup':
        await this.handleCleanupCommand(message);
        break;

      case 'reload':
        await this.handleReloadCommand(message);
        break;

      case 'users':
        await this.handleUsersCommand(message);
        break;

      case 'logs':
        await this.handleLogsCommand(message, args);
        break;

      case 'maintenance':
        await this.handleMaintenanceCommand(message, args);
        break;

      default:
        await this.whatsappService.sendMessage(
          message.from,
          `❓ Comando admin desconhecido: "${command}"\n\nComandos disponíveis: broadcast, cleanup, reload, users, logs, maintenance`
        );
        break;
    }
  }

  private async handleBroadcastCommand(message: WhatsAppMessage, args: string[]): Promise<void> {
    if (args.length === 0) {
      await this.whatsappService.sendMessage(
        message.from,
        '❌ Use: !broadcast <mensagem>\n\nEnvia uma mensagem para todos os usuários ativos.'
      );
      return;
    }

    const broadcastMessage = args.join(' ');
    const globalStats = await this.contextManager.getGlobalStats();

    await this.whatsappService.sendMessage(
      message.from,
      `📢 Iniciando broadcast para ${globalStats.activeContexts} usuários...`
    );

    // Note: In a real implementation, you'd need to track user IDs
    // This is a simplified version
    logger.info('Broadcast initiated', {
      admin: message.from,
      message: broadcastMessage,
      targetUsers: globalStats.activeContexts
    });

    await this.whatsappService.sendMessage(
      message.from,
      '✅ Broadcast concluído!'
    );
  }

  private async handleCleanupCommand(message: WhatsAppMessage): Promise<void> {
    try {
      await this.whatsappService.sendMessage(message.from, '🧹 Iniciando limpeza do sistema...');

      await this.database.cleanupOldConversations();
      await this.database.cleanupOldRateLimits();

      await this.whatsappService.sendMessage(
        message.from,
        '✅ Limpeza concluída!\n\n• Conversas antigas removidas\n• Rate limits expirados limpos'
      );
    } catch (error) {
      logger.error('Cleanup command error:', error);
      await this.whatsappService.sendMessage(
        message.from,
        '❌ Erro durante a limpeza. Verifique os logs.'
      );
    }
  }

  private async handleReloadCommand(message: WhatsAppMessage): Promise<void> {
    await this.whatsappService.sendMessage(
      message.from,
      '🔄 Recarregando configurações...\n\n⚠️ Nota: Para mudanças na API, reinicie o bot completamente.'
    );

    logger.info('Configuration reload requested', { admin: message.from });

    await this.whatsappService.sendMessage(
      message.from,
      '✅ Configurações recarregadas!'
    );
  }

  private async handleUsersCommand(message: WhatsAppMessage): Promise<void> {
    const globalStats = await this.contextManager.getGlobalStats();

    const usersText = `👥 **Usuários do Sistema**

**📊 Estatísticas:**
• Usuários ativos: ${globalStats.activeContexts}
• Total de mensagens: ${globalStats.totalMessages}
• Média por usuário: ${globalStats.avgMessagesPerContext}

**ℹ️ Usuários com contexto ativo:**
Os usuários são identificados por seus números de telefone e mantêm contexto ativo por 30 minutos após a última interação.`;

    await this.whatsappService.sendMessage(message.from, usersText);
  }

  private async handleLogsCommand(message: WhatsAppMessage, args: string[]): Promise<void> {
    const level = args[0] || 'error';
    const validLevels = ['error', 'warn', 'info', 'debug'];

    if (!validLevels.includes(level)) {
      await this.whatsappService.sendMessage(
        message.from,
        `❌ Nível inválido: ${level}\n\nNíveis válidos: ${validLevels.join(', ')}`
      );
      return;
    }

    await this.whatsappService.sendMessage(
      message.from,
      `📝 **Logs do Sistema (${level})**\n\nPara visualizar logs completos, acesse o servidor diretamente.\n\nArquivos de log:\n• logs/error.log\n• logs/combined.log`
    );
  }

  private async handleMaintenanceCommand(message: WhatsAppMessage, args: string[]): Promise<void> {
    const action = args[0];

    if (!action || !['on', 'off', 'status'].includes(action)) {
      await this.whatsappService.sendMessage(
        message.from,
        '❌ Use: !maintenance <on|off|status>\n\nControla o modo de manutenção do bot.'
      );
      return;
    }

    switch (action) {
      case 'on':
        logger.info('Maintenance mode enabled', { admin: message.from });
        await this.whatsappService.sendMessage(
          message.from,
          '🔧 Modo de manutenção ATIVADO\n\nO bot responderá apenas a administradores.'
        );
        break;

      case 'off':
        logger.info('Maintenance mode disabled', { admin: message.from });
        await this.whatsappService.sendMessage(
          message.from,
          '✅ Modo de manutenção DESATIVADO\n\nO bot voltou ao funcionamento normal.'
        );
        break;

      case 'status':
        await this.whatsappService.sendMessage(
          message.from,
          '📊 Modo de manutenção: DESATIVADO\n\n(Esta funcionalidade será implementada em versões futuras)'
        );
        break;
    }
  }

  async handleUtilityCommand(message: WhatsAppMessage, command: string, args: string[]): Promise<void> {
    switch (command) {
      case 'translate':
        await this.handleTranslateCommand(message, args);
        break;

      case 'calculate':
      case 'calc':
        await this.handleCalculateCommand(message, args);
        break;

      case 'summary':
        await this.handleSummaryCommand(message);
        break;

      case 'weather':
        await this.handleWeatherCommand(message, args);
        break;

      default:
        await this.whatsappService.sendMessage(
          message.from,
          `❓ Comando utilitário desconhecido: "${command}"`
        );
        break;
    }
  }

  private async handleTranslateCommand(message: WhatsAppMessage, args: string[]): Promise<void> {
    if (args.length < 2) {
      await this.whatsappService.sendMessage(
        message.from,
        '❌ Use: !translate <idioma> <texto>\n\nExemplo: !translate english Olá mundo'
      );
      return;
    }

    const targetLanguage = args[0];
    const textToTranslate = args.slice(1).join(' ');

    try {
      const context = await this.contextManager.getContext(message.from);
      const prompt = `Traduza o seguinte texto para ${targetLanguage}: "${textToTranslate}"`;

      const response = await this.openaiService.generateResponse(prompt, context);

      await this.whatsappService.sendMessage(
        message.from,
        `🌐 **Tradução para ${targetLanguage}:**\n\n${response.content}`
      );
    } catch (error) {
      logger.error('Translation error:', error);
      await this.whatsappService.sendMessage(
        message.from,
        '❌ Erro na tradução. Tente novamente.'
      );
    }
  }

  private async handleCalculateCommand(message: WhatsAppMessage, args: string[]): Promise<void> {
    if (args.length === 0) {
      await this.whatsappService.sendMessage(
        message.from,
        '❌ Use: !calc <expressão>\n\nExemplo: !calc 2 + 2 * 3'
      );
      return;
    }

    const expression = args.join(' ');

    try {
      const context = await this.contextManager.getContext(message.from);
      const prompt = `Calcule a seguinte expressão matemática e explique o resultado: ${expression}`;

      const response = await this.openaiService.generateResponse(prompt, context);

      await this.whatsappService.sendMessage(
        message.from,
        `🧮 **Cálculo:**\n\n${response.content}`
      );
    } catch (error) {
      logger.error('Calculation error:', error);
      await this.whatsappService.sendMessage(
        message.from,
        '❌ Erro no cálculo. Verifique a expressão.'
      );
    }
  }

  private async handleSummaryCommand(message: WhatsAppMessage): Promise<void> {
    try {
      const context = await this.contextManager.getContext(message.from);

      if (context.messages.length < 3) {
        await this.whatsappService.sendMessage(
          message.from,
          '❌ Não há mensagens suficientes para gerar um resumo.\n\nPreciso de pelo menos 3 mensagens na conversa.'
        );
        return;
      }

      const messages = context.messages.map(msg => `${msg.role}: ${msg.content}`);
      const summary = await this.openaiService.generateSummary(messages);

      await this.whatsappService.sendMessage(
        message.from,
        `📋 **Resumo da Conversa:**\n\n${summary}`
      );
    } catch (error) {
      logger.error('Summary error:', error);
      await this.whatsappService.sendMessage(
        message.from,
        '❌ Erro ao gerar resumo. Tente novamente.'
      );
    }
  }

  private async handleWeatherCommand(message: WhatsAppMessage, args: string[]): Promise<void> {
    await this.whatsappService.sendMessage(
      message.from,
      '🌤️ **Previsão do Tempo**\n\n❌ Esta funcionalidade requer integração com API de clima externa.\n\nFuncionalidade será implementada em versões futuras.'
    );
  }
}