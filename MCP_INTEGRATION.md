# 🔌 MCP Integration - Sara AI

## 📋 O que são MCPs?

**MCP (Model Context Protocol)** são servidores que expandem as capacidades da Sara AI, permitindo que ela interaja com sistemas externos, navegadores, APIs e mais.

## 🚀 MCPs Integrados

### 1. **Playwright MCP** (`@executeautomation/playwright-mcp-server`)
**Automação de Navegador**

**Capacidades:**
- ✅ Abrir páginas web
- ✅ Clicar em elementos
- ✅ Preencher formulários
- ✅ Tirar screenshots
- ✅ Extrair dados de páginas
- ✅ Testar aplicações web

**Exemplo de uso:**
```typescript
// Sara pode agora:
// "Tire um screenshot da página google.com"
// "Preencha o formulário em example.com com meus dados"
// "Verifique se o site está funcionando corretamente"
```

---

### 2. **Filesystem MCP** (`@modelcontextprotocol/server-filesystem`)
**Acesso ao Sistema de Arquivos**

**Capacidades:**
- ✅ Ler arquivos do projeto
- ✅ Escrever novos arquivos
- ✅ Modificar arquivos existentes
- ✅ Listar diretórios
- ✅ Buscar arquivos

**Configuração:**
- Limitado ao diretório do projeto: `/Users/estevaoantunes/ia_whats`
- Segurança: Não pode acessar arquivos fora do projeto

**Exemplo de uso:**
```typescript
// Sara pode agora:
// "Leia o arquivo de configuração"
// "Crie um novo arquivo README.md"
// "Liste todos os arquivos .ts no projeto"
```

---

### 3. **Web Fetch MCP** (`@modelcontextprotocol/server-fetch`)
**Busca de Conteúdo Web**

**Capacidades:**
- ✅ Fazer requisições HTTP/HTTPS
- ✅ Consumir APIs externas
- ✅ Baixar conteúdo de URLs
- ✅ Verificar status de serviços
- ✅ Integrar com webhooks

**Exemplo de uso:**
```typescript
// Sara pode agora:
// "Busque as últimas notícias do Brasil"
// "Consulte a API do clima para São Paulo"
// "Verifique se a API do Gemini está online"
```

---

### 4. **GitHub MCP** (`@modelcontextprotocol/server-github`)
**Integração com GitHub**

**Capacidades:**
- ✅ Criar/editar issues
- ✅ Gerenciar pull requests
- ✅ Ler código de repositórios
- ✅ Fazer commits (com permissão)
- ✅ Buscar repositórios
- ✅ Comentar em PRs

**Configuração Necessária:**
1. Criar Personal Access Token no GitHub:
   - Acesse: https://github.com/settings/tokens
   - Gere novo token (classic)
   - Selecione scopes: `repo`, `read:org`

2. Adicione ao `.env`:
   ```env
   GITHUB_TOKEN=seu_token_aqui
   ```

**Exemplo de uso:**
```typescript
// Sara pode agora:
// "Crie uma issue no repositório sobre o bug X"
// "Liste os últimos commits do projeto"
// "Comente no PR #123"
```

---

### 5. **Browser Use MCP** (`@modelcontextprotocol/server-puppeteer`)
**Automação Avançada de Navegador**

**Capacidades:**
- ✅ Interações complexas com páginas
- ✅ JavaScript injection
- ✅ Interceptar network requests
- ✅ Emular dispositivos móveis
- ✅ Gerar PDFs de páginas
- ✅ Performance monitoring

**Exemplo de uso:**
```typescript
// Sara pode agora:
// "Monitore o tempo de carregamento do site"
// "Emule um iPhone e teste a responsividade"
// "Gere um PDF da página"
```

---

## ⚙️ Configuração

### 1. Arquivo de Configuração

Os MCPs estão configurados em `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "playwright": { ... },
    "filesystem": { ... },
    "web-fetch": { ... },
    "github": { ... },
    "browser-use": { ... }
  }
}
```

### 2. Variáveis de Ambiente

Adicione ao `.env` (se necessário):

```env
# GitHub Integration (opcional)
GITHUB_TOKEN=seu_github_token_aqui

# Outras configs MCP podem ser adicionadas aqui
```

### 3. Instalação Automática

Os MCPs são instalados automaticamente via `npx` quando necessários. Não requer instalação manual.

---

## 🔐 Segurança

### Filesystem MCP
- ✅ Restrito ao diretório do projeto
- ✅ Não pode acessar arquivos do sistema
- ✅ Não pode executar comandos shell

### GitHub MCP
- ⚠️ Requer token de acesso pessoal
- ✅ Token deve ter permissões mínimas necessárias
- ✅ Nunca commite o token no Git (use `.env`)

### Browser MCPs
- ✅ Rodam em sandbox isolado
- ✅ Não executam código malicioso
- ⚠️ Cuidado ao acessar sites não confiáveis

---

## 🧪 Testando MCPs

### Teste 1: Web Fetch
```bash
# Via WhatsApp, envie:
"Sara, busque o clima atual de São Paulo"
```

### Teste 2: Filesystem
```bash
# Via WhatsApp, envie:
"Sara, liste os arquivos TypeScript no projeto"
```

### Teste 3: Playwright
```bash
# Via WhatsApp, envie:
"Sara, tire um screenshot da página google.com"
```

### Teste 4: GitHub (requer token)
```bash
# Via WhatsApp, envie:
"Sara, liste os últimos 5 commits do repositório"
```

---

## 📊 Casos de Uso

### 1. Monitoramento de Sites
Sara pode verificar se seus sites estão online e notificar você:
```
"Sara, verifique se meu site example.com está online"
```

### 2. Automação de Tarefas
Sara pode executar tarefas repetitivas:
```
"Sara, todos os dias às 9h, busque as notícias de tecnologia"
```

### 3. Integração com GitHub
Sara pode gerenciar issues e PRs:
```
"Sara, crie uma issue sobre implementar feature X"
```

### 4. Extração de Dados
Sara pode extrair informações de páginas web:
```
"Sara, extraia o preço do produto na página amazon.com/produto"
```

### 5. Gestão de Arquivos
Sara pode organizar arquivos do projeto:
```
"Sara, crie uma pasta docs/ e mova todos os .md para lá"
```

---

## 🚨 Troubleshooting

### Problema 1: MCP não inicializa
**Causa**: Dependências faltando

**Solução**:
```bash
# Limpar cache do npx
npx clear-npx-cache

# Tentar novamente
npx -y @modelcontextprotocol/server-fetch
```

### Problema 2: GitHub MCP falha
**Causa**: Token não configurado ou inválido

**Solução**:
```bash
# Verificar token
echo $GITHUB_TOKEN

# Reconfigurar no .env
GITHUB_TOKEN=novo_token_aqui
```

### Problema 3: Filesystem MCP acesso negado
**Causa**: Tentando acessar fora do diretório permitido

**Solução**:
- Verifique que o caminho está dentro de `/Users/estevaoantunes/ia_whats`
- MCPs de filesystem são restritos por segurança

### Problema 4: Browser MCPs muito lentos
**Causa**: Recursos limitados

**Solução**:
```bash
# Reduzir concorrência
# Fechar navegadores não utilizados
# Aumentar timeout nos MCPs
```

---

## 🔄 Atualizações

### Atualizar MCPs
```bash
# Os MCPs são sempre baixados na versão mais recente via npx
# Para forçar atualização, limpe o cache:
npx clear-npx-cache
```

### Adicionar Novos MCPs

1. Edite `.claude/mcp.json`
2. Adicione novo servidor:
```json
"novo-mcp": {
  "command": "npx",
  "args": ["-y", "@org/novo-mcp"],
  "description": "Descrição do MCP"
}
```

---

## 📚 Recursos

### Documentação Oficial
- **MCP Spec**: https://modelcontextprotocol.io
- **Playwright MCP**: https://github.com/executeautomation/playwright-mcp-server
- **Official MCPs**: https://github.com/modelcontextprotocol/servers

### Exemplos de Uso
- **MCP Examples**: https://github.com/modelcontextprotocol/examples
- **Community MCPs**: https://github.com/topics/mcp-server

---

## ✅ Checklist de Integração

- [x] Arquivo `.claude/mcp.json` criado
- [x] MCPs configurados com comandos corretos
- [ ] Variáveis de ambiente configuradas (.env)
- [ ] GitHub token configurado (opcional)
- [ ] Testes realizados com cada MCP
- [ ] Documentação lida e compreendida

---

## 🎉 Pronto para Usar!

Sara AI agora tem superpoderes! 🚀

**Próximos passos:**
1. Configure o GitHub token se necessário
2. Teste cada MCP individualmente
3. Explore casos de uso avançados
4. Monitore logs para debugging

**URL de Exemplo:**
- Local: `http://localhost:3000`
- Railway: `https://seu-app.railway.app`

---

*Última atualização: 2025-09-29*