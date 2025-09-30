import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

console.log('🚀 Iniciando teste simples do WhatsApp Bot...\n');

const sessionPath = path.join(process.cwd(), 'data', 'auth', 'test_session');

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true, // Forçar QR no terminal
      browser: ['Test Bot', 'Chrome', '1.0.0'],
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n📱 QR CODE APARECEU! Escaneie com seu WhatsApp!\n');
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Conexão fechada:', lastDisconnect?.error, '\nReconectar?', shouldReconnect);

        if (shouldReconnect) {
          console.log('Tentando reconectar...');
          startBot();
        }
      } else if (connection === 'open') {
        console.log('\n🎉 CONECTADO AO WHATSAPP COM SUCESSO!');
        console.log('📱 Envie uma mensagem para testar!\n');
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', (m) => {
      const message = m.messages[0];
      if (message && !message.key.fromMe && message.message?.conversation) {
        const text = message.message.conversation;
        const from = message.key.remoteJid;

        console.log(`📩 Mensagem recebida de ${from}: ${text}`);

        // Resposta simples
        if (from) {
          sock.sendMessage(from, { text: `🤖 Recebi sua mensagem: "${text}"` });
          console.log(`📤 Resposta enviada!\n`);
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar:', error);
  }
}

startBot();