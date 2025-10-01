import { Boom } from '@hapi/boom';
import makeWASocket, {
  ConnectionState,
  DisconnectReason,
  WASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  proto
} from '@whiskeysockets/baileys';
import path from 'path';
import fs from 'fs';
import { WhatsAppMessage } from '../types';
import { parseMessageFromBaileys, sleep } from '../utils/helpers';
import logger from '../utils/logger';

export class WhatsAppService {
  private socket: WASocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private sessionPath: string;
  private onMessageCallback: ((message: WhatsAppMessage) => Promise<void>) | null = null;
  private currentQR: string | null = null;

  constructor(sessionName: string = 'ia_whatsapp_session') {
    this.sessionPath = path.join(process.cwd(), 'data', 'auth', sessionName);
  }

  async initialize(): Promise<void> {
    try {
      console.log(`📂 Session path: ${this.sessionPath}`);

      // Clear session if CLEAR_WHATSAPP_SESSION is set
      if (process.env.CLEAR_WHATSAPP_SESSION === 'true') {
        console.log('🧹 CLEAR_WHATSAPP_SESSION detectado - Removendo sessão antiga...');
        if (fs.existsSync(this.sessionPath)) {
          fs.rmSync(this.sessionPath, { recursive: true, force: true });
          console.log('✅ Sessão antiga removida! Novo QR Code será gerado.');
        } else {
          console.log('ℹ️  Nenhuma sessão antiga encontrada.');
        }
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
      const { version } = await fetchLatestBaileysVersion();

      // Check if there's an existing session
      const hasSession = state.creds && state.creds.me;
      console.log(`🔐 Existing session found: ${hasSession ? 'YES' : 'NO'}`);

      if (hasSession) {
        console.log(`📱 Phone: ${state.creds.me?.id || 'unknown'}`);
      } else {
        console.log('📱 No session - QR Code will be generated');
      }

      logger.info('Initializing WhatsApp connection...');
      logger.info(`Using Baileys version: ${version.join('.')}`);

      // Create Baileys-compatible logger with trace() method
      const baileysLogger = {
        fatal: (msg: any, ...args: any[]) => logger.error(msg, ...args),
        error: (msg: any, ...args: any[]) => logger.error(msg, ...args),
        warn: (msg: any, ...args: any[]) => logger.warn(msg, ...args),
        info: (msg: any, ...args: any[]) => logger.info(msg, ...args),
        debug: (msg: any, ...args: any[]) => logger.debug(msg, ...args),
        trace: (msg: any, ...args: any[]) => logger.debug(msg, ...args), // Map trace to debug
        child: () => baileysLogger, // Return self for child logger calls
      };

      this.socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger as any),
        },
        logger: baileysLogger as any, // Use Baileys-compatible logger
        printQRInTerminal: true, // Enable QR code in console
        browser: ['Sara AI', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
          return {
            conversation: 'hello'
          };
        },
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      this.setupEventHandlers(saveCreds);
      logger.info('WhatsApp service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp service:', error);
      throw error;
    }
  }

  private setupEventHandlers(saveCreds: () => Promise<void>): void {
    if (!this.socket) return;

    this.socket.ev.on('connection.update', (update: Partial<ConnectionState>) => {
      this.handleConnectionUpdate(update);
    });

    this.socket.ev.on('creds.update', saveCreds);

    this.socket.ev.on('messages.upsert', async (messageUpdate) => {
      await this.handleNewMessages(messageUpdate);
    });

    this.socket.ev.on('presence.update', (presenceUpdate) => {
      logger.debug('Presence update:', presenceUpdate);
    });

    this.socket.ev.on('chats.upsert', (chats) => {
      logger.debug('New chats:', chats.length);
    });
  }

  private async handleConnectionUpdate(update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.currentQR = qr; // Store QR code
      console.log('\n🔗 QR CODE PARA CONECTAR WHATSAPP:');
      console.log('\n' + qr);
      console.log('\n📱 Escaneie este QR Code com seu WhatsApp:');
      console.log('1. Abra WhatsApp no celular');
      console.log('2. Vá em Menu → Aparelhos conectados');
      console.log('3. Toque em "Conectar um aparelho"');
      console.log('4. Escaneie o código acima\n');
      console.log(`✅ QR Code armazenado (${qr.length} chars) - Acesse /qr no navegador AGORA!`);
      logger.info('QR Code generated and stored. Access /qr endpoint IMMEDIATELY to scan it.');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const isQRTimeout = statusCode === 408; // QR code timeout

      if (lastDisconnect?.error) {
        logger.warn('Connection closed. Reason:', lastDisconnect.error);
      }

      // If user explicitly logged out, stop trying
      if (isLoggedOut) {
        logger.error('User logged out. Stopping reconnection attempts.');
        console.log('❌ WhatsApp desconectado pelo usuário. App continuará rodando mas sem WhatsApp.');
        // DON'T exit - just stop trying to reconnect
        return;
      }

      // For QR timeouts, keep trying forever (no limit)
      if (isQRTimeout) {
        console.log('⏰ QR Code expirou sem ser escaneado. Gerando novo QR...');
        logger.info('QR timeout - generating new QR code');
        this.reconnectAttempts = 0; // Reset counter for QR timeouts

        await sleep(3000); // Wait 3 seconds before new QR
        try {
          await this.initialize();
        } catch (error) {
          logger.error('Failed to generate new QR:', error);
        }
        return;
      }

      // For other connection issues, use limited retries
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        logger.info(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        console.log(`🔄 Tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts} de reconexão...`);

        await sleep(this.reconnectDelay);
        try {
          await this.initialize();
        } catch (error) {
          logger.error('Reconnection failed:', error);
        }
      } else {
        logger.error('Maximum reconnect attempts reached. Keeping app alive but WhatsApp disconnected.');
        console.log('⚠️ Máximo de tentativas atingido. App continuará sem WhatsApp.');
        // DON'T call process.exit(1) - keep app alive
      }
    } else if (connection === 'open') {
      console.log('\n🎉 WHATSAPP CONECTADO COM SUCESSO!');
      console.log('📱 Agora você pode enviar mensagens para o bot!\n');
      logger.info('WhatsApp connection established successfully!');
      this.reconnectAttempts = 0;
    } else if (connection === 'connecting') {
      logger.info('Connecting to WhatsApp...');
    }
  }

  private async handleNewMessages(messageUpdate: any): Promise<void> {
    try {
      for (const msg of messageUpdate.messages) {
        if (msg.key?.fromMe) {
          continue;
        }

        const parsedMessage = parseMessageFromBaileys({ messages: [msg] });
        if (parsedMessage && this.onMessageCallback) {
          logger.debug('New message received:', {
            from: parsedMessage.from,
            text: parsedMessage.text.substring(0, 50) + '...',
            isGroup: parsedMessage.isGroup
          });

          await this.onMessageCallback(parsedMessage);
        }
      }
    } catch (error) {
      logger.error('Error handling new messages:', error);
    }
  }

  onMessage(callback: (message: WhatsAppMessage) => Promise<void>): void {
    this.onMessageCallback = callback;
  }

  async sendMessage(to: string, message: string): Promise<void> {
    if (!this.socket) {
      throw new Error('WhatsApp socket not initialized');
    }

    try {
      await this.socket.sendMessage(to, { text: message });
      logger.debug(`Message sent to ${to}: ${message.substring(0, 50)}...`);
    } catch (error) {
      logger.error('Error sending message:', error);
      throw error;
    }
  }

  async sendImage(to: string, imageBuffer: Buffer, caption?: string): Promise<void> {
    if (!this.socket) {
      throw new Error('WhatsApp socket not initialized');
    }

    try {
      await this.socket.sendMessage(to, {
        image: imageBuffer,
        caption: caption || ''
      });
      logger.debug(`Image sent to ${to}`);
    } catch (error) {
      logger.error('Error sending image:', error);
      throw error;
    }
  }

  async sendDocument(to: string, documentBuffer: Buffer, fileName: string, mimetype: string): Promise<void> {
    if (!this.socket) {
      throw new Error('WhatsApp socket not initialized');
    }

    try {
      await this.socket.sendMessage(to, {
        document: documentBuffer,
        fileName,
        mimetype
      });
      logger.debug(`Document sent to ${to}: ${fileName}`);
    } catch (error) {
      logger.error('Error sending document:', error);
      throw error;
    }
  }

  async markAsRead(from: string, messageId: string): Promise<void> {
    if (!this.socket) {
      return;
    }

    try {
      await this.socket.readMessages([{
        remoteJid: from,
        id: messageId,
        participant: undefined
      }]);
    } catch (error) {
      logger.error('Error marking message as read:', error);
    }
  }

  async setPresence(presence: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused'): Promise<void> {
    if (!this.socket) {
      return;
    }

    try {
      await this.socket.sendPresenceUpdate(presence);
    } catch (error) {
      logger.error('Error setting presence:', error);
    }
  }

  async getProfilePicture(jid: string): Promise<string | null> {
    if (!this.socket) {
      return null;
    }

    try {
      const profilePicUrl = await this.socket.profilePictureUrl(jid);
      return profilePicUrl || null;
    } catch (error) {
      logger.debug('Error getting profile picture:', error);
      return null;
    }
  }

  isConnected(): boolean {
    return this.socket?.user !== undefined;
  }

  getConnectionInfo(): any {
    return {
      connected: this.isConnected(),
      user: this.socket?.user,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  getQRCode(): string | null {
    return this.currentQR;
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      await this.socket.logout();
      this.socket = null;
      logger.info('WhatsApp service disconnected');
    }
  }

  async forceResetSession(): Promise<void> {
    try {
      console.log('🚨 FORCE RESET SESSION - Starting...');

      // 1. Disconnect current socket
      if (this.socket) {
        console.log('🔌 Disconnecting current socket...');
        try {
          await this.socket.logout();
        } catch (e) {
          console.log('⚠️ Logout failed (socket may be dead):', e);
        }
        this.socket = null;
      }

      // 2. Clear QR code from memory
      this.currentQR = null;
      console.log('🧹 Cleared QR code from memory');

      // 3. Delete session files
      if (fs.existsSync(this.sessionPath)) {
        console.log(`🗑️ Deleting session folder: ${this.sessionPath}`);
        fs.rmSync(this.sessionPath, { recursive: true, force: true });
        console.log('✅ Session folder deleted');
      } else {
        console.log('ℹ️ No session folder to delete');
      }

      // 4. Reset reconnect attempts
      this.reconnectAttempts = 0;

      console.log('✅ FORCE RESET COMPLETE - Reinitializing...');

      // 5. Reinitialize with fresh session
      await this.initialize();

      console.log('🎉 WhatsApp reinitialized with fresh session!');
    } catch (error) {
      console.error('❌ Force reset failed:', error);
      logger.error('Force reset session failed:', error);
      throw error;
    }
  }
}