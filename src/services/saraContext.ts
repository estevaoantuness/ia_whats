import { DatabaseService } from './database';
import {
  SaraUserProfile,
  DailyGoals,
  ImportantDate,
  SaraAnalytics,
  OnboardingState,
  CheckinMode
} from '../types';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class SaraContextService {
  private db: DatabaseService;
  private onboardingStates: Map<string, OnboardingState> = new Map();

  constructor(db: DatabaseService) {
    this.db = db;
    this.init();
  }

  private async init(): Promise<void> {
    try {
      // Ensure database is properly initialized
      if (this.db && typeof this.db.initializeTables === 'function') {
        await this.db.initializeTables();
      }
    } catch (error) {
      logger.error('Failed to initialize SaraContext with database:', error);
    }
  }

  // User Profile Management
  async createUserProfile(profile: Omit<SaraUserProfile, 'createdAt' | 'updatedAt'>): Promise<void> {
    // Validate input
    if (!profile.userId || typeof profile.userId !== 'string') {
      throw new Error('Invalid userId provided to createUserProfile');
    }

    if (!profile.name || typeof profile.name !== 'string' || profile.name.trim().length < 1) {
      throw new Error('Invalid name provided to createUserProfile');
    }

    if (!['daily', 'twice_daily'].includes(profile.frequency)) {
      throw new Error('Invalid frequency provided to createUserProfile');
    }

    if (!profile.morningTime || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(profile.morningTime)) {
      throw new Error('Invalid morningTime provided to createUserProfile');
    }

    if (!profile.eveningTime || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(profile.eveningTime)) {
      throw new Error('Invalid eveningTime provided to createUserProfile');
    }

    const now = Date.now();
    const fullProfile: SaraUserProfile = {
      ...profile,
      createdAt: now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      this.db['db'].run(
        `INSERT OR REPLACE INTO sara_users
         (user_id, name, frequency, morning_time, evening_time, noon_enabled, tone, silence_weekends, timezone, onboarding_completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fullProfile.userId,
          fullProfile.name,
          fullProfile.frequency,
          fullProfile.morningTime,
          fullProfile.eveningTime,
          fullProfile.noonEnabled ? 1 : 0,
          fullProfile.tone,
          fullProfile.silenceWeekends ? 1 : 0,
          fullProfile.timezone,
          fullProfile.onboardingCompleted ? 1 : 0,
          fullProfile.createdAt,
          fullProfile.updatedAt
        ],
        function(err) {
          if (err) {
            logger.error('Error creating user profile:', err);
            reject(err);
          } else {
            logger.info(`Sara user profile created: ${fullProfile.userId}`);
            resolve();
          }
        }
      );
    });
  }

  async getUserProfile(userId: string): Promise<SaraUserProfile | null> {
    return new Promise((resolve, reject) => {
      this.db['db'].get(
        'SELECT * FROM sara_users WHERE user_id = ?',
        [userId],
        (err, row: any) => {
          if (err) {
            logger.error('Error getting user profile:', err);
            reject(err);
          } else if (row) {
            const profile: SaraUserProfile = {
              userId: row.user_id,
              name: row.name,
              frequency: row.frequency,
              morningTime: row.morning_time,
              eveningTime: row.evening_time,
              noonEnabled: Boolean(row.noon_enabled),
              tone: row.tone,
              silenceWeekends: Boolean(row.silence_weekends),
              timezone: row.timezone,
              onboardingCompleted: Boolean(row.onboarding_completed),
              createdAt: row.created_at,
              updatedAt: row.updated_at
            };
            resolve(profile);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  async updateUserProfile(userId: string, updates: Partial<SaraUserProfile>): Promise<void> {
    const current = await this.getUserProfile(userId);
    if (!current) {
      throw new Error(`User profile not found: ${userId}`);
    }

    const updated = { ...current, ...updates, updatedAt: Date.now() };

    return new Promise((resolve, reject) => {
      this.db['db'].run(
        `UPDATE sara_users SET
         name = ?, frequency = ?, morning_time = ?, evening_time = ?, noon_enabled = ?,
         tone = ?, silence_weekends = ?, timezone = ?, onboarding_completed = ?, updated_at = ?
         WHERE user_id = ?`,
        [
          updated.name,
          updated.frequency,
          updated.morningTime,
          updated.eveningTime,
          updated.noonEnabled ? 1 : 0,
          updated.tone,
          updated.silenceWeekends ? 1 : 0,
          updated.timezone,
          updated.onboardingCompleted ? 1 : 0,
          updated.updatedAt,
          userId
        ],
        function(err) {
          if (err) {
            logger.error('Error updating user profile:', err);
            reject(err);
          } else {
            logger.debug(`User profile updated: ${userId}`);
            resolve();
          }
        }
      );
    });
  }

  async getAllUsers(): Promise<SaraUserProfile[]> {
    return new Promise((resolve, reject) => {
      this.db['db'].all(
        'SELECT * FROM sara_users ORDER BY created_at ASC',
        [],
        (err, rows: any[]) => {
          if (err) {
            logger.error('Error getting all users:', err);
            reject(err);
          } else {
            const profiles = rows.map(row => ({
              userId: row.user_id,
              name: row.name,
              frequency: row.frequency,
              morningTime: row.morning_time,
              eveningTime: row.evening_time,
              noonEnabled: Boolean(row.noon_enabled),
              tone: row.tone,
              silenceWeekends: Boolean(row.silence_weekends),
              timezone: row.timezone,
              onboardingCompleted: Boolean(row.onboarding_completed),
              createdAt: row.created_at,
              updatedAt: row.updated_at
            }));
            resolve(profiles);
          }
        }
      );
    });
  }

  // Daily Goals Management
  async saveDailyGoals(goals: Omit<DailyGoals, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = uuidv4();
    const now = Date.now();
    const fullGoals: DailyGoals = {
      id,
      ...goals,
      createdAt: now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      this.db['db'].run(
        `INSERT OR REPLACE INTO daily_goals
         (id, user_id, date, goals, completed_count, total_count, learning, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fullGoals.id,
          fullGoals.userId,
          fullGoals.date,
          JSON.stringify(fullGoals.goals),
          fullGoals.completedCount,
          fullGoals.totalCount,
          fullGoals.learning || null,
          fullGoals.createdAt,
          fullGoals.updatedAt
        ],
        function(err) {
          if (err) {
            logger.error('Error saving daily goals:', err);
            reject(err);
          } else {
            logger.debug(`Daily goals saved: ${fullGoals.userId} - ${fullGoals.date}`);
            resolve(id);
          }
        }
      );
    });
  }

  async getDailyGoals(userId: string, date: string): Promise<DailyGoals | null> {
    return new Promise((resolve, reject) => {
      this.db['db'].get(
        'SELECT * FROM daily_goals WHERE user_id = ? AND date = ?',
        [userId, date],
        (err, row: any) => {
          if (err) {
            logger.error('Error getting daily goals:', err);
            reject(err);
          } else if (row) {
            const goals: DailyGoals = {
              id: row.id,
              userId: row.user_id,
              date: row.date,
              goals: JSON.parse(row.goals),
              completedCount: row.completed_count,
              totalCount: row.total_count,
              learning: row.learning,
              createdAt: row.created_at,
              updatedAt: row.updated_at
            };
            resolve(goals);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  async getWeeklyGoals(userId: string, startDate: string, endDate: string): Promise<DailyGoals[]> {
    return new Promise((resolve, reject) => {
      this.db['db'].all(
        'SELECT * FROM daily_goals WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC',
        [userId, startDate, endDate],
        (err, rows: any[]) => {
          if (err) {
            logger.error('Error getting weekly goals:', err);
            reject(err);
          } else {
            const goals = rows.map(row => ({
              id: row.id,
              userId: row.user_id,
              date: row.date,
              goals: JSON.parse(row.goals),
              completedCount: row.completed_count,
              totalCount: row.total_count,
              learning: row.learning,
              createdAt: row.created_at,
              updatedAt: row.updated_at
            }));
            resolve(goals);
          }
        }
      );
    });
  }

  async updateDailyGoalsProgress(userId: string, date: string, completedCount: number, learning?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db['db'].run(
        'UPDATE daily_goals SET completed_count = ?, learning = ?, updated_at = ? WHERE user_id = ? AND date = ?',
        [completedCount, learning || null, Date.now(), userId, date],
        function(err) {
          if (err) {
            logger.error('Error updating daily goals progress:', err);
            reject(err);
          } else {
            logger.debug(`Daily goals progress updated: ${userId} - ${date} - ${completedCount}`);
            resolve();
          }
        }
      );
    });
  }

  // Important Dates Management
  async addImportantDate(date: Omit<ImportantDate, 'id' | 'createdAt'>): Promise<string> {
    const id = uuidv4();
    const fullDate: ImportantDate = {
      id,
      ...date,
      createdAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      this.db['db'].run(
        `INSERT INTO important_dates
         (id, user_id, title, date, recurrence, category, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          fullDate.id,
          fullDate.userId,
          fullDate.title,
          fullDate.date,
          fullDate.recurrence,
          fullDate.category,
          fullDate.createdAt
        ],
        function(err) {
          if (err) {
            logger.error('Error adding important date:', err);
            reject(err);
          } else {
            logger.debug(`Important date added: ${fullDate.userId} - ${fullDate.title}`);
            resolve(id);
          }
        }
      );
    });
  }

  async getUserImportantDates(userId: string): Promise<ImportantDate[]> {
    return new Promise((resolve, reject) => {
      this.db['db'].all(
        'SELECT * FROM important_dates WHERE user_id = ? ORDER BY date ASC',
        [userId],
        (err, rows: any[]) => {
          if (err) {
            logger.error('Error getting user important dates:', err);
            reject(err);
          } else {
            const dates = rows.map(row => ({
              id: row.id,
              userId: row.user_id,
              title: row.title,
              date: row.date,
              recurrence: row.recurrence,
              category: row.category,
              createdAt: row.created_at
            }));
            resolve(dates);
          }
        }
      );
    });
  }

  // Analytics Management
  async logCheckinSent(userId: string, mode: CheckinMode): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    return new Promise((resolve, reject) => {
      // First, get or create today's analytics record
      this.db['db'].get(
        'SELECT * FROM sara_analytics WHERE user_id = ? AND date = ?',
        [userId, today],
        (err, row: any) => {
          if (err) {
            logger.error('Error getting analytics record:', err);
            reject(err);
            return;
          }

          const updateField = this.getCheckinField(mode, 'sent');
          if (!updateField) {
            resolve(); // Not a checkin mode
            return;
          }

          if (row) {
            // Update existing record
            this.db['db'].run(
              `UPDATE sara_analytics SET ${updateField} = 1 WHERE user_id = ? AND date = ?`,
              [userId, today],
              (updateErr) => {
                if (updateErr) {
                  logger.error('Error updating analytics:', updateErr);
                  reject(updateErr);
                } else {
                  resolve();
                }
              }
            );
          } else {
            // Create new record
            this.db['db'].run(
              `INSERT INTO sara_analytics
               (user_id, date, ${updateField}, checkin_morning_responded, checkin_noon_responded, checkin_evening_responded, goals_set, goals_completed, response_time_avg)
               VALUES (?, ?, 1, 0, 0, 0, 0, 0, 0)`,
              [userId, today],
              (insertErr) => {
                if (insertErr) {
                  logger.error('Error inserting analytics:', insertErr);
                  reject(insertErr);
                } else {
                  resolve();
                }
              }
            );
          }
        }
      );
    });
  }

  async logCheckinResponse(userId: string, mode: CheckinMode, responseTime: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const updateField = this.getCheckinField(mode, 'responded');

    if (!updateField) return;

    return new Promise((resolve, reject) => {
      this.db['db'].run(
        `UPDATE sara_analytics SET ${updateField} = 1, response_time_avg = ? WHERE user_id = ? AND date = ?`,
        [responseTime, userId, today],
        function(err) {
          if (err) {
            logger.error('Error logging checkin response:', err);
            reject(err);
          } else {
            logger.debug(`Checkin response logged: ${userId} - ${mode}`);
            resolve();
          }
        }
      );
    });
  }

  async getRecentAnalytics(userId: string, days: number): Promise<SaraAnalytics[]> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return new Promise((resolve, reject) => {
      this.db['db'].all(
        'SELECT * FROM sara_analytics WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC',
        [userId, startDate, endDate],
        (err, rows: any[]) => {
          if (err) {
            logger.error('Error getting recent analytics:', err);
            reject(err);
          } else {
            const analytics = rows.map(row => ({
              userId: row.user_id,
              date: row.date,
              checkinMorningSent: Boolean(row.checkin_morning_sent),
              checkinMorningResponded: Boolean(row.checkin_morning_responded),
              checkinNoonSent: Boolean(row.checkin_noon_sent),
              checkinNoonResponded: Boolean(row.checkin_noon_responded),
              checkinEveningSent: Boolean(row.checkin_evening_sent),
              checkinEveningResponded: Boolean(row.checkin_evening_responded),
              goalsSet: row.goals_set,
              goalsCompleted: row.goals_completed,
              responseTimeAvg: row.response_time_avg
            }));
            resolve(analytics);
          }
        }
      );
    });
  }

  // Onboarding Management
  startOnboarding(userId: string): OnboardingState {
    const state: OnboardingState = {
      userId,
      step: 'name',
      data: { userId },
      tempDates: []
    };

    this.onboardingStates.set(userId, state);
    return state;
  }

  getOnboardingState(userId: string): OnboardingState | null {
    return this.onboardingStates.get(userId) || null;
  }

  updateOnboardingState(userId: string, updates: Partial<OnboardingState>): OnboardingState | null {
    const current = this.onboardingStates.get(userId);
    if (!current) return null;

    const updated = { ...current, ...updates };
    this.onboardingStates.set(userId, updated);
    return updated;
  }

  async completeOnboarding(userId: string): Promise<void> {
    const state = this.onboardingStates.get(userId);
    if (!state || !state.data) {
      throw new Error('Invalid onboarding state');
    }

    // Create user profile
    await this.createUserProfile({
      ...state.data as SaraUserProfile,
      onboardingCompleted: true
    });

    // Add important dates
    for (const date of state.tempDates) {
      if (date.title && date.date) {
        await this.addImportantDate({
          userId,
          title: date.title,
          date: date.date,
          recurrence: date.recurrence || 'none',
          category: date.category || 'other'
        });
      }
    }

    // Clean up onboarding state
    this.onboardingStates.delete(userId);

    logger.info(`Onboarding completed for user: ${userId}`);
  }

  // Helper methods
  private getCheckinField(mode: CheckinMode, type: 'sent' | 'responded'): string | null {
    const mapping: Record<string, string> = {
      'checkin_morning': `checkin_morning_${type}`,
      'checkin_noon': `checkin_noon_${type}`,
      'checkin_evening': `checkin_evening_${type}`
    };

    return mapping[mode] || null;
  }

  // Utility methods
  async pauseUser(userId: string, hours: number): Promise<void> {
    const pausedUntil = Date.now() + (hours * 60 * 60 * 1000);
    await this.updateUserProfile(userId, { pausedUntil });
  }

  async resumeUser(userId: string): Promise<void> {
    await this.updateUserProfile(userId, { pausedUntil: undefined });
  }

  async isUserPaused(userId: string): Promise<boolean> {
    const profile = await this.getUserProfile(userId);
    if (!profile || !profile.pausedUntil) return false;
    return Date.now() < profile.pausedUntil;
  }

  async addSystemMessage(userId: string, message: string): Promise<void> {
    // Simple logger for system messages (for web interface)
    logger.info(`System message stored for ${userId}:`, { message, timestamp: new Date().toISOString() });
    // In a real implementation, you might want to store these in a separate table
  }
}