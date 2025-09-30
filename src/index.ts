import { config, validateConfig } from './config';
import { WhatsAppService } from './services/whatsapp';
import { OpenAIService } from './services/openai';
import { DatabaseService } from './services/database';
import { ContextManager } from './services/contextManager';
import { MessageHandler } from './handlers/messageHandler';
import { CommandHandler } from './handlers/commandHandler';
import { RateLimiter } from './utils/rateLimiter';
import { systemMonitor } from './utils/monitoring';
import { gracefulShutdown } from './utils/gracefulShutdown';
import { extractCommand } from './utils/helpers';
import { WebPanel } from './server/webPanel';
import logger from './utils/logger';

class IAWhatsAppBot {
  private whatsappService!: WhatsAppService;
  private openaiService!: OpenAIService;
  private database!: DatabaseService;
  private contextManager!: ContextManager;
  private messageHandler!: MessageHandler;
  private commandHandler!: CommandHandler;
  private rateLimiter!: RateLimiter;
  private webPanel!: WebPanel;

  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Starting IA WhatsApp Bot...');

      // Validate configuration
      validateConfig();
      logger.info('✅ Configuration validated');

      // Initialize database
      this.database = new DatabaseService();
      logger.info('✅ Database initialized');

      // Initialize services
      this.openaiService = new OpenAIService(
        config.openai.apiKey,
        config.openai.model,
        config.openai.maxTokens,
        config.openai.temperature
      );
      logger.info('✅ OpenAI service initialized');

      this.contextManager = new ContextManager(this.database, config.bot.maxContextMessages);
      logger.info('✅ Context manager initialized');

      this.rateLimiter = new RateLimiter(
        this.database,
        config.features.rateLimitMaxMessages,
        config.features.rateLimitWindowMs
      );
      logger.info('✅ Rate limiter initialized');

      this.whatsappService = new WhatsAppService(config.whatsapp.sessionName);
      await this.whatsappService.initialize();
      logger.info('✅ WhatsApp service initialized');

      // Initialize handlers
      this.messageHandler = new MessageHandler(
        this.whatsappService,
        this.openaiService,
        this.contextManager,
        this.rateLimiter,
        config
      );

      this.commandHandler = new CommandHandler(
        this.whatsappService,
        this.openaiService,
        this.contextManager,
        this.database,
        config
      );

      logger.info('✅ Message handlers initialized');

      // Setup message handling
      this.setupMessageHandling();

      // Initialize Web Panel
      this.webPanel = new WebPanel();
      this.webPanel.setServices(
        this.whatsappService,
        this.openaiService,
        this.contextManager,
        this.database
      );
      this.webPanel.start(3001);

      // Setup graceful shutdown
      gracefulShutdown.setServices(this.whatsappService, this.database);

      logger.info('🎉 IA WhatsApp Bot started successfully!');
      logger.info(`📱 Bot name: ${config.bot.name}`);
      logger.info(`🤖 OpenAI model: ${config.openai.model}`);
      logger.info(`⚡ Rate limit: ${config.features.rateLimitMaxMessages} messages per minute`);
      logger.info(`👥 Group responses: ${config.whatsapp.enableGroupResponses ? 'Enabled' : 'Disabled'}`);

      this.showWelcomeMessage();

    } catch (error) {
      logger.error('❌ Failed to initialize bot:', error);
      process.exit(1);
    }
  }

  private setupMessageHandling(): void {
    this.whatsappService.onMessage(async (message) => {
      try {
        const operationId = `msg_${message.id}_${Date.now()}`;
        systemMonitor.startOperation(operationId, 'message_processing', {
          from: message.from,
          isGroup: message.isGroup,
          hasMedia: !!message.mediaType
        });

        systemMonitor.incrementMessageCount();

        // Check if it's a command
        const commandResult = extractCommand(message.text, config.bot.prefix);

        if (commandResult) {
          // Handle admin commands
          if (['broadcast', 'cleanup', 'reload', 'users', 'logs', 'maintenance'].includes(commandResult.command)) {
            await this.commandHandler.handleAdminCommand(message, commandResult.command, commandResult.args);
          }
          // Handle utility commands
          else if (['translate', 'calculate', 'calc', 'summary', 'weather'].includes(commandResult.command)) {
            await this.commandHandler.handleUtilityCommand(message, commandResult.command, commandResult.args);
          }
          // Handle regular commands through message handler
          else {
            await this.messageHandler.handleMessage(message);
          }
        } else {
          // Handle regular messages
          await this.messageHandler.handleMessage(message);
        }

        systemMonitor.endOperation(operationId);

      } catch (error) {
        logger.error('Error in message processing:', error);
        systemMonitor.incrementErrorCount();

        try {
          await this.whatsappService.sendMessage(
            message.from,
            '❌ Ocorreu um erro interno. Por favor, tente novamente.'
          );
        } catch (sendError) {
          logger.error('Error sending error message:', sendError);
        }
      }
    });
  }

  private showWelcomeMessage(): void {
    const welcomeMessage = `
╔══════════════════════════════════════╗
║           IA WHATSAPP BOT            ║
║              v1.0.0                  ║
╠══════════════════════════════════════╣
║ 🤖 OpenAI Model: ${config.openai.model.padEnd(18)} ║
║ 📱 Session: ${config.whatsapp.sessionName.substring(0, 18).padEnd(18)} ║
║ ⚡ Rate Limit: ${String(config.features.rateLimitMaxMessages).padEnd(2)}/min              ║
║ 👥 Groups: ${(config.whatsapp.enableGroupResponses ? 'Enabled' : 'Disabled').padEnd(18)} ║
╠══════════════════════════════════════╣
║ Status: 🟢 ONLINE                    ║
║ 🌐 Painel: http://localhost:3001     ║
╚══════════════════════════════════════╝
    `;

    console.log(welcomeMessage);
    console.log('\n🌐 PAINEL WEB DISPONÍVEL:');
    console.log('📊 Acesse: http://localhost:3001');
    console.log('🔧 Controle completo do bot via browser\n');
  }

  async getSystemStatus(): Promise<string> {
    const stats = systemMonitor.getFormattedStats();
    const connectionInfo = this.whatsappService.getConnectionInfo();
    const globalStats = await this.contextManager.getGlobalStats();

    return `🤖 **IA WhatsApp Bot - Status**

**📊 Conexão:**
• WhatsApp: ${connectionInfo.connected ? '🟢 Conectado' : '🔴 Desconectado'}
• OpenAI: 🟢 Ativo
• Database: 🟢 Ativo

**👥 Usuários:**
• Contextos ativos: ${globalStats.activeContexts}
• Total de mensagens: ${globalStats.totalMessages}

${stats}

**⚙️ Configurações:**
• Modelo: ${config.openai.model}
• Rate Limit: ${config.features.rateLimitMaxMessages}/min
• Grupos: ${config.whatsapp.enableGroupResponses ? 'Habilitado' : 'Desabilitado'}`;
  }
}

// Start the bot
const bot = new IAWhatsAppBot();

bot.initialize().catch((error) => {
  logger.error('Fatal error during bot initialization:', error);
  process.exit(1);
});

// Export for potential external usage
export default bot;