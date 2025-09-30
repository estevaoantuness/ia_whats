import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as qrcode from 'qrcode-terminal';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

console.log('🚀 TESTE COM QR CODE VISUAL\n');

const sessionPath = path.join(process.cwd(), 'data', 'auth', 'qr_test');

async function startBotWithQR() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      auth: state,
      browser: ['QR Test Bot', 'Chrome', '1.0.0'],
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n🔗 ESCANEIE ESTE QR CODE COM SEU WHATSAPP:\n');

        // Mostrar QR Code visual no terminal
        qrcode.generate(qr, { small: true });

        console.log('\n📱 INSTRUÇÕES:');
        console.log('1. Abra WhatsApp no seu celular');
        console.log('2. Vá em Menu → Aparelhos conectados');
        console.log('3. Toque em "Conectar um aparelho"');
        console.log('4. Escaneie o QR Code acima\n');
        console.log('⏰ Aguardando conexão...\n');
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log('🔄 Tentando reconectar...');
          setTimeout(() => startBotWithQR(), 3000);
        } else {
          console.log('❌ Desconectado permanentemente');
        }
      } else if (connection === 'open') {
        console.log('\n🎉 WHATSAPP CONECTADO COM SUCESSO!');
        console.log('📱 Envie qualquer mensagem para o bot testar!\n');
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
      for (const message of m.messages) {
        if (message && !message.key.fromMe && message.message?.conversation) {
          const text = message.message.conversation;
          const from = message.key.remoteJid;

          console.log(`📩 Mensagem recebida: "${text}"`);

          if (from) {
            // Teste de resposta simples
            await sock.sendMessage(from, {
              text: `✅ Bot funcionando! Você enviou: "${text}"\n\n🤖 Para testar a IA completa, pare este teste (Ctrl+C) e execute: npm run dev`
            });
            console.log(`📤 Resposta enviada com sucesso!\n`);
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    setTimeout(() => startBotWithQR(), 5000);
  }
}

console.log('💡 Este é um teste simples para verificar a conexão WhatsApp');
console.log('💡 Após conectar e testar, use Ctrl+C para parar e execute "npm run dev"\n');

startBotWithQR();