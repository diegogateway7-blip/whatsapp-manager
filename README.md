# 📱 WhatsApp Manager Pro

Sistema inteligente de gerenciamento de números WhatsApp Business com detecção automática de banimentos, quarentena e remoção de números inativos.

## 🚀 Funcionalidades

### ✅ Recursos Principais

- **Health Check Automático**: Verificação periódica de todas as WABAs registradas (configurável)
- **Detecção Inteligente de Restrições**: Analisa o `account_review_status` e o `messaging_limit_tier` da conta no Meta
- **Sistema de Quarentena**: Números são desativados ao primeiro erro e só voltam quando a WABA estiver saudável
- **Desativação Segura**: Após 3 falhas consecutivas, o número permanece desativado até ação manual do operador
- **Persistência em MongoDB Atlas**: Banco de dados gerenciado, compatível com Render.com
- **Logs Detalhados**: Histórico completo de todas as operações
- **Webhooks**: Notificações em tempo real (Discord, Slack, Make, N8N, etc)
- **Dashboard Moderno**: Interface web completa e responsiva
- **API para Integração**: Endpoints REST para integrar com Typebot e outros sistemas

### 🎯 Sistema de Quarentena

O sistema implementa um processo inteligente de 3 etapas:

1. **1ª Falha**: Número vai para quarentena (continua na lista, mas marcado)
2. **2ª Falha**: Número ainda em quarentena (última chance)
3. **3ª Falha**: Número é **desativado permanentemente**. O operador decide reativar ou excluir após revisar a conta

Erros temporários (timeout, rate limit) não contam como falha para manter números válidos ativos.

### 🔍 Códigos de Erro Detectados

O sistema reconhece e age de acordo com os seguintes erros da API do WhatsApp Business:

**Erros Permanentes (Ban/Restrição)**:
- `4` - Número banido temporariamente
- `80007` - Rate limit permanente
- `131031` - Conta desabilitada
- `131042` - Número inválido
- `131047` - Janela de reengajamento expirada
- `131048` - Mensagem falhou - número bloqueado
- `200` - Erro de permissões
- `368` - Bloqueado por violação de políticas
- `401/403` - Sem autorização (token inválido ou número sem acesso)
- `404` - Número não encontrado

**Erros Temporários (não remove)**:
- `1` - Erro desconhecido da API
- `2` - Erro de serviço
- `10` - Permissão negada (verificar token)
- `130429` - Rate limit temporário
- `500+` - Erros de servidor

## 📦 Instalação

### Local

```bash
# Clone o repositório
git clone <seu-repositorio>
cd whatsapp-manager

# Instale as dependências
npm install

# Configure as variáveis de ambiente (opcional)
cp .env.example .env
# Edite o .env com suas configurações

# Inicie o servidor
npm start
```

O servidor estará disponível em `http://localhost:3000`

### Deploy no Render.com

1. **Fork/Clone este repositório**

2. **Criar novo Web Service no Render**:
   - Conecte seu repositório GitHub
   - Render detectará automaticamente o `render.yaml`

3. **Configurar Disco Persistente**:
   - Em Settings > Disks, adicione:
     - Name: `data`
     - Mount Path: `/opt/render/project/src/data`
     - Size: `1 GB` (suficiente)

4. **Configurar Variáveis de Ambiente** (opcional):
   ```
   WEBHOOK_URL=https://seu-webhook.com/notify
   ```

5. **Deploy**!

**IMPORTANTE**: O disco persistente é essencial para manter os dados entre deploys no Render.com.

## 🔧 Configuração

### Variáveis de Ambiente

```bash
# Porta (Render.com define automaticamente)
PORT=3000

# URL do Webhook para notificações (opcional)
WEBHOOK_URL=https://hooks.slack.com/services/xxx
# ou
WEBHOOK_URL=https://discord.com/api/webhooks/xxx
# ou
WEBHOOK_URL=https://hook.us1.make.com/xxx
# ou
WEBHOOK_URL=https://seu-n8n.com/webhook/xxx

# Ambiente
NODE_ENV=production
```

### Configurações no Código (server.js)

```javascript
const CONFIG = {
  MAX_FAILED_CHECKS: 3,              // Falhas antes de remover
  HEALTH_CHECK_INTERVAL: '*/15 * * * *', // A cada 15 minutos
  BACKUP_INTERVAL: '0 */6 * * *',    // Backup a cada 6 horas
  META_API_VERSION: 'v21.0'          // Versão da API do Meta
};
```

## 📖 Como Usar

### 1. Adicionar um App

1. Acesse o dashboard
2. Clique em "Adicionar App"
3. Preencha:
   - **App ID**: Identificador único (ex: `app_1`)
   - **Nome**: Nome descritivo
   - **Token**: Token permanente do Meta Business
   - **WABA ID**: Identificação da WhatsApp Business Account (obrigatório)
   - *(Opcional)* **Phone Number ID**: Apenas para referência; o health check não depende mais dele

### 2. Adicionar Números

1. No card do app, clique em "Adicionar Número"
2. Digite o número com código do país (ex: `5511999999999`)
3. O número será adicionado como ativo

### 3. Acompanhar Status

O dashboard mostra em tempo real:
- ✅ Números ativos
- ⚠️ Números em quarentena
- ❌ Números inativos
- 📊 Estatísticas gerais

### 4. Logs e Histórico

Na aba "Logs do Sistema" você pode:
- Ver todas as operações
- Filtrar por tipo (banimento, recuperação, etc)
- Exportar histórico

## 🔌 API Endpoints

### Para Integração com Typebot

```http
GET /api/get-active-number
```

**Resposta de sucesso**:
```json
{
  "success": true,
  "number": "5511999999999",
  "whatsappUrl": "https://wa.me/5511999999999",
  "totalActive": 5,
  "app": "app_1",
  "appName": "App Principal"
}
```

**Uso no Typebot**:
1. Adicione um bloco "HTTP Request"
2. URL: `https://seu-app.onrender.com/api/get-active-number`
3. Salve a variável `whatsappUrl`
4. Use para redirecionar o usuário

### Outros Endpoints

```http
# Status do sistema
GET /api/status

# Listar todos os apps
GET /api/apps

# Adicionar/Editar app
POST /api/apps
Body: { appId, appName, token, wabaId, phoneNumberId (opcional) }

# Deletar app
DELETE /api/apps/:appId

# Adicionar número
POST /api/apps/:appId/numbers
Body: { number }

# Deletar número
DELETE /api/apps/:appId/numbers/:number

# Ativar/Desativar número
PATCH /api/apps/:appId/numbers/:number
Body: { active: true/false }

# Executar health check manual
POST /api/health-check

# Obter logs
GET /api/logs?limit=100&type=ban

# Limpar logs
DELETE /api/logs

# Health check (para Render.com)
GET /health
```

## 🔔 Webhooks / Notificações

Configure a variável `WEBHOOK_URL` para receber notificações em tempo real:

**Formato da notificação**:
```json
{
  "title": "🚫 Número Desativado",
  "message": "O número 5511999999999 foi desativado após 3 falhas consecutivas (WABA com problema).",
  "data": {
    "appId": "app_1",
    "appName": "App Principal",
    "number": "5511999999999",
    "reason": "Account has been disabled",
    "errorCode": 131031
  },
  "timestamp": "2025-10-26T12:34:56.789Z"
}
```

### Exemplos de Integração

**Discord**:
```
WEBHOOK_URL=https://discord.com/api/webhooks/123/abc
```

**Slack**:
```
WEBHOOK_URL=https://hooks.slack.com/services/T00/B00/xxx
```

**Make.com / N8N**:
```
WEBHOOK_URL=https://hook.us1.make.com/xxx
WEBHOOK_URL=https://seu-n8n.com/webhook/whatsapp-alerts
```

## 🛡️ Segurança

- ⚠️ **NUNCA** commite tokens ou credenciais no Git
- Use variáveis de ambiente para informações sensíveis
- Considere adicionar autenticação no dashboard (Basic Auth, JWT, etc)
- Configure CORS apropriadamente em produção

## 📊 Estrutura de Dados

### Estrutura (MongoDB - coleção `apps`)
```json
{
  "appId": "app_1",
  "appName": "App Principal",
  "token": "EAAxxxxx",
  "wabaId": "357215632625206",
  "phoneNumberId": "123456", // opcional
  "numbers": {
    "5511999999999": {
      "active": true,
      "lastCheck": "2025-10-26T12:00:00Z",
      "error": null,
      "errorCode": null,
      "failedChecks": 0,
      "addedAt": "2025-10-25T10:00:00Z",
      "lastStatusChange": "2025-10-25T10:00:00Z",
      "qualityRating": "WABA: APPROVED"
    }
  },
  "createdAt": "2025-10-25T10:00:00Z",
  "updatedAt": "2025-10-26T12:00:00Z"
}
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Changelog

### v2.0.0
- ✅ Sistema de quarentena e remoção automática
- ✅ Detecção inteligente de códigos de erro
- ✅ Persistência em arquivo JSON
- ✅ Backup automático
- ✅ Logs detalhados
- ✅ Webhooks para notificações
- ✅ Dashboard completamente redesenhado
- ✅ Compatibilidade com Render.com

### v1.0.0
- ✅ Health check básico
- ✅ Gerenciamento de apps e números
- ✅ API para Typebot

## 📄 Licença

MIT License - veja o arquivo LICENSE para detalhes

## 💬 Suporte

Para dúvidas, problemas ou sugestões:
- Abra uma issue no GitHub
- Entre em contato com o desenvolvedor

---

**Desenvolvido com ❤️ para automatizar o gerenciamento de WhatsApp Business**
