export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  isGroup: boolean;
  groupName?: string;
  senderName?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
}

export interface OpenAIResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export interface BotConfig {
  openai: {
    apiKey: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
  };
  whatsapp: {
    sessionName: string;
    adminNumbers: string[];
    enableGroupResponses: boolean;
  };
  bot: {
    name: string;
    prefix: string;
    maxContextMessages: number;
  };
  features: {
    enableMediaProcessing: boolean;
    rateLimitMaxMessages: number;
    rateLimitWindowMs: number;
  };
}

export interface ConversationContext {
  userId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  lastActivity: number;
  metadata?: {
    userName?: string;
    onboardingStep?: string;
    tone?: 'direct' | 'warm';
  };
}

export interface RateLimitInfo {
  userId: string;
  messageCount: number;
  windowStart: number;
}

export interface DatabaseSchema {
  conversations: {
    id: string;
    user_id: string;
    context: string;
    last_activity: number;
    created_at: number;
  };
  rate_limits: {
    user_id: string;
    message_count: number;
    window_start: number;
  };
  logs: {
    id: string;
    level: string;
    message: string;
    timestamp: number;
    meta?: string;
  };
  sara_users: {
    user_id: string;
    name: string;
    frequency: 'daily' | 'twice_daily';
    morning_time: string;
    evening_time: string;
    noon_enabled: boolean;
    tone: 'warm' | 'direct';
    silence_weekends: boolean;
    timezone: string;
    onboarding_completed: boolean;
    created_at: number;
    updated_at: number;
  };
  daily_goals: {
    id: string;
    user_id: string;
    date: string;
    goals: string;
    completed_count: number;
    total_count: number;
    learning: string | null;
    created_at: number;
    updated_at: number;
  };
  important_dates: {
    id: string;
    user_id: string;
    title: string;
    date: string;
    recurrence: 'none' | 'yearly' | 'monthly' | 'weekly';
    category: 'birthday' | 'bill' | 'appointment' | 'other';
    created_at: number;
  };
  sara_analytics: {
    user_id: string;
    date: string;
    checkin_morning_sent: boolean;
    checkin_morning_responded: boolean;
    checkin_noon_sent: boolean;
    checkin_noon_responded: boolean;
    checkin_evening_sent: boolean;
    checkin_evening_responded: boolean;
    goals_set: number;
    goals_completed: number;
    response_time_avg: number;
  };
}

// Sara.ai specific types
export interface SaraUserProfile {
  userId: string;
  name: string;
  frequency: 'daily' | 'twice_daily';
  morningTime: string;
  eveningTime: string;
  noonEnabled: boolean;
  tone: 'warm' | 'direct';
  silenceWeekends: boolean;
  timezone: string;
  onboardingCompleted: boolean;
  pausedUntil?: number;
  quietHours?: {
    start: string;
    end: string;
  };
  createdAt: number;
  updatedAt: number;
}

export interface DailyGoals {
  id: string;
  userId: string;
  date: string;
  goals: string[];
  completedCount: number;
  totalCount: number;
  learning?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ImportantDate {
  id: string;
  userId: string;
  title: string;
  date: string;
  recurrence: 'none' | 'yearly' | 'monthly' | 'weekly';
  category: 'birthday' | 'bill' | 'appointment' | 'other';
  createdAt: number;
}

export interface SaraAnalytics {
  userId: string;
  date: string;
  checkinMorningSent: boolean;
  checkinMorningResponded: boolean;
  checkinNoonSent: boolean;
  checkinNoonResponded: boolean;
  checkinEveningSent: boolean;
  checkinEveningResponded: boolean;
  goalsSet: number;
  goalsCompleted: number;
  responseTimeAvg: number;
}

export type CheckinMode = 'checkin_morning' | 'checkin_noon' | 'checkin_evening' | 'reminder_date' | 'weekly_report';

export interface SaraOrchestratorData {
  mode: CheckinMode;
  user: SaraUserProfile;
  goals: {
    today: DailyGoals | null;
    weekly: DailyGoals[];
    health: 'good' | 'struggling' | 'needs_attention';
  };
  history: {
    responseRates: {
      morning: number;
      noon: number;
      evening: number;
    };
    recentCompletions: number[];
    commonBlockers: string[];
    silentDays: number;
  };
  dates: ImportantDate[];
  flags: {
    shortMode: boolean;
    offerPomodoro: boolean;
    allowNoon: boolean;
  };
}

export interface MessageTemplate {
  id: string;
  type: CheckinMode;
  content: string;
  variations: string[];
  lastUsed?: number;
  usageCount: number;
}

export interface OnboardingState {
  userId: string;
  step: 'name' | 'frequency' | 'times' | 'dates' | 'completed';
  data: Partial<SaraUserProfile>;
  tempDates: Partial<ImportantDate>[];
}