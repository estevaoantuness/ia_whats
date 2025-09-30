import logger from './logger';

export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  operation: string;
  metadata?: Record<string, any>;
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();

  startOperation(operationId: string, operation: string, metadata?: Record<string, any>): void {
    const metric: PerformanceMetrics = {
      startTime: Date.now(),
      operation,
      metadata
    };

    this.metrics.set(operationId, metric);

    logger.debug('Operation started', {
      operationId,
      operation,
      metadata
    });
  }

  endOperation(operationId: string): number | null {
    const metric = this.metrics.get(operationId);

    if (!metric) {
      logger.warn('Attempted to end non-existent operation', { operationId });
      return null;
    }

    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;

    logger.info('Operation completed', {
      operationId,
      operation: metric.operation,
      duration: metric.duration,
      metadata: metric.metadata
    });

    this.metrics.delete(operationId);
    return metric.duration;
  }

  getActiveOperations(): string[] {
    return Array.from(this.metrics.keys());
  }

  getOperationInfo(operationId: string): PerformanceMetrics | null {
    return this.metrics.get(operationId) || null;
  }
}

export class SystemMonitor {
  private startTime: number = Date.now();
  private messageCount: number = 0;
  private errorCount: number = 0;
  private performanceMonitor: PerformanceMonitor;

  constructor() {
    this.performanceMonitor = new PerformanceMonitor();
    this.startPeriodicReporting();
  }

  incrementMessageCount(): void {
    this.messageCount++;
  }

  incrementErrorCount(): void {
    this.errorCount++;
  }

  getSystemStats(): {
    uptime: number;
    messageCount: number;
    errorCount: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  } {
    return {
      uptime: Date.now() - this.startTime,
      messageCount: this.messageCount,
      errorCount: this.errorCount,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };
  }

  getFormattedStats(): string {
    const stats = this.getSystemStats();
    const uptimeHours = (stats.uptime / (1000 * 60 * 60)).toFixed(1);
    const memoryMB = (stats.memoryUsage.heapUsed / 1024 / 1024).toFixed(1);

    return `📊 **Sistema - Estatísticas**

⏱️ **Uptime:** ${uptimeHours}h
💬 **Mensagens processadas:** ${stats.messageCount}
❌ **Erros:** ${stats.errorCount}
💾 **Memória:** ${memoryMB}MB
🔄 **Taxa de erro:** ${stats.messageCount > 0 ? ((stats.errorCount / stats.messageCount) * 100).toFixed(1) : 0}%

**Performance:**
• CPU User: ${(stats.cpuUsage.user / 1000).toFixed(0)}ms
• CPU System: ${(stats.cpuUsage.system / 1000).toFixed(0)}ms`;
  }

  startOperation(operationId: string, operation: string, metadata?: Record<string, any>): void {
    this.performanceMonitor.startOperation(operationId, operation, metadata);
  }

  endOperation(operationId: string): number | null {
    return this.performanceMonitor.endOperation(operationId);
  }

  private startPeriodicReporting(): void {
    setInterval(() => {
      const stats = this.getSystemStats();

      logger.info('System health check', {
        uptime: stats.uptime,
        messageCount: stats.messageCount,
        errorCount: stats.errorCount,
        memoryMB: (stats.memoryUsage.heapUsed / 1024 / 1024).toFixed(1),
        activeOperations: this.performanceMonitor.getActiveOperations().length
      });

      if (stats.memoryUsage.heapUsed > 512 * 1024 * 1024) { // 512MB
        logger.warn('High memory usage detected', {
          memoryMB: (stats.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)
        });
      }

      if (stats.errorCount > 0 && stats.messageCount > 0) {
        const errorRate = (stats.errorCount / stats.messageCount) * 100;
        if (errorRate > 10) { // More than 10% error rate
          logger.warn('High error rate detected', {
            errorRate: errorRate.toFixed(1) + '%',
            errorCount: stats.errorCount,
            messageCount: stats.messageCount
          });
        }
      }

    }, 5 * 60 * 1000); // Every 5 minutes
  }
}

export class AlertManager {
  private alertThresholds = {
    memoryUsageMB: 1024, // 1GB
    errorRatePercent: 15,
    responseTimeMs: 10000, // 10 seconds
  };

  checkMemoryUsage(memoryUsage: NodeJS.MemoryUsage): boolean {
    const memoryMB = memoryUsage.heapUsed / 1024 / 1024;

    if (memoryMB > this.alertThresholds.memoryUsageMB) {
      logger.error('ALERT: High memory usage', {
        memoryMB: memoryMB.toFixed(1),
        threshold: this.alertThresholds.memoryUsageMB
      });
      return true;
    }

    return false;
  }

  checkErrorRate(errorCount: number, totalMessages: number): boolean {
    if (totalMessages === 0) return false;

    const errorRate = (errorCount / totalMessages) * 100;

    if (errorRate > this.alertThresholds.errorRatePercent) {
      logger.error('ALERT: High error rate', {
        errorRate: errorRate.toFixed(1) + '%',
        threshold: this.alertThresholds.errorRatePercent + '%',
        errorCount,
        totalMessages
      });
      return true;
    }

    return false;
  }

  checkResponseTime(responseTime: number): boolean {
    if (responseTime > this.alertThresholds.responseTimeMs) {
      logger.error('ALERT: Slow response time', {
        responseTime: responseTime + 'ms',
        threshold: this.alertThresholds.responseTimeMs + 'ms'
      });
      return true;
    }

    return false;
  }
}

export const systemMonitor = new SystemMonitor();
export const alertManager = new AlertManager();