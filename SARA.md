# Sara.ai - Assistente de Produtividade Pessoal

## 🌸 Sobre a Sara.ai

Sara.ai é uma assistente feminina, gentil e pragmática no WhatsApp que ajuda com produtividade pessoal através de:

- **Onboarding inteligente** (4 perguntas simples)
- **Check-ins adaptativos** (manhã, meio-dia opcional, tarde)
- **Metas diárias** (1-3 por dia, sem pressão)
- **Lembretes importantes** (aniversários, contas, compromissos)
- **Relatórios semanais** (domingos às 17:30 com insights)

## 🚀 Como Iniciar a Sara.ai

### Comandos Rápidos

```bash
# Desenvolvimento (Sara.ai)
npm run dev:sara

# Produção (Sara.ai)
npm run build
npm run start:sara

# Bot tradicional (se necessário)
npm run dev
npm run start
```

### Configuração

A Sara.ai usa as mesmas configurações do bot tradicional no `.env`:

```env
# OBRIGATÓRIO
OPENAI_API_KEY=sua_api_key_aqui
ADMIN_NUMBERS=+5511999999999

# Opcional (com valores padrão otimizados para Sara)
OPENAI_MODEL=gpt-4o-mini
WHATSAPP_SESSION_NAME=sara_whatsapp_session
BOT_NAME=Sara
BOT_PREFIX=!
```

## 💬 Funcionalidades da Sara.ai

### Onboarding (Primeira Interação)

1. **Nome**: "Como você gostaria que eu te chamasse?"
2. **Frequência**: "1x por dia (manhã) ou 2x por dia (manhã + tarde)?"
3. **Horários**: "Que horários funcionam melhor? Ex: 08:30 e 18:30"
4. **Datas importantes**: "Tem alguma data importante que você quer que eu lembre?"

### Check-ins Inteligentes

**Manhã (variação 8:20-8:40):**
- "Bom dia! Quais 1-3 metas vão fazer seu dia valer?"
- "Começamos simples: manda 1, 2 ou 3 metas de hoje. 30s e pronto."
- Adaptável ao tom do usuário (direto vs caloroso)

**Meio-dia (2-3x por semana):**
- "Metade do dia já foi. Onde você está? 0/3, 1/3, 2/3 ou 3/3?"
- "Micro-ação de 5 min: qual cabe agora na sua agenda?"
- Só envia se taxa de resposta > 30%

**Fim do dia (variação 18:20-18:40):**
- "Como fechamos? 0/3, 1/3, 2/3 ou 3/3. Quer anotar 1 aprendizado?"
- "Balanço do dia: quantas metas você conseguiu?"

**Domingo 17:30 - Relatório Semanal:**
- Resumo: metas completadas, % de sucesso
- Forças identificadas (2x)
- Obstáculo principal (1x)
- Recomendações para próxima semana (2x)

## 🛠️ Comandos da Sara.ai

### Comandos do Usuário

- **PAUSAR X** - Pausa Sara por X horas (ex: PAUSAR 4)
- **SILENCIAR FDS** - Não envia nada nos fins de semana
- **HORÁRIO hh:mm** - Muda horário do check-in principal
- **TOM DIRETO** - Muda para estilo mais objetivo
- **TOM CALOROSO** - Muda para estilo mais acolhedor
- **MEIO-DIA ON/OFF** - Liga/desliga check-in do meio-dia
- **HELP** - Mostra todos os comandos

### Respostas dos Usuários

**Definindo metas:**
```
"responder emails, reunião projeto, exercício"
"1. finalizar relatório 2. ligar cliente 3. comprar presente"
```

**Progresso:**
```
"2/3" - completou 2 de 3 metas
"1/3 travei no relatório" - 1 meta + contexto
"0/3" - dia difícil, Sara responde com empatia
```

## 📊 Sistema de Analytics

### Métricas Automáticas

- **Retenção D7**: % usuários ativos após 7 dias
- **Taxa de resposta**: por horário (manhã/meio-dia/tarde)
- **Taxa de conclusão**: metas completadas vs definidas
- **Engagement score**: pontuação geral 0-100

### Insights por Usuário

- **Health score**: good/struggling/needs_attention
- **Padrões**: horário preferido, dias mais produtivos
- **Streaks**: dias consecutivos com metas completadas
- **Recomendações**: personalizadas baseadas no comportamento

## 🏗️ Arquitetura Técnica

### Componentes Principais

```
src/
├── sara.ts                     # Classe principal Sara.ai
├── sara-index.ts              # Inicialização da Sara
├── types/index.ts             # Tipos específicos Sara
├── handlers/
│   └── saraMessageHandler.ts  # Handler especializado
├── services/
│   ├── saraContext.ts         # Gerenciamento de dados
│   ├── scheduler.ts           # Check-ins automáticos
│   ├── messageTemplates.ts    # Variações de mensagens
│   └── saraAnalytics.ts      # Métricas e insights
└── database updates           # Novas tabelas para Sara
```

### Banco de Dados

**Novas tabelas:**
- `sara_users` - Perfis completos dos usuários
- `daily_goals` - Metas diárias e progresso
- `important_dates` - Lembretes pessoais
- `sara_analytics` - Métricas de engajamento

### Scheduling Inteligente

- **node-cron** para agendamentos
- **Randomização**: ±10-20 min para parecer humano
- **Adaptação**: reduz frequência se não responder
- **Fuso horário**: configurável por usuário

## 🎯 Princípios de UX

### Tom e Personalidade

- **Feminino**: "Obrigada" quando se refere a si mesma
- **Gentil**: sem culpa, sempre oferece saída simples
- **Pragmático**: foco em progresso, não perfeição
- **Variação**: nunca repete a mesma mensagem em 72h

### Regras de Interação

- **1-2 perguntas máximo** por mensagem
- **Brevidade**: respostas de 1-3 frases
- **Consistência**: horários regulares mas humanizados
- **Respeito**: comandos de pausa e personalização

## 🔧 Desenvolvimento e Debug

### Logs Estruturados

```bash
# Ver logs da Sara em tempo real
tail -f logs/combined.log | grep Sara

# Analytics específicas
tail -f logs/combined.log | grep analytics
```

### Comandos de Manutenção

```bash
# Limpar banco e recomeçar
rm -rf data/
npm run build && npm run start:sara

# Testar apenas TypeScript
npm run typecheck

# Verificar agendamentos
# (logs mostram quando check-ins são enviados)
```

### Estrutura de Dados

```javascript
// Exemplo de usuário Sara
{
  userId: "+5511999999999",
  name: "João",
  frequency: "twice_daily",
  morningTime: "08:30",
  eveningTime: "18:30",
  noonEnabled: true,
  tone: "warm",
  silenceWeekends: false,
  timezone: "America/Sao_Paulo",
  onboardingCompleted: true
}

// Exemplo de metas diárias
{
  userId: "+5511999999999",
  date: "2024-09-27",
  goals: ["terminar relatório", "ligar cliente", "exercício"],
  completedCount: 2,
  totalCount: 3,
  learning: "focar uma coisa por vez"
}
```

## 📈 KPIs e Metas

### MVP Targets

- **≥60%** taxa de resposta diária aos check-ins
- **≥35%** retenção D7
- **≥80%** satisfação pós-check-in
- **<2 dias** para completar onboarding

### Otimizações Futuras

- [ ] Processamento de áudio (voice messages)
- [ ] Integração com calendários
- [ ] Sugestões de metas baseadas em IA
- [ ] Dashboard web para admins
- [ ] Múltiplas personas (além da Sara)

## 🚨 Troubleshooting

### Problemas Comuns

**Sara não está enviando check-ins:**
```bash
# Verificar logs do scheduler
grep "Scheduled.*sent" logs/combined.log

# Verificar usuários ativos
grep "Initialize.*schedules" logs/combined.log
```

**Onboarding interrompido:**
```bash
# Resetar estado de onboarding
# (não há comando automático, precisa verificar logs)
```

**Banco de dados corrompido:**
```bash
rm -rf data/database.sqlite
npm run start:sara
# Sara recria tabelas automaticamente
```

### Monitoramento

Sara.ai inclui métricas automáticas que podem ser acessadas via:

1. **Logs estruturados** em `logs/combined.log`
2. **Admin stats** via código (ver `sara.ts`)
3. **Database queries** diretas no SQLite

---

## 📝 Notas Importantes

- Sara.ai **substitui completamente** o bot tradicional quando ativa
- Use `sara-index.ts` para iniciar Sara, `index.ts` para bot tradicional
- Todas as configurações do `.env` são compartilhadas
- Dados ficam em `data/database.sqlite` com novas tabelas
- Sara mantém compatibilidade com infraestrutura existente

**🌸 Sara.ai representa uma evolução focada em produtividade pessoal, mantendo a mesma base técnica robusta do bot original, mas com experiência de usuário completamente redesenhada para engajamento e resultados.**