import sqlite3 from 'sqlite3';
import path from 'path';
import { ConversationContext, RateLimitInfo } from '../types';
import logger from '../utils/logger';

export class DatabaseService {
  private db: sqlite3.Database;
  private dbPath: string;

  constructor(dbPath: string = path.join(process.cwd(), 'data', 'database.sqlite')) {
    this.dbPath = dbPath;
    this.db = new sqlite3.Database(dbPath);
  }

  async initializeTables(): Promise<void> {
    const queries = [
      `
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          context TEXT NOT NULL,
          last_activity INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS rate_limits (
          user_id TEXT PRIMARY KEY,
          message_count INTEGER NOT NULL DEFAULT 0,
          window_start INTEGER NOT NULL
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS logs (
          id TEXT PRIMARY KEY,
          level TEXT NOT NULL,
          message TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          meta TEXT
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS sara_users (
          user_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'twice_daily')),
          morning_time TEXT NOT NULL,
          evening_time TEXT NOT NULL,
          noon_enabled INTEGER NOT NULL DEFAULT 0,
          tone TEXT NOT NULL DEFAULT 'warm' CHECK (tone IN ('warm', 'direct')),
          silence_weekends INTEGER NOT NULL DEFAULT 0,
          timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
          onboarding_completed INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS daily_goals (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          date TEXT NOT NULL,
          goals TEXT NOT NULL,
          completed_count INTEGER NOT NULL DEFAULT 0,
          total_count INTEGER NOT NULL DEFAULT 0,
          learning TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(user_id, date)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS important_dates (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          date TEXT NOT NULL,
          recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'yearly', 'monthly', 'weekly')),
          category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('birthday', 'bill', 'appointment', 'other')),
          created_at INTEGER NOT NULL
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS sara_analytics (
          user_id TEXT NOT NULL,
          date TEXT NOT NULL,
          checkin_morning_sent INTEGER NOT NULL DEFAULT 0,
          checkin_morning_responded INTEGER NOT NULL DEFAULT 0,
          checkin_noon_sent INTEGER NOT NULL DEFAULT 0,
          checkin_noon_responded INTEGER NOT NULL DEFAULT 0,
          checkin_evening_sent INTEGER NOT NULL DEFAULT 0,
          checkin_evening_responded INTEGER NOT NULL DEFAULT 0,
          goals_set INTEGER NOT NULL DEFAULT 0,
          goals_completed INTEGER NOT NULL DEFAULT 0,
          response_time_avg INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, date)
        )
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_conversations_last_activity ON conversations(last_activity)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_sara_users_onboarding ON sara_users(onboarding_completed)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_daily_goals_user_date ON daily_goals(user_id, date)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_daily_goals_date ON daily_goals(date)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_important_dates_user ON important_dates(user_id)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_important_dates_date ON important_dates(date)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_sara_analytics_user_date ON sara_analytics(user_id, date)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_sara_analytics_date ON sara_analytics(date)
      `
    ];

    try {
      for (const query of queries) {
        await this.runQuery(query);
      }
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private runQuery(query: string, params?: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(query, params || [], function(err) {
        if (err) {
          logger.error('Database query error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async saveConversationContext(userId: string, context: ConversationContext): Promise<void> {
    return new Promise((resolve, reject) => {
      const contextJson = JSON.stringify(context);
      const now = Date.now();

      this.db.run(
        `
          INSERT OR REPLACE INTO conversations
          (id, user_id, context, last_activity, created_at)
          VALUES (?, ?, ?, ?, ?)
        `,
        [userId, userId, contextJson, now, now],
        function(err) {
          if (err) {
            logger.error('Error saving conversation context:', err);
            reject(err);
          } else {
            logger.debug(`Conversation context saved for user: ${userId}`);
            resolve();
          }
        }
      );
    });
  }

  async getConversationContext(userId: string): Promise<ConversationContext | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT context FROM conversations WHERE user_id = ?',
        [userId],
        (err, row: any) => {
          if (err) {
            logger.error('Error getting conversation context:', err);
            reject(err);
          } else if (row) {
            try {
              const context = JSON.parse(row.context);
              resolve(context);
            } catch (parseErr) {
              logger.error('Error parsing conversation context:', parseErr);
              resolve(null);
            }
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  async updateRateLimit(userId: string, messageCount: number, windowStart: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `
          INSERT OR REPLACE INTO rate_limits
          (user_id, message_count, window_start)
          VALUES (?, ?, ?)
        `,
        [userId, messageCount, windowStart],
        function(err) {
          if (err) {
            logger.error('Error updating rate limit:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async getRateLimit(userId: string): Promise<RateLimitInfo | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM rate_limits WHERE user_id = ?',
        [userId],
        (err, row: any) => {
          if (err) {
            logger.error('Error getting rate limit:', err);
            reject(err);
          } else if (row) {
            resolve({
              userId: row.user_id,
              messageCount: row.message_count,
              windowStart: row.window_start,
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  async cleanupOldConversations(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    return new Promise((resolve, reject) => {
      const cutoff = Date.now() - maxAge;

      this.db.run(
        'DELETE FROM conversations WHERE last_activity < ?',
        [cutoff],
        function(err) {
          if (err) {
            logger.error('Error cleaning up old conversations:', err);
            reject(err);
          } else {
            logger.info(`Cleaned up ${this.changes} old conversations`);
            resolve();
          }
        }
      );
    });
  }

  async cleanupOldRateLimits(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    return new Promise((resolve, reject) => {
      const cutoff = Date.now() - maxAge;

      this.db.run(
        'DELETE FROM rate_limits WHERE window_start < ?',
        [cutoff],
        function(err) {
          if (err) {
            logger.error('Error cleaning up old rate limits:', err);
            reject(err);
          } else {
            logger.info(`Cleaned up ${this.changes} old rate limit entries`);
            resolve();
          }
        }
      );
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          logger.error('Error closing database:', err);
          reject(err);
        } else {
          logger.info('Database connection closed');
          resolve();
        }
      });
    });
  }
}