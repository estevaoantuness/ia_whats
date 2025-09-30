const express = require('express');
const cors = require('cors');
const path = require('path');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 📁 Importar configuração simples
const CONFIG = require('./config-simples');

const app = express();
const PORT = CONFIG.PORT || 3003;

// Estado global
let whatsappSocket = null;
let connectionStatus = 'disconnected';
let qrCodeData = '';
let messageCount = 0;
let startTime = Date.now();

// 🤖 Cliente Gemini
let geminiModel = null;
if (CONFIG.GEMINI_API_KEY && CONFIG.GEMINI_API_KEY !== "SUA_API_KEY_AQUI") {
  const genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);
  geminiModel = genAI.getGenerativeModel({ model: CONFIG.GEMINI_MODEL });
  console.log('✅ Gemini configurado!');
} else {
  console.log('⚠️ Configure sua API key do Gemini no arquivo config-simples.js');
}

// Middleware
app.use(cors());
app.use(express.json());

// 🌐 Página inicial simples
app.get('/', (req, res) => {
  const geminiStatus = geminiModel ? '✅ Configurado' : '❌ Não configurado';

  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🤖 WhatsApp IA - Painel Simples</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f0f0f0; }
        .card { background: white; padding: 20px; margin: 15px 0; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .btn { background: #25D366; color: white; border: none; padding: 12px 20px; border-radius: 5px; cursor: pointer; margin: 5px; }
        .btn:hover { background: #128C7E; }
        .btn:disabled { background: #ccc; cursor: not-allowed; }
        .status { padding: 10px; border-radius: 5px; margin: 10px 0; font-weight: bold; }
        .connected { background: #d4edda; color: #155724; }
        .disconnected { background: #f8d7da; color: #721c24; }
        .waiting { background: #fff3cd; color: #856404; }
        input, textarea { width: 100%; padding: 10px; margin: 5px 0; border: 1px solid #ddd; border-radius: 5px; }
        .qr-container { text-align: center; margin: 20px 0; }
        .alert { padding: 15px; margin: 10px 0; border-radius: 5px; }
        .alert-success { background: #d4edda; color: #155724; }
        .alert-error { background: #f8d7da; color: #721c24; }
        .hidden { display: none; }
    </style>
</head>
<body>
    <h1>🤖 WhatsApp IA - Painel Simples</h1>

    <div class="card">
        <h3>📊 Status do Sistema</h3>
        <p><strong>Gemini IA:</strong> ${geminiStatus}</p>
        <p><strong>WhatsApp:</strong> <span id="connection-status" class="status disconnected">Carregando...</span></p>
        <p><strong>Mensagens processadas:</strong> <span id="message-count">0</span></p>
    </div>

    <div class="card">
        <h3>🔌 Conectar WhatsApp</h3>
        <button id="connect-btn" class="btn" onclick="conectarWhatsApp()">Conectar WhatsApp</button>
        <button class="btn" onclick="atualizarStatus()">Atualizar Status</button>

        <div id="qr-section" class="qr-container hidden">
            <h4>📱 Escaneie o QR Code com seu WhatsApp:</h4>
            <div id="qr-display"></div>
            <p><small>Abra WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho</small></p>
        </div>
    </div>

    <div class="card">
        <h3>💬 Teste de Mensagem</h3>
        <input type="text" id="test-number" placeholder="Número com código do país (ex: +5511999999999)">
        <textarea id="test-message" rows="3" placeholder="Digite sua mensagem de teste..."></textarea>
        <button class="btn" onclick="enviarTeste()">Enviar Mensagem</button>
        <div id="test-result"></div>
    </div>

    <div class="card">
        <h3>🤖 Teste da IA</h3>
        <button class="btn" onclick="testarIA()">Testar Gemini IA</button>
        <div id="ai-result"></div>
    </div>

    <script>
        async function atualizarStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();

                const statusElement = document.getElementById('connection-status');
                const qrSection = document.getElementById('qr-section');
                const connectBtn = document.getElementById('connect-btn');

                statusElement.className = 'status';

                if (data.status === 'connected') {
                    statusElement.classList.add('connected');
                    statusElement.textContent = '✅ Conectado';
                    qrSection.classList.add('hidden');
                    connectBtn.textContent = 'Desconectar';
                } else if (data.status === 'waiting') {
                    statusElement.classList.add('waiting');
                    statusElement.textContent = '⏳ Aguardando QR Scan';
                    qrSection.classList.remove('hidden');
                    connectBtn.textContent = 'Cancelar';

                    if (data.qrCode) {
                        document.getElementById('qr-display').innerHTML =
                            '<img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' +
                            encodeURIComponent(data.qrCode) + '" alt="QR Code">';
                    }
                } else {
                    statusElement.classList.add('disconnected');
                    statusElement.textContent = '❌ Desconectado';
                    qrSection.classList.add('hidden');
                    connectBtn.textContent = 'Conectar WhatsApp';
                }

                document.getElementById('message-count').textContent = data.messageCount || 0;
            } catch (error) {
                console.error('Erro:', error);
            }
        }

        async function conectarWhatsApp() {
            try {
                const response = await fetch('/api/start-whatsapp', { method: 'POST' });
                const result = await response.json();

                if (result.success) {
                    mostrarAlerta('✅ ' + result.message, 'success');
                    setTimeout(atualizarStatus, 2000);
                } else {
                    mostrarAlerta('❌ ' + result.error, 'error');
                }
            } catch (error) {
                mostrarAlerta('❌ Erro: ' + error.message, 'error');
            }
        }

        async function enviarTeste() {
            const number = document.getElementById('test-number').value;
            const message = document.getElementById('test-message').value;

            if (!number || !message) {
                mostrarAlerta('❌ Preencha o número e a mensagem', 'error');
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
                    mostrarAlerta('✅ Mensagem enviada!', 'success');
                } else {
                    mostrarAlerta('❌ ' + result.error, 'error');
                }
            } catch (error) {
                mostrarAlerta('❌ Erro: ' + error.message, 'error');
            }
        }

        async function testarIA() {
            try {
                const response = await fetch('/api/test-ai', { method: 'POST' });
                const result = await response.json();

                if (result.success) {
                    document.getElementById('ai-result').innerHTML =
                        '<div class="alert alert-success"><strong>✅ ' + result.provider + ':</strong><br>' + result.response + '</div>';
                } else {
                    document.getElementById('ai-result').innerHTML =
                        '<div class="alert alert-error">❌ ' + result.error + '</div>';
                }
            } catch (error) {
                document.getElementById('ai-result').innerHTML =
                    '<div class="alert alert-error">❌ Erro: ' + error.message + '</div>';
            }
        }

        function mostrarAlerta(message, type) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-' + type;
            alertDiv.textContent = message;
            document.body.appendChild(alertDiv);
            setTimeout(() => alertDiv.remove(), 5000);
        }

        // Atualizar status a cada 5 segundos
        setInterval(atualizarStatus, 5000);
        atualizarStatus();
    </script>
</body>
</html>
  `);
});

// 📡 API Routes
app.get('/api/status', (req, res) => {
  const uptime = (Date.now() - startTime) / 1000;
  res.json({
    status: connectionStatus,
    qrCode: qrCodeData,
    uptime: uptime,
    messageCount: messageCount,
    geminiConfigured: !!geminiModel
  });
});

app.post('/api/start-whatsapp', async (req, res) => {
  try {
    if (whatsappSocket) {
      try {
        whatsappSocket.end();
      } catch (error) {
        console.log('Erro ao fechar conexão anterior:', error.message);
      }
      whatsappSocket = null;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('🔄 Conectando ao WhatsApp...');
    const sessionPath = path.join(process.cwd(), 'data', 'auth', 'simple_session');
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    whatsappSocket = makeWASocket({
      auth: state,
      browser: ['IA Bot Simples', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
    });

    whatsappSocket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCodeData = qr;
        connectionStatus = 'waiting';
        console.log('📱 QR Code gerado! Acesse o painel para escanear.');
      }

      if (connection === 'close') {
        console.log('❌ Conexão fechada:', lastDisconnect?.error?.message);
        whatsappSocket = null;
        connectionStatus = 'disconnected';
        qrCodeData = '';
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

          console.log('📩 Mensagem recebida:', text);

          // Responder com IA se configurada
          if (geminiModel && from) {
            try {
              const prompt = 'Você é um assistente útil e amigável. Responda sempre em português brasileiro de forma concisa.\n\nUsuário: ' + text;

              const result = await geminiModel.generateContent(prompt);
              const response = result.response.text() || 'Desculpe, não consegui responder.';

              await whatsappSocket.sendMessage(from, { text: '🤖 ' + response });
              console.log('📤 Resposta enviada!');
            } catch (error) {
              console.error('Erro IA:', error);
              await whatsappSocket.sendMessage(from, { text: '🤖 Desculpe, ocorreu um erro interno.' });
            }
          }
        }
      }
    });

    res.json({ success: true, message: 'WhatsApp iniciado! Aguarde o QR Code...' });
  } catch (error) {
    console.error('Erro ao iniciar WhatsApp:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/send-message', async (req, res) => {
  try {
    const { number, message } = req.body;

    if (!whatsappSocket || connectionStatus !== 'connected') {
      return res.json({ success: false, error: 'WhatsApp não conectado' });
    }

    const formattedNumber = number.includes('@') ? number : number + '@s.whatsapp.net';
    await whatsappSocket.sendMessage(formattedNumber, { text: message });

    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/test-ai', async (req, res) => {
  try {
    if (!geminiModel) {
      return res.json({ success: false, error: 'Configure sua API key do Gemini no arquivo config-simples.js' });
    }

    const prompt = 'Olá! Você está funcionando? Responda de forma breve e em português.';
    const result = await geminiModel.generateContent(prompt);
    const response = result.response.text() || 'Sem resposta';

    res.json({ success: true, response, provider: 'Google Gemini' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// 🚀 Iniciar servidor
app.listen(PORT, () => {
  const geminiStatus = geminiModel ? '✅ Configurado' : '❌ Configure no config-simples.js';
  const step1 = geminiModel ? '' : '1. Configure sua API key no arquivo config-simples.js\n';
  const step2 = (geminiModel ? '1.' : '2.') + ' Acesse o painel no browser';
  const step3 = (geminiModel ? '2.' : '3.') + ' Clique em "Conectar WhatsApp"';
  const step4 = (geminiModel ? '3.' : '4.') + ' Escaneie o QR Code';
  const step5 = (geminiModel ? '4.' : '5.') + ' Teste as mensagens!';

  console.log('\n🌐 PAINEL SIMPLES INICIADO!');
  console.log('📊 Acesse: http://localhost:' + PORT);
  console.log('');
  console.log('Gemini IA: ' + geminiStatus);
  console.log('');
  console.log('💡 PASSOS:');
  if (!geminiModel) console.log(step1);
  console.log(step2);
  console.log(step3);
  console.log(step4);
  console.log(step5);
  console.log('');
});