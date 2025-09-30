import { DatabaseService } from '../services/database';
import { RateLimitInfo } from '../types';
import logger from './logger';

export class RateLimiter {
  private db: DatabaseService;
  private maxMessages: number;
  private windowMs: number;

  constructor(db: DatabaseService, maxMessages: number = 10, windowMs: number = 60000) {
    this.db = db;
    this.maxMessages = maxMessages;
    this.windowMs = windowMs;
  }

  async isRateLimited(userId: string): Promise<boolean> {
    try {
      const now = Date.now();
      const rateLimitInfo = await this.db.getRateLimit(userId);

      if (!rateLimitInfo) {
        await this.db.updateRateLimit(userId, 1, now);
        return false;
      }

      const windowStart = rateLimitInfo.windowStart;
      const messageCount = rateLimitInfo.messageCount;

      if (now - windowStart > this.windowMs) {
        await this.db.updateRateLimit(userId, 1, now);
        return false;
      }

      if (messageCount >= this.maxMessages) {
        logger.warn(`Rate limit exceeded for user: ${userId}`);
        return true;
      }

      await this.db.updateRateLimit(userId, messageCount + 1, windowStart);
      return false;
    } catch (error) {
      logger.error('Error checking rate limit:', error);
      return false;
    }
  }

  async getRemainingMessages(userId: string): Promise<number> {
    try {
      const rateLimitInfo = await this.db.getRateLimit(userId);

      if (!rateLimitInfo) {
        return this.maxMessages - 1;
      }

      const now = Date.now();
      const windowStart = rateLimitInfo.windowStart;
      const messageCount = rateLimitInfo.messageCount;

      if (now - windowStart > this.windowMs) {
        return this.maxMessages - 1;
      }

      return Math.max(0, this.maxMessages - messageCount);
    } catch (error) {
      logger.error('Error getting remaining messages:', error);
      return 0;
    }
  }

  async getTimeUntilReset(userId: string): Promise<number> {
    try {
      const rateLimitInfo = await this.db.getRateLimit(userId);

      if (!rateLimitInfo) {
        return 0;
      }

      const now = Date.now();
      const windowStart = rateLimitInfo.windowStart;
      const timeElapsed = now - windowStart;

      if (timeElapsed >= this.windowMs) {
        return 0;
      }

      return this.windowMs - timeElapsed;
    } catch (error) {
      logger.error('Error getting time until reset:', error);
      return 0;
    }
  }
}