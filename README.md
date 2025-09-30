# IA WhatsApp Bot 🤖

Uma inteligência artificial completa para WhatsApp usando OpenAI e Baileys, desenvolvida em TypeScript.

## 🌟 Funcionalidades

### Core Features
- 🤖 **IA Conversacional** com OpenAI GPT-4o-mini
- 📱 **Conexão Multi-Device** via Baileys
- 💾 **Persistência de Contexto** com SQLite
- ⚡ **Rate Limiting** inteligente
- 📊 **Monitoramento** em tempo real
- 🛡️ **Moderação de Conteúdo** automática

### Comandos Disponíveis

#### Comandos Básicos
- `!help` - Mostra ajuda
- `!clear` - Limpa histórico da conversa
- `!status` - Status do bot
- `!ping` - Teste de conectividade

#### Comandos Utilitários
- `!translate <idioma> <texto>` - Tradução
- `!calc <expressão>` - Calculadora
- `!summary` - Resumo da conversa

#### Comandos Administrativos
- `!stats` - Estatísticas do sistema
- `!broadcast <mensagem>` - Envio em massa
- `!cleanup` - Limpeza do banco de dados
- `!users` - Lista de usuários ativos
- `!maintenance <on/off>` - Modo manutenção

## 🚀 Instalação

### Pré-requisitos
- Node.js 17+
- NPM ou Yarn
- Conta OpenAI com API Key

### 1. Clone e Configure
```bash
git clone <repository>
cd ia_whats
npm install
```

### 2. Configuração de Ambiente
```bash
cp .env.example .env
```

Edite o arquivo `.env`:
```env
# OpenAI Configuration
OPENAI_API_KEY=sua_api_key_aqui
OPENAI_MODEL=gpt-4o-mini

# WhatsApp Configuration
WHATSAPP_SESSION_NAME=ia_whatsapp_session

# Bot Configuration
BOT_NAME=IA Assistant
BOT_PREFIX=!
ADMIN_NUMBERS=+5511999999999

# Features
ENABLE_GROUP_RESPONSES=false
MAX_CONTEXT_MESSAGES=10
RATE_LIMIT_MAX_MESSAGES=10
```

### 3. Iniciar o Bot
```bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm start
```

## 📱 Como Usar

### Primeira Conexão
1. Execute o bot
2. Escaneie o QR Code com WhatsApp
3. O bot estará conectado e pronto!

### Interações
- **Conversa Normal**: Apenas envie mensagens
- **Comandos**: Use o prefixo `!` (configurável)
- **Contexto**: O bot lembra da conversa por 30 minutos

### Exemplo de Uso
```
Usuário: Olá, como você está?
Bot: Olá! Estou muito bem, obrigado por perguntar! 😊
     Como posso ajudá-lo hoje?

Usuário: !translate english Olá mundo
Bot: 🌐 Tradução para english:
     Hello world

Usuário: !calc 15 * 3 + 5
Bot: 🧮 Cálculo:
     15 × 3 + 5 = 50
```

## 🏗️ Arquitetura

### Estrutura do Projeto
```
src/
├── config/          # Configurações
├── services/        # Serviços principais
│   ├── whatsapp.ts     # Baileys integration
│   ├── openai.ts       # OpenAI integration
│   ├── database.ts     # SQLite operations
│   └── contextManager.ts
├── handlers/        # Processadores de mensagem
│   ├── messageHandler.ts
│   └── commandHandler.ts
├── utils/           # Utilitários
│   ├── logger.ts
│   ├── helpers.ts
│   ├── rateLimiter.ts
│   ├── monitoring.ts
│   └── gracefulShutdown.ts
└── types/           # Tipos TypeScript
```

### Fluxo de Dados
1. **WhatsApp** → Baileys → `MessageHandler`
2. **Rate Limiting** → Verificação de limites
3. **Context Manager** → Recupera/salva contexto
4. **OpenAI Service** → Processa com IA
5. **Response** → Baileys → WhatsApp

## 🛡️ Segurança

### Recursos de Segurança
- ✅ **Moderação de Conteúdo** via OpenAI
- ✅ **Rate Limiting** por usuário
- ✅ **Sanitização** de entrada
- ✅ **Logs** detalhados
- ✅ **Permissões** administrativas

### Rate Limiting
- 10 mensagens por minuto (padrão)
- Bloqueio automático temporário
- Configurável por ambiente

## 📊 Monitoramento

### Logs Automáticos
- `logs/error.log` - Apenas erros
- `logs/combined.log` - Todos os logs
- Console em desenvolvimento

### Métricas
- Uptime do sistema
- Mensagens processadas
- Taxa de erro
- Uso de memória
- Performance por operação

### Alertas
- Alto uso de memória (>1GB)
- Taxa de erro alta (>15%)
- Tempo de resposta lento (>10s)

## 🔧 Configuração Avançada

### Variáveis de Ambiente
```env
# OpenAI
OPENAI_MAX_TOKENS=1000
OPENAI_TEMPERATURE=0.7

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000

# Database
DATABASE_URL=./data/database.sqlite

# Logs
LOG_LEVEL=info
NODE_ENV=production
```

### Customização
- **Sistema de Prompts**: Edite `src/services/openai.ts`
- **Comandos**: Adicione em `src/handlers/commandHandler.ts`
- **Rate Limits**: Configure em `.env`
- **Logs**: Ajuste em `src/utils/logger.ts`

## 🚨 Troubleshooting

### Problemas Comuns

#### QR Code não aparece
```bash
# Limpe a sessão
rm -rf data/auth/
npm run dev
```

#### Erro de API Key
```bash
# Verifique a configuração
echo $OPENAI_API_KEY
```

#### Bot não responde
```bash
# Verifique logs
tail -f logs/combined.log
```

#### Erro de permissões
```bash
# Verifique permissões de pasta
chmod 755 data/ logs/
```

## 📈 Performance

### Otimizações Implementadas
- 🔄 **Connection Pooling** para database
- 📦 **Context Caching** em memória
- 🗜️ **Log Rotation** automática
- ⚡ **Async Processing** para todas operações
- 🧹 **Cleanup** automático de dados antigos

### Limites Recomendados
- **Memória**: 512MB - 1GB
- **CPU**: 1-2 cores
- **Storage**: 1GB (logs + sessões)
- **Usuários simultâneos**: 100-500

## 🔄 Atualizações

### Backup Antes de Atualizar
```bash
# Backup da database
cp data/database.sqlite data/database.backup.sqlite

# Backup das sessões
cp -r data/auth/ data/auth.backup/
```

### Processo de Atualização
```bash
git pull origin main
npm install
npm run build
```

## 📝 Logs e Debug

### Visualizar Logs
```bash
# Logs em tempo real
tail -f logs/combined.log

# Apenas erros
tail -f logs/error.log

# Debug completo
LOG_LEVEL=debug npm run dev
```

### Comandos de Debug
```bash
# Status do sistema
curl localhost:3000/health

# Estatísticas via comando
# Envie !stats para o bot
```

## 🤝 Contribuição

### Desenvolvimento
1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'Adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

### Padrões de Código
- **TypeScript** strict mode
- **ESLint** para linting
- **Prettier** para formatação
- **Conventional Commits** para mensagens

## 📄 Licença

Este projeto está sob a licença ISC. Veja o arquivo `LICENSE` para mais detalhes.

## ⚠️ Disclaimer

- Este bot não é oficial do WhatsApp
- Use por sua própria conta e risco
- Respeite os termos de serviço do WhatsApp
- Não use para spam ou atividades maliciosas

## 🆘 Suporte

### Comunidade
- **Issues**: Para bugs e sugestões
- **Discussions**: Para dúvidas gerais
- **Wiki**: Documentação adicional

### Contato
- 📧 Email: [seu-email]
- 💬 WhatsApp: [admin-number]
- 🐦 Twitter: [@seu-twitter]

---

**🎉 Feito com ❤️ usando TypeScript, OpenAI e Baileys**