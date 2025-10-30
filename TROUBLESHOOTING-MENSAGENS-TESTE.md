# 🔍 Troubleshooting: Por Que Não Estou Recebendo Mensagens de Teste?

## ✅ Melhorias Implementadas

### **Nova Mensagem (Muito Mais Clara!):**

Agora você vai receber:

```
✅ NÚMERO ESTÁ ATIVO E FUNCIONANDO!

🤖 Health Check Automático
📱 Número testado com sucesso
⏰ 30/10/2025 14:30:15

_Sistema WhatsApp Manager_
```

---

## 🔍 Por Que Não Recebo Mensagens? (Diagnóstico)

### **Possíveis Causas:**

1. ✅ **Número de teste não foi salvo no banco** (mais provável)
2. ✅ **Janela de 24h não foi aberta**
3. ✅ **App não encontrou o campo testPhoneNumber**
4. ✅ **Conta está restrita e não pode enviar**
5. ✅ **Health check não está rodando**

---

## 🧪 Teste 1: Verificar Se Número Foi Salvo

### **Via API (Mais Rápido):**

```bash
# Substitua pela URL do seu app
curl https://seu-app.onrender.com/api/apps
```

**Procure por:**
```json
{
  "app_11": {
    "appName": "App 011",
    "phoneNumberId": "866315056564850",
    "testPhoneNumber": "5511999999999",  ← DEVE APARECER AQUI!
    "lastMessageWindowRenewal": "2025-10-30T12:00:00Z"
  }
}
```

**Se `testPhoneNumber` for `null` ou não aparecer:**
❌ O número NÃO foi salvo!

---

## 🧪 Teste 2: Verificar Logs do Render

### **Acessar Logs:**

1. Ir em https://dashboard.render.com
2. Selecionar seu app
3. Clicar em "Logs"

### **Procurar Por:**

#### **Se número de teste está configurado:**
```bash
# Deve aparecer:
📱 Verificando App 011 (app_11)...
💡 Usando TESTE REAL por envio de mensagem
📤 TESTE REAL: Enviando mensagem para 5511999999999
```

#### **Se número NÃO está configurado:**
```bash
# Vai aparecer:
📱 Verificando App 011 (app_11)...
💡 Usando verificação por API (configure testPhoneNumber para teste real)
```

**Se aparecer "Usando verificação por API":**
❌ O número de teste NÃO está salvo no banco!

---

## 🔧 Solução: Como Salvar o Número Corretamente

### **Método 1: Via Dashboard (Recomendado)**

#### **Passo a Passo:**

1. **Abrir o app no dashboard**
2. **Clicar em "Editar" (✏️)**
3. **Rolar até "Número de Teste"**
4. **Preencher EXATAMENTE assim:**
   ```
   5511999999999
   
   ✅ SEM espaços
   ✅ SEM traços
   ✅ SEM parênteses
   ✅ SEM +
   ✅ Apenas números
   ✅ Código do país (55) + DDD + número
   ```
5. **Clicar em "Salvar" (💾)**
6. **Aguardar mensagem de confirmação**

---

### **Método 2: Via API Diretamente**

Se o dashboard não estiver salvando, use a API:

```bash
curl -X POST https://seu-app.onrender.com/api/apps \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "app_11",
    "appName": "App 011",
    "token": "SEU_TOKEN_AQUI",
    "phoneNumberId": "866315056564850",
    "testPhoneNumber": "5511999999999"
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "app": {
    "appId": "app_11",
    "testPhoneNumber": "5511999999999",
    ...
  }
}
```

---

### **Método 3: Verificar Diretamente no MongoDB**

Se você tem acesso ao MongoDB Atlas:

```javascript
// Conectar ao MongoDB Atlas
// Buscar o app
db.apps.findOne({ appId: "app_11" })

// Deve retornar:
{
  appId: "app_11",
  testPhoneNumber: "5511999999999",  ← Deve estar aqui!
  ...
}
```

**Se não aparecer:**
❌ Não foi salvo! Use Método 2 (API diretamente)

---

## 🚀 Passo a Passo Completo (Do Zero)

### **1. Preparar Janela de 24h:**

```
A. Abrir WhatsApp (seu número pessoal: 5511999999999)
B. Enviar mensagem para o número do app: +55 12 98299-2478
C. Texto: "Teste" (qualquer coisa)
D. Aguardar confirmação de entrega ✓✓
```

✅ **Janela aberta por 24 horas!**

---

### **2. Salvar Número de Teste no Sistema:**

```bash
# Via API (mais confiável se dashboard não funcionar):
curl -X POST https://seu-app.onrender.com/api/apps \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "app_11",
    "appName": "App 011",
    "token": "EAAJ0wMyOudpABPZCLwQYO4ZLIKyGwKNH9YZi9pqywL3er8ifCb41EnDgaJjHL8E3ZCzqsqfVffXWJeZBDc6eHudouZBpDpOclztHYAs5wwWhpsmgnnbSlgnv6VwdiE5iVrL10Wkvf71p7jWpUiunJGxFbNe1hqZB78zTR1E0krxxtUUuoJKnUqTrrVaw5U8Qs9PwZDZD",
    "phoneNumberId": "866315056564850",
    "testPhoneNumber": "5511999999999"
  }'
```

---

### **3. Forçar Health Check Manual:**

```bash
curl -X POST https://seu-app.onrender.com/api/health-check
```

---

### **4. Verificar Logs em Tempo Real:**

```
Render Dashboard > Logs

Deve aparecer em até 30 segundos:
📱 Verificando App 011 (app_11)...
💡 Usando TESTE REAL por envio de mensagem
📤 TESTE REAL: Enviando mensagem para 5511999999999
✅ MENSAGEM ENVIADA! Número 100% funcional!
```

---

### **5. Verificar WhatsApp:**

Você deve receber:

```
✅ NÚMERO ESTÁ ATIVO E FUNCIONANDO!

🤖 Health Check Automático
📱 Número testado com sucesso
⏰ 30/10/2025 14:30:15

_Sistema WhatsApp Manager_
```

---

## ❌ Erros Comuns e Soluções

### **Erro: #131047 - Janela de 24h expirou**

```
❌ Logs mostram:
Erro ao enviar mensagem (#131047)
```

**Solução:**
1. Enviar mensagem do seu número para o app novamente
2. Aguardar 1 minuto
3. Rodar health check manual
4. Deve funcionar ✅

---

### **Erro: #131026 - Número de destino inválido**

```
❌ Logs mostram:
Número de destino inválido ou não tem WhatsApp
```

**Possíveis causas:**
- Número errado
- Número não tem WhatsApp
- Formatação incorreta

**Solução:**
```bash
# Verificar formato:
✅ Correto: 5511999999999
❌ Errado: +55 11 99999-9999
❌ Errado: 11999999999 (sem código do país)
❌ Errado: +5511999999999 (com +)
```

---

### **Erro: #131031 - Conta restrita**

```
❌ Logs mostram:
CONTA DESABILITADA/RESTRITA pelo WhatsApp
```

**Solução:**
1. Verificar no Meta Business Manager
2. Se conta realmente está restrita → Não pode testar
3. Usar outro app que não esteja restrito

---

## 🔍 Debug Detalhado

### **Script de Teste Completo:**

Salve como `test-api.sh`:

```bash
#!/bin/bash

echo "🔍 TESTE 1: Verificando se número está salvo..."
curl -s https://seu-app.onrender.com/api/apps | grep -A 5 "app_11"

echo "\n\n🔍 TESTE 2: Forçando health check..."
curl -s -X POST https://seu-app.onrender.com/api/health-check

echo "\n\n🔍 TESTE 3: Verificando status..."
curl -s https://seu-app.onrender.com/api/status

echo "\n\n✅ Testes concluídos! Verifique os logs acima."
```

Execute:
```bash
chmod +x test-api.sh
./test-api.sh
```

---

## 📱 Formato do Número de Teste

### **Exemplos Corretos:**

| País | Número Completo | Formato Correto |
|------|----------------|-----------------|
| Brasil | +55 11 99999-9999 | `5511999999999` |
| Brasil | +55 12 98299-2478 | `5512982992478` |
| EUA | +1 555 123-4567 | `15551234567` |

### **Regra:**
```
CodigoPais + DDD + Numero
SEM: +, espaços, traços, parênteses
APENAS: números
```

---

## 🎯 Checklist Final

Antes de desistir, confirme:

- [ ] Enviou mensagem do número teste para o app (abrir janela 24h)
- [ ] Salvou número de teste no formato correto (só números)
- [ ] Verificou via API se número foi salvo (`testPhoneNumber` presente)
- [ ] Esperou pelo menos 15 minutos (próximo health check automático)
- [ ] OU forçou health check manual
- [ ] Verificou logs do Render para ver se tentou enviar
- [ ] Verificou se conta não está restrita no Meta Business

---

## 🚀 Se Nada Funcionar

### **Última Tentativa - Via MongoDB Direto:**

1. Acessar MongoDB Atlas
2. Ir no banco de dados
3. Coleção `apps`
4. Encontrar documento com `appId: "app_11"`
5. Editar manualmente:
   ```json
   {
     "appId": "app_11",
     "testPhoneNumber": "5511999999999",
     "lastMessageWindowRenewal": "2025-10-30T12:00:00.000Z"
   }
   ```
6. Salvar
7. Reiniciar app no Render

---

## 📊 Como Confirmar Que Está Funcionando

### **Sinais de Sucesso:**

✅ Logs mostram: "TESTE REAL: Enviando mensagem"  
✅ Logs mostram: "MENSAGEM ENVIADA! Número 100% funcional!"  
✅ Você recebe mensagem no WhatsApp  
✅ Mensagem tem timestamp atual  
✅ Mensagem vem do número do app  

### **Depois de Funcionar:**

- Vai receber mensagem a cada 15 minutos (health check automático)
- Se número estiver ativo, sempre funciona
- Se der erro, número vai para quarentena
- Você é notificado de problemas

---

## 💡 Próximos Passos

Uma vez funcionando:

1. **Configurar todos os apps** com número de teste
2. **Renovar janela diariamente** (1 mensagem por app)
3. **Monitorar mensagens** que chegam
4. **Aproveitar detecção 100% confiável!**

---

## 🆘 Ainda Não Funciona?

**Me envie:**
1. Resposta de: `curl https://seu-app.onrender.com/api/apps`
2. Últimas 50 linhas dos logs do Render
3. Screenshot do formulário de edição do app
4. Confirmação de que enviou mensagem para abrir janela

Com isso posso identificar exatamente o problema! 🔍

