# IA WhatsApp Bot - Informações para Claude Code

## 📋 Comandos de Build e Teste

```bash
# Build do projeto
npm run build

# Executar em desenvolvimento
npm run dev

# Executar em produção
npm start

# Verificação de tipos
npm run typecheck

# Limpeza
npm run clean
```

## 🔧 Configuração Necessária

### 1. Variáveis de Ambiente
Copie `.env.example` para `.env` e configure:

```env
# OBRIGATÓRIO: Chave da API OpenAI
OPENAI_API_KEY=sua_api_key_aqui

# OBRIGATÓRIO: Número do administrador
ADMIN_NUMBERS=+5511999999999

# Opcionais (têm valores padrão)
OPENAI_MODEL=gpt-4o-mini
WHATSAPP_SESSION_NAME=ia_whatsapp_session
BOT_NAME=IA Assistant
BOT_PREFIX=!
```

### 2. Estrutura de Pastas
O projeto criará automaticamente:
- `data/` - Banco de dados SQLite e sessões WhatsApp
- `logs/` - Arquivos de log
- `dist/` - Build do TypeScript

## 🚀 Como Iniciar

1. **Configurar ambiente:**
   ```bash
   cp .env.example .env
   # Edite o .env com sua API key
   ```

2. **Build e start:**
   ```bash
   npm run build
   npm start
   ```

3. **Conectar WhatsApp:**
   - Execute o bot
   - Escaneie o QR Code que aparece no terminal
   - O bot estará conectado!

## 📱 Funcionalidades Implementadas

### Core
- ✅ Conexão WhatsApp via Baileys 7.x
- ✅ Integração OpenAI GPT-4o-mini
- ✅ Persistência de contexto com SQLite
- ✅ Rate limiting inteligente
- ✅ Sistema de logs completo
- ✅ Monitoramento de performance
- ✅ Graceful shutdown

### Comandos
- ✅ `!help` - Ajuda
- ✅ `!clear` - Limpar contexto
- ✅ `!status` - Status do bot
- ✅ `!ping` - Teste conectividade
- ✅ `!translate` - Tradução
- ✅ `!calc` - Calculadora
- ✅ `!summary` - Resumo da conversa
- ✅ `!stats` - Estatísticas (admin)
- ✅ `!broadcast` - Envio em massa (admin)
- ✅ `!cleanup` - Limpeza BD (admin)

### Segurança
- ✅ Moderação de conteúdo OpenAI
- ✅ Rate limiting por usuário
- ✅ Sanitização de entrada
- ✅ Permissões administrativas
- ✅ Logs de segurança

## 🔍 Debugging

### Logs
- `logs/error.log` - Apenas erros
- `logs/combined.log` - Todos os logs
- Console em desenvolvimento

### Problemas Comuns

**QR Code não aparece:**
```bash
rm -rf data/auth/
npm run dev
```

**Erro de API key:**
```bash
echo $OPENAI_API_KEY
# Verifique se está configurada
```

**Bot não responde:**
```bash
tail -f logs/combined.log
# Verifique os logs
```

## 📊 Monitoramento

### Métricas Automáticas
- Uptime do sistema
- Mensagens processadas
- Taxa de erro
- Uso de memória
- Performance por operação

### Comandos de Monitoramento
- `!stats` (apenas admin) - Estatísticas detalhadas
- `!status` - Status básico do bot

## 🔄 Manutenção

### Limpeza Automática
- Conversas antigas removidas após 7 dias
- Rate limits expirados limpos após 24h
- Contextos inativos removidos da memória após 30min

### Backup
```bash
# Backup da database
cp data/database.sqlite data/database.backup.sqlite

# Backup das sessões
cp -r data/auth/ data/auth.backup/
```

## 🎯 Próximas Funcionalidades

Para implementar no futuro:
- [ ] Processamento de imagens
- [ ] Suporte a voice messages
- [ ] Integração com APIs externas (clima, etc.)
- [ ] Dashboard web para administração
- [ ] Múltiplas instâncias
- [ ] Webhook support

## ⚙️ Configurações Avançadas

### Rate Limiting
```env
RATE_LIMIT_MAX_MESSAGES=10  # mensagens por minuto
RATE_LIMIT_WINDOW_MS=60000  # janela em ms
```

### OpenAI
```env
OPENAI_MAX_TOKENS=1000      # tokens máximos por resposta
OPENAI_TEMPERATURE=0.7      # criatividade (0-1)
```

### Features
```env
ENABLE_GROUP_RESPONSES=false    # responder em grupos
ENABLE_MEDIA_PROCESSING=true   # processar mídia
MAX_CONTEXT_MESSAGES=10        # mensagens no contexto
```

## 🐛 Issues Conhecidas

### Baileys v7.x
- Algumas breaking changes da v6 para v7
- Conexão pode ser instável em alguns servidores
- QR Code pode demorar para aparecer

### OpenAI
- Rate limits podem afetar performance
- Custos podem aumentar com uso intenso
- Latência pode variar por região

## 📝 Notas de Desenvolvimento

### Arquitetura
- **Modular**: Cada serviço é independente
- **Tipada**: TypeScript strict mode
- **Escalável**: Suporta múltiplos usuários
- **Monitorada**: Logs e métricas completas

### Padrões de Código
- Classes para serviços principais
- Async/await para operações I/O
- Error handling robusto
- Logs estruturados

### Performance
- Context caching em memória
- Database com índices otimizados
- Cleanup automático
- Graceful shutdown