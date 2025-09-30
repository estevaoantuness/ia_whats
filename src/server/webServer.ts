import express from 'express';
import path from 'path';
import cors from 'cors';
import { SaraBot } from '../sara';
import { config, AI_SERVICE } from '../config';
import logger from '../utils/logger';

export class WebServer {
  private app: express.Application;
  private server: any;
  private saraBot?: SaraBot;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../../public')));
  }

  private setupRoutes(): void {
    // Serve dashboard HTML
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../../public/business-panel.html'));
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Sara.ai',
        aiService: AI_SERVICE,
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
      });
    });

    // Get status
    this.app.get('/api/status', (req, res) => {
      try {
        const isConnected = this.saraBot?.isConnected() || false;
        const whatsappStatus = isConnected ? 'connected' : 'disconnected';

        res.json({
          status: whatsappStatus,
          qrCode: null, // Will implement QR code later
          uptime: Math.floor(process.uptime()),
          messageCount: 0, // Will implement message counter later
          aiService: AI_SERVICE,
          connected: isConnected
        });
      } catch (error) {
        logger.error('Error getting status:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Start WhatsApp
    this.app.post('/api/start-whatsapp', async (req, res) => {
      try {
        const { mode } = req.body;

        if (!this.saraBot) {
          return res.status(400).json({
            success: false,
            error: 'Sara bot not initialized'
          });
        }

        // For now, we'll just try to start the bot
        logger.info(`Starting WhatsApp in ${mode} mode`);

        return res.json({
          success: true,
          message: `WhatsApp ${mode} starting...`
        });
      } catch (error) {
        logger.error('Error starting WhatsApp:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Send test message
    this.app.post('/api/send-message', async (req, res) => {
      try {
        const { number, message } = req.body;

        if (!number || !message) {
          return res.status(400).json({
            success: false,
            error: 'Number and message are required'
          });
        }

        if (!this.saraBot) {
          return res.status(400).json({
            success: false,
            error: 'Sara bot not initialized'
          });
        }

        // For now, we'll simulate sending (implement actual sending later)
        logger.info(`Would send message to ${number}: ${message}`);

        return res.json({
          success: true,
          message: 'Message sent successfully (simulated)'
        });
      } catch (error) {
        logger.error('Error sending message:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Test AI
    this.app.post('/api/test-ai', async (req, res) => {
      try {
        if (!this.saraBot) {
          return res.status(400).json({
            success: false,
            error: 'Sara bot not initialized'
          });
        }

        // Simulate AI response for now
        const aiResponse = `Olá! Sim, estou funcionando perfeitamente! 🌸\nUsando ${AI_SERVICE} e pronta para ajudar com suas metas de produtividade.`;

        return res.json({
          success: true,
          provider: AI_SERVICE,
          response: aiResponse
        });
      } catch (error) {
        logger.error('Error testing AI:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Sara chat endpoint for dashboard
    this.app.post('/api/sara-chat', async (req, res) => {
      try {
        const { message, userId } = req.body;

        if (!message) {
          return res.status(400).json({
            success: false,
            error: 'Message is required'
          });
        }

        if (!this.saraBot) {
          return res.status(400).json({
            success: false,
            error: 'Sara bot not initialized'
          });
        }

        const testUserId = userId || 'dashboard-user';

        // Process message through Sara's system
        const response = await this.saraBot.processMessage(testUserId, message);

        return res.json({
          success: true,
          response: response,
          aiService: AI_SERVICE
        });
      } catch (error) {
        logger.error('Error in Sara chat:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get Sara statistics
    this.app.get('/api/sara-stats', async (req, res) => {
      try {
        res.json({
          success: true,
          stats: {
            totalUsers: 0,
            activeUsers: 0,
            totalMessages: 0,
            totalGoalsSet: 0,
            totalGoalsCompleted: 0,
            avgCompletionRate: 0
          }
        });
      } catch (error) {
        logger.error('Error getting Sara stats:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }

  setSaraBot(saraBot: SaraBot): void {
    this.saraBot = saraBot;
  }

  start(port: number = 3001): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, () => {
          logger.info(`🌐 Web server started on http://localhost:${port}`);
          logger.info(`📊 Dashboard: http://localhost:${port}`);
          logger.info(`💚 Health check: http://localhost:${port}/health`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          logger.error('Web server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('🛑 Web server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}