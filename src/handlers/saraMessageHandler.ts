import { WhatsAppMessage, BotConfig, CheckinMode, ImportantDate } from '../types';
import { WhatsAppService } from '../services/whatsapp';
import { SaraContextService } from '../services/saraContext';
import { MessageTemplateService } from '../services/messageTemplates';
import { AIService } from '../services/ai-service-factory';
import logger from '../utils/logger';
import {
  humanizeResponse,
  ResponseVariation,
  CommunicationStyleTracker,
  TimingSimulation
} from '../utils/humanization';

export class SaraMessageHandler {
  private whatsappService: WhatsAppService;
  private saraContext: SaraContextService;
  private templates: MessageTemplateService;
  private openaiService: AIService;
  private config: BotConfig;

  constructor(
    whatsappService: WhatsAppService,
    saraContext: SaraContextService,
    templates: MessageTemplateService,
    openaiService: AIService,
    config: BotConfig
  ) {
    this.whatsappService = whatsappService;
    this.saraContext = saraContext;
    this.templates = templates;
    this.openaiService = openaiService;
    this.config = config;
  }

  async handleMessage(message: WhatsAppMessage): Promise<void> {
    try {
      // Validate input message
      if (!message?.from || !message?.text) {
        logger.warn('Invalid message received', { message });
        return;
      }

      // Sanitize and validate message text
      const sanitizedText = message.text.trim();
      if (sanitizedText.length === 0) {
        logger.debug('Empty message received from', message.from);
        return;
      }

      if (sanitizedText.length > 5000) {
        logger.warn('Message too long from', message.from);
        await this.sendErrorMessage(message.from, 'Mensagem muito longa. Por favor, seja mais conciso.');
        return;
      }

      logger.info('Sara processing message', {
        from: message.from,
        messageLength: sanitizedText.length
      });

      // Update message with sanitized text
      message.text = sanitizedText;

      // Track user's communication style for adaptive responses
      CommunicationStyleTracker.analyzeMessage(message.from, sanitizedText);

      await this.whatsappService.markAsRead(message.from, message.id);
      await this.whatsappService.setPresence('composing');

      // Check if user exists in Sara system
      const user = await this.saraContext.getUserProfile(message.from);

      if (!user) {
        // Start onboarding for new user
        await this.startOnboarding(message.from);
        return;
      }

      if (!user.onboardingCompleted) {
        // Continue onboarding process
        await this.handleOnboarding(message);
        return;
      }

      // Check if it's a Sara command
      if (await this.handleSaraCommand(message)) {
        return;
      }

      // Handle regular Sara interaction
      await this.handleSaraInteraction(message, user);

    } catch (error) {
      logger.error('Error in Sara message handling:', {
        error,
        from: message?.from,
        messageText: message?.text?.substring(0, 100),
        stack: error instanceof Error ? error.stack : 'Unknown error'
      });

      // Only send error message if we have a valid sender
      if (message?.from) {
        await this.sendErrorMessage(message.from);
      }
    } finally {
      try {
        await this.whatsappService.setPresence('available');
      } catch (error) {
        logger.error('Error setting presence to available:', error);
      }
    }
  }

  async sendScheduledCheckin(userId: string, mode: CheckinMode): Promise<void> {
    try {
      const user = await this.saraContext.getUserProfile(userId);
      if (!user || !user.onboardingCompleted) {
        return;
      }

      // Check for overwhelm patterns before sending check-in
      const overwhelmCheck = await this.detectOverwhelm(userId);
      if (overwhelmCheck.isOverwhelmed && mode !== 'weekly_report') {
        // Send supportive adjustment message instead of regular check-in
        await this.whatsappService.sendMessage(userId, overwhelmCheck.message);
        logger.info(`Overwhelm detected for user ${userId}, sent adjustment message`);
        return;
      }

      let message: string;

      if (mode === 'weekly_report') {
        message = await this.generateWeeklyReport(userId);
      } else {
        message = this.templates.getPersonalizedMessage(mode, user);
      }

      await this.whatsappService.sendMessage(userId, message);
      logger.info(`Scheduled ${mode} sent to user: ${userId}`);

    } catch (error) {
      logger.error(`Error sending scheduled ${mode}:`, error);
    }
  }

  private async detectOverwhelm(userId: string): Promise<{ isOverwhelmed: boolean; message: string }> {
    try {
      // Check last 5 days of activity
      const analytics = await this.saraContext.getRecentAnalytics(userId, 5);

      if (analytics.length < 2) {
        return { isOverwhelmed: false, message: '' };
      }

      // Pattern 1: 2+ consecutive days with 0/3 (user is trying but failing)
      let consecutiveZeros = 0;
      for (let i = analytics.length - 1; i >= Math.max(0, analytics.length - 3); i--) {
        const day = analytics[i];
        if (day.goalsCompleted === 0 && day.goalsSet > 0) {
          consecutiveZeros++;
        } else {
          break;
        }
      }

      if (consecutiveZeros >= 2) {
        const messages = [
          'Opa, vi que tá difícil bater as metas. Quer pausar uns dias? Ou a gente reduz pra 1 meta só?\n\nResponde: FÉRIAS 3 (pra pausar) ou "1 meta só"',
          'Tá pesado, né? Sem pressão. Quer dar um tempo ou simplificar pra 1 meta por dia?\n\nComandos: FÉRIAS X ou "reduzir metas"',
          'Percebi que tá complicado. Tudo bem! Quer pausar ou tentar com menos metas?\n\nDica: HOJE NÃO (só hoje) ou FÉRIAS 5 (vários dias)'
        ];
        return {
          isOverwhelmed: true,
          message: messages[Math.floor(Math.random() * messages.length)]
        };
      }

      // Pattern 2: 3+ days without any response to check-ins (user is ignoring)
      let daysWithoutResponse = 0;
      for (let i = analytics.length - 1; i >= Math.max(0, analytics.length - 4); i--) {
        const day = analytics[i];
        const hasAnyResponse = day.checkinMorningResponded || day.checkinNoonResponded || day.checkinEveningResponded;
        if (!hasAnyResponse) {
          daysWithoutResponse++;
        } else {
          break;
        }
      }

      if (daysWithoutResponse >= 3) {
        const messages = [
          'Sumiu! 😅 Tá tudo bem? Se tá corrido, posso pausar ou mudar frequência.\n\nComandos úteis: FÉRIAS X, HORÁRIO, TOM DIRETO',
          'Faz tempo que não conversa! Quer ajustar alguma coisa? Pausar, mudar horário?\n\nExemplo: FÉRIAS 7 ou HORÁRIO 10:00',
          'Oi! Parece que os horários não tão bons. Quer mudar ou dar uma pausa?\n\nTenta: PAUSAR 48 (2 dias) ou HORÁRIO novo'
        ];
        return {
          isOverwhelmed: true,
          message: messages[Math.floor(Math.random() * messages.length)]
        };
      }

      return { isOverwhelmed: false, message: '' };

    } catch (error) {
      logger.error('Error detecting overwhelm:', error);
      return { isOverwhelmed: false, message: '' };
    }
  }

  async sendDateReminder(userId: string, date: ImportantDate, isToday: boolean): Promise<void> {
    try {
      const message = this.templates.getDateReminderMessage(date, isToday);
      await this.whatsappService.sendMessage(userId, message);
      logger.info(`Date reminder sent to user: ${userId} for ${date.title}`);
    } catch (error) {
      logger.error('Error sending date reminder:', error);
    }
  }

  private async startOnboarding(userId: string): Promise<void> {
    this.saraContext.startOnboarding(userId);
    const welcomeMessage = this.templates.getOnboardingMessage('welcome');
    await this.sendMessage(userId, welcomeMessage);
  }

  private async sendMessage(userId: string, message: string): Promise<void> {
    try {
      if (this.whatsappService.isConnected()) {
        await this.whatsappService.sendMessage(userId, message);
      } else {
        // For web users, we'll log the message (it will be handled differently in web interface)
        logger.info(`Web message for ${userId}:`, { message });
        // Store the message in context for web retrieval if needed
        await this.saraContext.addSystemMessage(userId, message);
      }
    } catch (error) {
      logger.error('Error sending message:', error);
      // Store as system message as fallback
      await this.saraContext.addSystemMessage(userId, message);
    }
  }

  private async handleOnboarding(message: WhatsAppMessage): Promise<void> {
    const state = this.saraContext.getOnboardingState(message.from);
    if (!state) {
      await this.startOnboarding(message.from);
      return;
    }

    const text = message.text.trim();

    switch (state.step) {
      case 'name':
        await this.handleNameStep(message.from, text);
        break;
      case 'frequency':
        await this.handleFrequencyStep(message.from, text);
        break;
      case 'times':
        await this.handleTimesStep(message.from, text);
        break;
      case 'dates':
        await this.handleDatesStep(message.from, text);
        break;
    }
  }

  private async handleNameStep(userId: string, name: string): Promise<void> {
    if (name.length < 2 || name.length > 30) {
      await this.whatsappService.sendMessage(userId, 'Me diz um nome entre 2 e 30 caracteres, por favor.');
      return;
    }

    this.saraContext.updateOnboardingState(userId, {
      step: 'frequency',
      data: { name }
    });

    const message = this.templates.getOnboardingMessage('name', name);
    await this.whatsappService.sendMessage(userId, message);
  }

  private async handleFrequencyStep(userId: string, response: string): Promise<void> {
    const choice = response.trim();

    if (choice !== '1' && choice !== '2') {
      await this.whatsappService.sendMessage(userId, 'Escolha 1 ou 2, por favor.');
      return;
    }

    const frequency = choice === '1' ? 'daily' : 'twice_daily';

    this.saraContext.updateOnboardingState(userId, {
      step: 'times',
      data: { frequency }
    });

    const message = this.templates.getOnboardingMessage('frequency');
    await this.whatsappService.sendMessage(userId, message);
  }

  private async handleTimesStep(userId: string, times: string): Promise<void> {
    const timeRegex = /(\d{1,2}):(\d{2})/g;
    const matches = times.match(timeRegex);

    if (!matches) {
      await this.whatsappService.sendMessage(userId, 'Formato de horário inválido. Use HH:MM, exemplo: "08:30" ou "08:30 e 18:30"');
      return;
    }

    const state = this.saraContext.getOnboardingState(userId);
    if (!state) return;

    let morningTime = matches[0];
    let eveningTime = matches[1] || '18:30';

    // If only one time and frequency is twice_daily, ask for second time
    if (matches.length === 1 && state.data.frequency === 'twice_daily') {
      await this.whatsappService.sendMessage(userId, `Entendi ${morningTime} para manhã. Qual horário para tarde/noite?`);
      return;
    }

    this.saraContext.updateOnboardingState(userId, {
      step: 'dates',
      data: {
        morningTime,
        eveningTime,
        noonEnabled: state.data.frequency === 'twice_daily',
        tone: 'warm',
        silenceWeekends: false,
        timezone: 'America/Sao_Paulo'
      }
    });

    const message = this.templates.getOnboardingMessage('times');
    await this.whatsappService.sendMessage(userId, message);
  }

  private async handleDatesStep(userId: string, dates: string): Promise<void> {
    const state = this.saraContext.getOnboardingState(userId);
    if (!state) return;

    // Parse important dates from text
    const tempDates = this.parseImportantDates(dates);

    this.saraContext.updateOnboardingState(userId, {
      tempDates
    });

    // Complete onboarding
    await this.saraContext.completeOnboarding(userId);

    const name = state.data.name || 'você';
    const message = this.templates.getOnboardingMessage('completed', name);
    await this.whatsappService.sendMessage(userId, message);

    logger.info(`Onboarding completed for user: ${userId}`);
  }

  private parseImportantDates(text: string): Partial<ImportantDate>[] {
    if (text.toLowerCase().includes('nenhuma')) {
      return [];
    }

    const dates: Partial<ImportantDate>[] = [];

    // Simple parsing - can be enhanced
    const datePattern = /([^,]+)(\d{1,2}\/\d{1,2})/g;
    let match;

    while ((match = datePattern.exec(text)) !== null) {
      if (match[1] && match[2]) {
        const title = match[1].trim();
        const dateStr = match[2];

        // Convert to ISO date format (assume current year)
        const [day, month] = dateStr.split('/');
        if (day && month) {
          const currentYear = new Date().getFullYear();
          const isoDate = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

          dates.push({
            title,
            date: isoDate,
            recurrence: 'yearly',
            category: this.inferCategory(title)
          });
        }
      }
    }

    return dates;
  }

  private inferCategory(title: string): 'birthday' | 'bill' | 'appointment' | 'other' {
    const lower = title.toLowerCase();

    if (lower.includes('aniv') || lower.includes('nascimento')) {
      return 'birthday';
    }
    if (lower.includes('conta') || lower.includes('pagamento')) {
      return 'bill';
    }
    if (lower.includes('consulta') || lower.includes('reunião')) {
      return 'appointment';
    }

    return 'other';
  }

  private async handleSaraCommand(message: WhatsAppMessage): Promise<boolean> {
    const text = message.text.toUpperCase().trim();

    // PAUSAR command
    if (text.startsWith('PAUSAR ')) {
      const hours = parseInt(text.replace('PAUSAR ', ''));
      if (hours > 0 && hours <= 168) { // Max 1 week
        await this.saraContext.pauseUser(message.from, hours);
        await this.whatsappService.sendMessage(
          message.from,
          `Perfeito! Vou ficar em silêncio por ${hours} horas. Obrigada por avisar! 💤`
        );
        return true;
      }
    }

    // FÉRIAS command (1-14 days)
    if (text.startsWith('FÉRIAS ') || text.startsWith('FERIAS ')) {
      const daysStr = text.replace('FÉRIAS ', '').replace('FERIAS ', '');
      const days = parseInt(daysStr);
      if (days > 0 && days <= 14) {
        const hours = days * 24;
        await this.saraContext.pauseUser(message.from, hours);
        await this.whatsappService.sendMessage(
          message.from,
          `Aproveita as férias! 🏖️ Vou voltar em ${days} dia${days > 1 ? 's' : ''}. Relaxa e se cuida! ✨`
        );
        return true;
      } else {
        await this.whatsappService.sendMessage(
          message.from,
          'FÉRIAS aceita de 1 a 14 dias. Exemplo: FÉRIAS 7'
        );
        return true;
      }
    }

    // HOJE NÃO / HOJE TÁ FODA command (skip today's check-ins)
    if (text === 'HOJE NÃO' || text === 'HOJE NAO' || text === 'HOJE TÁ FODA' || text === 'HOJE TA FODA') {
      // Pause for rest of the day (calculate hours until midnight)
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const hoursUntilMidnight = Math.ceil((midnight.getTime() - now.getTime()) / (1000 * 60 * 60));

      await this.saraContext.pauseUser(message.from, hoursUntilMidnight);

      const responses = [
        'Beleza! Amanhã a gente volta 👍',
        'Tranquilo! Descansa hoje, amanhã recomeça',
        'Entendi. Amanhã converso com você de novo!',
        'Tá valendo! Amanhã é outro dia 🌅'
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];

      await this.whatsappService.sendMessage(message.from, randomResponse);
      return true;
    }

    // SILENCIAR FDS command
    if (text === 'SILENCIAR FDS') {
      await this.saraContext.updateUserProfile(message.from, { silenceWeekends: true });
      await this.whatsappService.sendMessage(
        message.from,
        'Entendido! Não vou te incomodar nos fins de semana. Obrigada por avisar! 🌴'
      );
      return true;
    }

    // HORÁRIO command
    if (text.startsWith('HORÁRIO ')) {
      const timeStr = text.replace('HORÁRIO ', '');
      if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
        await this.saraContext.updateUserProfile(message.from, { morningTime: timeStr });
        await this.whatsappService.sendMessage(
          message.from,
          `Horário atualizado para ${timeStr}! A partir de amanhã já mudo. 🕐`
        );
        return true;
      }
    }

    // TOM commands
    if (text === 'TOM DIRETO') {
      await this.saraContext.updateUserProfile(message.from, { tone: 'direct' });
      await this.whatsappService.sendMessage(message.from, 'Certo. Vou ser mais direta daqui pra frente.');
      return true;
    }

    if (text === 'TOM CALOROSO') {
      await this.saraContext.updateUserProfile(message.from, { tone: 'warm' });
      await this.whatsappService.sendMessage(message.from, 'Que bom! Vou manter meu jeitinho mais caloroso! 😊');
      return true;
    }

    // MEIO-DIA commands
    if (text === 'MEIO-DIA ON') {
      await this.saraContext.updateUserProfile(message.from, { noonEnabled: true });
      await this.whatsappService.sendMessage(message.from, 'Check-ins do meio-dia ativados! 🌞');
      return true;
    }

    if (text === 'MEIO-DIA OFF') {
      await this.saraContext.updateUserProfile(message.from, { noonEnabled: false });
      await this.whatsappService.sendMessage(message.from, 'Check-ins do meio-dia desativados. 👍');
      return true;
    }

    // HELP command
    if (text === 'HELP' || text === 'AJUDA') {
      const helpMessage = this.templates.getSaraCommands();
      await this.whatsappService.sendMessage(message.from, helpMessage);
      return true;
    }

    return false;
  }

  private async handleSaraInteraction(message: WhatsAppMessage, user: any): Promise<void> {
    const text = message.text.trim();
    const today = new Date().toISOString().split('T')[0];

    // Check if it's a goal setting response (contains goals)
    if (this.isGoalResponse(text)) {
      await this.handleGoalSetting(message.from, text, today);
      return;
    }

    // Check if it's a progress response (0/3, 1/3, etc.)
    if (this.isProgressResponse(text)) {
      await this.handleProgressUpdate(message.from, text, today);
      return;
    }

    // Handle as general conversation with AI
    await this.handleGeneralConversation(message, user);
  }

  private isGoalResponse(text: string): boolean {
    // Check if text contains goals (not just numbers)
    const hasWords = /[a-zA-ZÀ-ÿ]{3,}/.test(text);
    const isNotJustProgress = !/^\s*[0-3]\/[0-3]\s*$/.test(text);

    return hasWords && isNotJustProgress && text.length > 10;
  }

  private isProgressResponse(text: string): boolean {
    return /^\s*[0-3]\/[0-3]\s*/.test(text);
  }

  private async handleGoalSetting(userId: string, text: string, date: string): Promise<void> {
    // Parse goals from text
    const goals = this.parseGoals(text);

    if (goals.length === 0) {
      await this.whatsappService.sendMessage(
        userId,
        'Não consegui entender suas metas. Pode reformular? Exemplo: "responder emails, reunião projeto, exercício"'
      );
      return;
    }

    // Save goals
    await this.saraContext.saveDailyGoals({
      userId,
      date,
      goals,
      completedCount: 0,
      totalCount: goals.length
    });

    const user = await this.saraContext.getUserProfile(userId);
    const confirmMessage = this.generateGoalConfirmation(goals, user?.tone === 'direct');

    await this.whatsappService.sendMessage(userId, confirmMessage);

    // Log analytics
    await this.saraContext.logCheckinResponse(userId, 'checkin_morning', 0);
  }

  private parseGoals(text: string): string[] {
    // Simple goal parsing - split by common separators
    let goals = text
      .split(/[,;•\n]/)
      .map(goal => goal.trim())
      .filter(goal => goal.length > 2 && goal.length < 100);

    // If no separators found, treat as single goal if reasonable length
    if (goals.length === 0 && text.length > 5 && text.length < 200) {
      goals = [text.trim()];
    }

    return goals.slice(0, 3); // Max 3 goals
  }

  private generateGoalConfirmation(goals: string[], isDirect: boolean): string {
    const count = goals.length;
    const goalList = goals.map((goal, i) => `${i + 1}. ${goal}`).join('\n');

    // 15+ variations for direct tone
    const directVariations = [
      `${count} meta${count > 1 ? 's' : ''} definida${count > 1 ? 's' : ''}:\n\n${goalList}\n\nFoco no essencial hoje.`,
      `Entendi. ${count} meta${count > 1 ? 's' : ''}:\n\n${goalList}\n\nVamos ao que importa.`,
      `Ok. Suas ${count} prioridades:\n\n${goalList}\n\nBora executar.`,
      `Certo. ${count} foco${count > 1 ? 's' : ''} hoje:\n\n${goalList}\n\nDireto ao ponto.`,
      `${count} meta${count > 1 ? 's' : ''} registrada${count > 1 ? 's' : ''}:\n\n${goalList}\n\nÉ isso. Execução agora.`,
      `Tá anotado. ${count} meta${count > 1 ? 's' : ''}:\n\n${goalList}\n\nSem dispersão.`,
      `Beleza. O essencial de hoje:\n\n${goalList}\n\nFoco total nisso.`,
      `Definidas ${count} meta${count > 1 ? 's' : ''}:\n\n${goalList}\n\nPrioridade máxima.`,
      `${count} meta${count > 1 ? 's' : ''} confirmada${count > 1 ? 's' : ''}:\n\n${goalList}\n\nResto é ruído.`,
      `Ok, suas ${count} prioridades:\n\n${goalList}\n\nIgnorar distrações.`,
      `${count} meta${count > 1 ? 's' : ''} do dia:\n\n${goalList}\n\nSem desvios.`,
      `Entendido. Foco em:\n\n${goalList}\n\nExecutar.`,
      `${count} meta${count > 1 ? 's' : ''} registrada${count > 1 ? 's' : ''}:\n\n${goalList}\n\nDireto ao objetivo.`,
      `Certo. O que importa hoje:\n\n${goalList}\n\nSem rodeios.`,
      `${count} prioridade${count > 1 ? 's' : ''} definida${count > 1 ? 's' : ''}:\n\n${goalList}\n\nFoco absoluto.`
    ];

    // 15+ variations for warm tone
    const warmVariations = [
      `Perfeito! ${count} meta${count > 1 ? 's' : ''} para hoje:\n\n${goalList}\n\nVou te dar um toque mais tarde pra ver como tá indo`,
      `Boa! ${count} meta${count > 1 ? 's' : ''} anotada${count > 1 ? 's' : ''}:\n\n${goalList}\n\nVamos que vamos! Te acompanho ao longo do dia`,
      `Show! Suas ${count} prioridades:\n\n${goalList}\n\nBora fazer acontecer? Qualquer coisa me chama`,
      `Adorei! ${count} meta${count > 1 ? 's' : ''} no radar:\n\n${goalList}\n\nVocê consegue! Daqui a pouco eu volto pra ver como foi`,
      `Massa! Temos ${count} foco${count > 1 ? 's' : ''} hoje:\n\n${goalList}\n\nConfia no processo! Te dou um toque mais tarde`,
      `Gostei! ${count} meta${count > 1 ? 's' : ''} pra hoje:\n\n${goalList}\n\nVai dar tudo certo! Acompanho aqui contigo`,
      `Top! Seu plano de hoje:\n\n${goalList}\n\nBora nessa! Te aviso mais tarde pra ver o progresso`,
      `Beleza! ${count} meta${count > 1 ? 's' : ''} definida${count > 1 ? 's' : ''}:\n\n${goalList}\n\nTô aqui contigo! Daqui a pouco a gente fala de novo`,
      `Ótimo! ${count} prioridade${count > 1 ? 's' : ''} do dia:\n\n${goalList}\n\nVai com tudo! Te acompanho durante o dia`,
      `Perfeito! Foco em:\n\n${goalList}\n\nAcredito em você! Mais tarde eu volto pra ver como foi`,
      `Boa escolha! ${count} meta${count > 1 ? 's' : ''}:\n\n${goalList}\n\nVamo que vamo! Qualquer coisa tô aqui`,
      `Demais! Seu foco hoje:\n\n${goalList}\n\nArrasou na escolha! Te atualizo mais tarde`,
      `Show de bola! ${count} meta${count > 1 ? 's' : ''} registrada${count > 1 ? 's' : ''}:\n\n${goalList}\n\nTô na torcida! Daqui a pouco vejo como tá`,
      `Legal! O que você vai focar:\n\n${goalList}\n\nBora fazer acontecer! Te dou um toque depois`,
      `Bacana! Suas ${count} meta${count > 1 ? 's' : ''} do dia:\n\n${goalList}\n\nVai dar certo! Acompanho com você`
    ];

    const variations = isDirect ? directVariations : warmVariations;
    const selected = ResponseVariation.selectUniqueResponse('goal_confirmation', variations);

    return selected;
  }

  private async handleProgressUpdate(userId: string, text: string, date: string): Promise<void> {
    const match = text.match(/([0-3])\/([0-3])/);
    if (!match) return;

    const completed = parseInt(match[1]);
    const total = parseInt(match[2]);

    await this.saraContext.updateDailyGoalsProgress(userId, date, completed);

    const user = await this.saraContext.getUserProfile(userId);
    const responseMessage = this.generateProgressResponse(completed, total, user?.tone === 'direct');

    await this.whatsappService.sendMessage(userId, responseMessage);

    // Log analytics
    await this.saraContext.logCheckinResponse(userId, 'checkin_evening', 0);
  }

  private generateProgressResponse(completed: number, total: number, isDirect: boolean): string {
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Perfect score (3/3)
    if (completed === total && total > 0) {
      const directPerfect = [
        `${completed}/${total} - Parabéns. Dia 100% produtivo.`,
        `${completed}/${total} - Perfeito. Meta batida.`,
        `${completed}/${total} - Excelente. Tudo executado.`,
        `${completed}/${total} - Muito bom. Dia completo.`,
        `${completed}/${total} - Ótimo trabalho. 100%.`,
        `${completed}/${total} - Parabéns. Executou tudo.`,
        `${completed}/${total} - Show. Meta cumprida.`,
        `${completed}/${total} - Sucesso total. Parabéns.`,
        `${completed}/${total} - Dia perfeito. Bem feito.`,
        `${completed}/${total} - Completou tudo. Parabéns.`
      ];

      const warmPerfect = [
        `Uau! ${completed}/${total} - Dia perfeito! Você arrasou hoje`,
        `${completed}/${total} - Incrível! Completou tudo! Como tá se sentindo?`,
        `Boa demais! ${completed}/${total} - Dia impecável! Celebra isso`,
        `${completed}/${total} - Arrasou! Todas as metas! Que orgulho`,
        `Show! ${completed}/${total} - Perfeito! Você mandou muito bem hoje`,
        `${completed}/${total} - Que dia! Completou tudo! Tá se sentindo bem?`,
        `Adorei! ${completed}/${total} - 100%! Você é demais`,
        `${completed}/${total} - Uau! Tudo feito! Como foi o dia?`,
        `Incrível! ${completed}/${total} - Meta batida! Arrasou`,
        `${completed}/${total} - Que orgulho! Todas finalizadas! Celebra aí`,
        `Perfeito! ${completed}/${total} - Dia completo! Como você tá?`,
        `${completed}/${total} - Boa! Executou tudo! Sensação boa né?`
      ];

      const variations = isDirect ? directPerfect : warmPerfect;
      return ResponseVariation.selectUniqueResponse('progress_perfect', variations);
    }

    // Good progress (70%+)
    if (completed >= total * 0.7) {
      const directGood = [
        `${completed}/${total} - Bom resultado. ${percentage}% concluído.`,
        `${completed}/${total} - Ótimo. ${percentage}% executado.`,
        `${completed}/${total} - Bom dia. ${percentage}% completado.`,
        `${completed}/${total} - Aproveitamento forte. ${percentage}%.`,
        `${completed}/${total} - Bom trabalho. ${percentage}% feito.`,
        `${completed}/${total} - Produtivo. ${percentage}% concluído.`,
        `${completed}/${total} - Resultado positivo. ${percentage}%.`,
        `${completed}/${total} - Boa execução. ${percentage}% completado.`,
        `${completed}/${total} - Satisfatório. ${percentage}% feito.`,
        `${completed}/${total} - Bom desempenho. ${percentage}%.`
      ];

      const warmGood = [
        `${completed}/${total} - Ótimo aproveitamento! ${percentage}% é muito bom`,
        `Boa! ${completed}/${total} - ${percentage}% completado! Show de bola`,
        `${completed}/${total} - Legal! ${percentage}% é um baita resultado`,
        `Show! ${completed}/${total} - ${percentage}% feito! Tá indo bem`,
        `${completed}/${total} - Bacana! ${percentage}% completado! Gostei`,
        `Boa! ${completed}/${total} - ${percentage}% é sucesso! Parabéns`,
        `${completed}/${total} - ${percentage}% completado! Tá indo bem demais`,
        `Legal! ${completed}/${total} - ${percentage}%! Bom aproveitamento`,
        `${completed}/${total} - Ótimo! ${percentage}% é resultado forte`,
        `Massa! ${completed}/${total} - ${percentage}% finalizado! Boa`,
        `${completed}/${total} - Show! ${percentage}% é produtivo demais`,
        `Adorei! ${completed}/${total} - ${percentage}% completado! Top`
      ];

      const variations = isDirect ? directGood : warmGood;
      return ResponseVariation.selectUniqueResponse('progress_good', variations);
    }

    // Some progress (1 or 2 out of 3)
    if (completed > 0) {
      const directPartial = [
        `${completed}/${total} - Progresso parcial. Amanhã continua.`,
        `${completed}/${total} - Algum avanço. Recomeçar amanhã.`,
        `${completed}/${total} - Progresso feito. Nova chance amanhã.`,
        `${completed}/${total} - Parcialmente executado. Amanhã é novo dia.`,
        `${completed}/${total} - Avanço registrado. Continuar amanhã.`,
        `${completed}/${total} - Progresso existe. Retomar amanhã.`,
        `${completed}/${total} - Meta parcial. Amanhã ajusta.`,
        `${completed}/${total} - Algo feito. Recomeçar amanhã.`,
        `${completed}/${total} - Avanço parcial. Nova tentativa amanhã.`,
        `${completed}/${total} - Progrediu. Amanhã é novo ciclo.`
      ];

      const warmPartial = [
        `${completed}/${total} - Todo progresso vale! Amanhã você continua`,
        `${completed}/${total} - Ó, já é alguma coisa! Amanhã a gente tenta o resto`,
        `${completed}/${total} - Valeu o esforço! Amanhã foca de novo`,
        `${completed}/${total} - Progresso é progresso! Amanhã você consegue mais`,
        `${completed}/${total} - Tá valendo! O importante é não parar`,
        `${completed}/${total} - Já é algo! Amanhã a gente vai com tudo`,
        `${completed}/${total} - Boa! Fez o que deu. Amanhã recomeça`,
        `${completed}/${total} - Tá certo! Progrediu. Amanhã você pega o resto`,
        `${completed}/${total} - Legal! Fez acontecer. Amanhã continua`,
        `${completed}/${total} - Show! Conseguiu avanço. Amanhã é nova chance`,
        `${completed}/${total} - Valeu! Fez o possível. Amanhã retoma`,
        `${completed}/${total} - Beleza! Progrediu. Amanhã segue o jogo`
      ];

      const variations = isDirect ? directPartial : warmPartial;
      return ResponseVariation.selectUniqueResponse('progress_partial', variations);
    }

    // No progress (0/3)
    const directNone = [
      `${completed}/${total} - Dia difícil. Recomeçar amanhã.`,
      `${completed}/${total} - Não rolou hoje. Amanhã é novo dia.`,
      `${completed}/${total} - Complicado hoje. Reiniciar amanhã.`,
      `${completed}/${total} - Dia travado. Amanhã tenta diferente.`,
      `${completed}/${total} - Não foi hoje. Amanhã recome ça.`,
      `${completed}/${total} - Difícil hoje. Nova tentativa amanhã.`,
      `${completed}/${total} - Não avançou. Recomeçar amanhã.`,
      `${completed}/${total} - Dia complicado. Amanhã é outra história.`,
      `${completed}/${total} - Não deu hoje. Reset amanhã.`,
      `${completed}/${total} - Travou hoje. Amanhã reinicia.`
    ];

    const warmNone = [
      `${completed}/${total} - Dias assim acontecem. Tá tudo bem, amanhã recomeça`,
      `${completed}/${total} - Ó, sem culpa tá? Amanhã você tenta de novo`,
      `${completed}/${total} - Todo mundo tem esses dias. Amanhã é nova chance`,
      `${completed}/${total} - Tá tranquilo. Dias difíceis existem. Amanhã você volta`,
      `${completed}/${total} - Às vezes não dá mesmo. Sem problema. Amanhã recomeça`,
      `${completed}/${total} - Dias assim são normais. Descansa e amanhã tenta de novo`,
      `${completed}/${total} - Tudo bem não conseguir hoje. Amanhã é outro dia`,
      `${completed}/${total} - Zero culpa, viu? Amanhã você retoma`,
      `${completed}/${total} - Acontece. O importante é não desistir. Amanhã bora de novo`,
      `${completed}/${total} - Relaxa. Dia difícil passa. Amanhã você pega de novo`,
      `${completed}/${total} - Sem drama. Dias ruins existem. Amanhã recomeça`,
      `${completed}/${total} - Tá tudo certo. Amanhã é nova oportunidade. Conta comigo`
    ];

    const variations = isDirect ? directNone : warmNone;
    return ResponseVariation.selectUniqueResponse('progress_none', variations);
  }

  private async handleGeneralConversation(message: WhatsAppMessage, user: any): Promise<void> {
    try {
      // Build conversation context with user ID
      const context = {
        userId: message.from,
        messages: [] as Array<{
          role: 'user' | 'assistant';
          content: string;
          timestamp: number;
        }>,
        lastActivity: Date.now(),
        metadata: {
          userName: user.name || 'Usuário',
          onboardingStep: user.onboardingStep || 'completed',
          tone: user.tone || 'warm'
        }
      };

      // Generate response using OpenAI (will use Sara assistant if available)
      const aiResponse = await this.openaiService.generateResponse(message.text, context);

      // Send Sara's response
      await this.sendMessage(message.from, aiResponse.content);

      logger.debug('Sara conversation response sent', {
        userId: message.from,
        responseLength: aiResponse.content.length,
        model: aiResponse.model
      });

    } catch (error) {
      logger.error('Error in Sara general conversation:', error);

      // Fallback response
      const today = new Date().toISOString().split('T')[0];
      const todayGoals = await this.saraContext.getDailyGoals(message.from, today);

      if (!todayGoals) {
        await this.sendMessage(
          message.from,
          'Oi! Ainda não temos metas definidas para hoje. Que tal começar definindo 1-3 coisas importantes para focar?'
        );
      } else {
        await this.sendMessage(
          message.from,
          `Como estão suas metas de hoje? ${todayGoals.completedCount}/${todayGoals.totalCount} já finalizadas?`
        );
      }
    }
  }

  private async generateWeeklyReport(userId: string): Promise<string> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const weeklyGoals = await this.saraContext.getWeeklyGoals(userId, startDate, endDate);

    const totalGoals = weeklyGoals.reduce((sum, day) => sum + day.totalCount, 0);
    const completedGoals = weeklyGoals.reduce((sum, day) => sum + day.completedCount, 0);
    const percentage = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

    // Find best day
    const bestDay = weeklyGoals.reduce((best, current) => {
      const currentRate = current.totalCount > 0 ? current.completedCount / current.totalCount : 0;
      const bestRate = best.totalCount > 0 ? best.completedCount / best.totalCount : 0;
      return currentRate > bestRate ? current : best;
    }, weeklyGoals[0]);

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const bestDayName = bestDay ? dayNames[new Date(bestDay.date).getDay()] : 'Nenhum';

    return this.templates.getWeeklyReportTemplate({
      completed: completedGoals,
      percentage,
      bestDay: bestDayName,
      obstacle: percentage < 50 ? 'Foco e constância' : 'Manter o ritmo'
    });
  }

  private async sendErrorMessage(to: string, customMessage?: string): Promise<void> {
    const message = customMessage || 'Ops! Algo deu errado por aqui. Pode tentar novamente? Se persistir, me avisa que vou investigar! 🔧';

    try {
      await this.whatsappService.sendMessage(to, message);
    } catch (error) {
      logger.error('Failed to send error message to user', { to, error });
      // Don't throw - avoid infinite error loop
    }
  }
}