import { config, validateConfig } from './config';
import { createSaraBot, SaraBot } from './sara';
import logger from './utils/logger';

class SaraApplication {
  private sara!: SaraBot;

  async initialize(): Promise<void> {
    try {
      logger.info('🌸 Starting Sara.ai - Your Productivity Assistant...');

      // Validate configuration
      validateConfig();
      logger.info('✅ Configuration validated');

      // Create and start Sara bot
      this.sara = await createSaraBot(config);

      // Show welcome message
      this.showWelcomeMessage();

    } catch (error) {
      logger.error('❌ Failed to initialize Sara.ai:', error);
      process.exit(1);
    }
  }

  private showWelcomeMessage(): void {
    const welcomeMessage = `
╔══════════════════════════════════════╗
║              SARA.AI                 ║
║    Assistente de Produtividade       ║
║              v1.0.0                  ║
╠══════════════════════════════════════╣
║ 🤖 OpenAI Model: ${config.openai.model.padEnd(18)} ║
║ 📱 Session: ${config.whatsapp.sessionName.substring(0, 18).padEnd(18)} ║
║ 🌸 Persona: Feminina & Acolhedora    ║
║ ⏰ Check-ins: Manhã/Tarde/Domingo    ║
╠══════════════════════════════════════╣
║ Status: 🟢 ONLINE & READY            ║
║ 🎯 Modo: Produtividade Pessoal       ║
╚══════════════════════════════════════╝
    `;

    console.log(welcomeMessage);
    console.log('\n✨ SARA.AI FUNCIONALIDADES:');
    console.log('🎯 Onboarding inteligente (4 perguntas)');
    console.log('⏰ Check-ins automáticos personalizados');
    console.log('📊 Relatórios semanais com insights');
    console.log('📅 Lembretes de datas importantes');
    console.log('🔧 Comandos para personalização total');
    console.log('\n💬 COMANDOS DISPONÍVEIS:');
    console.log('• PAUSAR X - Pausa por X horas');
    console.log('• SILENCIAR FDS - Desativa fins de semana');
    console.log('• HORÁRIO hh:mm - Ajusta horário de check-in');
    console.log('• TOM DIRETO/CALOROSO - Muda o estilo');
    console.log('• MEIO-DIA ON/OFF - Liga/desliga check-in meio-dia');
    console.log('• HELP - Mostra todos os comandos');
    console.log('\n🚀 Sara está pronta para ajudar na produtividade!\n');
  }

  async getSystemStatus(): Promise<string> {
    const adminStats = await this.sara.getAdminStats();
    const connectionInfo = this.sara.getConnectionInfo();

    return `🌸 **Sara.ai - Status do Sistema**

**📱 Conexão:**
• WhatsApp: ${connectionInfo.connected ? '🟢 Conectado' : '🔴 Desconectado'}
• OpenAI: 🟢 Ativo
• Scheduler: 🟢 Ativo

**👥 Usuários:**
• Total: ${adminStats.users.total}
• Ativos (7 dias): ${adminStats.users.active}
• Em onboarding: ${adminStats.users.onboarding}

**📊 Engajamento:**
• Retenção D7: ${adminStats.engagement.retentionD7}%
• Taxa de resposta: ${adminStats.engagement.responseRate}%
• Taxa de conclusão: ${adminStats.engagement.completionRate}%
• Score geral: ${adminStats.engagement.engagementScore}/100

**⚙️ Sistema:**
• Uptime: ${Math.floor(adminStats.system.uptime / 3600)}h ${Math.floor((adminStats.system.uptime % 3600) / 60)}m
• Memória: ${adminStats.system.memory}MB
• Versão: ${adminStats.system.version}

🌸 Sara funcionando perfeitamente!`;
  }

  // Admin methods
  async pauseUser(userId: string, hours: number): Promise<void> {
    await this.sara.pauseUser(userId, hours);
    logger.info(`User ${userId} paused for ${hours} hours`);
  }

  async resumeUser(userId: string): Promise<void> {
    await this.sara.resumeUser(userId);
    logger.info(`User ${userId} resumed`);
  }

  async sendBroadcast(message: string, userIds?: string[]): Promise<void> {
    await this.sara.sendBroadcastMessage(message, userIds);
    logger.info(`Broadcast sent to ${userIds ? userIds.length : 'all'} users`);
  }

  async exportUserData(userId: string) {
    return await this.sara.exportUserData(userId);
  }

  async getAnalytics() {
    return await this.sara.getAnalytics();
  }

  getSara(): SaraBot {
    return this.sara;
  }
}

// Start Sara.ai
const saraApp = new SaraApplication();

saraApp.initialize().catch((error) => {
  logger.error('Fatal error during Sara.ai initialization:', error);
  process.exit(1);
});

// Export for external usage
export default saraApp;

// Also export the raw Sara bot for advanced usage
export { saraApp };