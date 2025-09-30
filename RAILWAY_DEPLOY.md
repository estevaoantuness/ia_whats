# 🚂 Guia de Deploy - Sara AI no Railway

## 📋 Pré-requisitos

1. **Conta no Railway**: [railway.app](https://railway.app)
2. **API Key do OpenAI**: [Get Key](https://platform.openai.com/api-keys)
3. **Repositório Git** (opcional, mas recomendado)

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
   # OBRIGATÓRIO
   OPENAI_API_KEY=sua_chave_aqui

   # OBRIGATÓRIO (número do admin com código do país)
   ADMIN_NUMBERS=+5511999999999

   # Opcionais (já têm padrões)
   OPENAI_MODEL=gpt-4o-mini
   OPENAI_MAX_TOKENS=1000
   OPENAI_TEMPERATURE=0.85
   NODE_ENV=production
   PORT=3000
   BOT_NAME=Sara AI
   WHATSAPP_SESSION_NAME=sara_whatsapp_session
   ```

4. **Deploy Automático**
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

## 💰 Custos

### Railway Free Tier
- **$5 USD/mês** de créditos gratuitos
- Geralmente suficiente para 1 bot WhatsApp com uso moderado

### Estimativa de Uso
- **Idle**: ~0.1 GB RAM (~$0.50/mês)
- **Ativo**: ~0.3 GB RAM (~$1.50/mês)
- **Volume**: 1GB (~$0.25/mês)

**Total estimado**: $2-3/mês (dentro do free tier!)

### OpenAI API
- **Pago**: Pay-as-you-go
- **gpt-4o-mini**: $0.150 / 1M input tokens, $0.600 / 1M output tokens
- Estimativa: ~$2-5/mês para uso moderado
- Alternativa gratuita: Configure Gemini API (ver .env.example)

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

## ✅ Checklist Final

Antes de considerar o deploy completo:

- [ ] Build passou sem erros
- [ ] Health check retorna 200
- [ ] QR Code foi escaneado
- [ ] WhatsApp conectou com sucesso
- [ ] Bot responde mensagens
- [ ] Comandos admin funcionam
- [ ] Logs não mostram erros críticos
- [ ] Volume persistente configurado
- [ ] Variáveis de ambiente configuradas

---

## 🎉 Deploy Completo!

Sara AI está online e pronta para uso!

**Próximos passos**:
1. Teste enviando mensagens
2. Configure check-ins com `!help`
3. Monitore logs regularmente
4. Ajuste variáveis conforme necessário

**URL do seu bot**: `https://seu-app.railway.app`

---

*Última atualização: 2025-09-29*