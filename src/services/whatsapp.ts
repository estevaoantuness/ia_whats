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

  constructor(sessionName: string = 'ia_whatsapp_session') {
    this.sessionPath = path.join(process.cwd(), 'data', 'auth', sessionName);
  }

  async initialize(): Promise<void> {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
      const { version } = await fetchLatestBaileysVersion();

      logger.info('Initializing WhatsApp connection...');
      logger.info(`Using Baileys version: ${version.join('.')}`);

      this.socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger as any),
        },
        logger: undefined, // Disable Baileys internal logging to reduce noise
        browser: ['IA WhatsApp Bot', 'Chrome', '1.0.0'],
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
      console.log('\n🔗 QR CODE PARA CONECTAR WHATSAPP:');
      console.log('\n' + qr);
      console.log('\n📱 Escaneie este QR Code com seu WhatsApp:');
      console.log('1. Abra WhatsApp no celular');
      console.log('2. Vá em Menu → Aparelhos conectados');
      console.log('3. Toque em "Conectar um aparelho"');
      console.log('4. Escaneie o código acima\n');
      logger.info('QR Code generated. Please scan with WhatsApp mobile app.');
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

      if (lastDisconnect?.error) {
        logger.warn('Connection closed. Reason:', lastDisconnect.error);
      }

      if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        logger.info(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        await sleep(this.reconnectDelay);
        try {
          await this.initialize();
        } catch (error) {
          logger.error('Reconnection failed:', error);
        }
      } else {
        logger.error('Maximum reconnect attempts reached or logged out. Stopping...');
        process.exit(1);
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

  async disconnect(): Promise<void> {
    if (this.socket) {
      await this.socket.logout();
      this.socket = null;
      logger.info('WhatsApp service disconnected');
    }
  }
}