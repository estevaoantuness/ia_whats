const express = require('express');
const cors = require('cors');
const path = require('path');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = 3002;

// Global state
let whatsappSocket = null;
let connectionStatus = 'disconnected';
let qrCodeData = '';
let messageCount = 0;
let startTime = Date.now();
let businessMode = false;
let isReconnecting = false;

// Google Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const geminiModel = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });

// OpenAI client (legacy support)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conectar WhatsApp
async function connectWhatsApp(isBusiness = false) {
  try {
    if (whatsappSocket) {
      console.log('⚠️ WhatsApp já está iniciado, fechando conexão anterior...');
      try {
        whatsappSocket.end();
      } catch (error) {
        console.log('⚠️ Erro ao fechar conexão anterior:', error.message);
      }
      whatsappSocket = null;
      await new Promise(resolve => setTimeout(resolve, 2000)); // Aguarda 2 segundos
    }

    if (isReconnecting) {
      console.log('⚠️ Já está tentando conectar...');
      return { success: false, error: 'Já está tentando conectar' };
    }

    isReconnecting = true;
    const mode = isBusiness ? 'business' : 'personal';
    console.log('🔄 Conectando ao WhatsApp ' + mode.toUpperCase() + '...');

    const sessionPath = path.join(process.cwd(), 'data', 'auth', mode + '_session');
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    whatsappSocket = makeWASocket({
      auth: state,
      browser: isBusiness ? ['IA Business Bot', 'Chrome', '1.0.0'] : ['IA Personal Bot', 'Chrome', '1.0.0'],
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
        console.log('📱 QR Code gerado para ' + mode + '! Escaneie no painel.');
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('❌ Conexão fechada:', lastDisconnect?.error?.message);

        whatsappSocket = null;
        isReconnecting = false;
        connectionStatus = 'disconnected';
        qrCodeData = '';

        // Não reconectar automaticamente para evitar loops infinitos
        console.log('⚠️ Conexão encerrada. Use o painel para reconectar.');
      } else if (connection === 'open') {
        connectionStatus = 'connected';
        qrCodeData = '';
        isReconnecting = false;
        console.log('🎉 WhatsApp ' + mode + ' conectado com sucesso!');
      } else if (connection === 'connecting') {
        connectionStatus = 'connecting';
      }
    });

    whatsappSocket.ev.on('creds.update', saveCreds);

    whatsappSocket.ev.on('messages.upsert', async (m) => {
      for (const message of m.messages) {
        if (message && !message.key.fromMe && message.message?.conversation) {
          messageCount++;
          const text = message.message.conversation;
          const from = message.key.remoteJid;

          console.log('📩 Mensagem:', text);

          // Resposta com Gemini (prioritário) ou OpenAI se configurado
          if ((process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) && from) {
            try {
              let response = 'Desculpe, não consegui responder.';
              const prefix = businessMode ? '[Business Bot]' : '[Personal Bot]';

              // Tentar Gemini primeiro
              if (process.env.GEMINI_API_KEY) {
                try {
                  const prompt = `Você é um assistente útil e amigável. Responda sempre em português brasileiro de forma concisa e útil.\n\nUsuário: ${text}`;
                  const result = await geminiModel.generateContent(prompt);
                  const geminiResponse = result.response;
                  response = geminiResponse.text() || 'Desculpe, não consegui responder.';
                  console.log('🤖 Resposta gerada pelo Gemini');
                } catch (geminiError) {
                  console.error('Erro Gemini:', geminiError.message);

                  // Fallback para OpenAI se Gemini falhar
                  if (process.env.OPENAI_API_KEY) {
                    const completion = await openai.chat.completions.create({
                      model: 'gpt-4o-mini',
                      messages: [
                        { role: 'system', content: 'Você é um assistente útil e amigável. Responda sempre em português.' },
                        { role: 'user', content: text }
                      ],
                      max_tokens: 300
                    });
                    response = completion.choices[0]?.message?.content || 'Desculpe, não consegui responder.';
                    console.log('🤖 Resposta gerada pelo OpenAI (fallback)');
                  }
                }
              } else if (process.env.OPENAI_API_KEY) {
                const completion = await openai.chat.completions.create({
                  model: 'gpt-4o-mini',
                  messages: [
                    { role: 'system', content: 'Você é um assistente útil e amigável. Responda sempre em português.' },
                    { role: 'user', content: text }
                  ],
                  max_tokens: 300
                });
                response = completion.choices[0]?.message?.content || 'Desculpe, não consegui responder.';
                console.log('🤖 Resposta gerada pelo OpenAI');
              }

              await whatsappSocket.sendMessage(from, { text: prefix + ' ' + response });
              console.log('📤 Resposta enviada!');
            } catch (error) {
              console.error('Erro AI:', error);
              await whatsappSocket.sendMessage(from, { text: 'Desculpe, ocorreu um erro interno.' });
            }
          }
        }
      }
    });

    businessMode = isBusiness;
    return { success: true, message: 'WhatsApp iniciado em modo ' + mode };
  } catch (error) {
    console.error('Erro ao conectar WhatsApp:', error);
    isReconnecting = false;
    return { success: false, error: error.message };
  }
}

// Servir o painel HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'business-panel.html'));
});

// API Routes
app.get('/api/status', (req, res) => {
  const uptime = (Date.now() - startTime) / 1000;

  res.json({
    status: connectionStatus,
    qrCode: qrCodeData,
    uptime: uptime,
    messageCount: messageCount,
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    mode: businessMode ? 'business' : 'personal'
  });
});

app.post('/api/start-whatsapp', async (req, res) => {
  try {
    if (whatsappSocket && !isReconnecting) {
      return res.json({ success: false, error: 'WhatsApp já está iniciado' });
    }

    const { mode } = req.body;
    const isBusiness = mode === 'business';

    const result = await connectWhatsApp(isBusiness);
    res.json(result);
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
    let response = 'Sem resposta';
    let aiProvider = 'Nenhum';

    // Testar Gemini primeiro
    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = 'Olá! Você está funcionando? Responda de forma breve e em português.';
        const result = await geminiModel.generateContent(prompt);
        const geminiResponse = result.response;
        response = geminiResponse.text() || 'Sem resposta do Gemini';
        aiProvider = 'Google Gemini';
      } catch (geminiError) {
        // Fallback para OpenAI se Gemini falhar
        if (process.env.OPENAI_API_KEY) {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Olá! Você está funcionando?' }],
            max_tokens: 50
          });
          response = completion.choices[0]?.message?.content || 'Sem resposta do OpenAI';
          aiProvider = 'OpenAI (fallback)';
        } else {
          return res.json({ success: false, error: 'Gemini falhou e OpenAI não configurado' });
        }
      }
    } else if (process.env.OPENAI_API_KEY) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Olá! Você está funcionando?' }],
        max_tokens: 50
      });
      response = completion.choices[0]?.message?.content || 'Sem resposta do OpenAI';
      aiProvider = 'OpenAI';
    } else {
      return res.json({ success: false, error: 'Nenhuma API Key configurada (Gemini ou OpenAI)' });
    }

    res.json({ success: true, response, provider: aiProvider });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Manter rota legacy para compatibilidade
app.post('/api/test-openai', async (req, res) => {
  try {
    let response = 'Sem resposta';
    let aiProvider = 'Nenhum';

    // Testar Gemini primeiro
    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = 'Olá! Você está funcionando? Responda de forma breve e em português.';
        const result = await geminiModel.generateContent(prompt);
        const geminiResponse = result.response;
        response = geminiResponse.text() || 'Sem resposta do Gemini';
        aiProvider = 'Google Gemini';
      } catch (geminiError) {
        if (process.env.OPENAI_API_KEY) {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Olá! Você está funcionando?' }],
            max_tokens: 50
          });
          response = completion.choices[0]?.message?.content || 'Sem resposta do OpenAI';
          aiProvider = 'OpenAI (fallback)';
        } else {
          return res.json({ success: false, error: 'Gemini falhou e OpenAI não configurado' });
        }
      }
    } else if (process.env.OPENAI_API_KEY) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Olá! Você está funcionando?' }],
        max_tokens: 50
      });
      response = completion.choices[0]?.message?.content || 'Sem resposta do OpenAI';
      aiProvider = 'OpenAI';
    } else {
      return res.json({ success: false, error: 'Nenhuma API Key configurada (Gemini ou OpenAI)' });
    }

    res.json({ success: true, response, provider: aiProvider });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
🌐 PAINEL BUSINESS INICIADO!
📊 Acesse: http://localhost:${PORT}
🔧 Suporte WhatsApp Business e Personal

💡 INSTRUÇÕES:
1. Acesse o painel no browser
2. Selecione o modo (Business ou Personal)
3. Clique em "Conectar WhatsApp"
4. Escaneie o QR Code na aba QR Code
5. Teste o envio de mensagens!
`);
});

module.exports = app;