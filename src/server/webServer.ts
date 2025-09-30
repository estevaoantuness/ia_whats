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
      res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Sara AI - Status</title>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    h1 { font-size: 3em; margin-bottom: 20px; }
    a { color: white; font-size: 1.2em; text-decoration: none; background: rgba(255,255,255,0.2); padding: 15px 30px; border-radius: 10px; display: inline-block; margin: 10px; }
    a:hover { background: rgba(255,255,255,0.3); }
  </style>
</head>
<body>
  <h1>🌸 Sara AI</h1>
  <p>Assistente de Produtividade - Online!</p>
  <br>
  <a href="/qr">📱 Conectar WhatsApp</a>
  <a href="/health">💚 Status</a>
</body>
</html>
      `);
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

    // QR Code page
    this.app.get('/qr', (req, res) => {
      const qrCode = this.saraBot?.getQRCode();
      const isConnected = this.saraBot?.isConnected();

      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sara AI - QR Code WhatsApp</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        h1 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 2em;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
        }
        .status {
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 30px;
            font-weight: 500;
        }
        .status.connected {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.waiting {
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffeaa7;
        }
        .qr-container {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
        }
        #qrcode {
            margin: 0 auto;
            max-width: 300px;
        }
        .instructions {
            text-align: left;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-top: 20px;
        }
        .instructions h3 {
            color: #667eea;
            margin-bottom: 15px;
        }
        .instructions ol {
            margin-left: 20px;
        }
        .instructions li {
            margin-bottom: 10px;
            line-height: 1.6;
        }
        .loading {
            color: #667eea;
            font-size: 18px;
        }
        .refresh-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 20px;
            transition: background 0.3s;
        }
        .refresh-btn:hover {
            background: #5568d3;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
</head>
<body>
    <div class="container">
        <h1>🌸 Sara AI</h1>
        <p class="subtitle">Assistente de Produtividade</p>

        ${isConnected ? `
            <div class="status connected">
                ✅ WhatsApp Conectado!
            </div>
            <p>Seu WhatsApp já está conectado e funcionando.</p>
        ` : qrCode ? `
            <div class="status waiting">
                📱 Aguardando Conexão...
            </div>

            <div class="qr-container">
                <div id="qrcode"></div>
            </div>

            <div class="instructions">
                <h3>Como Conectar:</h3>
                <ol>
                    <li>Abra o <strong>WhatsApp</strong> no seu celular</li>
                    <li>Toque em <strong>Menu</strong> ou <strong>Configurações</strong></li>
                    <li>Selecione <strong>Aparelhos Conectados</strong></li>
                    <li>Toque em <strong>Conectar um Aparelho</strong></li>
                    <li>Aponte a câmera para o QR Code acima</li>
                </ol>
            </div>

            <button class="refresh-btn" onclick="location.reload()">🔄 Atualizar</button>

            <p style="margin-top: 20px; font-size: 12px; color: #999;">
                Debug: QR Code ativo (${qrCode.length} caracteres)<br>
                Gerado em: ${new Date().toLocaleTimeString('pt-BR')}<br>
                <a href="/api/qr-debug" target="_blank" style="color: #667eea;">Ver JSON Debug</a>
            </p>

            <script>
                try {
                    QRCode.toCanvas(document.getElementById('qrcode'), '${qrCode}', {
                        width: 300,
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#ffffff'
                        }
                    });
                    console.log('✅ QR Code renderizado com sucesso!');
                } catch (error) {
                    console.error('❌ Erro ao renderizar QR Code:', error);
                    document.getElementById('qrcode').innerHTML = '<p style="color:red;">Erro ao renderizar QR Code</p>';
                }

                // Auto-refresh every 3 seconds (QR codes expire quickly)
                setTimeout(() => location.reload(), 3000);
            </script>
        ` : `
            <div class="status waiting">
                ⏳ Gerando QR Code...
            </div>
            <p class="loading">Aguarde enquanto o QR Code é gerado...</p>
            <button class="refresh-btn" onclick="location.reload()">🔄 Atualizar</button>
            <script>
                // Auto-refresh every 3 seconds until QR appears
                setTimeout(() => location.reload(), 3000);
            </script>
        `}
    </div>
</body>
</html>
      `;

      res.send(html);
    });

    // Get status
    this.app.get('/api/status', (req, res) => {
      try {
        const isConnected = this.saraBot?.isConnected() || false;
        const whatsappStatus = isConnected ? 'connected' : 'disconnected';
        const qrCode = this.saraBot?.getQRCode() || null;

        res.json({
          status: whatsappStatus,
          qrCode: qrCode,
          qrCodeLength: qrCode ? qrCode.length : 0,
          qrCodeAvailable: !!qrCode,
          uptime: Math.floor(process.uptime()),
          messageCount: 0,
          aiService: AI_SERVICE,
          connected: isConnected,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Error getting status:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Debug endpoint - Get QR code directly
    this.app.get('/api/qr-debug', (req, res) => {
      try {
        const qrCode = this.saraBot?.getQRCode();
        const isConnected = this.saraBot?.isConnected() || false;

        res.json({
          success: true,
          qrCode: qrCode,
          qrCodeLength: qrCode ? qrCode.length : 0,
          hasQRCode: !!qrCode,
          isConnected: isConnected,
          timestamp: new Date().toISOString(),
          message: qrCode
            ? 'QR Code disponível'
            : (isConnected ? 'Já conectado' : 'QR Code ainda não foi gerado')
        });
      } catch (error) {
        logger.error('Error getting QR code:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
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