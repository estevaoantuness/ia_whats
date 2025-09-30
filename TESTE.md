# 🧪 Guia Completo de Teste - IA WhatsApp Bot

## 📋 Pré-requisitos para Teste

### 1. **Conta OpenAI**
- Acesse: https://platform.openai.com/
- Crie uma conta ou faça login
- Vá em "API Keys" e gere uma nova chave
- **IMPORTANTE**: Tenha créditos na conta (mínimo $5)

### 2. **WhatsApp**
- Tenha o WhatsApp instalado no celular
- Certifique-se que está funcionando normalmente

### 3. **Node.js**
- Versão 17 ou superior
- Verifique: `node --version`

## 🚀 Processo de Teste Passo a Passo

### **PASSO 1: Configurar API Key**
```bash
# Edite o arquivo .env
nano .env

# Substitua 'your_openai_api_key_here' pela sua chave real
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### **PASSO 2: Configurar Número Admin**
```bash
# No .env, configure seu número (com código do país)
ADMIN_NUMBERS=+5511999999999  # Substitua pelo seu número
```

### **PASSO 3: Build e Inicialização**
```bash
# 1. Build do projeto
npm run build

# 2. Verificar se build foi bem-sucedido
ls dist/  # Deve mostrar arquivos .js

# 3. Iniciar o bot
npm run dev
```

### **PASSO 4: Conectar WhatsApp**
1. **Execute o bot** - um QR Code aparecerá no terminal
2. **Abra WhatsApp no celular**
3. **Vá em:** Menu → Aparelhos conectados → Conectar um aparelho
4. **Escaneie o QR Code** que aparece no terminal
5. **Aguarde** - você verá mensagem de "Connected!" no terminal

## 📱 Testes de Funcionalidade

### **TESTE 1: Conversa Básica**
```
Você → Bot: Olá, como você está?
Bot → Você: Olá! Estou muito bem, obrigado por perguntar! 😊 Como posso ajudá-lo hoje?
```

### **TESTE 2: Comandos Básicos**
```
Você → Bot: !help
Bot → Você: [Mostra menu de ajuda completo]

Você → Bot: !ping
Bot → Você: 🏓 Pong! Bot está funcionando normalmente.

Você → Bot: !status
Bot → Você: [Mostra status do sistema]
```

### **TESTE 3: Funcionalidades IA**
```
Você → Bot: !translate english Olá mundo
Bot → Você: 🌐 Tradução para english: Hello world

Você → Bot: !calc 15 * 3 + 5
Bot → Você: 🧮 Cálculo: 15 × 3 + 5 = 50

Você → Bot: Explique como funciona a fotossíntese
Bot → Você: [Explicação detalhada sobre fotossíntese]
```

### **TESTE 4: Contexto de Conversa**
```
Você → Bot: Meu nome é João
Bot → Você: Prazer em conhecê-lo, João! Como posso ajudá-lo?

Você → Bot: Qual é o meu nome?
Bot → Você: Seu nome é João! 😊
```

### **TESTE 5: Comandos Admin** (apenas se você for admin)
```
Você → Bot: !stats
Bot → Você: [Estatísticas detalhadas do sistema]
```

## 🐛 Troubleshooting - Problemas Comuns

### **Problema 1: QR Code não aparece**
**Solução:**
```bash
# Pare o bot (Ctrl+C)
# Limpe sessões antigas
rm -rf data/auth/
# Reinicie
npm run dev
```

### **Problema 2: Erro "Invalid API Key"**
**Solução:**
```bash
# Verifique se a chave está correta no .env
cat .env | grep OPENAI_API_KEY

# Teste a chave manualmente:
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer SUA_CHAVE_AQUI"
```

### **Problema 3: Bot não responde**
**Solução:**
```bash
# Verifique os logs
tail -f logs/combined.log

# Procure por erros específicos
grep ERROR logs/combined.log
```

### **Problema 4: "Rate limit exceeded"**
**Solução:**
- Aguarde alguns minutos
- Verifique se tem créditos na conta OpenAI
- Reduza a frequência de mensagens

### **Problema 5: Erro de dependências**
**Solução:**
```bash
# Reinstale dependências
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📊 Monitoramento Durante Teste

### **Logs em Tempo Real**
```bash
# Terminal 1: Execute o bot
npm run dev

# Terminal 2: Monitore logs
tail -f logs/combined.log

# Terminal 3: Monitore apenas erros
tail -f logs/error.log
```

### **Verificação de Performance**
```bash
# Verifique uso de memória
top -p $(pgrep -f "node.*ia_whats")

# Verifique arquivos criados
ls -la data/
ls -la logs/
```

## ✅ Checklist de Teste Completo

### **Funcionalidades Básicas**
- [ ] Bot inicia sem erros
- [ ] QR Code aparece no terminal
- [ ] WhatsApp conecta com sucesso
- [ ] Bot responde a mensagens simples
- [ ] Comando `!help` funciona
- [ ] Comando `!ping` funciona

### **Funcionalidades IA**
- [ ] Conversas naturais funcionam
- [ ] Contexto é mantido entre mensagens
- [ ] Tradução funciona (`!translate`)
- [ ] Calculadora funciona (`!calc`)
- [ ] Status do sistema (`!status`)

### **Funcionalidades Avançadas**
- [ ] Rate limiting funciona (teste enviando muitas mensagens)
- [ ] Comandos admin funcionam (se configurado)
- [ ] Logs são gerados corretamente
- [ ] Bot reconecta após desconexão

### **Teste de Stress**
- [ ] Múltiplas mensagens consecutivas
- [ ] Mensagens longas (>1000 caracteres)
- [ ] Comandos inválidos
- [ ] Reconexão após perda de internet

## 🎯 Cenários de Teste Específicos

### **Cenário 1: Usuário Novo**
1. Envie primeira mensagem
2. Verifique se contexto é criado
3. Continue conversa
4. Verifique persistência

### **Cenário 2: Rate Limiting**
1. Envie 15 mensagens rapidamente
2. Verifique se bot bloqueia temporariamente
3. Aguarde 1 minuto
4. Teste se voltou ao normal

### **Cenário 3: Reconexão**
1. Desconecte internet
2. Aguarde 30 segundos
3. Reconecte internet
4. Verifique se bot reconecta automaticamente

### **Cenário 4: Comandos Inválidos**
```
!comando_inexistente
!help_com_parametros_errados
!@#$%^&*()
```

## 📝 Log de Teste

### **Template para Documentar Testes**
```
Data: ___________
Testador: ___________
Versão: 1.0.0

TESTE 1 - Conexão Inicial:
✅ QR Code exibido: SIM/NÃO
✅ WhatsApp conectou: SIM/NÃO
✅ Primeira mensagem: SIM/NÃO

TESTE 2 - Comandos Básicos:
✅ !help: SIM/NÃO
✅ !ping: SIM/NÃO
✅ !status: SIM/NÃO

TESTE 3 - IA:
✅ Conversa normal: SIM/NÃO
✅ Tradução: SIM/NÃO
✅ Cálculo: SIM/NÃO

PROBLEMAS ENCONTRADOS:
-
-

OBSERVAÇÕES:
-
-
```

## 🆘 Suporte Durante Teste

### **Se precisar de ajuda:**
1. **Verifique logs:** `tail -f logs/combined.log`
2. **Consulte este guia** de troubleshooting
3. **Documente o erro** com prints/logs
4. **Verifique configurações** no `.env`

### **Comandos Úteis para Debug:**
```bash
# Verificar se o bot está rodando
ps aux | grep node

# Verificar portas em uso
netstat -tulpn | grep :3000

# Verificar espaço em disco
df -h

# Verificar logs do sistema
journalctl -f
```

## 🎉 Teste Bem-Sucedido!

Se todos os testes passaram, parabéns! 🎉
Sua IA de WhatsApp está **funcionando perfeitamente** e pronta para uso em produção.

### **Próximos Passos:**
1. **Configurar produção** (se necessário)
2. **Personalizar prompts** da IA
3. **Adicionar novos comandos**
4. **Configurar backups**
5. **Monitorar uso e custos**