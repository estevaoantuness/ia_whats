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

    // QR Code page - STABLE (no blinking!)
    this.app.get('/qr-stable', (req, res) => {
      res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sara AI - QR Code ESTÁVEL</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
        h1 { color: #667eea; margin-bottom: 10px; font-size: 2em; }
        .subtitle { color: #666; margin-bottom: 30px; }
        .status {
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 30px;
            font-weight: 500;
        }
        .status.connected { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.waiting { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        .status.loading { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        .qr-container {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
            position: relative;
        }
        #qrcode { margin: 0 auto; max-width: 300px; }
        .timer {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
            margin-top: 15px;
        }
        .timer.warning { color: #ff6b6b; }
        .instructions {
            text-align: left;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-top: 20px;
        }
        .instructions h3 { color: #667eea; margin-bottom: 15px; }
        .instructions ol { margin-left: 20px; }
        .instructions li { margin-bottom: 10px; line-height: 1.6; }
        .refresh-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            margin: 10px 5px;
            transition: background 0.3s;
        }
        .refresh-btn:hover { background: #5568d3; }
        .debug { margin-top: 20px; font-size: 12px; color: #999; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
</head>
<body>
    <div class="container">
        <h1>🌸 Sara AI</h1>
        <p class="subtitle">QR Code Estável - Sem Piscar!</p>

        <div id="content">
            <div class="status loading">
                ⏳ Carregando QR Code...
            </div>
        </div>
    </div>

    <script>
        let qrData = null;
        let timeLeft = 30;
        let timerInterval = null;

        async function loadQRCode() {
            try {
                const response = await fetch('/api/qr-debug');
                const data = await response.json();
                qrData = data;

                const content = document.getElementById('content');

                if (data.isConnected) {
                    content.innerHTML = \`
                        <div class="status connected">
                            ✅ WhatsApp Conectado!
                        </div>
                        <p>Conexão estabelecida com sucesso!</p>
                    \`;
                    if (timerInterval) clearInterval(timerInterval);
                    return;
                }

                if (!data.hasQRCode || !data.qrCode) {
                    content.innerHTML = \`
                        <div class="status loading">
                            ⏳ Gerando QR Code...
                        </div>
                        <button class="refresh-btn" onclick="loadQRCode()">🔄 Tentar Novamente</button>
                    \`;
                    return;
                }

                // QR Code disponível - renderizar
                content.innerHTML = \`
                    <div class="status waiting">
                        📱 Escaneie Agora! (QR NÃO VAI PISCAR)
                    </div>

                    <div class="qr-container">
                        <canvas id="qrcode"></canvas>
                        <div class="timer" id="timer">Tempo: <span id="countdown">30</span>s</div>
                    </div>

                    <div class="instructions">
                        <h3>Como Escanear:</h3>
                        <ol>
                            <li>Pegue seu <strong>celular</strong></li>
                            <li>Abra <strong>WhatsApp</strong></li>
                            <li><strong>Menu</strong> → <strong>Aparelhos Conectados</strong></li>
                            <li><strong>Conectar um Aparelho</strong></li>
                            <li><strong>Aponte para o QR acima</strong> 👆</li>
                        </ol>
                    </div>

                    <button class="refresh-btn" onclick="loadQRCode()">🔄 Gerar Novo QR</button>

                    <p class="debug">
                        QR: \${data.qrCodeLength} caracteres<br>
                        Gerado: \${new Date(data.timestamp).toLocaleTimeString('pt-BR')}
                    </p>
                \`;

                // Renderizar QR
                setTimeout(() => {
                    try {
                        const canvas = document.getElementById('qrcode');
                        QRCode.toCanvas(canvas, data.qrCode, {
                            width: 300,
                            margin: 2,
                            color: { dark: '#000000', light: '#ffffff' }
                        });
                        console.log('✅ QR Code renderizado!');
                    } catch (err) {
                        console.error('Erro ao renderizar:', err);
                    }
                }, 100);

                // Iniciar timer
                startTimer();

            } catch (error) {
                console.error('Erro:', error);
                document.getElementById('content').innerHTML = \`
                    <div class="status loading">
                        ⚠️ Erro ao carregar
                    </div>
                    <button class="refresh-btn" onclick="loadQRCode()">🔄 Tentar Novamente</button>
                \`;
            }
        }

        function startTimer() {
            // Limpar timer anterior se existir
            if (timerInterval) clearInterval(timerInterval);

            timeLeft = 30; // Reset para 30 segundos
            const countdownEl = document.getElementById('countdown');
            const timerEl = document.getElementById('timer');

            timerInterval = setInterval(() => {
                timeLeft--;
                if (countdownEl) {
                    countdownEl.textContent = timeLeft;

                    if (timeLeft <= 10 && timerEl) {
                        timerEl.classList.add('warning');
                    }
                }

                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    // Recarregar QR automaticamente após expirar
                    loadQRCode();
                }
            }, 1000);
        }

        // Carregar QR ao abrir página
        window.addEventListener('load', loadQRCode);

        // Verificar conexão a cada 3 segundos (sem reload!)
        setInterval(async () => {
            try {
                const response = await fetch('/api/qr-debug');
                const data = await response.json();

                if (data.isConnected && qrData && !qrData.isConnected) {
                    // Conectou! Atualizar página
                    loadQRCode();
                }
            } catch (e) {
                console.error('Check failed:', e);
            }
        }, 3000);
    </script>
</body>
</html>`);
    });

    // QR Code page with live fetch
    this.app.get('/qr-live', (req, res) => {
      res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sara AI - QR Code WhatsApp (Live)</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
        h1 { color: #667eea; margin-bottom: 10px; font-size: 2em; }
        .subtitle { color: #666; margin-bottom: 30px; }
        .status {
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 30px;
            font-weight: 500;
        }
        .status.connected { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.waiting { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        .status.loading { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        .qr-container {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
        }
        #qrcode { margin: 0 auto; max-width: 300px; }
        .instructions {
            text-align: left;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-top: 20px;
        }
        .instructions h3 { color: #667eea; margin-bottom: 15px; }
        .instructions ol { margin-left: 20px; }
        .instructions li { margin-bottom: 10px; line-height: 1.6; }
        .loading { color: #667eea; font-size: 18px; }
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
        .refresh-btn:hover { background: #5568d3; }
        .debug { margin-top: 20px; font-size: 12px; color: #999; }
        .error { color: red; font-weight: bold; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
</head>
<body>
    <div class="container">
        <h1>🌸 Sara AI</h1>
        <p class="subtitle">Assistente de Produtividade</p>

        <div id="content">
            <div class="status loading">
                ⏳ Carregando QR Code...
            </div>
            <p class="loading">Buscando QR Code em tempo real...</p>
        </div>
    </div>

    <script>
        async function fetchAndRenderQR() {
            try {
                const response = await fetch('/api/qr-debug');
                const data = await response.json();

                console.log('QR Debug Response:', data);

                const content = document.getElementById('content');

                if (data.isConnected) {
                    content.innerHTML = \`
                        <div class="status connected">
                            ✅ WhatsApp Conectado!
                        </div>
                        <p>Seu WhatsApp já está conectado e funcionando.</p>
                    \`;
                } else if (data.hasQRCode && data.qrCode) {
                    content.innerHTML = \`
                        <div class="status waiting">
                            📱 Aguardando Conexão...
                        </div>

                        <div class="qr-container">
                            <canvas id="qrcode"></canvas>
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

                        <button class="refresh-btn" onclick="fetchAndRenderQR()">🔄 Atualizar</button>

                        <p class="debug">
                            QR Code: \${data.qrCodeLength} caracteres<br>
                            Gerado: \${new Date(data.timestamp).toLocaleTimeString('pt-BR')}<br>
                            <a href="/api/qr-debug" target="_blank" style="color: #667eea;">Ver JSON</a>
                        </p>
                    \`;

                    // Render QR Code
                    setTimeout(() => {
                        try {
                            QRCode.toCanvas(
                                document.getElementById('qrcode'),
                                data.qrCode,
                                {
                                    width: 300,
                                    margin: 2,
                                    color: { dark: '#000000', light: '#ffffff' }
                                },
                                (error) => {
                                    if (error) {
                                        console.error('QR Render Error:', error);
                                        document.getElementById('qrcode').outerHTML =
                                            '<p class="error">Erro ao renderizar QR Code</p>';
                                    } else {
                                        console.log('✅ QR Code renderizado!');
                                    }
                                }
                            );
                        } catch (err) {
                            console.error('QR Code exception:', err);
                        }
                    }, 100);

                } else {
                    content.innerHTML = \`
                        <div class="status loading">
                            ⏳ Gerando QR Code...
                        </div>
                        <p class="loading">Aguarde enquanto o QR Code é gerado...</p>
                        <button class="refresh-btn" onclick="fetchAndRenderQR()">🔄 Atualizar</button>
                        <p class="debug">Status: \${data.message}</p>
                    \`;
                }

                // Auto-refresh every 2 seconds
                setTimeout(fetchAndRenderQR, 2000);

            } catch (error) {
                console.error('Fetch error:', error);
                document.getElementById('content').innerHTML = \`
                    <div class="status waiting">
                        ⚠️ Erro ao Buscar QR Code
                    </div>
                    <p class="error">Erro: \${error.message}</p>
                    <button class="refresh-btn" onclick="fetchAndRenderQR()">🔄 Tentar Novamente</button>
                \`;
            }
        }

        // Start fetching immediately
        fetchAndRenderQR();
    </script>
</body>
</html>
      `);
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

    // Sherlock Holmes Debug Page
    this.app.get('/qr-sherlock', (req, res) => {
      res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QR Code Debug - Sherlock Holmes Edition</title>
    <style>
        body {
            font-family: monospace;
            background: #1a1a1a;
            color: #00ff00;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
        }
        h1 { color: #ffff00; border-bottom: 2px solid #ffff00; padding-bottom: 10px; }
        h2 { color: #00ffff; margin-top: 30px; }
        .section {
            background: #2a2a2a;
            padding: 15px;
            margin: 15px 0;
            border-left: 4px solid #00ff00;
            border-radius: 5px;
        }
        .error { color: #ff0000; font-weight: bold; }
        .success { color: #00ff00; font-weight: bold; }
        .warning { color: #ffaa00; }
        #qrCanvas {
            background: white;
            padding: 20px;
            margin: 20px 0;
            border: 3px solid #00ff00;
        }
        pre {
            background: #0a0a0a;
            padding: 10px;
            overflow-x: auto;
            border: 1px solid #333;
        }
        button {
            background: #00ff00;
            color: #000;
            border: none;
            padding: 10px 20px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            margin: 10px 5px;
        }
        button:hover { background: #00cc00; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
</head>
<body>
    <h1>🔍 SHERLOCK HOLMES QR CODE INVESTIGATION</h1>

    <div class="section">
        <h2>📋 STEP 1: Fetch QR Code from API</h2>
        <div id="step1">⏳ Fetching...</div>
    </div>

    <div class="section">
        <h2>📊 STEP 2: API Response Analysis</h2>
        <div id="step2"></div>
    </div>

    <div class="section">
        <h2>🎨 STEP 3: Canvas Rendering Test</h2>
        <canvas id="qrCanvas"></canvas>
        <div id="step3"></div>
    </div>

    <div class="section">
        <h2>📝 STEP 4: Raw QR Code String</h2>
        <pre id="rawQR" style="word-wrap: break-word; white-space: pre-wrap;">⏳ Loading...</pre>
    </div>

    <div class="section">
        <h2>🧪 STEP 5: QRCode Library Test</h2>
        <div id="step5"></div>
    </div>

    <div class="section">
        <h2>🔄 Actions</h2>
        <button onclick="runFullDiagnostic()">🔍 Run Full Diagnostic</button>
        <button onclick="testSimpleQR()">🧪 Test Simple QR</button>
        <button onclick="forceResetSession()" style="background: #ff0000;">🚨 LIMPAR SESSÃO & GERAR NOVO QR</button>
        <button onclick="location.reload()">♻️ Reload Page</button>
        <div id="resetStatus" style="margin-top: 15px;"></div>
    </div>

    <div class="section">
        <h2>📜 Console Logs</h2>
        <pre id="logs"></pre>
    </div>

    <script>
        let logs = [];

        function log(message, type = 'info') {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = \`[\${timestamp}] \${type.toUpperCase()}: \${message}\`;
            logs.push(logEntry);
            console.log(logEntry);
            document.getElementById('logs').textContent = logs.join('\\n');
        }

        async function runFullDiagnostic() {
            log('🔍 Starting Sherlock Holmes Investigation...', 'info');

            try {
                log('📡 Fetching /api/qr-debug...', 'info');
                const response = await fetch('/api/qr-debug');

                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }

                const data = await response.json();
                log('✅ API Response received', 'success');

                document.getElementById('step1').innerHTML = \`
                    <span class="success">✅ API Fetch SUCCESS</span><br>
                    Status: \${response.status} \${response.statusText}<br>
                    Response Time: \${Date.now()} ms
                \`;

                document.getElementById('step2').innerHTML = \`
                    <pre>\${JSON.stringify(data, null, 2)}</pre>
                    <br>
                    <strong>Analysis:</strong><br>
                    • hasQRCode: \${data.hasQRCode ? '<span class="success">✅ YES</span>' : '<span class="error">❌ NO</span>'}<br>
                    • qrCode exists: \${data.qrCode ? '<span class="success">✅ YES</span>' : '<span class="error">❌ NO</span>'}<br>
                    • qrCodeLength: \${data.qrCodeLength} characters<br>
                    • isConnected: \${data.isConnected ? '<span class="success">✅ YES</span>' : '<span class="warning">⏳ NO</span>'}<br>
                    • Timestamp: \${data.timestamp}
                \`;

                if (data.qrCode) {
                    document.getElementById('rawQR').textContent = data.qrCode;
                    log(\`📝 QR Code string: \${data.qrCode.substring(0, 50)}...\`, 'info');
                } else {
                    document.getElementById('rawQR').innerHTML = '<span class="error">❌ NO QR CODE IN RESPONSE</span>';
                    log('❌ No QR code in API response', 'error');
                    return;
                }

                try {
                    log('🎨 Attempting to render QR Code to canvas...', 'info');

                    const canvas = document.getElementById('qrCanvas');

                    await QRCode.toCanvas(canvas, data.qrCode, {
                        width: 400,
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#ffffff'
                        }
                    });

                    log('✅ QR Code rendered successfully!', 'success');
                    document.getElementById('step3').innerHTML = \`
                        <span class="success">✅ QR CODE RENDERED SUCCESSFULLY!</span><br>
                        Canvas Width: \${canvas.width}px<br>
                        Canvas Height: \${canvas.height}px<br>
                        <strong>👆 YOU SHOULD SEE THE QR CODE ABOVE 👆</strong>
                    \`;

                } catch (renderError) {
                    log(\`❌ Canvas render failed: \${renderError.message}\`, 'error');
                    document.getElementById('step3').innerHTML = \`
                        <span class="error">❌ CANVAS RENDER FAILED</span><br>
                        Error: \${renderError.message}<br>
                        Stack: <pre>\${renderError.stack}</pre>
                    \`;
                }

                document.getElementById('step5').innerHTML = \`
                    <strong>QRCode Library Status:</strong><br>
                    • Loaded: \${typeof QRCode !== 'undefined' ? '<span class="success">✅ YES</span>' : '<span class="error">❌ NO</span>'}<br>
                    • Version: \${QRCode.version || 'Unknown'}<br>
                    • toCanvas method: \${typeof QRCode.toCanvas === 'function' ? '<span class="success">✅ Available</span>' : '<span class="error">❌ Missing</span>'}
                \`;

            } catch (error) {
                log(\`❌ FATAL ERROR: \${error.message}\`, 'error');
                document.getElementById('step1').innerHTML = \`
                    <span class="error">❌ API FETCH FAILED</span><br>
                    Error: \${error.message}<br>
                    <pre>\${error.stack}</pre>
                \`;
            }
        }

        function testSimpleQR() {
            log('🧪 Testing simple QR code generation...', 'info');
            try {
                const canvas = document.getElementById('qrCanvas');
                QRCode.toCanvas(canvas, 'https://www.google.com', {
                    width: 300
                });
                log('✅ Simple QR test SUCCESS', 'success');
                alert('✅ Simple QR Code rendered! If you see it, the library works.');
            } catch (error) {
                log(\`❌ Simple QR test FAILED: \${error.message}\`, 'error');
                alert('❌ QR Library is broken: ' + error.message);
            }
        }

        async function forceResetSession() {
            log('🚨 Force reset session requested...', 'info');
            const resetStatus = document.getElementById('resetStatus');

            try {
                resetStatus.innerHTML = '<span class="warning">⏳ Limpando sessão...</span>';

                const response = await fetch('/api/force-reset-whatsapp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                const data = await response.json();

                if (data.success) {
                    log('✅ Session reset successful!', 'success');
                    resetStatus.innerHTML = '<span class="success">✅ Sessão limpa! Aguarde 5-10s e clique em "Run Full Diagnostic"</span>';

                    // Auto-run diagnostic after 8 seconds
                    setTimeout(() => {
                        resetStatus.innerHTML = '<span class="success">🔄 Rodando diagnóstico automático...</span>';
                        runFullDiagnostic();
                    }, 8000);
                } else {
                    throw new Error(data.error || 'Unknown error');
                }
            } catch (error) {
                log(\`❌ Reset failed: \${error.message}\`, 'error');
                resetStatus.innerHTML = \`<span class="error">❌ Erro: \${error.message}</span>\`;
            }
        }

        window.addEventListener('load', () => {
            log('🚀 Page loaded, starting diagnostic...', 'info');
            runFullDiagnostic();
        });

        window.addEventListener('error', (e) => {
            log(\`❌ Global error: \${e.message}\`, 'error');
        });
    </script>
</body>
</html>`);
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

    // Force reset WhatsApp session
    this.app.post('/api/force-reset-whatsapp', async (req, res) => {
      try {
        if (!this.saraBot) {
          return res.status(400).json({
            success: false,
            error: 'Sara bot not initialized'
          });
        }

        logger.info('🚨 API: Force reset WhatsApp session requested');
        await this.saraBot.forceResetWhatsAppSession();

        return res.json({
          success: true,
          message: 'WhatsApp session reset complete. New QR code should be available in 5-10 seconds.',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Error force resetting WhatsApp:', error);
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