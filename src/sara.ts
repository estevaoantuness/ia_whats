import { BotConfig, WhatsAppMessage } from './types';
import { DatabaseService } from './services/database';
import { WhatsAppService } from './services/whatsapp';
import { createAIService, AIService } from './services/ai-service-factory';
import { SaraContextService } from './services/saraContext';
import { SaraMessageHandler } from './handlers/saraMessageHandler';
import { MessageTemplateService } from './services/messageTemplates';
import { SchedulerService } from './services/scheduler';
import { SaraAnalyticsService } from './services/saraAnalytics';
import { WebServer } from './server/webServer';
import { gracefulShutdown } from './utils/gracefulShutdown';
import logger from './utils/logger';

export class SaraBot {
  private db!: DatabaseService;
  private whatsappService!: WhatsAppService;
  private openaiService!: AIService;
  private saraContext!: SaraContextService;
  private messageHandler!: SaraMessageHandler;
  private templates!: MessageTemplateService;
  private scheduler!: SchedulerService;
  private analytics!: SaraAnalyticsService;
  private webServer!: WebServer;
  private config: BotConfig;

  constructor(config: BotConfig) {
    this.config = config;
  }

  private async initializeServices(): Promise<void> {
    // Core services
    this.db = new DatabaseService();
    await this.db.initializeTables();
    this.whatsappService = new WhatsAppService(this.config.whatsapp.sessionName);
    this.openaiService = createAIService();

    // Sara-specific services
    this.saraContext = new SaraContextService(this.db);
    this.templates = new MessageTemplateService();
    this.analytics = new SaraAnalyticsService(this.saraContext);

    // Message handler
    this.messageHandler = new SaraMessageHandler(
      this.whatsappService,
      this.saraContext,
      this.templates,
      this.openaiService,
      this.config
    );

    // Scheduler (depends on message handler)
    this.scheduler = new SchedulerService(
      this.saraContext,
      this.whatsappService,
      this.messageHandler
    );

    // Web server
    this.webServer = new WebServer();
    this.webServer.setSaraBot(this);

    logger.info('Sara.ai services initialized');
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting Sara.ai bot...');

      // Initialize services first
      await this.initializeServices();

      // Try to initialize WhatsApp connection (continue even if it fails)
      try {
        console.log('📱 INICIANDO WHATSAPP - Tentando conectar...');
        await this.whatsappService.initialize();
        this.whatsappService.onMessage(async (message) => {
          await this.messageHandler.handleMessage(message);
        });
        console.log('✅ WhatsApp connection initialized successfully');
        logger.info('WhatsApp connection initialized successfully');
      } catch (whatsappError) {
        console.error('❌❌❌ ERRO CRÍTICO NO WHATSAPP ❌❌❌');
        console.error('Erro completo:', whatsappError);
        console.error('Stack trace:', (whatsappError as Error).stack);
        logger.error('WhatsApp failed to initialize:', whatsappError);
        logger.warn('Continuing in web-only mode without WhatsApp');
      }

      // Initialize user schedules
      await this.scheduler.initializeUserSchedules();

      // Start web server
      const port = parseInt(process.env.PORT || '3000');
      await this.webServer.start(port);

      // Set up graceful shutdown
      gracefulShutdown.setServices(this.whatsappService, this.db);

      logger.info('Sara.ai bot started successfully! 🤖✨');

    } catch (error) {
      logger.error('Failed to start Sara.ai bot:', error);
      throw error;
    }
  }

  // Public methods for external access
  async getAnalytics() {
    return {
      global: await this.analytics.getGlobalMetrics(),
      getUserInsights: (userId: string) => this.analytics.getUserInsights(userId),
      getWeeklyReport: (userId: string) => this.analytics.getWeeklyReport(userId)
    };
  }

  async pauseUser(userId: string, hours: number): Promise<void> {
    await this.saraContext.pauseUser(userId, hours);
    await this.scheduler.pauseUser(userId, hours);
  }

  async resumeUser(userId: string): Promise<void> {
    await this.saraContext.resumeUser(userId);
    await this.scheduler.resumeUser(userId);
  }

  async updateUserSchedule(userId: string): Promise<void> {
    const user = await this.saraContext.getUserProfile(userId);
    if (user) {
      this.scheduler.updateUserSchedule(user);
    }
  }

  isConnected(): boolean {
    return this.whatsappService?.isConnected() || false;
  }

  getQRCode(): string | null {
    return this.whatsappService?.getQRCode() || null;
  }

  async processMessage(userId: string, message: string): Promise<string> {
    const whatsappMessage: WhatsAppMessage = {
      id: 'web-' + Date.now(),
      from: userId,
      to: 'sara-bot',
      text: message,
      timestamp: Date.now(),
      isGroup: false
    };

    try {
      await this.messageHandler.handleMessage(whatsappMessage);

      // Get the actual Sara response that was generated
      const response = this.messageHandler.getLastResponse(userId);

      if (response) {
        return response;
      } else {
        // Fallback if no response was captured
        return 'Mensagem processada com sucesso! A Sara está processando sua mensagem...';
      }
    } catch (error) {
      logger.error('Error processing message from web:', error);
      return 'Erro ao processar mensagem. Tente novamente.';
    }
  }

  getConnectionInfo() {
    return this.whatsappService.getConnectionInfo();
  }

  async sendBroadcastMessage(message: string, userIds?: string[]): Promise<void> {
    try {
      let targetUsers: string[];

      if (userIds) {
        targetUsers = userIds;
      } else {
        // Send to all active users
        const users = await this.saraContext.getAllUsers();
        targetUsers = users
          .filter(u => u.onboardingCompleted)
          .map(u => u.userId);
      }

      logger.info(`Sending broadcast to ${targetUsers.length} users`);

      for (const userId of targetUsers) {
        try {
          await this.whatsappService.sendMessage(userId, message);
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.error(`Failed to send broadcast to user ${userId}:`, error);
        }
      }

      logger.info('Broadcast completed');

    } catch (error) {
      logger.error('Error sending broadcast:', error);
      throw error;
    }
  }

  // Admin methods
  async getAdminStats() {
    const analytics = await this.analytics.getGlobalMetrics();
    const connectionInfo = this.whatsappService.getConnectionInfo();

    return {
      users: {
        total: analytics.totalUsers,
        active: analytics.activeUsers,
        onboarding: analytics.onboardingUsers
      },
      engagement: {
        retentionD7: Math.round(analytics.retentionD7 * 100),
        responseRate: Math.round(
          (analytics.averageResponseRate.morning +
           analytics.averageResponseRate.noon +
           analytics.averageResponseRate.evening) / 3 * 100
        ),
        completionRate: Math.round(analytics.goalCompletionRate * 100),
        engagementScore: analytics.engagementScore
      },
      system: {
        connected: connectionInfo.connected,
        uptime: Math.floor(process.uptime()),
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        version: '1.0.0'
      }
    };
  }

  async exportUserData(userId: string) {
    const user = await this.saraContext.getUserProfile(userId);
    if (!user) return null;

    const analytics = await this.saraContext.getRecentAnalytics(userId, 90);
    const weeklyGoals = await this.saraContext.getWeeklyGoals(
      userId,
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      new Date().toISOString().split('T')[0]
    );
    const importantDates = await this.saraContext.getUserImportantDates(userId);

    return {
      profile: user,
      analytics,
      goals: weeklyGoals,
      importantDates,
      exportedAt: new Date().toISOString()
    };
  }

  async forceResetWhatsAppSession(): Promise<void> {
    logger.info('Admin: Force resetting WhatsApp session...');
    await this.whatsappService.forceResetSession();
    logger.info('Admin: WhatsApp session reset complete');
  }

  async requestPairingCode(phoneNumber: string): Promise<string> {
    logger.info(`Requesting pairing code for ${phoneNumber}`);
    return await this.whatsappService.requestPairingCode(phoneNumber);
  }

  getPairingCode(): string | null {
    return this.whatsappService.getPairingCode();
  }
}

// Factory function for easy initialization
export async function createSaraBot(config: BotConfig): Promise<SaraBot> {
  const bot = new SaraBot(config);
  await bot.start();
  return bot;
}