import { CheckinMode, MessageTemplate, SaraUserProfile, ImportantDate } from '../types';
import logger from '../utils/logger';

export class MessageTemplateService {
  private templates: Map<CheckinMode, MessageTemplate[]> = new Map();
  private lastUsed: Map<string, number> = new Map(); // userId_mode -> timestamp

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // Morning check-in templates
    this.templates.set('checkin_morning', [
      {
        id: 'morning_1',
        type: 'checkin_morning',
        content: 'Bom dia! Quais 1-3 metas vão fazer seu dia valer? Pode ser curtinho.',
        variations: [
          'Bom dia! Quais 1-3 metas vão fazer seu dia valer? Pode ser curtinho.',
          'Começamos simples: manda 1, 2 ou 3 metas de hoje. 30s e pronto.',
          'Se o dia tá corrido, escolhe 1 meta só. Qual vai ser?',
          'Oi! Que tal definir 1-3 focos para hoje? Rapidinho.',
          'Bom dia! Vamos definir o que vai importar hoje? 1, 2 ou 3 metas.',
          'Olá! Seu dia começa agora. Quais as prioridades? Até 3 metas.',
          'Bom dia! O que não pode ficar pra amanhã? 1-3 metas.',
          'Oi! Tempo de focar. Quais 1-3 coisas vão fazer diferença hoje?',
          'Bom dia! Simples e direto: quais suas 1-3 metas de hoje?',
          'Olá! Vamos lá: 1, 2 ou 3 metas para fazer o dia valer.',
          'Bom dia! Se só pudesse escolher 3 coisas hoje, quais seriam?',
          'Oi! Mais um dia, novas oportunidades. Quais 1-3 metas?',
          'Bom dia! Foca no essencial: até 3 metas para hoje.',
          'Olá! Que tal começar definindo 1-3 prioridades?',
          'Bom dia! O importante hoje: quais 1-3 metas você escolhe?'
        ],
        lastUsed: 0,
        usageCount: 0
      }
    ]);

    // Noon check-in templates
    this.templates.set('checkin_noon', [
      {
        id: 'noon_1',
        type: 'checkin_noon',
        content: 'Metade do dia já foi. Onde você está? 0/3, 1/3, 2/3 ou 3/3?',
        variations: [
          'Metade do dia já foi. Onde você está? 0/3, 1/3, 2/3 ou 3/3?',
          'Respira e foca: qual micro-passo de 5 min cabe agora?',
          'Se o dia saiu do roteiro, tudo bem. Qual pequena vitória dá pra buscar hoje?',
          'Pausa para um check: como está o progresso? 0/3, 1/3, 2/3 ou 3/3?',
          'Meio-dia! Como vão as metas? Me conta o placar.',
          'Olha só o tempo voando! Onde estamos? 0/3, 1/3, 2/3 ou 3/3?',
          'Hora do balanço: quantas metas já saíram? 0/3, 1/3, 2/3 ou 3/3?',
          'Oi! Tudo bem se o dia não foi como planejado. Qual o status?',
          'Check rápido: das suas metas, quantas já foram? Me conta.',
          'Meio-dia chegou! Como está indo? 0/3, 1/3, 2/3 ou 3/3?'
        ],
        lastUsed: 0,
        usageCount: 0
      },
      {
        id: 'noon_motivational',
        type: 'checkin_noon',
        content: 'Escolha 1: enviar 1 mensagem, abrir 1 arquivo, agendar 1 bloco. Qual?',
        variations: [
          'Escolha 1: enviar 1 mensagem, abrir 1 arquivo, agendar 1 bloco. Qual?',
          'Topa um foco de 25 min agora? Eu te aviso quando acabar.',
          'Micro-ação de 5 min: qual cabe agora na sua agenda?',
          'Se travou, sem problema. Que pequeno passo dá pra dar agora?',
          'Uma coisa só: qual micro-tarefa você consegue fazer agora?',
          'Destrava com 1 ação simples. O que você escolhe?',
          'Foco de 10 min: qual tarefa pequena você encara agora?',
          'Que tal 1 micro-progresso? Qual você escolhe fazer?'
        ],
        lastUsed: 0,
        usageCount: 0
      }
    ]);

    // Evening check-in templates
    this.templates.set('checkin_evening', [
      {
        id: 'evening_1',
        type: 'checkin_evening',
        content: 'Como fechamos? 0/3, 1/3, 2/3 ou 3/3. Quer anotar 1 aprendizado?',
        variations: [
          'Como fechamos? 0/3, 1/3, 2/3 ou 3/3. Quer anotar 1 aprendizado?',
          'Fechou o essencial? Me diga o placar (0-3). Se quiser, 1 palavra sobre o dia.',
          'Final do expediente! Como foi? Placar e, se rolar, um aprendizado.',
          'Hora de fechar: quantas metas saíram? 0/3, 1/3, 2/3 ou 3/3?',
          'Como foi hoje? Me conta o resultado final.',
          'Fechando o dia: qual foi o placar das metas?',
          'Fim de tarde! Como foi? 0/3, 1/3, 2/3 ou 3/3?',
          'Balanço do dia: quantas metas você conseguiu? Aprendeu algo?',
          'Encerrando: como foi o aproveitamento? 0/3, 1/3, 2/3 ou 3/3?',
          'Dia quase no fim! Qual foi o resultado? Algum aprendizado?'
        ],
        lastUsed: 0,
        usageCount: 0
      }
    ]);

    // Weekly report templates
    this.templates.set('weekly_report', [
      {
        id: 'weekly_1',
        type: 'weekly_report',
        content: 'Seu resumo da semana em 30s. Metas concluídas: X (Y%). Melhor dia: Z. Obstáculo: W.',
        variations: [
          'Seu resumo da semana em 30s. Metas concluídas: {completed} ({percentage}%). Melhor dia: {best_day}. Obstáculo: {obstacle}.',
          'Semana fechada! Você completou {completed} metas ({percentage}%). Destaque: {best_day}. Desafio: {obstacle}.',
          'Balanço semanal: {completed} metas finalizadas ({percentage}%). Ponto alto: {best_day}. Para melhorar: {obstacle}.'
        ],
        lastUsed: 0,
        usageCount: 0
      }
    ]);

    // Date reminder templates
    this.templates.set('reminder_date', [
      {
        id: 'reminder_today',
        type: 'reminder_date',
        content: '{event} hoje. Prefere mensagem carinhosa ou profissional? Posso sugerir 2 opções.',
        variations: [
          '{event} hoje. Prefere mensagem carinhosa ou profissional? Posso sugerir 2 opções.',
          'Hoje é {event}! Quer que eu ajude com uma mensagem? Que estilo prefere?',
          '{event} chegou! Posso sugerir uma mensagem. Carinhosa ou mais formal?'
        ],
        lastUsed: 0,
        usageCount: 0
      },
      {
        id: 'reminder_tomorrow',
        type: 'reminder_date',
        content: 'Amanhã é {event}. Quer uma mensagem pronta? SIM/NÃO',
        variations: [
          'Amanhã é {event}. Quer uma mensagem pronta? SIM/NÃO',
          'Lembrete: {event} é amanhã. Precisa de ajuda com uma mensagem?',
          'Oi! Amanhã é {event}. Quer que eu prepare algo especial?'
        ],
        lastUsed: 0,
        usageCount: 0
      }
    ]);

    logger.info('Message templates initialized');
  }

  getRandomTemplate(mode: CheckinMode, userId?: string): string {
    const templates = this.templates.get(mode);
    if (!templates || templates.length === 0) {
      return this.getDefaultMessage(mode);
    }

    // Filter out recently used templates (within 72 hours)
    const now = Date.now();
    const recentlyUsedKey = userId ? `${userId}_${mode}` : mode;
    const lastUsedTime = this.lastUsed.get(recentlyUsedKey) || 0;
    const isRecent = now - lastUsedTime < 72 * 60 * 60 * 1000; // 72 hours

    let availableTemplates = templates;
    if (isRecent && templates.length > 1) {
      // Get the template that was used recently
      const lastTemplate = templates.find(t => t.lastUsed === lastUsedTime);
      if (lastTemplate) {
        availableTemplates = templates.filter(t => t.id !== lastTemplate.id);
      }
    }

    // Select template with lowest usage count
    const sortedTemplates = availableTemplates.sort((a, b) => a.usageCount - b.usageCount);
    const leastUsed = sortedTemplates[0];

    if (!leastUsed) {
      return this.getDefaultMessage(mode);
    }

    // Select random variation from the chosen template
    const randomIndex = Math.floor(Math.random() * leastUsed.variations.length);
    const selectedMessage = leastUsed.variations[randomIndex];

    if (!selectedMessage) {
      return this.getDefaultMessage(mode);
    }

    // Update usage tracking
    leastUsed.usageCount++;
    leastUsed.lastUsed = now;
    if (userId) {
      this.lastUsed.set(recentlyUsedKey, now);
    }

    return selectedMessage;
  }

  getDateReminderMessage(date: ImportantDate, isToday: boolean): string {
    const templateType = isToday ? 'reminder_today' : 'reminder_tomorrow';
    const templates = this.templates.get('reminder_date');

    if (!templates || templates.length === 0) {
      return isToday
        ? `${date.title} hoje. Prefere mensagem carinhosa ou profissional?`
        : `Amanhã é ${date.title}. Quer uma mensagem pronta?`;
    }

    const template = templates.find(t => t.id === (isToday ? 'reminder_today' : 'reminder_tomorrow'));
    if (!template) {
      return this.getDateReminderMessage(date, isToday);
    }

    const randomIndex = Math.floor(Math.random() * template.variations.length);
    const selectedMessage = template.variations[randomIndex];

    // Replace placeholder
    return selectedMessage.replace('{event}', date.title);
  }

  getWeeklyReportTemplate(data: {
    completed: number;
    percentage: number;
    bestDay: string;
    obstacle: string;
  }): string {
    const templates = this.templates.get('weekly_report');
    if (!templates || templates.length === 0) {
      return `Semana fechada! Você completou ${data.completed} metas (${data.percentage}%). Melhor dia: ${data.bestDay}.`;
    }

    const template = templates[0]; // Use the first template for now
    const randomIndex = Math.floor(Math.random() * template.variations.length);
    let message = template.variations[randomIndex];

    // Replace placeholders
    message = message.replace('{completed}', data.completed.toString());
    message = message.replace('{percentage}', data.percentage.toString());
    message = message.replace('{best_day}', data.bestDay);
    message = message.replace('{obstacle}', data.obstacle);

    return message;
  }

  getPersonalizedMessage(mode: CheckinMode, user: SaraUserProfile, context?: any): string {
    let baseMessage = this.getRandomTemplate(mode, user.userId);

    // Adjust tone based on user preference
    if (user.tone === 'direct') {
      baseMessage = this.makeMoreDirect(baseMessage);
    } else {
      baseMessage = this.makeMoreWarm(baseMessage);
    }

    // Add user's name occasionally (20% chance)
    if (Math.random() < 0.2 && user.name) {
      baseMessage = `${user.name}, ${baseMessage.toLowerCase()}`;
    }

    return baseMessage;
  }

  private makeMoreDirect(message: string): string {
    // Make message more direct/objective
    return message
      .replace(/Oi!/g, 'Olá')
      .replace(/Que tal/g, 'Vamos')
      .replace(/Pode ser curtinho/g, 'Seja objetivo')
      .replace(/\?$/g, '.');
  }

  private makeMoreWarm(message: string): string {
    // Make message more warm/caring
    if (!message.includes('!') && Math.random() < 0.3) {
      return message.replace('.', '! 😊');
    }
    return message;
  }

  private getDefaultMessage(mode: CheckinMode): string {
    switch (mode) {
      case 'checkin_morning':
        return 'Bom dia! Quais suas metas para hoje?';
      case 'checkin_noon':
        return 'Como está o progresso das suas metas?';
      case 'checkin_evening':
        return 'Como foi o dia? Quantas metas você conseguiu?';
      case 'weekly_report':
        return 'Hora do resumo semanal!';
      case 'reminder_date':
        return 'Você tem um compromisso importante hoje.';
      default:
        return 'Olá! Como posso ajudar?';
    }
  }

  // Helper methods for special cases
  getOnboardingMessage(step: string, name?: string): string {
    const messages = {
      welcome: `Oi! Eu sou a Sara 🌸

Minha missão: te ajudar a bater 1-3 MICRO-METAS por dia.

**Por quê micro-metas?**
• 3 coisinhas pequenas > 1 objetivo gigante que trava
• Você sente progresso TODO dia (não só no fim do mês)
• Sem pressão, sem culpa, sem burnout

**Como funciona?**
Eu dou um toque de manhã/tarde perguntando suas 1-3 metas. Você responde o placar (0/3, 1/3, 2/3, 3/3). Só isso.

Pra começar: como você quer que eu te chame?`,

      name: (name: string) => `Prazer, ${name}!

Agora: que frequência de check-ins funciona melhor pra você?

1️⃣ **Uma vez por dia** (só de manhã)
2️⃣ **Duas vezes por dia** (manhã + tarde/noite)

Responda 1 ou 2.`,

      frequency: `Perfeito!

Que horários funcionam melhor pra você?

**Exemplos:**
• "08:30 e 18:30" (se escolheu 2x/dia)
• "09:00" (se escolheu 1x/dia)

Me manda seus horários:`,

      times: `Ótimo!

Última coisa: tem alguma data importante que você quer que eu lembre?

**Pode ser:**
• Aniversários
• Contas pra pagar
• Compromissos importantes

**Exemplo:** "aniv João 15/10, conta luz dia 05"

Ou escreva "nenhuma" se preferir adicionar depois.`,

      completed: (name: string) => `Pronto, ${name}! 🎉

Estamos conectadas! Amanhã de manhã eu mando a primeira mensagem perguntando suas 1-3 metas do dia.

**Lembretes:**
• Não precisa ser perfeito - 1/3 já é vitória
• Se tiver dia ruim (0/3), sem culpa! Amanhã recomeça
• Pode pausar ou ajustar a qualquer momento

**Comandos úteis:**
• PAUSAR X - pausa por X horas
• TOM DIRETO/CALOROSO - muda meu estilo
• HELP - mostra todos os comandos

Vamos nessa! ✨`
    };

    return messages[step as keyof typeof messages] as string || messages.welcome;
  }

  getSaraCommands(): string {
    return `**📱 Comandos da Sara:**

**⏸️ Pausar:**
• **PAUSAR X** - Pauso por X horas (ex: PAUSAR 4)
• **FÉRIAS X** - Pauso por X dias, 1-14 (ex: FÉRIAS 7)
• **HOJE NÃO** - Pulo só hoje, volto amanhã

**⚙️ Configurar:**
• **SILENCIAR FDS** - Não envio nada nos fins de semana
• **HORÁRIO hh:mm** - Mudo horário do check-in
• **TOM DIRETO** ou **TOM CALOROSO** - Ajusto meu jeito
• **MEIO-DIA ON/OFF** - Ligo/desligo check-in do meio-dia

**💡 Como funciona:**
• Mando 1-3 metas por dia (quanto menos, melhor!)
• Você responde: 0/3, 1/3, 2/3 ou 3/3
• Sem culpa se 0/3 - amanhã recomeça
• 1/3 já é vitória! 🎉

Qualquer dúvida, é só chamar! 😊`;
  }
}