# 🚂 Guia de Deploy - Sara AI no Railway (GEMINI - 100% GRÁTIS)

## 📋 Pré-requisitos

1. **Conta no Railway**: [railway.app](https://railway.app) - Free tier (5$ créditos/mês)
2. **API Key do Gemini**: [Google AI Studio](https://aistudio.google.com/app/apikey) - **GRÁTIS!**
3. **Repositório Git conectado** (recomendado para auto-deploy)

---

## 🚀 Deploy Rápido (3 minutos)

### Opção 1: Deploy via GitHub (Recomendado)

1. **Push para GitHub**
   ```bash
   git add .
   git commit -m "Prepare for Railway deploy"
   git push origin main
   ```

2. **Conectar ao Railway**
   - Acesse [railway.app](https://railway.app)
   - Clique em "New Project"
   - Selecione "Deploy from GitHub repo"
   - Escolha o repositório `ia_whats`

3. **Configurar Variáveis de Ambiente**

   No Railway, vá em **Variables** e adicione:

   ```env
   # 🔴 OBRIGATÓRIO - AI Service (Gemini = grátis!)
   AI_SERVICE=gemini
   GEMINI_API_KEY=sua_chave_do_gemini_aqui

   # 🔴 OBRIGATÓRIO - Admin (número com código do país)
   ADMIN_NUMBERS=+5511999999999

   # Opcionais (já têm padrões otimizados)
   GEMINI_MODEL=gemini-1.5-flash
   GEMINI_MAX_TOKENS=1000
   GEMINI_TEMPERATURE=0.85
   NODE_ENV=production
   PORT=3000
   BOT_NAME=Sara
   WHATSAPP_SESSION_NAME=sara_session
   ENABLE_GROUP_RESPONSES=false
   MAX_CONTEXT_MESSAGES=10
   ```

4. **🔴 CRÍTICO: Configurar Volume Persistente**

   **POR QUE É NECESSÁRIO:**
   - Sem volume: Sessão WhatsApp apagada a cada deploy → QR code infinito
   - Com volume: Sessão persiste → Escaneia QR code **UMA VEZ** e nunca mais!

   **COMO CONFIGURAR:**
   1. No Railway → Seu projeto → **Settings** → **Volumes**
   2. Clique em **+ New Volume**
   3. Configure:
      - **Name:** `sara-data` (ou qualquer nome)
      - **Mount Path:** `/app/data`
      - **Size:** `1 GB`
   4. Clique **Add**
   5. Railway vai fazer redeploy automático (~2 min)

   ✅ **Pronto!** Agora `/app/data` persiste entre deploys.

5. **Deploy Automático**
   - O Railway vai detectar o `Dockerfile` e fazer build automaticamente
   - Aguarde 3-5 minutos para o deploy completar
   - Verifique os logs em **Deployments**

---

### Opção 2: Deploy via Railway CLI

1. **Instalar Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login**
   ```bash
   railway login
   ```

3. **Inicializar Projeto**
   ```bash
   railway init
   ```

4. **Adicionar Variáveis**
   ```bash
   railway variables set OPENAI_API_KEY=sua_chave_aqui
   railway variables set ADMIN_NUMBERS=+5511999999999
   railway variables set NODE_ENV=production
   ```

5. **Deploy**
   ```bash
   railway up
   ```

---

## 📱 Conectar WhatsApp

**IMPORTANTE**: O QR Code do WhatsApp precisa ser escaneado **após** o primeiro deploy.

### Método 1: Logs do Railway

1. Vá para **Deployments** > **View Logs**
2. Procure pelo QR Code nos logs (aparece como ASCII art)
3. Escaneie com WhatsApp → **Dispositivos Conectados** → **Conectar Dispositivo**

### Método 2: Railway Shell (Recomendado)

1. No painel do Railway, clique em **Shell** (ícone de terminal)
2. Execute:
   ```bash
   node dist/sara-index.js
   ```
3. O QR Code aparecerá no terminal
4. Escaneie e aguarde confirmação

### Método 3: Expor Endpoint (Avançado)

Adicione esta rota em `src/server/webServer.ts`:
```typescript
app.get('/qr', (req, res) => {
  // Retorna QR code como imagem ou JSON
});
```

---

## 🔍 Verificação de Deploy

### Health Check
```bash
curl https://seu-app.railway.app/health
```

**Resposta esperada**:
```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2025-09-29T..."
}
```

### Logs em Tempo Real
```bash
railway logs --follow
```

### Status do Bot
Acesse: `https://seu-app.railway.app/`

---

## ⚙️ Configurações Importantes do Railway

### 1. Volumes Persistentes

**PROBLEMA**: Railway não persiste arquivos por padrão (sessions WhatsApp perdem ao restart)

**SOLUÇÃO**: Criar volume para `/app/data`

No Railway:
1. Vá em **Settings** > **Volumes**
2. Crie novo volume:
   - **Mount Path**: `/app/data`
   - **Size**: 1GB (suficiente para sessões)

### 2. Restart Policy

Já configurado no `railway.json`:
```json
{
  "restartPolicyType": "ON_FAILURE",
  "restartPolicyMaxRetries": 10
}
```

### 3. Health Check

Já configurado no `Dockerfile`:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3
```

---

## 🐛 Troubleshooting

### Problema 1: "OPENAI_API_KEY is required"

**Causa**: Variável de ambiente não configurada

**Solução**:
```bash
railway variables set OPENAI_API_KEY=sua_chave_aqui
railway restart
```

### Problema 2: QR Code não aparece

**Causa**: WhatsApp não consegue se conectar

**Soluções**:
1. Verificar logs: `railway logs`
2. Limpar sessão antiga:
   ```bash
   railway shell
   rm -rf /app/data/auth_info_baileys
   node dist/sara-index.js
   ```

### Problema 3: Build falha

**Causa**: Dependências faltando

**Solução**:
```bash
# Local
npm install
npm run build

# Railway
railway run npm install
railway restart
```

### Problema 4: Bot desconecta frequentemente

**Causa**: Session não está persistindo

**Solução**: Configure volume persistente (ver seção acima)

### Problema 5: Erro "Cannot find module"

**Causa**: Build incompleto ou faltando arquivos

**Solução**:
```bash
# Rebuild completo
railway down
railway up --detach
```

---

## 📊 Monitoramento

### Métricas do Railway

Visualize em **Metrics**:
- CPU usage
- Memory usage
- Network traffic
- Disk usage

### Logs Importantes

```bash
# Ver logs de erro
railway logs | grep ERROR

# Ver logs do WhatsApp
railway logs | grep "WhatsApp"

# Ver logs da OpenAI
railway logs | grep "OpenAI"
```

### Alertas

Configure em **Settings** > **Notifications**:
- Deploy failures
- Service down
- High memory usage

---

## 💰 Custos (TOTALMENTE GRÁTIS!)

### ✅ Railway Free Tier
- **$5 USD/mês** de créditos gratuitos
- **Sara AI consome:** ~$2-3/mês
- **Sobra:** $2-3/mês para outros projetos
- ✅ **Dentro do free tier!**

### Estimativa de Uso Real
- **RAM**: ~0.2-0.3 GB (~$1.50/mês)
- **CPU**: Mínimo (~$0.50/mês)
- **Volume 1GB**: ~$0.25/mês
- **Network**: Desprezível

**Total Railway**: ~$2.25/mês ✅ **GRÁTIS** (dentro dos $5 de crédito)

### ✅ Gemini API - 100% GRÁTIS
- **Free tier**: 15 RPM (requests/min)
- **Quota**: 1500 requests/dia
- **Sara AI usa**: ~200-500 requests/dia (média)
- ✅ **Completamente dentro do free tier!**

### 💸 Custo Total
**$0.00/mês** - Tudo grátis! 🎉

**Alternativa paga (se quiser):**
- OpenAI GPT-4o-mini: ~$2-5/mês
- OpenAI GPT-4: ~$10-30/mês

---

## 🔄 Atualizações

### Deploy Automático (GitHub)

Toda vez que você der push:
```bash
git add .
git commit -m "Nova feature"
git push origin main
```

Railway vai automaticamente:
1. Build nova imagem Docker
2. Deploy nova versão
3. Restart com zero downtime

### Deploy Manual

```bash
railway up
```

---

## 🔐 Segurança

### Boas Práticas

1. **Nunca commite** `.env` no Git (já no `.gitignore`)
2. **Rotacione** API keys periodicamente
3. **Use** variáveis de ambiente do Railway
4. **Configure** ADMIN_NUMBERS para proteger comandos admin

### Variáveis Sensíveis

Use Railway Variables para:
- `GEMINI_API_KEY`
- `OPENAI_API_KEY` (se usar)
- `ADMIN_NUMBERS`
- Qualquer outra credencial

---

## 📞 Suporte

### Railway
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway
- Status: https://status.railway.app

### Sara AI
- Issues: Crie um issue no GitHub
- Logs: Sempre inclua logs do Railway

---

## ✅ Checklist Final - LANÇAMENTO 24/7

### **Fase 1: Configuração Inicial**
- [ ] Conta Railway criada
- [ ] Gemini API key obtida ([Get Key](https://aistudio.google.com/app/apikey))
- [ ] Repositório conectado ao Railway

### **Fase 2: Variáveis de Ambiente**
- [ ] `AI_SERVICE=gemini` configurado
- [ ] `GEMINI_API_KEY=...` configurado
- [ ] `ADMIN_NUMBERS=+55...` configurado
- [ ] Outras variáveis opcionais configuradas

### **Fase 3: Volume Persistente (CRÍTICO!)**
- [ ] Volume criado no Railway
- [ ] Mount path configurado: `/app/data`
- [ ] Size: 1 GB
- [ ] Redeploy automático concluído

### **Fase 4: Deploy & Build**
- [ ] Push para GitHub feito
- [ ] Railway build iniciado
- [ ] Build passou sem erros (ver logs)
- [ ] Deploy concluído com sucesso

### **Fase 5: Conexão WhatsApp**
- [ ] Acessou `/qr` no Railway
- [ ] QR code apareceu
- [ ] Escaneou com WhatsApp
- [ ] Mensagem "WhatsApp connected successfully" nos logs

### **Fase 6: Testes**
- [ ] Health check retorna 200 (`/health`)
- [ ] Enviou mensagem teste para Sara
- [ ] Sara respondeu corretamente
- [ ] Testou chat offline (`/chat`)
- [ ] Comandos admin funcionam

### **Fase 7: Monitoramento**
- [ ] Logs não mostram erros críticos
- [ ] CPU < 20%
- [ ] Memory < 400 MB
- [ ] Uptime > 99%

---

## 🚀 RESUMO EXECUTIVO - LANÇAMENTO

### **Configuração Mínima para 24/7:**

```
✅ Railway Free Tier ($5 créditos/mês)
✅ Gemini API Key (grátis)
✅ Volume /app/data (1GB) ← CRÍTICO!
✅ AI_SERVICE=gemini
✅ GEMINI_API_KEY=...
✅ ADMIN_NUMBERS=+55...
```

### **Resultado Esperado:**

| Métrica | Valor Esperado |
|---------|----------------|
| **Uptime** | 99.9% |
| **QR Code** | Escaneia 1x e nunca mais |
| **Deploy** | Auto-deploy do GitHub |
| **Restart** | Automático em <30s se cair |
| **Custo** | $0/mês (tudo free tier) |
| **Latência** | ~500-1500ms por resposta |
| **Gemini Quota** | 1500 req/dia (sobra muito) |

### **3 Comandos para Verificar:**

```bash
# 1. Status geral
curl https://seu-app.railway.app/api/status

# 2. Health check
curl https://seu-app.railway.app/health

# 3. Ver logs em tempo real
railway logs --follow
```

---

## 🎉 Deploy Completo! Sara AI Online 24/7

**Sara AI está rodando:**
- 🌸 **Online** em `https://seu-app.railway.app`
- 📱 **WhatsApp** conectado e persistente
- 🤖 **Gemini** respondendo (grátis!)
- 🔒 **Volume** configurado (sessão salva)
- ⚡ **Auto-deploy** ativo

**Próximos passos:**
1. Envie mensagem teste: "Oi Sara!"
2. Configure check-ins: Use comandos PAUSAR, TOM, HORÁRIO
3. Monitore logs: `railway logs`
4. Compartilhe com usuários! 🎯

**Suporte rápido:**
- **QR Code:** `https://seu-app.railway.app/qr`
- **Status:** `https://seu-app.railway.app/api/status`
- **Logs:** `railway.app → Deployments → View Logs`
- **Restart:** `railway.app → Deployments → Restart`

---

## 📞 Links Úteis

- [Railway Dashboard](https://railway.app)
- [Gemini API Studio](https://aistudio.google.com)
- [Sara AI Repo](https://github.com/estevaoantuness/ia_whats)
- [Railway Docs](https://docs.railway.app)

---

*Última atualização: 2025-10-01 - Sara AI v1.0 com Gemini*