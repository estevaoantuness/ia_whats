import { ConversationContext } from '../types';
import { DatabaseService } from './database';
import logger from '../utils/logger';

export class ContextManager {
  private contexts: Map<string, ConversationContext> = new Map();
  private db: DatabaseService;
  private maxContextMessages: number;
  private contextTimeout: number = 30 * 60 * 1000; // 30 minutes

  constructor(db: DatabaseService, maxContextMessages: number = 10) {
    this.db = db;
    this.maxContextMessages = maxContextMessages;

    setInterval(() => {
      this.cleanupInactiveContexts();
    }, 10 * 60 * 1000); // Check every 10 minutes
  }

  async getContext(userId: string): Promise<ConversationContext> {
    let context = this.contexts.get(userId);

    if (!context) {
      const dbContext = await this.db.getConversationContext(userId);

      context = dbContext || {
        userId,
        messages: [],
        lastActivity: Date.now(),
      };

      this.contexts.set(userId, context);
    }

    return context;
  }

  async addMessage(userId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    const context = await this.getContext(userId);

    context.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });

    if (context.messages.length > this.maxContextMessages) {
      const messagesToRemove = context.messages.length - this.maxContextMessages;
      context.messages.splice(0, messagesToRemove);
    }

    context.lastActivity = Date.now();
    this.contexts.set(userId, context);

    await this.saveContext(userId, context);

    logger.debug(`Message added to context for user ${userId}`, {
      role,
      messageCount: context.messages.length,
      contentLength: content.length
    });
  }

  async clearContext(userId: string): Promise<void> {
    const context: ConversationContext = {
      userId,
      messages: [],
      lastActivity: Date.now(),
    };

    this.contexts.set(userId, context);
    await this.saveContext(userId, context);

    logger.info(`Context cleared for user: ${userId}`);
  }

  async getContextSummary(userId: string): Promise<string> {
    const context = await this.getContext(userId);

    if (context.messages.length === 0) {
      return 'Nenhuma conversa anterior encontrada.';
    }

    const messageCount = context.messages.length;
    const lastMessage = context.messages[context.messages.length - 1];

    if (!lastMessage) {
      return `📊 **Resumo da Conversa**

🔢 **Mensagens**: 0
🕒 **Última atividade**: Nenhuma
💬 **Status**: Nenhuma conversa encontrada`;
    }

    const timeSinceLastMessage = Date.now() - lastMessage.timestamp;
    const timeAgo = this.formatTimeAgo(timeSinceLastMessage);

    return `📊 **Resumo da Conversa**

🔢 **Mensagens**: ${messageCount}
🕒 **Última atividade**: ${timeAgo}
💬 **Última mensagem**: ${lastMessage.content.substring(0, 50)}...
🤖 **Tipo**: ${lastMessage.role === 'user' ? 'Usuário' : 'Assistente'}`;
  }

  private async saveContext(userId: string, context: ConversationContext): Promise<void> {
    try {
      await this.db.saveConversationContext(userId, context);
    } catch (error) {
      logger.error(`Error saving context for user ${userId}:`, error);
    }
  }

  private cleanupInactiveContexts(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [userId, context] of this.contexts.entries()) {
      if (now - context.lastActivity > this.contextTimeout) {
        this.contexts.delete(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} inactive contexts from memory`);
    }
  }

  private formatTimeAgo(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} dia${days > 1 ? 's' : ''} atrás`;
    } else if (hours > 0) {
      return `${hours} hora${hours > 1 ? 's' : ''} atrás`;
    } else if (minutes > 0) {
      return `${minutes} minuto${minutes > 1 ? 's' : ''} atrás`;
    } else {
      return 'agora mesmo';
    }
  }

  getActiveContextsCount(): number {
    return this.contexts.size;
  }

  async getGlobalStats(): Promise<{
    activeContexts: number;
    totalMessages: number;
    avgMessagesPerContext: number;
  }> {
    const activeContexts = this.contexts.size;
    let totalMessages = 0;

    for (const context of this.contexts.values()) {
      totalMessages += context.messages.length;
    }

    const avgMessagesPerContext = activeContexts > 0 ? Math.round(totalMessages / activeContexts) : 0;

    return {
      activeContexts,
      totalMessages,
      avgMessagesPerContext,
    };
  }
}