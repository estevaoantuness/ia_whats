/**
 * Humanization Utilities
 *
 * Tools for making AI responses feel more natural and human-like,
 * with authentic Brazilian Portuguese patterns and behaviors.
 */

// Brazilian Portuguese Colloquialisms
export const BrazilianColloquialisms = {
  // Filler words and expressions
  fillers: ['né', 'ó', 'então', 'tipo', 'pô', 'cara', 'mano', 'bora', 'beleza'],

  // Greetings (varied)
  greetings: ['oi', 'e aí', 'opa', 'fala', 'olá', 'hey', 'salve'],

  // Affirmations
  affirmations: ['boa', 'show', 'massa', 'legal', 'bacana', 'demais', 'top', 'valeu', 'beleza', 'tranquilo'],

  // Transitions
  transitions: ['então', 'daí', 'aí', 'tipo assim', 'olha', 'ó', 'bom'],

  // Encouragement
  encouragement: ['bora', 'vai lá', 'manda ver', 'arrasa', 'você consegue', 'confia'],

  // Empathy expressions
  empathy: ['entendo', 'te entendo', 'imagino', 'compreendo', 'saquei', 'tá', 'uhum'],

  // Diminutives (makes things sound friendlier)
  diminutives: {
    'rapido': 'rapidinho',
    'perto': 'pertinho',
    'pouco': 'pouquinho',
    'devagar': 'devagarinho',
    'sozinho': 'sozinha',
    'cedo': 'cedinho',
    'agora': 'agorinha',
    'depois': 'depoisinho'
  }
};

// Emoji usage patterns (variable, not predictable)
export class EmojiManager {
  private static readonly EMOJI_POOLS = {
    celebration: ['🎉', '👏', '💪', '✨', '🌟', '🔥', '😊', '😄', '🙌'],
    support: ['❤️', '💙', '🤗', '😌', '☺️', '🙂'],
    thinking: ['🤔', '💭', '🧐'],
    time: ['⏰', '🕐', '⏱️', '📅'],
    goal: ['🎯', '✅', '📝', '📌'],
    motivation: ['💪', '🚀', '⚡', '🔥', '💫'],
    casual: ['😊', '🙂', '😄', '😁', '🤝']
  };

  /**
   * Decides if an emoji should be used (not every message)
   * 40% no emoji, 40% one emoji, 20% multiple
   */
  static shouldUseEmoji(): 'none' | 'single' | 'multiple' {
    const rand = Math.random();
    if (rand < 0.4) return 'none';
    if (rand < 0.8) return 'single';
    return 'multiple';
  }

  /**
   * Get a random emoji from a specific pool
   */
  static getEmoji(pool: keyof typeof EmojiManager.EMOJI_POOLS): string {
    const emojis = EmojiManager.EMOJI_POOLS[pool];
    return emojis[Math.floor(Math.random() * emojis.length)];
  }

  /**
   * Get multiple emojis from a pool
   */
  static getMultipleEmojis(pool: keyof typeof EmojiManager.EMOJI_POOLS, count: number = 2): string {
    const emojis = EmojiManager.EMOJI_POOLS[pool];
    const selected: string[] = [];

    for (let i = 0; i < Math.min(count, 3); i++) {
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      if (!selected.includes(emoji)) {
        selected.push(emoji);
      }
    }

    return selected.join(' ');
  }

  /**
   * Add emoji to message based on context and usage pattern
   */
  static addEmojiToMessage(message: string, context: 'celebration' | 'support' | 'casual' | 'motivation' | 'thinking' | 'goal' | 'time'): string {
    const usage = this.shouldUseEmoji();

    if (usage === 'none') return message;

    const emoji = usage === 'single'
      ? this.getEmoji(context)
      : this.getMultipleEmojis(context);

    // Vary placement: beginning (20%), middle (20%), end (60%)
    const placement = Math.random();

    if (placement < 0.2) {
      return `${emoji} ${message}`;
    } else if (placement < 0.4) {
      // Insert in middle at a natural break (period, comma, question mark)
      const breakPoints = ['. ', ', ', '? ', '! '];
      for (const bp of breakPoints) {
        if (message.includes(bp)) {
          return message.replace(bp, `${bp}${emoji} `);
        }
      }
      return `${message} ${emoji}`;
    } else {
      return `${message} ${emoji}`;
    }
  }
}

// Natural imperfections (occasional typos with corrections)
export class NaturalImperfections {
  /**
   * Should we add an imperfection? (5-10% chance)
   */
  static shouldAddImperfection(): boolean {
    return Math.random() < 0.08; // 8% chance
  }

  /**
   * Add a natural correction pattern to the message
   */
  static addCorrection(message: string): string {
    const corrections = [
      { pattern: /\bvocê\b/, replacement: 'cê... quer dizer, você' },
      { pattern: /\bestá\b/, replacement: 'tá... digo, está' },
      { pattern: /\bpara\b/, replacement: 'pra... melhor dizendo, para' },
      { pattern: /bom/, replacement: 'bom... hmm' },
      { pattern: /então/, replacement: 'então... tipo' }
    ];

    // Apply one random correction if the pattern exists
    const applicable = corrections.filter(c => c.pattern.test(message));
    if (applicable.length > 0) {
      const correction = applicable[Math.floor(Math.random() * applicable.length)];
      return message.replace(correction.pattern, correction.replacement);
    }

    return message;
  }

  /**
   * Add a self-correction phrase
   */
  static addSelfCorrection(): string {
    const phrases = [
      'quer dizer',
      'melhor dizendo',
      'ou melhor',
      'na verdade',
      'opa, deixa eu reformular',
      'hmm não sei se ficou claro mas'
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }
}

// Response variation engine
export class ResponseVariation {
  private static usageHistory: Map<string, Set<string>> = new Map(); // userId -> Set of used responses

  /**
   * Check if a response was recently used for this user
   */
  static wasRecentlyUsed(userId: string, response: string): boolean {
    const history = this.usageHistory.get(userId);
    if (!history) return false;

    // Normalize response for comparison (remove emojis, extra spaces)
    const normalized = response.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, '').trim().toLowerCase();

    return history.has(normalized);
  }

  /**
   * Mark a response as used for this user
   */
  static markAsUsed(userId: string, response: string): void {
    if (!this.usageHistory.has(userId)) {
      this.usageHistory.set(userId, new Set());
    }

    const normalized = response.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, '').trim().toLowerCase();

    const history = this.usageHistory.get(userId)!;
    history.add(normalized);

    // Keep only last 50 responses to avoid memory bloat
    if (history.size > 50) {
      const oldest = Array.from(history)[0];
      history.delete(oldest);
    }
  }

  /**
   * Select a response from variations that hasn't been used recently
   */
  static selectUniqueResponse(userId: string, variations: string[]): string {
    // Filter out recently used responses
    const available = variations.filter(v => !this.wasRecentlyUsed(userId, v));

    // If all were used, reset and use any
    const pool = available.length > 0 ? available : variations;

    const selected = pool[Math.floor(Math.random() * pool.length)];
    this.markAsUsed(userId, selected);

    return selected;
  }

  /**
   * Add natural variation to a base message
   */
  static varyMessage(baseMessage: string, userId: string): string {
    let varied = baseMessage;

    // Occasionally add filler words (20% chance)
    if (Math.random() < 0.2) {
      const filler = BrazilianColloquialisms.fillers[Math.floor(Math.random() * BrazilianColloquialisms.fillers.length)];

      // Add at beginning or end
      if (Math.random() < 0.5) {
        varied = `${filler}, ${varied}`;
      } else {
        // Add "né?" at the end for questions
        if (varied.includes('?')) {
          varied = varied.replace('?', ` ${filler}?`);
        } else {
          varied = `${varied} ${filler}`;
        }
      }
    }

    // Apply diminutives occasionally (15% chance)
    if (Math.random() < 0.15) {
      Object.entries(BrazilianColloquialisms.diminutives).forEach(([base, dim]) => {
        if (varied.includes(base)) {
          varied = varied.replace(base, dim);
        }
      });
    }

    return varied;
  }
}

// Timing simulation for natural "typing" delays
export class TimingSimulation {
  /**
   * Calculate natural typing delay based on message length
   * Returns delay in milliseconds
   */
  static calculateTypingDelay(messageLength: number): number {
    // Base reading/thinking time: 500ms
    const baseDelay = 500;

    // Add time based on length (50-80ms per character, simulates reading + typing)
    const perCharDelay = 50 + Math.random() * 30;
    const lengthDelay = messageLength * perCharDelay;

    // Add random variation (±20%)
    const variation = 0.8 + Math.random() * 0.4;

    // Cap at 7 seconds max for UX
    const totalDelay = Math.min((baseDelay + lengthDelay) * variation, 7000);

    return Math.floor(totalDelay);
  }

  /**
   * Get delay for different message types
   */
  static getDelayForType(type: 'short' | 'medium' | 'long' | 'thinking'): number {
    switch (type) {
      case 'short':
        return 800 + Math.random() * 700; // 0.8-1.5s
      case 'medium':
        return 1500 + Math.random() * 1500; // 1.5-3s
      case 'long':
        return 3000 + Math.random() * 2000; // 3-5s
      case 'thinking':
        return 2000 + Math.random() * 3000; // 2-5s (complex thoughts)
      default:
        return 1000;
    }
  }

  /**
   * Create a promise that resolves after the calculated delay
   */
  static async simulateTyping(message: string): Promise<void> {
    const delay = this.calculateTypingDelay(message.length);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// Communication style tracker
export interface UserCommunicationStyle {
  emojiUsage: 'high' | 'medium' | 'low' | 'none';
  messageLength: 'short' | 'medium' | 'long';
  formality: 'casual' | 'neutral' | 'formal';
  responseSpeed: 'fast' | 'medium' | 'slow';
}

export class CommunicationStyleTracker {
  private static styles: Map<string, UserCommunicationStyle> = new Map();
  private static messageHistory: Map<string, string[]> = new Map();

  /**
   * Analyze a user's message and update their communication style
   */
  static analyzeMessage(userId: string, message: string): void {
    if (!this.messageHistory.has(userId)) {
      this.messageHistory.set(userId, []);
    }

    const history = this.messageHistory.get(userId)!;
    history.push(message);

    // Keep only last 10 messages for analysis
    if (history.length > 10) {
      history.shift();
    }

    // Analyze and update style (only after 3+ messages)
    if (history.length >= 3) {
      this.updateStyle(userId, history);
    }
  }

  /**
   * Update user's communication style based on message history
   */
  private static updateStyle(userId: string, messages: string[]): void {
    const emojiCount = messages.reduce((count, msg) => {
      const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu;
      return count + (msg.match(emojiRegex) || []).length;
    }, 0);

    const avgLength = messages.reduce((sum, msg) => sum + msg.length, 0) / messages.length;

    const formalityMarkers = {
      formal: ['senhor', 'senhora', 'obrigado', 'por favor', 'poderia'],
      casual: ['oi', 'tá', 'pra', 'beleza', 'valeu', 'cara', 'mano']
    };

    let formalCount = 0;
    let casualCount = 0;

    messages.forEach(msg => {
      const lower = msg.toLowerCase();
      formalityMarkers.formal.forEach(marker => {
        if (lower.includes(marker)) formalCount++;
      });
      formalityMarkers.casual.forEach(marker => {
        if (lower.includes(marker)) casualCount++;
      });
    });

    const style: UserCommunicationStyle = {
      emojiUsage: emojiCount > 5 ? 'high' : emojiCount > 2 ? 'medium' : emojiCount > 0 ? 'low' : 'none',
      messageLength: avgLength > 200 ? 'long' : avgLength > 50 ? 'medium' : 'short',
      formality: formalCount > casualCount ? 'formal' : casualCount > formalCount ? 'casual' : 'neutral',
      responseSpeed: 'medium' // This would need timing data to determine
    };

    this.styles.set(userId, style);
  }

  /**
   * Get user's communication style
   */
  static getStyle(userId: string): UserCommunicationStyle | null {
    return this.styles.get(userId) || null;
  }

  /**
   * Adapt message to user's communication style
   */
  static adaptMessage(userId: string, baseMessage: string): string {
    const style = this.getStyle(userId);
    if (!style) return baseMessage;

    let adapted = baseMessage;

    // Adapt based on formality
    if (style.formality === 'formal') {
      // Reduce colloquialisms slightly
      adapted = adapted
        .replace(/\btá\b/g, 'está')
        .replace(/\bpra\b/g, 'para')
        .replace(/\bcê\b/g, 'você');
    } else if (style.formality === 'casual') {
      // Increase colloquialisms
      adapted = adapted
        .replace(/\bestá\b/g, 'tá')
        .replace(/\bpara\b/g, 'pra');
    }

    // Adapt based on message length
    if (style.messageLength === 'short') {
      // Make more concise (remove extra phrases)
      const sentences = adapted.split('. ');
      adapted = sentences.slice(0, Math.min(2, sentences.length)).join('. ');
    }

    return adapted;
  }
}

// Message sequencing (inspired by ia_alecrim)
export interface MessageSequence {
  parts: string[];
  delays: number[];
}

export class MessageSequencer {
  /**
   * Split message by "|" for sequential delivery
   * Example: "Oi|Sou a Sara|Como posso ajudar?"
   */
  static parseSequence(message: string): MessageSequence {
    const parts = message.split('|').map(p => p.trim()).filter(p => p.length > 0);

    if (parts.length === 1) {
      return { parts, delays: [1000] };
    }

    const delays = parts.map((part, index) => {
      if (index === 0) {
        // First message: thinking time + typing
        return 1000 + Math.random() * 1500; // 1-2.5s
      } else {
        // Subsequent messages: shorter delay
        return 800 + Math.random() * 1200; // 0.8-2s
      }
    });

    return { parts, delays };
  }

  /**
   * Split long message intelligently (inspired by ia_alecrim MessageSplitter)
   */
  static splitLongMessage(message: string, maxLength: number = 100): string[] {
    if (message.length <= maxLength) {
      return [message];
    }

    const parts: string[] = [];

    // Try to split by natural breaks
    const paragraphs = message.split('\n\n');

    for (const paragraph of paragraphs) {
      if (paragraph.length <= maxLength) {
        parts.push(paragraph);
      } else {
        // Split by sentences
        const sentences = paragraph.split(/([.!?]\s+)/);
        let currentPart = '';

        for (const sentence of sentences) {
          if ((currentPart + sentence).length <= maxLength) {
            currentPart += sentence;
          } else {
            if (currentPart) parts.push(currentPart.trim());
            currentPart = sentence;
          }
        }

        if (currentPart) parts.push(currentPart.trim());
      }
    }

    return parts.filter(p => p.length > 0).slice(0, 3); // Max 3 parts
  }

  /**
   * Detect if message needs dramatic pause (inspired by ia_alecrim)
   */
  static needsDramaticPause(message: string): boolean {
    const dramaticMarkers = [
      'deixa eu te falar',
      'sabe o que',
      'vou te contar',
      'olha só',
      'uma coisa importante',
      'deixa eu te mostrar',
      'ó',
      'então'
    ];

    return dramaticMarkers.some(marker => message.toLowerCase().includes(marker));
  }
}

// Brazilian name variations (inspired by ia_alecrim personality-mateus)
export class BrazilianNameVariations {
  private static lastUsedType: Map<string, 'full' | 'diminutive' | 'generic'> = new Map();

  /**
   * Generate Brazilian diminutive (affectionate nickname)
   */
  static getDiminutive(name: string): string {
    const specificDiminutives: { [key: string]: string[] } = {
      'ana': ['Aninha', 'Anita'],
      'maria': ['Mari', 'Mariazinha'],
      'joão': ['Joãozinho', 'Jão'],
      'jose': ['Zé', 'Zezinho'],
      'pedro': ['Pedrinho', 'Pedrão'],
      'lucas': ['Luquinha', 'Lucão'],
      'gabriel': ['Gabi', 'Gabizão'],
      'rafael': ['Rafa', 'Rafinha'],
      'carlos': ['Carlinhos', 'Carlão'],
      'paulo': ['Paulinho', 'Paulão'],
      'ricardo': ['Ricardinho', 'Cadú'],
      'fernando': ['Fernandinho', 'Nando'],
      'juliana': ['Ju', 'Juju'],
      'amanda': ['Amandinha', 'Manda'],
      'beatriz': ['Bia', 'Bea'],
      'rodrigo': ['Digão', 'Digo'],
      'leonardo': ['Leo', 'Leozinho'],
      'marcelo': ['Marcelinho', 'Celo']
    };

    const lowerName = name.toLowerCase();

    if (specificDiminutives[lowerName]) {
      return specificDiminutives[lowerName][Math.floor(Math.random() * specificDiminutives[lowerName].length)];
    }

    // Generic rules
    if (name.length <= 4) {
      return name + 'inho';
    } else {
      return name.substring(0, Math.min(4, name.length)) + (Math.random() < 0.5 ? 'inho' : 'ão');
    }
  }

  /**
   * Get varied name treatment (avoid repetition)
   */
  static getNameVariation(name: string, userId: string): string {
    if (!name) return 'você';

    const lastType = this.lastUsedType.get(userId);
    const types: Array<'full' | 'diminutive' | 'generic'> = ['full', 'diminutive', 'generic'];

    // Remove last used type to avoid immediate repetition
    const availableTypes = lastType ? types.filter(t => t !== lastType) : types;

    // Probabilities: full 30%, diminutive 40%, generic 30%
    const rand = Math.random();
    let selectedType: 'full' | 'diminutive' | 'generic';

    if (rand < 0.3 && availableTypes.includes('full')) {
      selectedType = 'full';
    } else if (rand < 0.7 && availableTypes.includes('diminutive')) {
      selectedType = 'diminutive';
    } else {
      selectedType = availableTypes.includes('generic') ? 'generic' : availableTypes[0];
    }

    this.lastUsedType.set(userId, selectedType);

    switch (selectedType) {
      case 'full':
        return name;
      case 'diminutive':
        return this.getDiminutive(name);
      case 'generic':
        const generics = ['você', 'cê', 'tu', 'amiga', 'amigo', 'querida', 'querido'];
        return generics[Math.floor(Math.random() * generics.length)];
    }
  }

  /**
   * Replace repeated names in a message with variations
   */
  static replaceRepeatedNames(text: string, name: string, userId: string): string {
    if (!name) return text;

    const nameRegex = new RegExp(`\\b${name}\\b`, 'gi');
    const matches = text.match(nameRegex);

    if (!matches || matches.length <= 1) {
      return text; // No repetition
    }

    let modifiedText = text;
    let occurrenceCount = 0;

    modifiedText = modifiedText.replace(nameRegex, () => {
      occurrenceCount++;

      if (occurrenceCount === 1) {
        return name; // Keep first occurrence
      } else if (occurrenceCount === 2) {
        return this.getDiminutive(name); // Second: use diminutive
      } else {
        return 'você'; // Third+: use generic
      }
    });

    return modifiedText;
  }
}

// Export helper function for easy integration
export function humanizeResponse(
  baseMessage: string,
  userId: string,
  context: 'celebration' | 'support' | 'casual' | 'motivation' | 'thinking' | 'goal' | 'time',
  userName?: string
): string {
  let message = baseMessage;

  // Apply variation
  message = ResponseVariation.varyMessage(message, userId);

  // Replace repeated names if user name is provided
  if (userName) {
    message = BrazilianNameVariations.replaceRepeatedNames(message, userName, userId);
  }

  // Adapt to user's style
  message = CommunicationStyleTracker.adaptMessage(userId, message);

  // Occasionally add natural imperfection
  if (NaturalImperfections.shouldAddImperfection()) {
    message = NaturalImperfections.addCorrection(message);
  }

  // Add emoji based on context
  message = EmojiManager.addEmojiToMessage(message, context);

  return message;
}