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
let isReconnecting = false;

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Middleware
app.use(cors());
app.use(express.json());

// Função para conectar/reconectar WhatsApp
async function connectWhatsApp() {
  try {
    if (whatsappSocket || isReconnecting) {
      console.log('⚠️ WhatsApp já está conectado ou reconectando...');
      return;
    }

    isReconnecting = true;
    console.log('🔄 Conectando ao WhatsApp...');

    const sessionPath = path.join(process.cwd(), 'data', 'auth', 'robust_session');
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    whatsappSocket = makeWASocket({
      auth: state,
      browser: ['IA Bot', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 10000,
      generateHighQualityLinkPreview: true,
    });

    whatsappSocket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCodeData = qr;
        connectionStatus = 'waiting';
        console.log('📱 QR Code gerado! Escaneie no painel.');
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('❌ Conexão fechada:', lastDisconnect?.error?.message);

        whatsappSocket = null;
        isReconnecting = false;

        if (shouldReconnect) {
          connectionStatus = 'reconnecting';
          console.log('🔄 Tentando reconectar em 5 segundos...');
          setTimeout(() => {
            connectWhatsApp();
          }, 5000);
        } else {
          connectionStatus = 'disconnected';
          qrCodeData = '';
        }
      } else if (connection === 'open') {
        connectionStatus = 'connected';
        qrCodeData = '';
        isReconnecting = false;
        console.log('🎉 WhatsApp conectado com sucesso!');
      } else if (connection === 'connecting') {
        connectionStatus = 'connecting';
        console.log('🔗 Conectando...');
      }
    });

    whatsappSocket.ev.on('creds.update', saveCreds);

    whatsappSocket.ev.on('messages.upsert', async (m) => {
      try {
        for (const message of m.messages) {
          if (message && !message.key.fromMe && message.message?.conversation) {
            messageCount++;
            const text = message.message.conversation;
            const from = message.key.remoteJid;

            console.log('📩 Nova mensagem: "' + text + '"');

            // Resposta automática com OpenAI
            if (process.env.OPENAI_API_KEY && from && whatsappSocket) {
              try {
                const completion = await openai.chat.completions.create({
                  model: 'gpt-4o-mini',
                  messages: [
                    {
                      role: 'system',
                      content: 'Você é um assistente virtual útil e amigável. Responda de forma concisa em português brasileiro.'
                    },
                    { role: 'user', content: text }
                  ],
                  max_tokens: 200,
                  temperature: 0.7
                });

                const response = completion.choices[0]?.message?.content || 'Desculpe, não consegui responder.';

                if (whatsappSocket) {
                  await whatsappSocket.sendMessage(from, { text: '🤖 ' + response });
                  console.log('📤 Resposta enviada com sucesso!');
                }
              } catch (error) {
                console.error('❌ Erro OpenAI:', error.message);
                if (whatsappSocket) {
                  await whatsappSocket.sendMessage(from, {
                    text: '🤖 Olá! Recebi sua mensagem. No momento estou com problemas técnicos, mas já anotei seu contato!'
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Erro processando mensagem:', error);
      }
    });

    isReconnecting = false;
  } catch (error) {
    console.error('❌ Erro ao conectar WhatsApp:', error);
    isReconnecting = false;
    whatsappSocket = null;
    connectionStatus = 'error';

    // Tentar reconectar em 10 segundos
    setTimeout(() => {
      connectWhatsApp();
    }, 10000);
  }
}

// HTML do painel
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🤖 IA WhatsApp - Painel de Controle</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; color: white; margin-bottom: 30px; }
        .header h1 { font-size: 2.8rem; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
        .header p { font-size: 1.2rem; opacity: 0.9; }
        .dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 25px; margin-bottom: 30px; }
        .card {
            background: white;
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,0,0,0.15); }
        .card-header { display: flex; align-items: center; margin-bottom: 25px; }
        .card-header i { font-size: 1.8rem; margin-right: 15px; }
        .card-header h3 { font-size: 1.4rem; }
        .status-indicator {
            display: inline-flex;
            align-items: center;
            padding: 12px 20px;
            border-radius: 30px;
            font-weight: bold;
            font-size: 1rem;
            margin-bottom: 15px;
        }
        .status-connected { background-color: #d4edda; color: #155724; }
        .status-disconnected { background-color: #f8d7da; color: #721c24; }
        .status-waiting { background-color: #fff3cd; color: #856404; }
        .status-connecting { background-color: #d1ecf1; color: #0c5460; }
        .status-reconnecting { background-color: #ffeaa7; color: #6c5ce7; }
        .status-error { background-color: #fdcae1; color: #d63031; }
        .btn {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 15px 25px;
            border-radius: 30px;
            cursor: pointer;
            margin: 8px;
            transition: all 0.3s ease;
            font-size: 1rem;
            font-weight: 600;
        }
        .btn:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .btn-success { background: linear-gradient(45deg, #00b894, #00cec9); }
        .btn-danger { background: linear-gradient(45deg, #e17055, #d63031); }
        .input-group { margin-bottom: 20px; }
        .input-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #2d3436; }
        .input-group input, .input-group textarea {
            width: 100%;
            padding: 15px;
            border: 2px solid #ddd;
            border-radius: 12px;
            font-size: 1rem;
            transition: all 0.3s ease;
        }
        .input-group input:focus, .input-group textarea:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .qr-container { text-align: center; padding: 25px; }
        .qr-code {
            background: white;
            padding: 20px;
            border-radius: 15px;
            display: inline-block;
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 20px; }
        .stat-item { text-align: center; padding: 20px; background: #f8f9fa; border-radius: 15px; }
        .stat-value { font-size: 2.2rem; font-weight: bold; color: #667eea; margin-bottom: 5px; }
        .stat-label { font-size: 1rem; color: #636e72; font-weight: 500; }
        .hidden { display: none; }
        .alert {
            padding: 20px;
            margin: 15px 0;
            border-radius: 12px;
            font-weight: 600;
            animation: slideIn 0.3s ease;
        }
        .alert-success { background-color: #d4edda; color: #155724; border-left: 4px solid #28a745; }
        .alert-error { background-color: #f8d7da; color: #721c24; border-left: 4px solid #dc3545; }
        .logs-container {
            max-height: 300px;
            overflow-y: auto;
            background: #2c3e50;
            color: #ecf0f1;
            padding: 20px;
            border-radius: 12px;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
        }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        .connection-info { background: #f1f3f4; padding: 15px; border-radius: 10px; margin-top: 15px; }
        .connection-info small { color: #5f6368; }
        @media (max-width: 768px) {
            .dashboard { grid-template-columns: 1fr; }
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-robot"></i> IA WhatsApp Bot</h1>
            <p>Painel de Controle Inteligente com OpenAI</p>
        </div>

        <div class="dashboard">
            <!-- Status Card -->
            <div class="card">
                <div class="card-header">
                    <i class="fas fa-wifi" style="color: #667eea;"></i>
                    <h3>Status da Conexão</h3>
                </div>
                <div id="connection-status" class="status-indicator status-disconnected">
                    <i class="fas fa-circle pulse"></i> <span id="status-text">Carregando...</span>
                </div>
                <div id="qr-section" class="qr-container hidden">
                    <h4>📱 Escaneie para conectar:</h4>
                    <div id="qr-display" class="qr-code"></div>
                    <p><small>WhatsApp → Aparelhos conectados → Conectar aparelho</small></p>
                </div>
                <div class="connection-info">
                    <small><i class="fas fa-info-circle"></i> Reconexão automática habilitada</small>
                </div>
            </div>

            <!-- Stats -->
            <div class="card">
                <div class="card-header">
                    <i class="fas fa-chart-line" style="color: #00b894;"></i>
                    <h3>Estatísticas do Sistema</h3>
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
                    <div class="stat-item">
                        <div id="openai-status" class="stat-value">❓</div>
                        <div class="stat-label">OpenAI</div>
                    </div>
                </div>
            </div>

            <!-- Test Message -->
            <div class="card">
                <div class="card-header">
                    <i class="fas fa-paper-plane" style="color: #0984e3;"></i>
                    <h3>Enviar Mensagem de Teste</h3>
                </div>
                <div class="input-group">
                    <label for="test-number">📞 Número (com código do país):</label>
                    <input type="text" id="test-number" placeholder="+5511999999999" autocomplete="tel">
                </div>
                <div class="input-group">
                    <label for="test-message">💬 Mensagem:</label>
                    <textarea id="test-message" rows="4" placeholder="Digite sua mensagem de teste aqui..."></textarea>
                </div>
                <button class="btn btn-success" onclick="sendTestMessage()" id="send-btn">
                    <i class="fas fa-paper-plane"></i> Enviar Mensagem
                </button>
                <div id="test-result"></div>
            </div>

            <!-- Controls -->
            <div class="card">
                <div class="card-header">
                    <i class="fas fa-cogs" style="color: #fdcb6e;"></i>
                    <h3>Controles do Sistema</h3>
                </div>
                <button class="btn" onclick="connectWhatsApp()" id="connect-btn">
                    <i class="fas fa-play"></i> Conectar WhatsApp
                </button>
                <button class="btn btn-success" onclick="refreshStatus()">
                    <i class="fas fa-sync-alt"></i> Atualizar Status
                </button>
                <button class="btn" onclick="testOpenAI()">
                    <i class="fas fa-robot"></i> Testar OpenAI
                </button>
                <button class="btn btn-danger" onclick="clearLogs()">
                    <i class="fas fa-trash"></i> Limpar Logs
                </button>
            </div>
        </div>

        <!-- Logs -->
        <div class="card">
            <div class="card-header">
                <i class="fas fa-terminal" style="color: #6c5ce7;"></i>
                <h3>Logs do Sistema</h3>
            </div>
            <div class="logs-container" id="logs-container">
                <div>🚀 Sistema iniciado...</div>
            </div>
        </div>
    </div>

    <script>
        let logCount = 0;

        function addLog(message, type = 'info') {
            const logsContainer = document.getElementById('logs-container');
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');

            const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
            logEntry.innerHTML = '[' + timestamp + '] ' + icon + ' ' + message;

            logsContainer.appendChild(logEntry);
            logsContainer.scrollTop = logsContainer.scrollHeight;

            // Manter apenas os últimos 50 logs
            if (logCount++ > 50) {
                logsContainer.removeChild(logsContainer.firstChild);
            }
        }

        async function refreshStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();

                updateStatus(data.status, data.qrCode);
                updateStats(data.uptime, data.messageCount, data.openaiConfigured);

                addLog('Status atualizado com sucesso', 'success');
            } catch (error) {
                addLog('Erro ao atualizar status: ' + error.message, 'error');
            }
        }

        function updateStatus(status, qrCode) {
            const statusElement = document.getElementById('connection-status');
            const statusText = document.getElementById('status-text');
            const qrSection = document.getElementById('qr-section');
            const connectBtn = document.getElementById('connect-btn');

            statusElement.className = 'status-indicator';

            switch(status) {
                case 'connected':
                    statusElement.classList.add('status-connected');
                    statusText.innerHTML = '<i class="fas fa-check-circle"></i> Conectado';
                    qrSection.classList.add('hidden');
                    connectBtn.disabled = true;
                    connectBtn.innerHTML = '<i class="fas fa-check"></i> Conectado';
                    break;
                case 'waiting':
                    statusElement.classList.add('status-waiting');
                    statusText.innerHTML = '<i class="fas fa-qrcode"></i> Aguardando QR Scan';
                    qrSection.classList.remove('hidden');
                    if (qrCode) {
                        document.getElementById('qr-display').innerHTML =
                            '<img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' +
                            encodeURIComponent(qrCode) + '" alt="QR Code" style="border-radius: 10px;">';
                    }
                    connectBtn.disabled = true;
                    break;
                case 'connecting':
                    statusElement.classList.add('status-connecting');
                    statusText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...';
                    qrSection.classList.add('hidden');
                    connectBtn.disabled = true;
                    break;
                case 'reconnecting':
                    statusElement.classList.add('status-reconnecting');
                    statusText.innerHTML = '<i class="fas fa-sync fa-spin"></i> Reconectando...';
                    qrSection.classList.add('hidden');
                    connectBtn.disabled = true;
                    break;
                case 'error':
                    statusElement.classList.add('status-error');
                    statusText.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro';
                    qrSection.classList.add('hidden');
                    connectBtn.disabled = false;
                    connectBtn.innerHTML = '<i class="fas fa-redo"></i> Tentar Novamente';
                    break;
                default:
                    statusElement.classList.add('status-disconnected');
                    statusText.innerHTML = '<i class="fas fa-times-circle"></i> Desconectado';
                    qrSection.classList.add('hidden');
                    connectBtn.disabled = false;
                    connectBtn.innerHTML = '<i class="fas fa-play"></i> Conectar WhatsApp';
            }
        }

        function updateStats(uptime, messageCount, openaiConfigured) {
            document.getElementById('uptime').textContent = Math.floor(uptime / 3600) + 'h';
            document.getElementById('messages').textContent = messageCount;
            document.getElementById('openai-status').textContent = openaiConfigured ? '✅' : '❌';
        }

        async function connectWhatsApp() {
            try {
                addLog('Iniciando conexão WhatsApp...', 'info');
                const response = await fetch('/api/start-whatsapp', { method: 'POST' });
                const result = await response.json();

                if (result.success) {
                    addLog(result.message || 'WhatsApp iniciado!', 'success');
                    setTimeout(refreshStatus, 2000);
                } else {
                    addLog('Erro: ' + result.error, 'error');
                    showAlert('Erro: ' + result.error, 'error');
                }
            } catch (error) {
                addLog('Erro de conexão: ' + error.message, 'error');
                showAlert('Erro de conexão: ' + error.message, 'error');
            }
        }

        async function sendTestMessage() {
            const number = document.getElementById('test-number').value;
            const message = document.getElementById('test-message').value;
            const sendBtn = document.getElementById('send-btn');

            if (!number || !message) {
                showAlert('Por favor, preencha o número e a mensagem!', 'error');
                return;
            }

            try {
                sendBtn.disabled = true;
                sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

                const response = await fetch('/api/send-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ number, message })
                });

                const result = await response.json();

                if (result.success) {
                    showAlert('✅ Mensagem enviada com sucesso!', 'success');
                    addLog('Mensagem enviada para ' + number, 'success');
                    document.getElementById('test-message').value = '';
                } else {
                    showAlert('❌ Erro: ' + result.error, 'error');
                    addLog('Erro ao enviar: ' + result.error, 'error');
                }
            } catch (error) {
                showAlert('❌ Erro de conexão: ' + error.message, 'error');
                addLog('Erro de conexão: ' + error.message, 'error');
            } finally {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Mensagem';
            }
        }

        async function testOpenAI() {
            try {
                addLog('Testando OpenAI...', 'info');
                const response = await fetch('/api/test-openai', { method: 'POST' });
                const result = await response.json();

                if (result.success) {
                    const shortResponse = result.response.substring(0, 80) + '...';
                    showAlert('✅ OpenAI funcionando: ' + shortResponse, 'success');
                    addLog('OpenAI OK: ' + shortResponse, 'success');
                } else {
                    showAlert('❌ Erro OpenAI: ' + result.error, 'error');
                    addLog('Erro OpenAI: ' + result.error, 'error');
                }
            } catch (error) {
                showAlert('❌ Erro: ' + error.message, 'error');
                addLog('Erro: ' + error.message, 'error');
            }
        }

        function clearLogs() {
            document.getElementById('logs-container').innerHTML = '<div>🧹 Logs limpos...</div>';
            logCount = 0;
            addLog('Sistema de logs reiniciado', 'info');
        }

        function showAlert(message, type) {
            const existingAlert = document.querySelector('.alert');
            if (existingAlert) existingAlert.remove();

            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-' + type;
            alertDiv.innerHTML = message;

            document.querySelector('.container').appendChild(alertDiv);
            setTimeout(() => alertDiv.remove(), 5000);
        }

        // Auto refresh a cada 5 segundos
        setInterval(refreshStatus, 5000);

        // Carregar status inicial
        refreshStatus();
        addLog('Painel de controle inicializado', 'success');
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
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    isReconnecting: isReconnecting
  });
});

app.post('/api/start-whatsapp', async (req, res) => {
  if (whatsappSocket || isReconnecting) {
    return res.json({ success: false, error: 'WhatsApp já está conectado ou tentando conectar' });
  }

  res.json({ success: true, message: 'Iniciando conexão WhatsApp...' });

  // Conectar em background
  connectWhatsApp();
});

app.post('/api/send-message', async (req, res) => {
  try {
    const { number, message } = req.body;

    if (!whatsappSocket || connectionStatus !== 'connected') {
      return res.json({ success: false, error: 'WhatsApp não está conectado' });
    }

    const formattedNumber = number.includes('@') ? number : number + '@s.whatsapp.net';
    await whatsappSocket.sendMessage(formattedNumber, { text: message });

    console.log('📤 Mensagem de teste enviada para ' + number);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/test-openai', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.json({ success: false, error: 'API Key da OpenAI não configurada no arquivo .env' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Olá! Responda brevemente se você está funcionando corretamente.' }],
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
  console.log(\`
🚀 PAINEL ROBUSTO DA IA WHATSAPP INICIADO!

📊 Acesse: http://localhost:\${PORT}
🤖 OpenAI: \${process.env.OPENAI_API_KEY ? '✅ Configurado' : '❌ Não configurado'}

✨ RECURSOS:
• 🔄 Reconexão automática
• 📱 QR Code visual
• 💬 Respostas automáticas com IA
• 📊 Estatísticas em tempo real
• 🛠️ Controles avançados
• 📋 Logs detalhados

🎯 COMO USAR:
1. Acesse o painel no browser
2. Clique em "Conectar WhatsApp"
3. Escaneie o QR Code
4. Teste enviando mensagens!

💡 O bot responderá automaticamente usando OpenAI!
\`);

  // Auto-conectar WhatsApp na inicialização
  setTimeout(() => {
    console.log('🔄 Iniciando conexão automática...');
    connectWhatsApp();
  }, 2000);
});