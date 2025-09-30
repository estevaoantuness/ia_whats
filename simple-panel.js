const express = require('express');
const cors = require('cors');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const OpenAI = require('openai');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3001;

// Global state
let whatsappSocket = null;
let connectionStatus = 'disconnected';
let qrCodeData = '';
let messageCount = 0;
let startTime = Date.now();

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Middleware
app.use(cors());
app.use(express.json());

// Home route with embedded HTML
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IA WhatsApp Bot - Painel de Controle</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; color: white; margin-bottom: 30px; }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        .card:hover { transform: translateY(-5px); }
        .card-header { display: flex; align-items: center; margin-bottom: 20px; }
        .card-header i { font-size: 1.5rem; margin-right: 10px; }
        .status-indicator {
            display: inline-flex;
            align-items: center;
            padding: 8px 15px;
            border-radius: 25px;
            font-weight: bold;
        }
        .status-connected { background-color: #d4edda; color: #155724; }
        .status-disconnected { background-color: #f8d7da; color: #721c24; }
        .status-waiting { background-color: #fff3cd; color: #856404; }
        .btn {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            cursor: pointer;
            margin: 5px;
            transition: all 0.3s ease;
        }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
        .input-group { margin-bottom: 15px; }
        .input-group label { display: block; margin-bottom: 5px; font-weight: bold; }
        .input-group input, .input-group textarea {
            width: 100%;
            padding: 10px;
            border: 2px solid #e1e1e1;
            border-radius: 8px;
        }
        .qr-container { text-align: center; padding: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
        .stat-item { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 10px; }
        .stat-value { font-size: 1.8rem; font-weight: bold; color: #667eea; }
        .stat-label { font-size: 0.9rem; color: #666; margin-top: 5px; }
        .hidden { display: none; }
        .alert { padding: 15px; margin: 10px 0; border-radius: 8px; font-weight: bold; }
        .alert-success { background-color: #d4edda; color: #155724; }
        .alert-error { background-color: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-robot"></i> IA WhatsApp Bot</h1>
            <p>Painel de Controle com OpenAI</p>
        </div>

        <div class="dashboard">
            <!-- Status Card -->
            <div class="card">
                <div class="card-header">
                    <i class="fas fa-wifi" style="color: #667eea;"></i>
                    <h3>Status da Conexão</h3>
                </div>
                <div id="connection-status" class="status-indicator status-disconnected">
                    <i class="fas fa-circle"></i> <span id="status-text">Carregando...</span>
                </div>
                <div id="qr-section" class="qr-container hidden">
                    <h4>Escaneie para conectar:</h4>
                    <div id="qr-display"></div>
                    <p><small>Use WhatsApp → Aparelhos conectados → Conectar aparelho</small></p>
                </div>
            </div>

            <!-- Stats -->
            <div class="card">
                <div class="card-header">
                    <i class="fas fa-chart-line" style="color: #27ae60;"></i>
                    <h3>Estatísticas</h3>
                </div>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div id="uptime" class="stat-value">0h</div>
                        <div class="stat-label">Uptime</div>
                    </div>
                    <div class="stat-item">
                        <div id="messages" class="stat-value">0</div>
                        <div class="stat-label">Mensagens</div>
                    </div>
                </div>
            </div>

            <!-- Test Message -->
            <div class="card">
                <div class="card-header">
                    <i class="fas fa-paper-plane" style="color: #3498db;"></i>
                    <h3>Enviar Mensagem</h3>
                </div>
                <div class="input-group">
                    <label>Número (com código do país):</label>
                    <input type="text" id="test-number" placeholder="+5511999999999">
                </div>
                <div class="input-group">
                    <label>Mensagem:</label>
                    <textarea id="test-message" rows="3" placeholder="Olá! Esta é uma mensagem de teste."></textarea>
                </div>
                <button class="btn" onclick="sendTestMessage()">
                    <i class="fas fa-paper-plane"></i> Enviar
                </button>
                <div id="test-result"></div>
            </div>

            <!-- Actions -->
            <div class="card">
                <div class="card-header">
                    <i class="fas fa-cogs" style="color: #e67e22;"></i>
                    <h3>Controles</h3>
                </div>
                <button class="btn" onclick="startWhatsApp()">
                    <i class="fas fa-play"></i> Conectar WhatsApp
                </button>
                <button class="btn" onclick="refreshStatus()">
                    <i class="fas fa-sync-alt"></i> Atualizar
                </button>
                <button class="btn" onclick="testOpenAI()">
                    <i class="fas fa-robot"></i> Testar IA
                </button>
            </div>
        </div>
    </div>

    <script>
        async function refreshStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                updateStatus(data.status, data.qrCode);
                updateStats(data.uptime, data.messageCount);
            } catch (error) {
                console.error('Error:', error);
            }
        }

        function updateStatus(status, qrCode) {
            const statusElement = document.getElementById('connection-status');
            const statusText = document.getElementById('status-text');
            const qrSection = document.getElementById('qr-section');

            statusElement.className = 'status-indicator';

            switch(status) {
                case 'connected':
                    statusElement.classList.add('status-connected');
                    statusText.textContent = 'Conectado ✅';
                    qrSection.classList.add('hidden');
                    break;
                case 'waiting':
                    statusElement.classList.add('status-waiting');
                    statusText.textContent = 'Aguardando QR Scan';
                    qrSection.classList.remove('hidden');
                    if (qrCode) {
                        document.getElementById('qr-display').innerHTML =
                            '<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(qrCode) + '" alt="QR Code">';
                    }
                    break;
                default:
                    statusElement.classList.add('status-disconnected');
                    statusText.textContent = 'Desconectado ❌';
                    qrSection.classList.add('hidden');
            }
        }

        function updateStats(uptime, messageCount) {
            document.getElementById('uptime').textContent = Math.floor(uptime / 3600) + 'h';
            document.getElementById('messages').textContent = messageCount;
        }

        async function startWhatsApp() {
            try {
                showAlert('Iniciando WhatsApp...', 'success');
                const response = await fetch('/api/start-whatsapp', { method: 'POST' });
                const result = await response.json();

                if (result.success) {
                    showAlert('WhatsApp iniciado! Aguarde o QR Code...', 'success');
                    setTimeout(refreshStatus, 2000);
                } else {
                    showAlert('Erro: ' + result.error, 'error');
                }
            } catch (error) {
                showAlert('Erro: ' + error.message, 'error');
            }
        }

        async function sendTestMessage() {
            const number = document.getElementById('test-number').value;
            const message = document.getElementById('test-message').value;

            if (!number || !message) {
                showAlert('Preencha número e mensagem!', 'error');
                return;
            }

            try {
                const response = await fetch('/api/send-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ number, message })
                });

                const result = await response.json();

                if (result.success) {
                    showAlert('Mensagem enviada com sucesso! ✅', 'success');
                    document.getElementById('test-message').value = '';
                } else {
                    showAlert('Erro: ' + result.error, 'error');
                }
            } catch (error) {
                showAlert('Erro: ' + error.message, 'error');
            }
        }

        async function testOpenAI() {
            try {
                showAlert('Testando OpenAI...', 'success');
                const response = await fetch('/api/test-openai', { method: 'POST' });
                const result = await response.json();

                if (result.success) {
                    showAlert('OpenAI OK: ' + result.response.substring(0, 50) + '...', 'success');
                } else {
                    showAlert('Erro OpenAI: ' + result.error, 'error');
                }
            } catch (error) {
                showAlert('Erro: ' + error.message, 'error');
            }
        }

        function showAlert(message, type) {
            const existingAlert = document.querySelector('.alert');
            if (existingAlert) existingAlert.remove();

            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-' + type;
            alertDiv.textContent = message;

            document.querySelector('.container').appendChild(alertDiv);
            setTimeout(() => alertDiv.remove(), 4000);
        }

        // Auto refresh every 5 seconds
        setInterval(refreshStatus, 5000);
        refreshStatus();
    </script>
</body>
</html>
  `);
});

// API Routes
app.get('/api/status', (req, res) => {
  const uptime = (Date.now() - startTime) / 1000;
  res.json({
    status: connectionStatus,
    qrCode: qrCodeData,
    uptime: uptime,
    messageCount: messageCount,
    openaiConfigured: !!process.env.OPENAI_API_KEY
  });
});

app.post('/api/start-whatsapp', async (req, res) => {
  try {
    if (whatsappSocket) {
      return res.json({ success: false, error: 'WhatsApp já está iniciado' });
    }

    console.log('🔄 Iniciando WhatsApp...');

    const sessionPath = path.join(process.cwd(), 'data', 'auth', 'panel_session');
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    whatsappSocket = makeWASocket({
      auth: state,
      browser: ['Panel Bot', 'Chrome', '1.0.0'],
    });

    whatsappSocket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCodeData = qr;
        connectionStatus = 'waiting';
        console.log('📱 QR Code gerado! Escaneie no painel web.');
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('❌ Conexão fechada:', lastDisconnect?.error?.message);

        if (!shouldReconnect) {
          connectionStatus = 'disconnected';
          whatsappSocket = null;
        }
      } else if (connection === 'open') {
        connectionStatus = 'connected';
        qrCodeData = '';
        console.log('🎉 WhatsApp conectado com sucesso!');
      }
    });

    whatsappSocket.ev.on('creds.update', saveCreds);

    whatsappSocket.ev.on('messages.upsert', async (m) => {
      for (const message of m.messages) {
        if (message && !message.key.fromMe && message.message?.conversation) {
          messageCount++;
          const text = message.message.conversation;
          const from = message.key.remoteJid;

          console.log('📩 Nova mensagem: "' + text + '"');

          // Resposta automática com OpenAI
          if (process.env.OPENAI_API_KEY && from) {
            try {
              const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'system',
                    content: 'Você é um assistente útil e amigável. Responda de forma concisa e em português.'
                  },
                  { role: 'user', content: text }
                ],
                max_tokens: 150,
                temperature: 0.7
              });

              const response = completion.choices[0]?.message?.content || 'Desculpe, não consegui responder.';
              await whatsappSocket.sendMessage(from, { text: '🤖 ' + response });
              console.log('📤 Resposta IA enviada!');
            } catch (error) {
              console.error('❌ Erro OpenAI:', error.message);
              await whatsappSocket.sendMessage(from, {
                text: '🤖 Olá! Recebi sua mensagem. Estou tendo problemas técnicos no momento, mas já registrei seu contato!'
              });
            }
          }
        }
      }
    });

    res.json({ success: true, message: 'WhatsApp iniciado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao iniciar WhatsApp:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/send-message', async (req, res) => {
  try {
    const { number, message } = req.body;

    if (!whatsappSocket || connectionStatus !== 'connected') {
      return res.json({ success: false, error: 'WhatsApp não está conectado' });
    }

    const formattedNumber = number.includes('@') ? number : number + '@s.whatsapp.net';
    await whatsappSocket.sendMessage(formattedNumber, { text: message });

    console.log('📤 Mensagem enviada para ' + number);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/test-openai', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.json({ success: false, error: 'API Key da OpenAI não configurada' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Olá! Você está funcionando corretamente?' }],
      max_tokens: 50
    });

    const response = completion.choices[0]?.message?.content || 'Sem resposta';
    res.json({ success: true, response });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
🌐 PAINEL WEB DA IA WHATSAPP INICIADO!

📊 Acesse: http://localhost:${PORT}
🤖 OpenAI: ${process.env.OPENAI_API_KEY ? '✅ Configurado' : '❌ Não configurado'}

🚀 COMO USAR:
1. Acesse o painel no browser
2. Clique em "Conectar WhatsApp"
3. Escaneie o QR Code
4. Envie mensagens para testar!

💡 O bot responderá automaticamente usando OpenAI!
`);
});