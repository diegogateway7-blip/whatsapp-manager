# ⚡ Teste Rápido em 3 Passos

## 🎯 Vamos Fazer Funcionar AGORA!

### **PASSO 1: Abrir Janela de 24h** ⏰

```
1. Abrir WhatsApp (seu celular: 5511999999999)
2. Enviar mensagem para: +55 66 3150-5656-4850
   
   Texto: "teste"
   
3. Aguardar ✓✓ (entregue)
```

✅ **Janela aberta!**

---

### **PASSO 2: Salvar Número Via API** 💾

Copie e cole no terminal (PowerShell no Windows):

```powershell
# Substitua SEU_TOKEN pelo token do print
$body = @{
    appId = "app_11"
    appName = "App 011"
    token = "EAAJ0wMyOudpABPZCLwQYO4ZLIKyGwKNH9YZi9pqywL3er8ifCb41EnDgaJjHL8E3ZCzqsqfVffXWJeZBDc6eHudouZBpDpOclztHYAs5wwWhpsmgnnbSlgnv6VwdiE5iVrL10Wkvf71p7jWpUiunJGxFbNe1hqZB78zTR1E0krxxtUUuoJKnUqTrrVaw5U8Qs9PwZDZD"
    phoneNumberId = "866315056564850"
    testPhoneNumber = "5511999999999"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://seu-app.onrender.com/api/apps" -Method POST -Body $body -ContentType "application/json"
```

**OU no Linux/Mac:**

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

✅ **Deve retornar:** `{"success": true, ...}`

---

### **PASSO 3: Forçar Teste Agora** 🚀

```bash
curl -X POST https://seu-app.onrender.com/api/health-check
```

**OU abra no navegador:**
```
https://seu-app.onrender.com/api/health-check
```

---

## 📱 Em 30 Segundos Você Deve Receber:

```
✅ NÚMERO ESTÁ ATIVO E FUNCIONANDO!

🤖 Health Check Automático
📱 Número testado com sucesso
⏰ 30/10/2025 14:30:15

_Sistema WhatsApp Manager_
```

---

## ❌ Se NÃO Receber:

### **Verificar logs do Render:**

1. Ir em https://dashboard.render.com
2. Abrir seu app
3. Clicar "Logs"
4. Procurar por:

```
📤 TESTE REAL: Enviando mensagem para 5511999999999
```

**Se NÃO aparecer:**
- Número não foi salvo
- Repetir PASSO 2

**Se aparecer MAS tiver erro:**
- Ver qual erro (#131047, #131026, etc)
- Seguir solução no TROUBLESHOOTING-MENSAGENS-TESTE.md

---

## 🎯 Verificação Rápida

**Ver se salvou:**
```bash
curl https://seu-app.onrender.com/api/apps | grep testPhoneNumber
```

**Deve aparecer:**
```json
"testPhoneNumber": "5511999999999"
```

---

## 💡 Dica

**Substitua em TODOS os comandos:**
- `seu-app.onrender.com` → URL real do seu Render
- `5511999999999` → Seu número real
- O token → Token real do print

---

**🚀 Faça isso e vai funcionar em 2 minutos!**

