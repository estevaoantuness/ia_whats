import * as cron from 'node-cron';
import { SaraUserProfile, CheckinMode } from '../types';
import { SaraContextService } from './saraContext';
import { WhatsAppService } from './whatsapp';
import { SaraMessageHandler } from '../handlers/saraMessageHandler';
import logger from '../utils/logger';

export class SchedulerService {
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private saraContext: SaraContextService;
  private whatsappService: WhatsAppService;
  private messageHandler: SaraMessageHandler;

  constructor(
    saraContext: SaraContextService,
    whatsappService: WhatsAppService,
    messageHandler: SaraMessageHandler
  ) {
    this.saraContext = saraContext;
    this.whatsappService = whatsappService;
    this.messageHandler = messageHandler;
  }

  async initializeUserSchedules(): Promise<void> {
    try {
      const users = await this.saraContext.getAllUsers();

      for (const user of users) {
        if (user.onboardingCompleted && !this.isUserPaused(user)) {
          this.setupUserSchedule(user);
        }
      }

      // Setup weekly report for all users (Sundays at 17:30)
      this.setupWeeklyReports();

      // Setup date reminders check (daily at 8:00)
      this.setupDateReminders();

      logger.info(`Initialized schedules for ${users.length} users`);
    } catch (error) {
      logger.error('Error initializing user schedules:', error);
    }
  }

  setupUserSchedule(user: SaraUserProfile): void {
    this.clearUserSchedule(user.userId);

    // Morning check-in
    if (user.frequency === 'daily' || user.frequency === 'twice_daily') {
      this.scheduleCheckin(user, 'morning');
    }

    // Evening check-in
    if (user.frequency === 'twice_daily') {
      this.scheduleCheckin(user, 'evening');
    }

    // Noon check-in (2-3 times per week if enabled)
    if (user.noonEnabled && user.frequency === 'twice_daily') {
      this.scheduleNoonCheckins(user);
    }

    logger.info(`Schedule setup completed for user: ${user.userId}`);
  }

  private scheduleCheckin(user: SaraUserProfile, type: 'morning' | 'evening'): void {
    if (this.shouldSkipWeekends(user)) {
      return;
    }

    const time = type === 'morning' ? user.morningTime : user.eveningTime;
    const [hour, minute] = time.split(':').map(Number);

    // Add randomization (±10-20 minutes)
    const randomOffset = this.getRandomOffset();
    const adjustedMinute = Math.max(0, Math.min(59, minute + randomOffset));

    // Create cron expression for weekdays or all days
    const cronExpression = user.silenceWeekends
      ? `${adjustedMinute} ${hour} * * 1-5`  // Monday to Friday
      : `${adjustedMinute} ${hour} * * *`;   // Every day

    const taskId = `${user.userId}_${type}`;
    const task = cron.schedule(cronExpression, async () => {
      await this.executeCheckin(user.userId, type === 'morning' ? 'checkin_morning' : 'checkin_evening');
    }, {
      timezone: user.timezone || 'America/Sao_Paulo'
    });

    this.tasks.set(taskId, task);
    logger.debug(`Scheduled ${type} checkin for user ${user.userId} at ${hour}:${adjustedMinute}`);
  }

  private scheduleNoonCheckins(user: SaraUserProfile): void {
    // Schedule noon checkins for Tuesday, Wednesday, Friday (2-3 times per week)
    const noonDays = [2, 3, 5]; // Tue, Wed, Fri

    noonDays.forEach(day => {
      const randomOffset = this.getRandomOffset();
      const adjustedMinute = Math.max(0, Math.min(59, randomOffset));

      // Noon around 12:00 with variation
      const cronExpression = `${adjustedMinute} 12 * * ${day}`;

      const taskId = `${user.userId}_noon_${day}`;
      const task = cron.schedule(cronExpression, async () => {
        // Only send if user has been responsive to noon checkins
        const shouldSend = await this.shouldSendNoonCheckin(user.userId);
        if (shouldSend) {
          await this.executeCheckin(user.userId, 'checkin_noon');
        }
      }, {
        timezone: user.timezone || 'America/Sao_Paulo'
      });

      this.tasks.set(taskId, task);
    });
  }

  private setupWeeklyReports(): void {
    // Every Sunday at 17:30
    const task = cron.schedule('30 17 * * 0', async () => {
      await this.executeWeeklyReports();
    }, {
      timezone: 'America/Sao_Paulo'
    });

    this.tasks.set('weekly_reports', task);
    logger.info('Weekly reports scheduled for Sundays at 17:30');
  }

  private setupDateReminders(): void {
    // Every day at 8:00 AM to check for important dates
    const task = cron.schedule('0 8 * * *', async () => {
      await this.executeDateReminders();
    }, {
      timezone: 'America/Sao_Paulo'
    });

    this.tasks.set('date_reminders', task);
    logger.info('Date reminders scheduled for daily at 8:00 AM');
  }

  private async executeCheckin(userId: string, mode: CheckinMode): Promise<void> {
    try {
      const user = await this.saraContext.getUserProfile(userId);
      if (!user || this.isUserPaused(user)) {
        return;
      }

      // Check quiet hours
      if (this.isInQuietHours(user)) {
        logger.debug(`Skipping checkin for user ${userId} - in quiet hours`);
        return;
      }

      // Generate and send checkin message
      await this.messageHandler.sendScheduledCheckin(userId, mode);

      // Log analytics
      await this.saraContext.logCheckinSent(userId, mode);

    } catch (error) {
      logger.error(`Error executing ${mode} for user ${userId}:`, error);
    }
  }

  private async executeWeeklyReports(): Promise<void> {
    try {
      const users = await this.saraContext.getAllUsers();

      for (const user of users) {
        if (user.onboardingCompleted && !this.isUserPaused(user)) {
          await this.messageHandler.sendScheduledCheckin(user.userId, 'weekly_report');
        }
      }

      logger.info('Weekly reports sent to all active users');
    } catch (error) {
      logger.error('Error executing weekly reports:', error);
    }
  }

  private async executeDateReminders(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const users = await this.saraContext.getAllUsers();

      for (const user of users) {
        if (!user.onboardingCompleted || this.isUserPaused(user)) {
          continue;
        }

        const dates = await this.saraContext.getUserImportantDates(user.userId);

        for (const date of dates) {
          // Check if date is today or tomorrow
          if (date.date === today || date.date === tomorrow) {
            await this.messageHandler.sendDateReminder(user.userId, date, date.date === today);
          }
        }
      }

      logger.info('Date reminders checked and sent');
    } catch (error) {
      logger.error('Error executing date reminders:', error);
    }
  }

  private async shouldSendNoonCheckin(userId: string): Promise<boolean> {
    try {
      const analytics = await this.saraContext.getRecentAnalytics(userId, 7);

      // Calculate noon response rate
      const noonSent = analytics.filter(a => a.checkinNoonSent).length;
      const noonResponded = analytics.filter(a => a.checkinNoonResponded).length;

      if (noonSent === 0) return true; // First time

      const responseRate = noonResponded / noonSent;
      return responseRate > 0.3; // Only send if 30%+ response rate
    } catch (error) {
      logger.error('Error checking noon checkin eligibility:', error);
      return true; // Default to sending
    }
  }

  private isUserPaused(user: SaraUserProfile): boolean {
    if (!user.pausedUntil) return false;
    return Date.now() < user.pausedUntil;
  }

  private isInQuietHours(user: SaraUserProfile): boolean {
    if (!user.quietHours) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return currentTime >= user.quietHours.start && currentTime <= user.quietHours.end;
  }

  private shouldSkipWeekends(user: SaraUserProfile): boolean {
    if (!user.silenceWeekends) return false;

    const today = new Date().getDay();
    return today === 0 || today === 6; // Sunday or Saturday
  }

  private getRandomOffset(): number {
    // Return random offset between -20 and +20 minutes
    return Math.floor(Math.random() * 41) - 20;
  }

  clearUserSchedule(userId: string): void {
    const userTasks = Array.from(this.tasks.keys()).filter(key => key.startsWith(userId));

    userTasks.forEach(taskId => {
      const task = this.tasks.get(taskId);
      if (task) {
        task.destroy();
        this.tasks.delete(taskId);
      }
    });

    logger.debug(`Cleared schedule for user: ${userId}`);
  }

  updateUserSchedule(user: SaraUserProfile): void {
    this.setupUserSchedule(user);
  }

  async pauseUser(userId: string, hours: number): Promise<void> {
    const user = await this.saraContext.getUserProfile(userId);
    if (user) {
      this.clearUserSchedule(userId);
      // The pause will be handled in the user profile update
      logger.info(`User ${userId} paused for ${hours} hours`);
    }
  }

  async resumeUser(userId: string): Promise<void> {
    const user = await this.saraContext.getUserProfile(userId);
    if (user) {
      this.setupUserSchedule(user);
      logger.info(`User ${userId} resumed`);
    }
  }

  shutdown(): void {
    this.tasks.forEach(task => task.destroy());
    this.tasks.clear();
    logger.info('Scheduler service shut down');
  }
}