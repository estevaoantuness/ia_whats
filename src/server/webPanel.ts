import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { WhatsAppService } from '../services/whatsapp';
import { OpenAIService } from '../services/openai';
import { ContextManager } from '../services/contextManager';
import { DatabaseService } from '../services/database';
import { systemMonitor } from '../utils/monitoring';
import logger from '../utils/logger';
import { config } from '../config';

export class WebPanel {
  private app: express.Application;
  private server: any;
  private whatsappService: WhatsAppService | null = null;
  private openaiService: OpenAIService | null = null;
  private contextManager: ContextManager | null = null;
  private database: DatabaseService | null = null;
  private qrCode: string = '';
  private connectionStatus: string = 'disconnected';
  private botStats: any = {};

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../public')));
  }

  private setupRoutes(): void {
    // Servir o painel HTML
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/panel.html'));
    });

    // API para status do sistema
    this.app.get('/api/status', (req, res) => {
      res.json({
        connection: this.connectionStatus,
        qrCode: this.qrCode,
        stats: this.botStats,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });
    });

    // API para estatísticas detalhadas
    this.app.get('/api/stats', async (req, res) => {
      try {
        const globalStats = this.contextManager ? await this.contextManager.getGlobalStats() : null;
        const systemStats = systemMonitor.getSystemStats();

        res.json({
          system: systemStats,
          context: globalStats,
          openai: this.openaiService ? this.openaiService.getUsageStats() : null,
          whatsapp: this.whatsappService ? this.whatsappService.getConnectionInfo() : null
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
      }
    });

    // API para enviar mensagem de teste
    this.app.post('/api/send-test', async (req, res) => {
      try {
        const { number, message } = req.body;

        if (!this.whatsappService || !this.whatsappService.isConnected()) {
          return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        const formattedNumber = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        await this.whatsappService.sendMessage(formattedNumber, message);

        return res.json({ success: true, message: 'Message sent successfully' });
      } catch (error) {
        logger.error('Error sending test message:', error);
        return res.status(500).json({ error: 'Failed to send message' });
      }
    });

    // API para limpar contextos antigos
    this.app.post('/api/cleanup', async (req, res) => {
      try {
        if (this.database) {
          await this.database.cleanupOldConversations();
          await this.database.cleanupOldRateLimits();
        }

        return res.json({ success: true, message: 'Cleanup completed' });
      } catch (error) {
        logger.error('Error during cleanup:', error);
        return res.status(500).json({ error: 'Cleanup failed' });
      }
    });

    // API para logs
    this.app.get('/api/logs/:type', (req, res) => {
      const logType = req.params.type;
      const fs = require('fs');
      const logPath = path.join(process.cwd(), 'logs', `${logType}.log`);

      try {
        if (fs.existsSync(logPath)) {
          const logs = fs.readFileSync(logPath, 'utf8')
            .split('\n')
            .filter((line: string) => line.trim())
            .slice(-50) // Last 50 lines
            .reverse();

          res.json({ logs });
        } else {
          res.json({ logs: [] });
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to read logs' });
      }
    });

    // WebSocket-like endpoint para atualizações em tempo real
    this.app.get('/api/realtime', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      const sendUpdate = () => {
        const data = {
          connection: this.connectionStatus,
          qrCode: this.qrCode,
          timestamp: new Date().toISOString(),
          stats: systemMonitor.getSystemStats()
        };

        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const interval = setInterval(sendUpdate, 2000);

      req.on('close', () => {
        clearInterval(interval);
      });
    });
  }

  setServices(
    whatsappService: WhatsAppService,
    openaiService: OpenAIService,
    contextManager: ContextManager,
    database: DatabaseService
  ): void {
    this.whatsappService = whatsappService;
    this.openaiService = openaiService;
    this.contextManager = contextManager;
    this.database = database;

    // Setup WhatsApp event listeners for real-time updates
    this.setupWhatsAppListeners();
  }

  private setupWhatsAppListeners(): void {
    if (!this.whatsappService) return;

    // Monitor connection changes
    const originalHandleConnectionUpdate = (this.whatsappService as any).handleConnectionUpdate;
    if (originalHandleConnectionUpdate) {
      (this.whatsappService as any).handleConnectionUpdate = (update: any) => {
        const { connection, qr } = update;

        if (qr) {
          this.qrCode = qr;
          this.connectionStatus = 'waiting_for_scan';
        }

        if (connection === 'open') {
          this.connectionStatus = 'connected';
          this.qrCode = '';
        } else if (connection === 'close') {
          this.connectionStatus = 'disconnected';
        } else if (connection === 'connecting') {
          this.connectionStatus = 'connecting';
        }

        // Call original handler
        return originalHandleConnectionUpdate.call(this.whatsappService, update);
      };
    }
  }

  start(port: number = 3001): void {
    this.server = this.app.listen(port, () => {
      console.log(`\n🌐 PAINEL WEB INICIADO!`);
      console.log(`📊 Acesse: http://localhost:${port}`);
      console.log(`🔧 Painel de controle do bot disponível\n`);
      logger.info(`Web panel started on port ${port}`);
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      logger.info('Web panel stopped');
    }
  }
}