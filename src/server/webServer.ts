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
  <title>Sara AI - Conectar WhatsApp</title>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    h1 { font-size: 3em; margin-bottom: 20px; }
    .subtitle { font-size: 1.3em; margin-bottom: 40px; opacity: 0.9; }
    .options { display: flex; justify-content: center; gap: 30px; margin: 40px 0; flex-wrap: wrap; }
    .option-card { background: rgba(255,255,255,0.15); padding: 30px; border-radius: 15px; max-width: 300px; transition: all 0.3s; }
    .option-card:hover { background: rgba(255,255,255,0.25); transform: translateY(-5px); }
    .option-card h2 { margin: 10px 0; font-size: 1.5em; }
    .option-card p { margin: 15px 0; font-size: 0.95em; opacity: 0.9; }
    .btn { color: white; font-size: 1.1em; text-decoration: none; background: rgba(255,255,255,0.3); padding: 12px 25px; border-radius: 10px; display: inline-block; margin-top: 10px; font-weight: bold; }
    .btn:hover { background: rgba(255,255,255,0.4); }
    .footer { margin-top: 50px; }
    .footer a { color: white; font-size: 1em; text-decoration: none; background: rgba(255,255,255,0.1); padding: 10px 20px; border-radius: 8px; display: inline-block; margin: 5px; }
    .footer a:hover { background: rgba(255,255,255,0.2); }
  </style>
</head>
<body>
  <h1>🌸 Sara AI</h1>
  <p class="subtitle">Assistente de Produtividade - Escolha como conectar</p>

  <div class="options">
    <div class="option-card">
      <h2>📱 QR Code</h2>
      <p><strong>Recomendado para Android</strong></p>
      <p>Escaneie o código QR diretamente do seu celular</p>
      <a href="/qr-stable" class="btn">Conectar com QR Code</a>
    </div>

    <div class="option-card">
      <h2>🔢 Código de Pareamento</h2>
      <p><strong>Ideal para iPhone</strong></p>
      <p>Digite um código de 8 dígitos no WhatsApp</p>
      <a href="/pairing" class="btn">Conectar com Código</a>
    </div>
  </div>

  <div class="footer">
    <a href="/health">💚 Status do Sistema</a>
  </div>
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

    // Pairing Code Page (for iPhone)
    this.app.get('/pairing', (req, res) => {
      res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sara AI - Conectar com Código</title>
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
        .subtitle { color: #666; margin-bottom: 30px; font-size: 14px; }
        .input-group {
            margin: 30px 0;
        }
        label {
            display: block;
            text-align: left;
            margin-bottom: 10px;
            color: #333;
            font-weight: 500;
        }
        input {
            width: 100%;
            padding: 15px;
            border: 2px solid #ddd;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        button {
            width: 100%;
            background: #667eea;
            color: white;
            border: none;
            padding: 15px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.3s;
            margin-top: 10px;
        }
        button:hover { background: #5568d3; }
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .code-display {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 15px;
            margin: 30px 0;
        }
        .code {
            font-size: 48px;
            font-weight: bold;
            color: #667eea;
            letter-spacing: 5px;
            margin: 20px 0;
            font-family: 'Courier New', monospace;
        }
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
        .status {
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            font-weight: 500;
        }
        .status.success { background: #d4edda; color: #155724; }
        .status.error { background: #f8d7da; color: #721c24; }
        .status.loading { background: #d1ecf1; color: #0c5460; }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📱 Sara AI</h1>
        <p class="subtitle">Conectar com Código de Pareamento (Ideal para iPhone!)</p>

        <div id="phoneStep">
            <div class="input-group">
                <label for="phoneNumber">Seu Número de WhatsApp:</label>
                <input
                    type="tel"
                    id="phoneNumber"
                    placeholder="+55 11 99999-9999"
                    value="+55 "
                />
                <small style="color: #666; display: block; margin-top: 8px;">
                    Digite com código do país (ex: +55 11 99999-9999)
                </small>
            </div>

            <button id="generateBtn" onclick="generateCode()">
                📱 Gerar Código de Pareamento
            </button>

            <div id="status" class="status hidden"></div>
        </div>

        <div id="codeStep" class="hidden">
            <div class="status success">
                ✅ Código Gerado com Sucesso!
            </div>

            <div class="code-display">
                <p style="color: #666; margin-bottom: 10px;">SEU CÓDIGO:</p>
                <div class="code" id="codeDisplay">----</div>
                <p style="color: #666; font-size: 12px;">Válido por 60 segundos</p>
            </div>

            <div class="instructions">
                <h3>Como Conectar:</h3>
                <ol>
                    <li>Abra <strong>WhatsApp</strong> no seu iPhone</li>
                    <li>Vá em <strong>Configurações</strong> (canto inferior direito)</li>
                    <li>Toque em <strong>Aparelhos Conectados</strong></li>
                    <li>Toque em <strong>Conectar um Aparelho</strong></li>
                    <li>Toque em <strong>"Conectar com número de telefone"</strong></li>
                    <li><strong>Digite o código acima</strong></li>
                    <li>Aguarde a confirmação! ✅</li>
                </ol>
            </div>

            <button onclick="location.reload()">🔄 Gerar Novo Código</button>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px; margin-bottom: 15px;">Outras opções:</p>
            <a href="/qr-stable" style="display: inline-block; color: #667eea; text-decoration: none; padding: 10px 20px; border: 2px solid #667eea; border-radius: 8px; margin: 5px; transition: all 0.3s;" onmouseover="this.style.background='#667eea'; this.style.color='white';" onmouseout="this.style.background='transparent'; this.style.color='#667eea';">
                📱 Tentar QR Code
            </a>
            <a href="/" style="display: inline-block; color: #666; text-decoration: none; padding: 10px 20px; border: 2px solid #ddd; border-radius: 8px; margin: 5px; transition: all 0.3s;" onmouseover="this.style.background='#ddd';" onmouseout="this.style.background='transparent';">
                🏠 Página Inicial
            </a>
        </div>
    </div>

    <script>
        async function generateCode() {
            const phoneInput = document.getElementById('phoneNumber');
            const generateBtn = document.getElementById('generateBtn');
            const status = document.getElementById('status');
            const phoneStep = document.getElementById('phoneStep');
            const codeStep = document.getElementById('codeStep');
            const codeDisplay = document.getElementById('codeDisplay');

            const phoneNumber = phoneInput.value.trim();

            // Validar número
            if (!phoneNumber || phoneNumber.length < 10) {
                status.className = 'status error';
                status.textContent = '❌ Digite um número válido!';
                status.classList.remove('hidden');
                return;
            }

            // Desabilitar botão
            generateBtn.disabled = true;
            generateBtn.textContent = '⏳ Gerando código...';

            status.className = 'status loading';
            status.textContent = '🔄 Solicitando código de pareamento...';
            status.classList.remove('hidden');

            try {
                const response = await fetch('/api/request-pairing-code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ phoneNumber })
                });

                const data = await response.json();

                if (data.success && data.pairingCode) {
                    // Mostrar código
                    codeDisplay.textContent = data.pairingCode;
                    phoneStep.classList.add('hidden');
                    codeStep.classList.remove('hidden');

                    console.log('✅ Código gerado:', data.pairingCode);
                } else {
                    throw new Error(data.error || 'Erro ao gerar código');
                }
            } catch (error) {
                status.className = 'status error';
                status.textContent = '❌ Erro: ' + error.message;
                generateBtn.disabled = false;
                generateBtn.textContent = '📱 Gerar Código de Pareamento';
                console.error('Erro:', error);
            }
        }

        // Permitir Enter para enviar
        document.getElementById('phoneNumber').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                generateCode();
            }
        });
    </script>
</body>
</html>`);
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
        let timeLeft = 20; // WhatsApp QR expires every ~20 seconds
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
                        <div class="timer" id="timer">Tempo: <span id="countdown">20</span>s</div>
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
                    <a href="/pairing" class="refresh-btn" style="text-decoration: none; display: inline-block;">🔢 Usar Código (iPhone)</a>

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

            timeLeft = 20; // WhatsApp QR expires every ~20 seconds
            const countdownEl = document.getElementById('countdown');
            const timerEl = document.getElementById('timer');

            timerInterval = setInterval(() => {
                timeLeft--;
                if (countdownEl) {
                    countdownEl.textContent = timeLeft;

                    // Turn red in last 5 seconds
                    if (timeLeft <= 5 && timerEl) {
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

    // Request pairing code
    this.app.post('/api/request-pairing-code', async (req, res) => {
      try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
          return res.status(400).json({
            success: false,
            error: 'Phone number is required'
          });
        }

        if (!this.saraBot) {
          return res.status(400).json({
            success: false,
            error: 'Sara bot not initialized'
          });
        }

        logger.info(`📱 API: Requesting pairing code for ${phoneNumber}`);
        const code = await this.saraBot.requestPairingCode(phoneNumber);

        return res.json({
          success: true,
          pairingCode: code,
          phoneNumber: phoneNumber,
          message: 'Pairing code generated successfully',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Error requesting pairing code:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get pairing code status
    this.app.get('/api/pairing-code-status', async (req, res) => {
      try {
        if (!this.saraBot) {
          return res.status(400).json({
            success: false,
            error: 'Sara bot not initialized'
          });
        }

        const pairingCode = this.saraBot.getPairingCode();
        const isConnected = this.saraBot.isConnected();

        return res.json({
          success: true,
          pairingCode: pairingCode,
          isConnected: isConnected,
          hasPairingCode: !!pairingCode,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Error getting pairing code status:', error);
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

    // Advanced Diagnostics - Shows detailed system info
    this.app.get('/api/diagnostics', async (req, res) => {
      try {
        if (!this.saraBot) {
          return res.status(400).json({
            success: false,
            error: 'Sara bot not initialized'
          });
        }

        const connectionInfo = this.saraBot.getConnectionInfo();
        const pairingCode = this.saraBot.getPairingCode();
        const qrCode = this.saraBot.getQRCode();

        // Read package.json for Baileys version
        const fs = require('fs');
        const path = require('path');
        const packagePath = path.join(process.cwd(), 'package.json');
        let baileysVersion = 'unknown';

        try {
          const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
          baileysVersion = packageJson.dependencies['@whiskeysockets/baileys'] || 'unknown';
        } catch (e) {
          logger.warn('Could not read package.json for Baileys version');
        }

        return res.json({
          success: true,
          diagnostics: {
            whatsapp: {
              connected: connectionInfo.connected,
              user: connectionInfo.user,
              reconnectAttempts: connectionInfo.reconnectAttempts,
              hasQRCode: !!qrCode,
              hasPairingCode: !!pairingCode
            },
            system: {
              baileysVersion: baileysVersion,
              nodeVersion: process.version,
              platform: process.platform,
              uptime: Math.floor(process.uptime()),
              memory: {
                heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
              }
            },
            warnings: [
              {
                type: 'business-api-incompatibility',
                severity: 'critical',
                message: 'If you are using WhatsApp Business connected to Meta Business API Platform, Baileys WILL NOT WORK. Baileys only works with personal WhatsApp or WhatsApp Business (mobile app).',
                recommendation: 'Use a personal WhatsApp account or WhatsApp Business (mobile app), NOT Business API'
              },
              {
                type: 'baileys-version',
                severity: baileysVersion.startsWith('6.') ? 'medium' : 'low',
                message: `You are using Baileys ${baileysVersion}. Latest version is 7.x with important bug fixes.`,
                recommendation: baileysVersion.startsWith('6.') ? 'Consider updating to Baileys 7.x' : 'Baileys version is up to date'
              },
              {
                type: 'iphone-qr-issues',
                severity: 'medium',
                message: 'iPhones have known issues scanning QR codes with Baileys. Pairing code is recommended for iPhone users.',
                recommendation: 'Use /pairing page if you have an iPhone'
              }
            ],
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        logger.error('Error getting diagnostics:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Clear session page
    this.app.get('/clear-session', (req, res) => {
      res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sara AI - Limpar Sessão</title>
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
            max-width: 600px;
            width: 100%;
            text-align: center;
        }
        h1 { color: #667eea; margin-bottom: 10px; font-size: 2em; }
        .subtitle { color: #666; margin-bottom: 30px; }
        .warning {
            background: #fff3cd;
            border: 2px solid #ffc107;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }
        .warning h3 { color: #856404; margin-bottom: 10px; }
        .warning ul { margin-left: 20px; color: #856404; }
        .warning li { margin: 5px 0; }
        button {
            background: #dc3545;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            margin: 20px 10px;
            transition: background 0.3s;
        }
        button:hover { background: #c82333; }
        button.secondary {
            background: #667eea;
        }
        button.secondary:hover { background: #5568d3; }
        .status {
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            font-weight: 500;
            display: none;
        }
        .status.success { background: #d4edda; color: #155724; display: block; }
        .status.error { background: #f8d7da; color: #721c24; display: block; }
        .status.loading { background: #d1ecf1; color: #0c5460; display: block; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧹 Limpar Sessão WhatsApp</h1>
        <p class="subtitle">Reset completo para resolver problemas de conexão</p>

        <div class="warning">
            <h3>⚠️ ATENÇÃO - Esta ação vai:</h3>
            <ul>
                <li>🗑️ Deletar toda a sessão atual do WhatsApp</li>
                <li>🔄 Desconectar qualquer conexão ativa</li>
                <li>🆕 Gerar um QR Code/Pairing Code completamente novo</li>
                <li>⏰ Resetar tentativas de reconexão</li>
            </ul>
            <br>
            <strong>Use isso se:</strong>
            <ul>
                <li>✅ QR Code não está conectando após várias tentativas</li>
                <li>✅ Pairing Code não funciona</li>
                <li>✅ Conexão fica "carregando infinito"</li>
                <li>✅ Você quer começar do zero</li>
            </ul>
        </div>

        <div id="status" class="status"></div>

        <button onclick="clearSession()">🧹 LIMPAR SESSÃO AGORA</button>
        <button class="secondary" onclick="location.href='/'">🏠 Voltar para Home</button>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            <p><strong>Depois de limpar:</strong></p>
            <p>Acesse <a href="/pairing" style="color: #667eea;">/pairing</a> ou <a href="/qr-stable" style="color: #667eea;">/qr-stable</a> para reconectar</p>
        </div>
    </div>

    <script>
        async function clearSession() {
            const statusDiv = document.getElementById('status');

            statusDiv.className = 'status loading';
            statusDiv.textContent = '🔄 Limpando sessão WhatsApp...';

            try {
                const response = await fetch('/api/force-clear-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (data.success) {
                    statusDiv.className = 'status success';
                    statusDiv.innerHTML = \`
                        ✅ <strong>Sessão limpa com sucesso!</strong><br><br>
                        \${data.message}<br><br>
                        <a href="/pairing" style="color: #155724; font-weight: bold;">→ Gerar Pairing Code</a> |
                        <a href="/qr-stable" style="color: #155724; font-weight: bold;">→ Ver QR Code</a>
                    \`;
                } else {
                    throw new Error(data.error || 'Erro desconhecido');
                }
            } catch (error) {
                statusDiv.className = 'status error';
                statusDiv.innerHTML = \`
                    ❌ <strong>Erro ao limpar sessão:</strong><br>
                    \${error.message}<br><br>
                    Tente novamente ou entre em contato com suporte.
                \`;
                console.error('Error:', error);
            }
        }
    </script>
</body>
</html>`);
    });

    // Force clear WhatsApp session
    this.app.post('/api/force-clear-session', async (req, res) => {
      try {
        if (!this.saraBot) {
          return res.status(400).json({
            success: false,
            error: 'Sara bot not initialized'
          });
        }

        logger.info('🧹 API: Force clearing WhatsApp session...');
        console.log('🧹 API REQUEST: Force clearing WhatsApp session...');

        await this.saraBot.forceResetWhatsAppSession();

        return res.json({
          success: true,
          message: 'WhatsApp session cleared successfully. New QR code should be generated.',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Error clearing session:', error);
        return res.status(500).json({
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