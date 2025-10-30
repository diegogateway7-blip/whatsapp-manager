# 🔍 Diagnóstico: Por Que a Mensagem Não Chega?

## 🎯 Problema Reportado

- ✅ Health check marca números como ATIVOS
- ❌ Mensagem NÃO chega no WhatsApp
- 🤔 Sistema pode estar usando método ANTIGO (API) ao invés de enviar mensagem

---

## 📊 Como o Sistema Decide Qual Método Usar

### **Lógica no Código (linha 650):**

```javascript
if (app.testPhoneNumber) {
  // ✅ TEM número de teste salvo
  console.log('Usando TESTE REAL por envio de mensagem');
  result = await checkWhatsAppNumberByMessageSend(...);
  // → ENVIA MENSAGEM REAL para você
} else {
  // ❌ NÃO TEM número de teste salvo
  console.log('Usando verificação por API');
  result = await checkWhatsAppNumber(...);
  // → SÓ VERIFICA pela API (não envia mensagem)
}
```

---

## 🔍 Diagnóstico em 3 Passos

### **PASSO 1: Verificar Logs do Render**

Acesse: https://dashboard.render.com → Seu App → Logs

**Procure por uma destas mensagens:**

#### **Se aparecer ISTO:**
```
📱 Verificando App 011 (app_11)...
💡 Usando TESTE REAL por envio de mensagem
📤 TESTE REAL: Enviando mensagem para 5511999999999
```
✅ **Sistema está tentando enviar!**  
→ Problema é outro (janela expirada, conta restrita, etc)

#### **Se aparecer ISTO:**
```
📱 Verificando App 011 (app_11)...
💡 Usando verificação por API (configure testPhoneNumber para teste real)
```
❌ **Sistema está usando método ANTIGO!**  
→ `testPhoneNumber` não está salvo no banco!

---

### **PASSO 2: Verificar Banco de Dados**

**Via API (Mais Rápido):**

Abra no navegador ou terminal:
```
https://seu-app.onrender.com/api/apps
```

**Procure pelo seu app:**
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

**Verificações:**
- ❌ Se `testPhoneNumber: null` → Não está salvo!
- ❌ Se campo `testPhoneNumber` não aparecer → Não está salvo!
- ✅ Se `testPhoneNumber: "5511999999999"` → Está salvo!

---

### **PASSO 3: Forçar Salvamento do Número**

Se o número NÃO estiver salvo, use este comando:

**Windows (PowerShell):**
```powershell
$body = @{
    appId = "app_11"
    appName = "App 011"
    token = "EAAJ0wMyOudpABPZCLwQYO4ZLIKyGwKNH9YZi9pqywL3er8ifCb41EnDgaJjHL8E3ZCzqsqfVffXWJeZBDc6eHudouZBpDpOclztHYAs5wwWhpsmgnnbSlgnv6VwdiE5iVrL10Wkvf71p7jWpUiunJGxFbNe1hqZB78zTR1E0krxxtUUuoJKnUqTrrVaw5U8Qs9PwZDZD"
    phoneNumberId = "866315056564850"
    testPhoneNumber = "5511999999999"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://seu-app.onrender.com/api/apps" -Method POST -Body $body -ContentType "application/json"
```

**Linux/Mac:**
```bash
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

## 🧪 Teste Completo

### **Após Salvar o Número:**

1. **Abrir janela de 24h:**
   ```
   Do seu WhatsApp (5511999999999):
   → Enviar mensagem para: +55 66 3150-5656-4850
   → Texto: "teste"
   → Aguardar ✓✓
   ```

2. **Forçar health check:**
   ```
   https://seu-app.onrender.com/api/health-check
   ```

3. **Verificar logs:**
   ```
   Render Dashboard → Logs
   
   Deve aparecer:
   📱 Verificando App 011 (app_11)...
   💡 Usando TESTE REAL por envio de mensagem
   📤 TESTE REAL: Enviando mensagem para 5511999999999
   ✅ MENSAGEM ENVIADA! Número 100% funcional!
   ```

4. **Verificar WhatsApp:**
   ```
   Você deve receber:
   "✅ Número ativo - 30/10/2025 14:30:15"
   ```

---

## ❌ Possíveis Erros e Soluções

### **Erro 1: Logs Mostram "Usando verificação por API"**

**Causa:** `testPhoneNumber` não está salvo

**Solução:**
1. Executar comando do PASSO 3
2. Verificar novamente via API
3. Confirmar que aparece no JSON

---

### **Erro 2: Logs Mostram "Enviando mensagem" MAS Você Não Recebe**

**Causa:** Janela de 24h expirada

**Logs vão mostrar:**
```
❌ ERRO AO ENVIAR MENSAGEM: Request failed with status code 403
❌ Código do erro: 131047
❌ Mensagem: Erro ao enviar mensagem (#131047)
```

**Solução:**
1. Enviar mensagem do seu número para o app
2. Aguardar 1 minuto
3. Forçar health check novamente

---

### **Erro 3: Logs Mostram "Enviando mensagem" E Erro #131031**

**Causa:** Conta está restrita

**Logs vão mostrar:**
```
❌ Código do erro: 131031
❌ Mensagem: CONTA DESABILITADA/RESTRITA pelo WhatsApp
```

**Solução:**
1. Verificar Meta Business Manager
2. Ver se conta está com restrição
3. Se sim, não tem como testar com esse app

---

### **Erro 4: Número Formatado Errado**

**Errado:**
- ❌ `+5511999999999` (com +)
- ❌ `11999999999` (sem código do país)
- ❌ `55 11 99999-9999` (com espaços)

**Correto:**
- ✅ `5511999999999` (só números)

---

## 🎯 Checklist de Diagnóstico

Marque conforme verifica:

```
[ ] 1. Verificou logs do Render
    [ ] Mostra "Usando TESTE REAL"? → Sim/Não
    [ ] Mostra "Enviando mensagem para..."? → Sim/Não
    [ ] Mostra erro? → Qual código?

[ ] 2. Verificou API /api/apps
    [ ] Campo testPhoneNumber aparece? → Sim/Não
    [ ] Valor correto? → Sim/Não

[ ] 3. Abriu janela de 24h
    [ ] Enviou mensagem do seu número? → Sim/Não
    [ ] Mensagem foi entregue ✓✓? → Sim/Não

[ ] 4. Forçou health check manual
    [ ] Executou? → Sim/Não
    [ ] Aguardou 30 segundos? → Sim/Não

[ ] 5. Verificou WhatsApp
    [ ] Recebeu mensagem? → Sim/Não
```

---

## 💡 Script de Diagnóstico Automático

Crie arquivo `diagnostico.ps1` (Windows) ou `diagnostico.sh` (Linux/Mac):

**Windows:**
```powershell
Write-Host "=== DIAGNÓSTICO WHATSAPP MANAGER ===" -ForegroundColor Cyan

Write-Host "`n1. Verificando se número está salvo..." -ForegroundColor Yellow
$apps = Invoke-RestMethod -Uri "https://seu-app.onrender.com/api/apps"
$app11 = $apps.app_11

if ($app11.testPhoneNumber) {
    Write-Host "   ✅ Número salvo: $($app11.testPhoneNumber)" -ForegroundColor Green
} else {
    Write-Host "   ❌ Número NÃO está salvo!" -ForegroundColor Red
    Write-Host "   → Execute o comando do PASSO 3 para salvar" -ForegroundColor Yellow
    exit
}

Write-Host "`n2. Forçando health check..." -ForegroundColor Yellow
$result = Invoke-RestMethod -Uri "https://seu-app.onrender.com/api/health-check" -Method POST
Write-Host "   ✅ Health check executado!" -ForegroundColor Green

Write-Host "`n3. Aguardando 30 segundos..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host "`n4. Verificando logs..." -ForegroundColor Yellow
Write-Host "   → Acesse: https://dashboard.render.com" -ForegroundColor Cyan
Write-Host "   → Procure por: 'TESTE REAL: Enviando mensagem'" -ForegroundColor Cyan

Write-Host "`n5. Verificando seu WhatsApp..." -ForegroundColor Yellow
Write-Host "   → Você deve ter recebido: '✅ Número ativo - [timestamp]'" -ForegroundColor Cyan

Write-Host "`n=== DIAGNÓSTICO CONCLUÍDO ===" -ForegroundColor Cyan
```

**Execute:**
```powershell
.\diagnostico.ps1
```

---

## 📞 Resultado Esperado

### **Fluxo Completo de Sucesso:**

```
1. testPhoneNumber salvo no banco ✅
   ↓
2. Janela de 24h aberta ✅
   ↓
3. Health check executado ✅
   ↓
4. Logs mostram "TESTE REAL: Enviando mensagem" ✅
   ↓
5. Logs mostram "MENSAGEM ENVIADA!" ✅
   ↓
6. Você recebe no WhatsApp ✅
```

---

## 🆘 Se Nada Funcionar

**Me envie:**

1. **Resposta da API:**
   ```
   https://seu-app.onrender.com/api/apps
   (copie e cole o JSON completo)
   ```

2. **Logs do Render:**
   ```
   Últimas 100 linhas após executar health check
   ```

3. **Confirmação:**
   ```
   - Enviou mensagem para abrir janela? Sim/Não
   - Mensagem foi entregue ✓✓? Sim/Não
   - Formato do número de teste: _______
   ```

Com essas informações consigo identificar exatamente o problema! 🔍

---

**🎯 99% de chance: testPhoneNumber não está salvo no banco!**

