import { WhatsAppMessage } from '../types';

export function formatPhoneNumber(number: string): string {
  return number.replace(/[^\d]/g, '').replace(/^(\d{2})(\d)/, '+$1$2');
}

export function isAdminUser(number: string, adminNumbers: string[]): boolean {
  const formattedNumber = formatPhoneNumber(number);
  return adminNumbers.some(admin => formatPhoneNumber(admin) === formattedNumber);
}

export function extractCommand(text: string, prefix: string): { command: string; args: string[] } | null {
  if (!text.startsWith(prefix)) {
    return null;
  }

  const parts = text.slice(prefix.length).trim().split(' ');
  const command = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1);

  return { command, args };
}

export function sanitizeText(text: string): string {
  return text.replace(/[<>]/g, '').trim();
}

export function truncateText(text: string, maxLength: number = 1000): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

export function parseMessageFromBaileys(msg: any): WhatsAppMessage | null {
  try {
    const messageInfo = msg.messages?.[0];
    if (!messageInfo) return null;

    const key = messageInfo.key;
    const message = messageInfo.message;

    let text = '';
    let mediaType: WhatsAppMessage['mediaType'] = undefined;
    let mediaUrl: string | undefined = undefined;

    if (message?.conversation) {
      text = message.conversation;
    } else if (message?.extendedTextMessage?.text) {
      text = message.extendedTextMessage.text;
    } else if (message?.imageMessage?.caption) {
      text = message.imageMessage.caption;
      mediaType = 'image';
    } else if (message?.videoMessage?.caption) {
      text = message.videoMessage.caption;
      mediaType = 'video';
    } else if (message?.audioMessage) {
      text = '[Audio Message]';
      mediaType = 'audio';
    } else if (message?.documentMessage) {
      text = message.documentMessage.fileName || '[Document]';
      mediaType = 'document';
    }

    return {
      id: key.id || '',
      from: key.remoteJid || '',
      to: key.fromMe ? key.remoteJid || '' : 'bot',
      text: sanitizeText(text),
      timestamp: Date.now(),
      isGroup: key.remoteJid?.includes('@g.us') || false,
      groupName: key.remoteJid?.includes('@g.us') ? 'Group Chat' : undefined,
      senderName: messageInfo.pushName || 'Unknown',
      mediaType,
      mediaUrl,
    };
  } catch (error) {
    console.error('Error parsing message from Baileys:', error);
    return null;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}