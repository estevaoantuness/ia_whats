import { SaraContextService } from './saraContext';
import { SaraAnalytics, SaraUserProfile } from '../types';
import logger from '../utils/logger';

export interface SaraMetrics {
  totalUsers: number;
  activeUsers: number;
  onboardingUsers: number;
  retentionD7: number;
  averageResponseRate: {
    morning: number;
    noon: number;
    evening: number;
  };
  goalCompletionRate: number;
  averageGoalsPerDay: number;
  mostActiveDay: string;
  engagementScore: number;
}

export interface UserInsights {
  userId: string;
  name: string;
  healthScore: 'good' | 'struggling' | 'needs_attention';
  responseRate: number;
  completionRate: number;
  streak: number;
  lastActive: string;
  preferredCheckinTime: 'morning' | 'noon' | 'evening';
  recommendations: string[];
}

export class SaraAnalyticsService {
  private saraContext: SaraContextService;

  constructor(saraContext: SaraContextService) {
    this.saraContext = saraContext;
  }

  async getGlobalMetrics(): Promise<SaraMetrics> {
    try {
      const users = await this.saraContext.getAllUsers();
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

      // Basic user counts
      const totalUsers = users.length;
      const onboardingUsers = users.filter(u => !u.onboardingCompleted).length;
      const activeUsers = users.filter(u =>
        u.onboardingCompleted &&
        now - u.updatedAt < (7 * 24 * 60 * 60 * 1000)
      ).length;

      // Calculate D7 retention
      const retentionD7 = await this.calculateRetentionD7(users);

      // Response rates
      const responseRates = await this.calculateAverageResponseRates(users);

      // Goal metrics
      const goalMetrics = await this.calculateGoalMetrics(users);

      // Most active day
      const mostActiveDay = await this.findMostActiveDay();

      // Overall engagement score
      const engagementScore = this.calculateEngagementScore({
        responseRate: (responseRates.morning + responseRates.noon + responseRates.evening) / 3,
        completionRate: goalMetrics.completionRate,
        retentionRate: retentionD7
      });

      return {
        totalUsers,
        activeUsers,
        onboardingUsers,
        retentionD7,
        averageResponseRate: responseRates,
        goalCompletionRate: goalMetrics.completionRate,
        averageGoalsPerDay: goalMetrics.averagePerDay,
        mostActiveDay,
        engagementScore
      };

    } catch (error) {
      logger.error('Error calculating global metrics:', error);
      throw error;
    }
  }

  async getUserInsights(userId: string): Promise<UserInsights | null> {
    try {
      const user = await this.saraContext.getUserProfile(userId);
      if (!user) return null;

      const analytics = await this.saraContext.getRecentAnalytics(userId, 30);

      // Calculate response rate
      const totalSent = analytics.reduce((sum, a) =>
        sum + (a.checkinMorningSent ? 1 : 0) +
             (a.checkinNoonSent ? 1 : 0) +
             (a.checkinEveningSent ? 1 : 0), 0);

      const totalResponded = analytics.reduce((sum, a) =>
        sum + (a.checkinMorningResponded ? 1 : 0) +
             (a.checkinNoonResponded ? 1 : 0) +
             (a.checkinEveningResponded ? 1 : 0), 0);

      const responseRate = totalSent > 0 ? totalResponded / totalSent : 0;

      // Calculate completion rate
      const totalGoals = analytics.reduce((sum, a) => sum + a.goalsSet, 0);
      const completedGoals = analytics.reduce((sum, a) => sum + a.goalsCompleted, 0);
      const completionRate = totalGoals > 0 ? completedGoals / totalGoals : 0;

      // Calculate streak
      const streak = this.calculateStreak(analytics);

      // Determine preferred checkin time
      const preferredTime = this.findPreferredCheckinTime(analytics);

      // Health score
      const healthScore = this.determineHealthScore(responseRate, completionRate, streak);

      // Generate recommendations
      const recommendations = this.generateRecommendations(user, {
        responseRate,
        completionRate,
        streak,
        preferredTime
      });

      return {
        userId,
        name: user.name,
        healthScore,
        responseRate: Math.round(responseRate * 100),
        completionRate: Math.round(completionRate * 100),
        streak,
        lastActive: analytics[0]?.date || 'N/A',
        preferredCheckinTime: preferredTime,
        recommendations
      };

    } catch (error) {
      logger.error('Error getting user insights:', error);
      return null;
    }
  }

  async getWeeklyReport(userId: string): Promise<{
    weekSummary: string;
    strengths: string[];
    challenges: string[];
    recommendations: string[];
    nextWeekGoals: string[];
  }> {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const weeklyGoals = await this.saraContext.getWeeklyGoals(userId, startDate, endDate);
      const analytics = await this.saraContext.getRecentAnalytics(userId, 7);

      const totalGoals = weeklyGoals.reduce((sum, day) => sum + day.totalCount, 0);
      const completedGoals = weeklyGoals.reduce((sum, day) => sum + day.completedCount, 0);
      const completionRate = totalGoals > 0 ? completedGoals / totalGoals : 0;

      // Find best and worst days
      const bestDay = weeklyGoals.reduce((best, current) => {
        const currentRate = current.totalCount > 0 ? current.completedCount / current.totalCount : 0;
        const bestRate = best.totalCount > 0 ? best.completedCount / best.totalCount : 0;
        return currentRate > bestRate ? current : best;
      }, weeklyGoals[0]);

      const worstDay = weeklyGoals.reduce((worst, current) => {
        const currentRate = current.totalCount > 0 ? current.completedCount / current.totalCount : 1;
        const worstRate = worst.totalCount > 0 ? worst.completedCount / worst.totalCount : 1;
        return currentRate < worstRate ? current : worst;
      }, weeklyGoals[0]);

      return {
        weekSummary: this.generateWeekSummary(completedGoals, totalGoals, completionRate),
        strengths: this.identifyStrengths(weeklyGoals, analytics),
        challenges: this.identifyChallenges(weeklyGoals, analytics),
        recommendations: this.generateWeeklyRecommendations(weeklyGoals, analytics),
        nextWeekGoals: this.suggestNextWeekGoals(weeklyGoals)
      };

    } catch (error) {
      logger.error('Error generating weekly report:', error);
      throw error;
    }
  }

  private async calculateRetentionD7(users: SaraUserProfile[]): Promise<number> {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const cohort = users.filter(u => u.createdAt >= sevenDaysAgo && u.onboardingCompleted);

    if (cohort.length === 0) return 0;

    let retainedUsers = 0;
    for (const user of cohort) {
      const analytics = await this.saraContext.getRecentAnalytics(user.userId, 7);
      const hasActivity = analytics.some(a =>
        a.checkinMorningResponded || a.checkinNoonResponded || a.checkinEveningResponded
      );
      if (hasActivity) retainedUsers++;
    }

    return retainedUsers / cohort.length;
  }

  private async calculateAverageResponseRates(users: SaraUserProfile[]): Promise<{
    morning: number;
    noon: number;
    evening: number;
  }> {
    let morningTotal = 0, noonTotal = 0, eveningTotal = 0;
    let morningCount = 0, noonCount = 0, eveningCount = 0;

    for (const user of users) {
      if (!user.onboardingCompleted) continue;

      const analytics = await this.saraContext.getRecentAnalytics(user.userId, 30);

      const morningSent = analytics.filter(a => a.checkinMorningSent).length;
      const morningResponded = analytics.filter(a => a.checkinMorningResponded).length;
      if (morningSent > 0) {
        morningTotal += morningResponded / morningSent;
        morningCount++;
      }

      const noonSent = analytics.filter(a => a.checkinNoonSent).length;
      const noonResponded = analytics.filter(a => a.checkinNoonResponded).length;
      if (noonSent > 0) {
        noonTotal += noonResponded / noonSent;
        noonCount++;
      }

      const eveningSent = analytics.filter(a => a.checkinEveningSent).length;
      const eveningResponded = analytics.filter(a => a.checkinEveningResponded).length;
      if (eveningSent > 0) {
        eveningTotal += eveningResponded / eveningSent;
        eveningCount++;
      }
    }

    return {
      morning: morningCount > 0 ? morningTotal / morningCount : 0,
      noon: noonCount > 0 ? noonTotal / noonCount : 0,
      evening: eveningCount > 0 ? eveningTotal / eveningCount : 0
    };
  }

  private async calculateGoalMetrics(users: SaraUserProfile[]): Promise<{
    completionRate: number;
    averagePerDay: number;
  }> {
    let totalGoals = 0;
    let completedGoals = 0;
    let totalDays = 0;

    for (const user of users) {
      if (!user.onboardingCompleted) continue;

      const analytics = await this.saraContext.getRecentAnalytics(user.userId, 30);

      totalGoals += analytics.reduce((sum, a) => sum + a.goalsSet, 0);
      completedGoals += analytics.reduce((sum, a) => sum + a.goalsCompleted, 0);
      totalDays += analytics.length;
    }

    return {
      completionRate: totalGoals > 0 ? completedGoals / totalGoals : 0,
      averagePerDay: totalDays > 0 ? totalGoals / totalDays : 0
    };
  }

  private async findMostActiveDay(): Promise<string> {
    // This would require more complex analytics
    // For now, return a placeholder
    const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    return days[Math.floor(Math.random() * days.length)];
  }

  private calculateEngagementScore(metrics: {
    responseRate: number;
    completionRate: number;
    retentionRate: number;
  }): number {
    // Weighted average of key metrics
    return Math.round(
      (metrics.responseRate * 0.4 +
       metrics.completionRate * 0.4 +
       metrics.retentionRate * 0.2) * 100
    );
  }

  private calculateStreak(analytics: SaraAnalytics[]): number {
    let streak = 0;
    const sortedAnalytics = analytics.sort((a, b) => b.date.localeCompare(a.date));

    for (const day of sortedAnalytics) {
      if (day.goalsCompleted > 0) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private findPreferredCheckinTime(analytics: SaraAnalytics[]): 'morning' | 'noon' | 'evening' {
    const responses = {
      morning: analytics.filter(a => a.checkinMorningResponded).length,
      noon: analytics.filter(a => a.checkinNoonResponded).length,
      evening: analytics.filter(a => a.checkinEveningResponded).length
    };

    return Object.keys(responses).reduce((a, b) =>
      responses[a as keyof typeof responses] > responses[b as keyof typeof responses] ? a : b
    ) as 'morning' | 'noon' | 'evening';
  }

  private determineHealthScore(
    responseRate: number,
    completionRate: number,
    streak: number
  ): 'good' | 'struggling' | 'needs_attention' {
    const score = (responseRate + completionRate) / 2;

    if (score >= 0.7 && streak >= 3) return 'good';
    if (score >= 0.4 || streak >= 1) return 'struggling';
    return 'needs_attention';
  }

  private generateRecommendations(
    user: SaraUserProfile,
    metrics: {
      responseRate: number;
      completionRate: number;
      streak: number;
      preferredTime: string;
    }
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.responseRate < 0.5) {
      recommendations.push('Considere ajustar os horários de check-in');
    }

    if (metrics.completionRate < 0.6) {
      recommendations.push('Tente definir metas menores e mais específicas');
    }

    if (metrics.streak === 0) {
      recommendations.push('Foque em completar pelo menos 1 meta por dia');
    }

    if (user.frequency === 'twice_daily' && metrics.responseRate < 0.3) {
      recommendations.push('Considere reduzir para 1 check-in por dia');
    }

    return recommendations.slice(0, 3); // Max 3 recommendations
  }

  private generateWeekSummary(completed: number, total: number, rate: number): string {
    const percentage = Math.round(rate * 100);

    if (percentage >= 80) {
      return `Semana excelente! ${completed}/${total} metas (${percentage}%)`;
    } else if (percentage >= 60) {
      return `Boa semana! ${completed}/${total} metas (${percentage}%)`;
    } else if (percentage >= 40) {
      return `Semana regular. ${completed}/${total} metas (${percentage}%)`;
    } else {
      return `Semana desafiadora. ${completed}/${total} metas (${percentage}%)`;
    }
  }

  private identifyStrengths(weeklyGoals: any[], analytics: SaraAnalytics[]): string[] {
    const strengths: string[] = [];

    const responseRate = analytics.length > 0 ?
      analytics.filter(a => a.checkinMorningResponded || a.checkinEveningResponded).length / analytics.length : 0;

    if (responseRate > 0.8) {
      strengths.push('Excelente engajamento nos check-ins');
    }

    const consistentDays = weeklyGoals.filter(day => day.completedCount > 0).length;
    if (consistentDays >= 5) {
      strengths.push('Consistência durante a semana');
    }

    return strengths;
  }

  private identifyChallenges(weeklyGoals: any[], analytics: SaraAnalytics[]): string[] {
    const challenges: string[] = [];

    const lowCompletionDays = weeklyGoals.filter(day =>
      day.totalCount > 0 && day.completedCount / day.totalCount < 0.5
    ).length;

    if (lowCompletionDays >= 3) {
      challenges.push('Dificuldade em completar metas definidas');
    }

    const responseRate = analytics.length > 0 ?
      analytics.filter(a => a.checkinMorningResponded || a.checkinEveningResponded).length / analytics.length : 0;

    if (responseRate < 0.5) {
      challenges.push('Baixo engajamento nos check-ins');
    }

    return challenges;
  }

  private generateWeeklyRecommendations(weeklyGoals: any[], analytics: SaraAnalytics[]): string[] {
    return [
      'Mantenha metas específicas e mensuráveis',
      'Celebre as pequenas vitórias diárias',
      'Use blocos de tempo focado para tarefas importantes'
    ];
  }

  private suggestNextWeekGoals(weeklyGoals: any[]): string[] {
    return [
      'Definir horários específicos para tarefas importantes',
      'Implementar pausas regulares entre atividades',
      'Revisar e ajustar metas baseado nos resultados'
    ];
  }
}