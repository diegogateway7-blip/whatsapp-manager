# ✅ Como Configurar TODOS os Apps para Detectar Restrições

## 🎯 Objetivo

Garantir que **TODOS os apps** usem o método de **envio real de mensagem** para detectar contas restritas.

---

## 📋 Passo a Passo

### **PASSO 1: Listar Todos os Apps**

```bash
# Abra no navegador:
https://seu-app.onrender.com/api/apps
```

**Copie o JSON completo e identifique:**
- Quais apps têm `testPhoneNumber: null`
- Quais apps têm `testPhoneNumber: "número"`

---

### **PASSO 2: Preparar Comandos**

Para cada app que tem `testPhoneNumber: null`, prepare o comando:

```powershell
# Template:
Invoke-RestMethod -Uri "https://seu-app.onrender.com/api/apps" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"appId":"APP_ID","appName":"NOME_DO_APP","token":"TOKEN","phoneNumberId":"PHONE_ID","testPhoneNumber":"SEU_NUMERO"}'
```

**Substitua:**
- `APP_ID` → ID do app (ex: `app_01`)
- `NOME_DO_APP` → Nome (ex: `app 01`)
- `TOKEN` → Token do Meta Business
- `PHONE_ID` → Phone Number ID
- `SEU_NUMERO` → Seu número de teste (ex: `5511999999999`)

---

### **PASSO 3: Executar Comandos**

**Exemplo para seus apps:**

```powershell
# App 01
Invoke-RestMethod -Uri "https://seu-app.onrender.com/api/apps" -Method POST -ContentType "application/json" -Body '{"appId":"app_01","appName":"app 01","token":"TOKEN_AQUI","phoneNumberId":"PHONE_ID_AQUI","testPhoneNumber":"5511999999999"}'

# App 02
Invoke-RestMethod -Uri "https://seu-app.onrender.com/api/apps" -Method POST -ContentType "application/json" -Body '{"appId":"app_02","appName":"app 02","token":"TOKEN_AQUI","phoneNumberId":"PHONE_ID_AQUI","testPhoneNumber":"5511999999999"}'

# App 06
Invoke-RestMethod -Uri "https://seu-app.onrender.com/api/apps" -Method POST -ContentType "application/json" -Body '{"appId":"app_3","appName":"App 06","token":"TOKEN_AQUI","phoneNumberId":"PHONE_ID_AQUI","testPhoneNumber":"5511999999999"}'

# App 011
Invoke-RestMethod -Uri "https://seu-app.onrender.com/api/apps" -Method POST -ContentType "application/json" -Body '{"appId":"app_11","appName":"App 011","token":"TOKEN_AQUI","phoneNumberId":"PHONE_ID_AQUI","testPhoneNumber":"5511999999999"}'

# App 05
Invoke-RestMethod -Uri "https://seu-app.onrender.com/api/apps" -Method POST -ContentType "application/json" -Body '{"appId":"app_05","appName":"App 05","token":"TOKEN_AQUI","phoneNumberId":"PHONE_ID_AQUI","testPhoneNumber":"5511999999999"}'
```

---

### **PASSO 4: Abrir Janelas de 24h**

Para **CADA app**, envie mensagem para abrir janela:

| App | Número do App | Ação |
|-----|---------------|------|
| app 01 | Ver no JSON | Enviar "teste" |
| app 02 | Ver no JSON | Enviar "teste" |
| App 06 | +55 11 9208-26301 | Enviar "teste" |
| App 011 | +55 13 98228-0093 | Enviar "teste" |
| App 05 | +55 83 99849-1252 | Enviar "teste" |

**Do WhatsApp do número configurado como `testPhoneNumber`!**

---

### **PASSO 5: Forçar Health Check**

```bash
https://seu-app.onrender.com/api/health-check
```

---

### **PASSO 6: Verificar Logs**

Render Dashboard → Logs

**Deve aparecer para TODOS os apps:**
```
📱 Verificando [NOME] ([APP_ID])...
💡 Usando TESTE REAL por envio de mensagem
📤 TESTE REAL: Enviando mensagem para 5511999999999
```

**Se algum ainda mostrar:**
```
💡 Usando verificação por API
```
❌ Refaça os passos para esse app!

---

## 🎯 Checklist

```
[ ] Listei todos os apps via API
[ ] Identifiquei quais não têm testPhoneNumber
[ ] Executei comandos para adicionar testPhoneNumber
[ ] Verifiquei que foram salvos (GET /api/apps)
[ ] Enviei mensagem para TODOS os apps (abrir janela)
[ ] Forcei health check
[ ] Verifiquei logs - todos usando "TESTE REAL"
[ ] Recebi mensagens de teste no WhatsApp
```

---

## 📊 Resultado Esperado

### **Após Configuração Completa:**

**TODOS os apps nos logs:**
```
📱 Verificando app 01 (app_01)...
💡 Usando TESTE REAL por envio de mensagem
📤 TESTE REAL: Enviando mensagem para 5511999999999
✅ MENSAGEM ENVIADA! Número 100% funcional!

📱 Verificando app 02 (app_02)...
💡 Usando TESTE REAL por envio de mensagem
📤 TESTE REAL: Enviando mensagem para 5511999999999
❌ ERRO AO ENVIAR MENSAGEM
❌ Código do erro: 131031
❌ CONTA DESABILITADA/RESTRITA pelo WhatsApp
⚠️ EM QUARENTENA - INATIVO
```

**No dashboard:**
- ✅ Apps funcionando = Verde
- ❌ Apps restritos = Vermelho (quarentena)

---

## 💡 Dicas

### **Usar Mesmo Número de Teste:**
✅ Pode usar o mesmo número (ex: `5511999999999`) para TODOS os apps  
✅ Você vai receber mensagem de cada app  
✅ Fácil de gerenciar  

### **Renovação Diária:**
Todo dia enviar 1 mensagem para cada app mantém janelas ativas.

### **Automatizar:**
Criar script que:
1. Lista todos os apps
2. Para cada app sem testPhoneNumber
3. Adiciona automaticamente
4. Lembra de abrir janelas

---

## 🚀 Script Automatizado (Opcional)

```powershell
# Script para configurar todos os apps
$apps = Invoke-RestMethod -Uri "https://seu-app.onrender.com/api/apps"

foreach ($appId in $apps.PSObject.Properties.Name) {
    $app = $apps.$appId
    
    if (-not $app.testPhoneNumber) {
        Write-Host "Configurando $appId..." -ForegroundColor Yellow
        
        $body = @{
            appId = $appId
            appName = $app.appName
            token = $app.token
            phoneNumberId = $app.phoneNumberId
            testPhoneNumber = "5511999999999"
        } | ConvertTo-Json
        
        Invoke-RestMethod -Uri "https://seu-app.onrender.com/api/apps" `
            -Method POST `
            -Body $body `
            -ContentType "application/json"
        
        Write-Host "   ✅ Configurado!" -ForegroundColor Green
    } else {
        Write-Host "$appId já tem número de teste" -ForegroundColor Green
    }
}

Write-Host "`nTodos configurados! Agora abra as janelas de 24h." -ForegroundColor Cyan
```

---

**Depois de seguir todos os passos, o sistema vai detectar 100% das restrições! 🎯**


