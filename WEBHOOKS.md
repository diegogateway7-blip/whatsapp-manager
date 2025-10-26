# 🔔 Configuração de Webhooks e Notificações

Este guia mostra como configurar notificações em tempo real para quando números forem banidos, recuperados ou entrarem em quarentena.

## 📡 Formato da Notificação

O sistema envia um POST request com o seguinte formato:

```json
{
  "title": "🚫 Número Banido/Removido",
  "message": "O número 5511999999999 foi removido automaticamente após 3 falhas.",
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

## 🎯 Integrações Disponíveis

### 1. Discord

**Webhook Nativo do Discord**:

1. No seu servidor Discord, vá em Configurações do Canal > Integrações > Webhooks
2. Crie um novo webhook
3. Copie a URL
4. Configure no Render: `WEBHOOK_URL=https://discord.com/api/webhooks/123456/abcdef`

**Nota**: Discord aceita JSON direto, mas você pode usar Make.com ou N8N para formatar melhor a mensagem.

### 2. Slack

**Webhook do Slack**:

1. Acesse https://api.slack.com/messaging/webhooks
2. Crie um Incoming Webhook
3. Escolha o canal
4. Copie a URL
5. Configure: `WEBHOOK_URL=https://hooks.slack.com/services/T00/B00/xxx`

### 3. Make.com (Integromat)

**Melhor opção para múltiplas integrações!**

1. Crie um novo Scenario no Make.com
2. Adicione o módulo "Webhooks > Custom Webhook"
3. Copie a URL gerada
4. Configure: `WEBHOOK_URL=https://hook.us1.make.com/xxx`

**Exemplo de Scenario**:
```
Webhook → Router
├─> Discord (enviar mensagem formatada)
├─> Email (enviar alerta por email)
├─> Google Sheets (registrar em planilha)
└─> Telegram (enviar para grupo)
```

### 4. N8N (Self-hosted)

**Para quem prefere auto-hospedagem**:

1. No N8N, crie um novo workflow
2. Adicione um nó "Webhook"
3. Configure como POST
4. Copie a URL
5. Configure: `WEBHOOK_URL=https://seu-n8n.com/webhook/whatsapp-alerts`

**Exemplo de Workflow N8N**:
```json
{
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "whatsapp-alerts",
        "responseMode": "onReceived"
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook"
    },
    {
      "parameters": {
        "message": "={{ $json.title }}\n\n{{ $json.message }}\n\nApp: {{ $json.data.appName }}\nNúmero: {{ $json.data.number }}\nRazão: {{ $json.data.reason }}"
      },
      "name": "Telegram",
      "type": "n8n-nodes-base.telegram"
    }
  ]
}
```

### 5. Telegram

**Via Make.com ou N8N**:

1. Crie um bot no Telegram com @BotFather
2. Obtenha o token do bot
3. Use Make.com ou N8N para receber webhook e enviar para Telegram

**Ou use a API diretamente**:

Configure um servidor intermediário que recebe o webhook e chama:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d "chat_id=<CHAT_ID>" \
  -d "text=Alerta: Número banido!"
```

### 6. Email (SMTP via Make/N8N)

Use Make.com ou N8N para converter o webhook em email:

**Make.com**:
```
Webhook → Email (Gmail, SendGrid, etc)
```

**N8N**:
```
Webhook → Email (SMTP)
```

### 7. WhatsApp (Meta API)

**Receber alertas no próprio WhatsApp!**

Via Make.com ou N8N:
```
Webhook → HTTP Request (Meta API) → Enviar mensagem WhatsApp
```

### 8. Google Sheets

**Registrar todos os banimentos em planilha**:

Via Make.com:
```
Webhook → Google Sheets (Add Row)
```

Colunas sugeridas:
- Data/Hora
- App
- Número
- Status (Banido/Recuperado/Quarentena)
- Razão
- Código de Erro

### 9. Custom API

**Se você tem sua própria API**:

```javascript
// Seu endpoint deve aceitar POST
app.post('/whatsapp-notification', (req, res) => {
  const { title, message, data, timestamp } = req.body;
  
  // Processar notificação
  console.log(`${title}: ${message}`);
  
  // Salvar no banco de dados
  // Enviar para outros sistemas
  // etc...
  
  res.json({ received: true });
});
```

Configure: `WEBHOOK_URL=https://sua-api.com/whatsapp-notification`

## 🎨 Exemplos de Formatação

### Exemplo Make.com para Discord

**Módulos**:
1. Webhook (recebe)
2. Tools > Set Variable (formata mensagem)
3. Discord > Send Message

**Mensagem formatada**:
```
🚨 **ALERTA WHATSAPP MANAGER** 🚨

**Status**: {{ title }}

**Mensagem**: {{ message }}

**Detalhes**:
• App: {{ data.appName }}
• Número: {{ data.number }}
• Razão: {{ data.reason }}
• Código: {{ data.errorCode }}
• Horário: {{ formatDate(timestamp) }}
```

### Exemplo N8N para Telegram com Botões

```json
{
  "parameters": {
    "chatId": "seu_chat_id",
    "message": "={{ $json.title }}\n\n{{ $json.message }}",
    "replyMarkup": {
      "inline_keyboard": [
        [
          {
            "text": "Ver Dashboard",
            "url": "https://seu-app.onrender.com"
          },
          {
            "text": "Ver Logs",
            "url": "https://seu-app.onrender.com#logs"
          }
        ]
      ]
    }
  },
  "type": "n8n-nodes-base.telegram"
}
```

## 🔒 Segurança

### Validar Webhooks (Recomendado)

Se quiser adicionar segurança ao webhook:

1. **Adicione um token secreto** no server.js:

```javascript
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

async function sendNotification(title, message, data = {}) {
  if (!CONFIG.WEBHOOK_URL) return;
  
  try {
    await axios.post(CONFIG.WEBHOOK_URL, {
      title,
      message,
      data,
      timestamp: new Date().toISOString(),
      secret: WEBHOOK_SECRET // Adicionar secret
    }, { timeout: 5000 });
  } catch (error) {
    console.error('❌ Erro ao enviar notificação:', error.message);
  }
}
```

2. **No receptor (Make/N8N)**, valide o secret antes de processar

### IP Whitelist

Se usar sua própria API, considere aceitar apenas requests do IP do Render.com.

## 📊 Tipos de Notificações

O sistema envia notificações para os seguintes eventos:

### 🚫 Número Banido/Removido
```json
{
  "title": "🚫 Número Banido/Removido",
  "message": "O número 5511999999999 foi removido automaticamente após 3 falhas."
}
```

### ⚠️ Número em Quarentena
```json
{
  "title": "⚠️ Número em Quarentena",
  "message": "O número 5511999999999 foi desativado. Tentativa 1/3"
}
```

### ✅ Número Recuperado
```json
{
  "title": "✅ Número Recuperado",
  "message": "O número 5511999999999 voltou a funcionar!"
}
```

## 🧪 Testar Webhook

Para testar se o webhook está funcionando:

1. Use webhook.site temporariamente:
   - Acesse https://webhook.site
   - Copie a URL única gerada
   - Configure: `WEBHOOK_URL=https://webhook.site/sua-url`
   - Execute um health check
   - Veja os requests chegando em tempo real

2. Teste com curl:
```bash
curl -X POST https://seu-webhook.com/notify \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Teste",
    "message": "Testando webhook",
    "data": {},
    "timestamp": "2025-10-26T12:00:00Z"
  }'
```

## 💡 Dicas

1. **Use Make.com** se você não tem experiência com APIs - é visual e fácil
2. **Use N8N** se você quer auto-hospedar e ter controle total
3. **Múltiplas notificações**: Configure Make.com para enviar para Discord + Email + Telegram simultaneamente
4. **Filtros**: No Make.com/N8N, adicione filtros para só receber alertas críticos
5. **Horários**: Configure para só receber notificações em horário comercial

## 🆘 Troubleshooting

**Webhook não está funcionando?**

1. Verifique se `WEBHOOK_URL` está configurada no Render.com
2. Teste a URL com webhook.site primeiro
3. Verifique os logs do Render para ver se há erros
4. Confirme que o endpoint aceita POST com JSON
5. Verifique se não há firewall bloqueando

**Notificações duplicadas?**

- O health check roda a cada 15 minutos
- Você só recebe notificação na PRIMEIRA falha (quarentena) e na TERCEIRA (remoção)
- Recuperações também geram notificação

**Timeout?**

- O webhook tem timeout de 5 segundos
- Se seu endpoint é lento, use Make.com como intermediário

---

**Need help?** Abra uma issue no GitHub!

