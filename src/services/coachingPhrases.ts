/**
 * Coaching Phrases - Frases contextuais para diferentes momentos do fluxo de produtividade
 * Usado pela Sara para dar suporte personalizado além dos check-ins automáticos
 */

export interface CoachingPhrase {
  text: string;
  emoji?: string;
  tone: 'motivacional' | 'suave' | 'direto' | 'celebracao';
}

export class CoachingPhrasesService {

  // Para começar (acionar o start)
  static readonly START_PHRASES: CoachingPhrase[] = [
    { text: 'Bora começar com 10 min só pra aquecer.', emoji: '⏱️', tone: 'motivacional' },
    { text: 'Hoje é jogo curto: 1 tarefa, sem drama.', emoji: '🎯', tone: 'direto' },
    { text: 'Qual é a primeira micro-ação de 2 minutos?', emoji: '✨', tone: 'suave' },
    { text: 'Abre o material e me diz "ok" que eu te guio.', emoji: '📚', tone: 'suave' },
    { text: 'Sem perfeição, só movimento. Vai.', emoji: '🚀', tone: 'direto' },
    { text: 'Um passo agora vale mais que um plano perfeito.', emoji: '✅', tone: 'motivacional' },
    { text: 'Começa pelo mais fácil: ganha tração.', emoji: '⚡️', tone: 'direto' }
  ];

  // Para manter o ritmo (durante o bloco)
  static readonly MAINTAIN_FOCUS_PHRASES: CoachingPhrase[] = [
    { text: 'Mantém simples: próxima linha, próxima resposta.', emoji: '🎯', tone: 'direto' },
    { text: 'Foco só nisso pelos próximos 10 minutos.', emoji: '🔒', tone: 'direto' },
    { text: 'Respira, ajusta postura, segue.', emoji: '🫁', tone: 'suave' },
    { text: 'Se travar, me pergunta. Tô aqui.', emoji: '💬', tone: 'suave' },
    { text: 'Está indo bem. Continua no mesmo compasso.', emoji: '✨', tone: 'motivacional' },
    { text: 'Lembra do porquê: isso te aproxima de [meta].', emoji: '🎯', tone: 'motivacional' },
    { text: 'Tira a notificação, volta pra tela e vai.', emoji: '📱', tone: 'direto' }
  ];

  // Para recuperar foco (quando dispersa)
  static readonly RECOVER_FOCUS_PHRASES: CoachingPhrase[] = [
    { text: 'Notou a distração? Sem culpa. Volta pro ponto.', emoji: '🔁', tone: 'suave' },
    { text: 'Onde você parou? Diz em 1 frase.', emoji: '📍', tone: 'direto' },
    { text: 'Qual é a próxima ação de 90 segundos?', emoji: '⏱️', tone: 'direto' },
    { text: 'Fecha outras abas e me dá 5 minutos de foco.', emoji: '🔒', tone: 'direto' },
    { text: 'Levanta, água rápida, e a gente retoma.', emoji: '🥤', tone: 'suave' },
    { text: 'Errar faz parte. Corrige e continua.', emoji: '✅', tone: 'suave' },
    { text: 'Recomeço agora conta como progresso.', emoji: '🔁', tone: 'motivacional' }
  ];

  // Quando bate a tentação de adiar
  static readonly ANTI_PROCRASTINATION_PHRASES: CoachingPhrase[] = [
    { text: 'Se for pra adiar, adia bonito: termina 1 item antes.', emoji: '⏳', tone: 'direto' },
    { text: 'Faz só "mais um parágrafo" e decide depois.', emoji: '📝', tone: 'suave' },
    { text: 'Pergunta: isso é importante agora? Se não, corta.', emoji: '✂️', tone: 'direto' },
    { text: 'Cinco minutos valem mais que zero.', emoji: '⏱️', tone: 'motivacional' },
    { text: 'Troca perfeição por entrega: versão 1 agora.', emoji: '✅', tone: 'direto' }
  ];

  // Quase lá (última milha)
  static readonly FINISH_STRONG_PHRASES: CoachingPhrase[] = [
    { text: 'Falta só esse trecho. Fecha o ciclo.', emoji: '🏁', tone: 'motivacional' },
    { text: 'Revisão rápida e enviar. Sem reescrever tudo.', emoji: '⚡️', tone: 'direto' },
    { text: 'Cheiro de meta batida. Mantém a mão.', emoji: '🎯', tone: 'motivacional' },
    { text: 'Dá nome ao arquivo, salva e conclui.', emoji: '💾', tone: 'direto' }
  ];

  // Celebrar microvitórias
  static readonly CELEBRATION_PHRASES: CoachingPhrase[] = [
    { text: 'Boa! Meta batida. Marca no calendário.', emoji: '✅', tone: 'celebracao' },
    { text: 'Pequena vitória, grande consistência.', emoji: '🏆', tone: 'celebracao' },
    { text: 'Print da tela e bora pro próximo dia.', emoji: '📸', tone: 'celebracao' },
    { text: 'Você fez o difícil: aparecer. Orgulho disso.', emoji: '🙌', tone: 'celebracao' },
    { text: 'Fecha por hoje. Descansar também é meta.', emoji: '🌿', tone: 'suave' }
  ];

  // Para metas de estudo (variações específicas)
  static readonly STUDY_PHRASES: CoachingPhrase[] = [
    { text: 'Timer em 25 min? Pomodoro valendo.', emoji: '⏲️', tone: 'direto' },
    { text: '3 questões agora, sem olhar gabarito.', emoji: '📝', tone: 'direto' },
    { text: 'Errou? Ótimo, achamos o ponto de revisão.', emoji: '🔍', tone: 'motivacional' },
    { text: 'Resumo em 5 bullets e encerra.', emoji: '📚', tone: 'direto' }
  ];

  // Para metas de treino/saúde
  static readonly HEALTH_PHRASES: CoachingPhrase[] = [
    { text: 'Tênis no pé primeiro, motivação depois.', emoji: '👟', tone: 'direto' },
    { text: '15 minutos contam. Começa com aquecimento.', emoji: '🏃‍♂️', tone: 'motivacional' },
    { text: 'Água, playlist, e vai no seu ritmo.', emoji: '💪', tone: 'suave' }
  ];

  // Para metas de trabalho
  static readonly WORK_PHRASES: CoachingPhrase[] = [
    { text: 'Qual entrega gera mais impacto hoje? Começa por ela.', emoji: '⚡️', tone: 'direto' },
    { text: 'Caixa de e-mail em 2 blocos: triagem e resposta.', emoji: '📧', tone: 'direto' },
    { text: 'Define "feito" em 1 frase e trabalha pra isso.', emoji: '🎯', tone: 'direto' }
  ];

  // Autoacordo do dia (frases de compromisso)
  static readonly COMMITMENT_PHRASES: CoachingPhrase[] = [
    { text: 'Hoje cumpro 1 coisa que amanhã vou agradecer.', emoji: '✨', tone: 'motivacional' },
    { text: 'Meu combinado: 30 min focados e sem multitarefa.', emoji: '🎯', tone: 'direto' },
    { text: 'Se eu começar, eu termino o bloco. Sem barganha.', emoji: '💪', tone: 'direto' }
  ];

  // Check-in e check-out
  static readonly CHECKIN_CHECKOUT_PHRASES: CoachingPhrase[] = [
    { text: 'Check-in: O que vai provar que hoje rendeu?', emoji: '🎯', tone: 'direto' },
    { text: 'Check-out: O que ficou feito? O que é o primeiro passo de amanhã?', emoji: '📝', tone: 'direto' }
  ];

  /**
   * Obtém uma frase aleatória de um contexto específico
   */
  static getRandomPhrase(context: 'start' | 'maintain' | 'recover' | 'anti_procrastination' | 'finish' | 'celebration' | 'study' | 'health' | 'work' | 'commitment' | 'checkin'): CoachingPhrase {
    let phrases: CoachingPhrase[];

    switch (context) {
      case 'start':
        phrases = this.START_PHRASES;
        break;
      case 'maintain':
        phrases = this.MAINTAIN_FOCUS_PHRASES;
        break;
      case 'recover':
        phrases = this.RECOVER_FOCUS_PHRASES;
        break;
      case 'anti_procrastination':
        phrases = this.ANTI_PROCRASTINATION_PHRASES;
        break;
      case 'finish':
        phrases = this.FINISH_STRONG_PHRASES;
        break;
      case 'celebration':
        phrases = this.CELEBRATION_PHRASES;
        break;
      case 'study':
        phrases = this.STUDY_PHRASES;
        break;
      case 'health':
        phrases = this.HEALTH_PHRASES;
        break;
      case 'work':
        phrases = this.WORK_PHRASES;
        break;
      case 'commitment':
        phrases = this.COMMITMENT_PHRASES;
        break;
      case 'checkin':
        phrases = this.CHECKIN_CHECKOUT_PHRASES;
        break;
      default:
        phrases = this.START_PHRASES;
    }

    const randomIndex = Math.floor(Math.random() * phrases.length);
    return phrases[randomIndex];
  }

  /**
   * Obtém uma frase formatada com ou sem emoji
   */
  static getFormattedPhrase(context: 'start' | 'maintain' | 'recover' | 'anti_procrastination' | 'finish' | 'celebration' | 'study' | 'health' | 'work' | 'commitment' | 'checkin', includeEmoji: boolean = true): string {
    const phrase = this.getRandomPhrase(context);

    if (includeEmoji && phrase.emoji) {
      return `${phrase.text} ${phrase.emoji}`;
    }

    return phrase.text;
  }

  /**
   * Sistema de emoji rotator - escolhe emoji sem repetir o último
   */
  private static lastEmojiUsed: Map<string, string> = new Map();

  static getEmojiForContext(context: string, intent: 'start' | 'focus' | 'pause' | 'recover' | 'finish' | 'celebration' | 'study' | 'tech' | 'health' | 'humor'): string {
    const emojiSets: Record<string, string[]> = {
      start: ['🚀', '✨', '✅'],
      focus: ['🎯', '🔒', '🧠'],
      pause: ['🌿', '☕️', '🫁'],
      recover: ['🔁', '⏱️'],
      finish: ['🏁', '⛳️'],
      celebration: ['✅', '🏆', '🙌'],
      study: ['📚', '📝', '🔍'],
      tech: ['💻', '⚙️'],
      health: ['🏃‍♂️', '💪', '🥤'],
      humor: ['😅', '😉']
    };

    const availableEmojis = emojiSets[intent] || ['✨'];
    const lastUsed = this.lastEmojiUsed.get(context) || '';

    // Filtra para não repetir o último
    const filtered = availableEmojis.filter(e => e !== lastUsed);
    const choices = filtered.length > 0 ? filtered : availableEmojis;

    const selected = choices[Math.floor(Math.random() * choices.length)];
    this.lastEmojiUsed.set(context, selected);

    return selected;
  }

  /**
   * Adiciona emoji contextual com rotação (máximo 1-2 por mensagem)
   */
  static addContextualEmoji(message: string, intent: 'start' | 'focus' | 'pause' | 'recover' | 'finish' | 'celebration' | 'study' | 'tech' | 'health' | 'humor', userId: string): string {
    // Limite: se já tem 2+ emojis, não adiciona
    const emojiCount = (message.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    if (emojiCount >= 2) return message;

    // 70% de chance de adicionar emoji (não sempre)
    if (Math.random() > 0.7) return message;

    const emoji = this.getEmojiForContext(userId, intent);
    return `${message} ${emoji}`;
  }
}
