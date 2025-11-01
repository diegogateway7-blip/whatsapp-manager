# 📡 Documentação da API

Referência completa de todos os endpoints da API do WhatsApp Manager.

Base URL: `https://seu-app.onrender.com`

## 📋 Índice

- [Endpoints para Typebot](#-endpoints-para-typebot)
- [Gerenciamento de Apps](#-gerenciamento-de-apps)
- [Gerenciamento de Números](#-gerenciamento-de-números)
- [Sistema](#-sistema)
- [Logs](#-logs)
- [Códigos de Resposta](#-códigos-de-resposta)

---

## 🤖 Endpoints para Typebot

### Obter Número Ativo Aleatório

Retorna um número ativo aleatoriamente para redirecionar usuários.

**Request:**
```http
GET /api/get-active-number
```

**Response (Sucesso - 200)**:
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

**Response (Sem números ativos - 404)**:
```json
{
  "success": false,
  "message": "Nenhum número ativo disponível",
  "totalActive": 0
}
```

**Exemplo de Uso no Typebot:**
```javascript
// No HTTP Request block
Method: GET
URL: https://seu-app.onrender.com/api/get-active-number

// Salvar em variável: whatsappData

// Usar no Redirect block:
URL: {{whatsappData.whatsappUrl}}
```

---

## 📱 Gerenciamento de Apps

### Listar Todos os Apps

**Request:**
```http
GET /api/apps
```

**Response (200)**:
```json
{
  "app_1": {
    "appName": "App Principal",
    "token": "EAAxxxxx...",
    "phoneNumberId": "123456789",
    "wabaId": "357215632625206",
    "numbers": {
      "5511999999999": {
        "active": true,
        "lastCheck": "2025-10-26T12:34:56.789Z",
        "error": null,
        "errorCode": null,
        "failedChecks": 0,
        "addedAt": "2025-10-25T10:00:00Z",
        "lastStatusChange": "2025-10-25T10:00:00Z",
        "qualityRating": "GREEN"
      }
    },
    "createdAt": "2025-10-25T10:00:00Z"
  }
}
```

### Adicionar ou Atualizar App

**Request:**
```http
POST /api/apps
Content-Type: application/json

{
  "appId": "app_1",
  "appName": "App Principal",
  "token": "EAAxxxxx...",
  "wabaId": "357215632625206",
  "phoneNumberId": "123456789"
}
```

**Response (200)**:
```json
{
  "success": true,
  "app": {
    "appName": "App Principal",
    "token": "EAAxxxxx...",
    "phoneNumberId": "123456789",
    "numbers": {},
    "createdAt": "2025-10-26T12:34:56.789Z"
  }
}
```

**Response (Erro - 400)**:
```json
{
  "error": "Campos obrigatórios: appId, appName, token, wabaId"
}
```

### Deletar App

**Request:**
```http
DELETE /api/apps/:appId
```

**Exemplo:**
```http
DELETE /api/apps/app_1
```

**Response (200)**:
```json
{
  "success": true
}
```

**Response (Erro - 404)**:
```json
{
  "error": "App não encontrado"
}
```

---

## 📞 Gerenciamento de Números

### Adicionar Número

**Request:**
```http
POST /api/apps/:appId/numbers
Content-Type: application/json

{
  "number": "5511999999999"
}
```

**Response (200)**:
```json
{
  "success": true,
  "number": {
    "active": true,
    "lastCheck": null,
    "error": null,
    "errorCode": null,
    "failedChecks": 0,
    "addedAt": "2025-10-26T12:34:56.789Z",
    "lastStatusChange": "2025-10-26T12:34:56.789Z"
  }
}
```

**Response (Erro - 400)**:
```json
{
  "error": "Número inválido"
}
```

**Response (Erro - 404)**:
```json
{
  "error": "App não encontrado"
}
```

### Ativar/Desativar Número

**Request:**
```http
PATCH /api/apps/:appId/numbers/:number
Content-Type: application/json

{
  "active": true
}
```

**Exemplo:**
```http
PATCH /api/apps/app_1/numbers/5511999999999
Content-Type: application/json

{
  "active": false
}
```

**Response (200)**:
```json
{
  "success": true,
  "number": {
    "active": false,
    "lastCheck": "2025-10-26T12:00:00Z",
    "error": "Manually disabled",
    "errorCode": null,
    "failedChecks": 0,
    "addedAt": "2025-10-25T10:00:00Z",
    "lastStatusChange": "2025-10-26T12:34:56.789Z"
  }
}
```

### Deletar Número

**Request:**
```http
DELETE /api/apps/:appId/numbers/:number
```

**Exemplo:**
```http
DELETE /api/apps/app_1/numbers/5511999999999
```

**Response (200)**:
```json
{
  "success": true
}
```

**Response (Erro - 404)**:
```json
{
  "error": "Número não encontrado"
}
```

---

## ⚙️ Sistema

### Status do Sistema

Retorna estatísticas gerais do sistema.

**Request:**
```http
GET /api/status
```

**Response (200)**:
```json
{
  "status": "online",
  "totalApps": 2,
  "totalNumbers": 10,
  "activeNumbers": 8,
  "inQuarantine": 1,
  "lastHealthCheck": "2025-10-26T12:00:00Z",
  "stats": {
    "totalChecks": 150,
    "totalBans": 5,
    "totalRecoveries": 2
  },
  "config": {
    "maxFailedChecks": 3,
    "healthCheckInterval": "*/15 * * * *",
    "webhookConfigured": true
  }
}
```

### Executar Health Check

Executa verificação manual de todos os números.

**Request:**
```http
POST /api/health-check
```

**Response (200)**:
```json
{
  "success": true,
  "lastCheck": "2025-10-26T12:34:56.789Z",
  "results": {
    "checked": 10,
    "active": 8,
    "disabled": 1,
    "removed": 1,
    "errors": [
      {
        "appId": "app_1",
        "appName": "App Principal",
        "number": "5511999999999",
        "error": "Account has been disabled",
        "errorCode": 131031,
        "failedChecks": 3
      }
    ]
  }
}
```

**Response (Erro - 500)**:
```json
{
  "error": "Erro ao executar health check"
}
```

### Configurações

Retorna as configurações atuais do sistema.

**Request:**
```http
GET /api/config
```

**Response (200)**:
```json
{
  "maxFailedChecks": 3,
  "healthCheckInterval": "*/15 * * * *",
  "webhookConfigured": true,
  "metaApiVersion": "v21.0"
}
```

### Health Check (Render.com)

Endpoint para verificação de saúde do servidor.

**Request:**
```http
GET /health
```

**Response (200)**:
```json
{
  "status": "ok",
  "uptime": 12345.67,
  "timestamp": "2025-10-26T12:34:56.789Z"
}
```

---

## 📋 Logs

### Obter Logs

**Request:**
```http
GET /api/logs?limit=100&type=ban
```

**Query Parameters:**
- `limit` (opcional): Número de logs a retornar (padrão: 100)
- `type` (opcional): Filtrar por tipo de log
  - `health_check`
  - `ban`
  - `recovery`
  - `quarantine`
  - `system`
  - `app`
  - `number`
  - `redirect`
  - `backup`
  - `notification`

**Response (200)**:
```json
{
  "logs": [
    {
      "timestamp": "2025-10-26T12:34:56.789Z",
      "type": "ban",
      "message": "Número REMOVIDO automaticamente: 5511999999999",
      "data": {
        "appId": "app_1",
        "reason": "Account has been disabled",
        "errorCode": 131031,
        "failedChecks": 3
      }
    }
  ],
  "total": 156
}
```

### Limpar Logs

**Request:**
```http
DELETE /api/logs
```

**Response (200)**:
```json
{
  "success": true
}
```

---

## 📊 Códigos de Resposta

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 400 | Requisição inválida (dados faltando ou incorretos) |
| 404 | Recurso não encontrado |
| 500 | Erro interno do servidor |

---

## 🔒 Autenticação

Atualmente, a API **não requer autenticação**. 

**Recomendações de Segurança:**
- Não exponha a URL publicamente
- Configure firewall/IP whitelist se necessário
- Considere adicionar Basic Auth ou API Key para produção

**Exemplo de Basic Auth** (se implementado):
```http
GET /api/apps
Authorization: Basic dXNlcjpwYXNzd29yZA==
```

---

## 📝 Exemplos de Uso

### cURL

**Obter número ativo:**
```bash
curl https://seu-app.onrender.com/api/get-active-number
```

**Adicionar app:**
```bash
curl -X POST https://seu-app.onrender.com/api/apps \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "app_1",
    "appName": "Meu App",
    "token": "EAAxxxxx",
    "phoneNumberId": "123456789"
  }'
```

**Executar health check:**
```bash
curl -X POST https://seu-app.onrender.com/api/health-check
```

### JavaScript (Fetch)

**Obter número ativo:**
```javascript
const response = await fetch('https://seu-app.onrender.com/api/get-active-number');
const data = await response.json();

if (data.success) {
  window.location.href = data.whatsappUrl;
}
```

**Adicionar app:**
```javascript
const response = await fetch('https://seu-app.onrender.com/api/apps', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    appId: 'app_1',
    appName: 'Meu App',
    token: 'EAAxxxxx',
    phoneNumberId: '123456789'
  })
});

const result = await response.json();
```

### Python (Requests)

**Obter número ativo:**
```python
import requests

response = requests.get('https://seu-app.onrender.com/api/get-active-number')
data = response.json()

if data['success']:
    print(f"WhatsApp URL: {data['whatsappUrl']}")
```

**Adicionar app:**
```python
import requests

response = requests.post(
    'https://seu-app.onrender.com/api/apps',
    json={
        'appId': 'app_1',
        'appName': 'Meu App',
        'token': 'EAAxxxxx',
        'phoneNumberId': '123456789'
    }
)

result = response.json()
```

### PHP

**Obter número ativo:**
```php
<?php
$response = file_get_contents('https://seu-app.onrender.com/api/get-active-number');
$data = json_decode($response, true);

if ($data['success']) {
    header('Location: ' . $data['whatsappUrl']);
}
?>
```

---

## 🔄 Rate Limiting

Atualmente, **não há rate limiting** implementado. 

Para ambientes de produção com alto tráfego, considere adicionar rate limiting usando `express-rate-limit`.

---

## 🐛 Erros Comuns

### "Nenhum número ativo disponível"

**Causa**: Todos os números estão inativos ou não há números cadastrados.

**Solução**: 
- Adicione números
- Execute health check manual
- Verifique se os tokens estão válidos

### "App não encontrado"

**Causa**: O `appId` fornecido não existe.

**Solução**: 
- Verifique se o app existe com `GET /api/apps`
- Use o `appId` correto

### "Número inválido"

**Causa**: O número não contém apenas dígitos.

**Solução**: 
- Use apenas números (sem +, espaços ou parênteses)
- Exemplo correto: `5511999999999`

---

## 📚 Recursos Adicionais

- [README.md](README.md) - Visão geral do projeto
- [DEPLOY.md](DEPLOY.md) - Guia de deploy no Render.com
- [WEBHOOKS.md](WEBHOOKS.md) - Configuração de notificações

---

**Need help?** Abra uma issue no GitHub!

