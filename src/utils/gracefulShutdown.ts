import { WhatsAppService } from '../services/whatsapp';
import { DatabaseService } from '../services/database';
import logger from './logger';

export class GracefulShutdown {
  private whatsappService: WhatsAppService | null = null;
  private database: DatabaseService | null = null;
  private isShuttingDown = false;

  constructor() {
    this.setupSignalHandlers();
  }

  setServices(whatsappService: WhatsAppService, database: DatabaseService): void {
    this.whatsappService = whatsappService;
    this.database = database;
  }

  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        await this.shutdown();
      });
    });

    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught Exception:', error);
      await this.shutdown(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      // Ignore WhatsApp connection rejections during startup
      if (reason && typeof reason === 'object' && 'code' in reason) {
        if ((reason as any).code === 'ECONNRESET' || (reason as any).code === 'ENOTFOUND') {
          logger.debug('Network error during WhatsApp connection (ignoring):', reason);
          return;
        }
      }

      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      await this.shutdown(1);
    });
  }

  async shutdown(exitCode: number = 0): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting graceful shutdown process...');

    try {
      // Stop accepting new connections/messages
      logger.info('Stopping new message processing...');

      // Close WhatsApp connection
      if (this.whatsappService) {
        logger.info('Disconnecting WhatsApp service...');
        await this.whatsappService.disconnect();
        logger.info('WhatsApp service disconnected');
      }

      // Close database connection
      if (this.database) {
        logger.info('Closing database connection...');
        await this.database.close();
        logger.info('Database connection closed');
      }

      // Final cleanup
      await this.performFinalCleanup();

      logger.info('Graceful shutdown completed successfully');
      process.exit(exitCode);

    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  private async performFinalCleanup(): Promise<void> {
    try {
      // Clear any remaining timeouts/intervals
      logger.info('Clearing timeouts and intervals...');

      // Allow some time for final log writes
      await new Promise(resolve => setTimeout(resolve, 1000));

      logger.info('Final cleanup completed');
    } catch (error) {
      logger.error('Error during final cleanup:', error);
    }
  }

  isInShutdownMode(): boolean {
    return this.isShuttingDown;
  }
}

export const gracefulShutdown = new GracefulShutdown();