# 🚀 Guia Completo de Deploy no Render.com
## Garantia de 100% de Funcionamento

Siga cada passo com atenção. Tempo estimado: **10-15 minutos**

---

## ✅ CHECKLIST ANTES DE COMEÇAR

- [x] Código no GitHub (https://github.com/diegogateway7-blip/whatsapp-manager)
- [x] Conta no Render.com criada
- [x] Token do Meta Business em mãos
- [x] Phone Number ID em mãos

---

## 🌐 PASSO 1: Criar Conta no Render.com

1. Acesse: **https://render.com**
2. Clique em **"Get Started for Free"**
3. Escolha **"Sign up with GitHub"** (mais fácil)
4. Autorize o Render a acessar seus repositórios

✅ **Pronto!** Agora você tem uma conta Render.

---

## 📦 PASSO 2: Criar Web Service

### 2.1 - Iniciar Criação

1. No dashboard do Render, clique em **"New +"** (canto superior direito)
2. Selecione **"Web Service"**

### 2.2 - Conectar Repositório

Se primeira vez conectando GitHub:
- Clique em **"Connect GitHub"**
- Autorize o Render
- Você pode dar acesso a todos repos ou só ao whatsapp-manager

Se já conectou:
- Procure por **"whatsapp-manager"** na lista
- Clique em **"Connect"** ao lado do repositório

### 2.3 - Configurar o Service

**Preencha os campos:**

```
┌─────────────────────────────────────────────┐
│ Name: whatsapp-manager                      │
│ (ou qualquer nome que preferir)             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Region: Oregon (US West)                    │
│ (escolha o mais próximo de você)            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Branch: main                                │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Root Directory: (deixe em branco)           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Runtime: Node                               │
│ (detectado automaticamente)                 │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Build Command: npm install                  │
│ (já preenchido automaticamente)             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Start Command: npm start                    │
│ (já preenchido automaticamente)             │
└─────────────────────────────────────────────┘
```

### 2.4 - Escolher Plano

**Selecione: Free** 🆓

Características do Free:
- ✅ 750 horas/mês (suficiente!)
- ✅ 512 MB RAM
- ✅ SSL automático
- ⚠️ Dorme após 15min inatividade
- ⚠️ Cold start ~30s

**Dica**: Se quiser que fique sempre ativo (sem sleep):
- Upgrade para **Starter**: $7/mês
- Melhor para produção

### 2.5 - Expandir "Advanced"

Role para baixo e clique em **"Advanced"**

Configure:
```
┌─────────────────────────────────────────────┐
│ Health Check Path: /health                  │
│ (IMPORTANTE!)                               │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Auto-Deploy: Yes (deixe marcado)            │
│ (deploy automático quando push no GitHub)   │
└─────────────────────────────────────────────┘
```

### 2.6 - Criar o Service

Clique em **"Create Web Service"** (botão azul no final)

🎉 **Deploy iniciado!** Aguarde 2-5 minutos.

---

## 💾 PASSO 3: Adicionar Disco Persistente (CRUCIAL!)

⚠️ **MUITO IMPORTANTE**: Sem o disco, seus dados serão perdidos a cada deploy!

### 3.1 - Aguardar Deploy Inicial

- Aguarde até ver **"Live"** em verde no topo
- Ou aguarde até os logs pararem de rolar

### 3.2 - Acessar Configurações

1. No seu web service, clique na aba **"Settings"** (menu lateral esquerdo)
2. Role para baixo até a seção **"Disks"**

### 3.3 - Adicionar Disco

Clique em **"Add Disk"**

Preencha exatamente assim:
```
┌─────────────────────────────────────────────┐
│ Name: data                                  │
│ (exatamente assim, minúsculo)               │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Mount Path:                                 │
│ /opt/render/project/src/data                │
│ (copie e cole exatamente assim)             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Size: 1 GB                                  │
│ (suficiente para milhares de números)       │
└─────────────────────────────────────────────┘
```

### 3.4 - Salvar

1. Clique em **"Save"**
2. Render vai **redeploy automaticamente** (aguarde 2-3 minutos)

✅ **Disco adicionado!** Seus dados agora serão persistidos.

---

## 🔐 PASSO 4: Configurar Webhook (OPCIONAL)

Se quiser receber notificações quando números forem banidos:

1. Clique na aba **"Environment"** (menu lateral)
2. Clique em **"Add Environment Variable"**
3. Preencha:
   ```
   Key: WEBHOOK_URL
   Value: https://seu-webhook.com/notify
   ```
4. Clique em **"Save Changes"**

**Webhooks suportados:**
- Discord: `https://discord.com/api/webhooks/xxx`
- Slack: `https://hooks.slack.com/services/xxx`
- Make.com: `https://hook.us1.make.com/xxx`
- N8N: `https://seu-n8n.com/webhook/alerts`

📖 Veja [WEBHOOKS.md](WEBHOOKS.md) para configuração detalhada.

---

## ✅ PASSO 5: Verificar se Está Funcionando

### 5.1 - Acessar a Aplicação

1. No topo do seu service, copie a **URL** (algo como `https://whatsapp-manager-xxxx.onrender.com`)
2. Cole no navegador
3. **Você deve ver o dashboard!** 🎉

### 5.2 - Verificar Logs

1. Clique na aba **"Logs"** (menu lateral)
2. Você deve ver:
   ```
   🚀 ========== WHATSAPP MANAGER INICIADO ==========
   📡 Servidor rodando na porta 3000
   🌐 URL: https://whatsapp-manager-xxxx.onrender.com
   📊 Dashboard: https://whatsapp-manager-xxxx.onrender.com
   🔗 API: https://whatsapp-manager-xxxx.onrender.com/api
   ⏰ Health Check: */15 * * * *
   💾 Backup: 0 */6 * * *
   📱 Apps cadastrados: 0
   ================================================
   ```

✅ Se você ver isso, **está tudo funcionando perfeitamente!**

---

## 📱 PASSO 6: Adicionar Primeiro App

### 6.1 - Obter Credenciais do Meta

Antes de adicionar, você precisa:

1. **Token Permanente:**
   - Acesse: https://developers.facebook.com
   - Vá no seu app
   - Configurações > Básico > Token de Acesso ao Sistema
   - Copie o token (começa com EAA...)

2. **Phone Number ID:**
   - No mesmo app, vá em WhatsApp > Configurações da API
   - Copie o "ID do número de telefone"

### 6.2 - Adicionar no Dashboard

1. Acesse o dashboard: `https://seu-app.onrender.com`
2. Clique em **"➕ Adicionar App"**
3. Preencha:
   ```
   App ID: app_1
   Nome do App: Meu App Principal
   Token Permanente: EAAxxxxx... (cole aqui)
   Phone Number ID: 123456789 (cole aqui)
   ```
4. Clique em **"💾 Salvar"**

✅ **App adicionado!**

### 6.3 - Adicionar Números

1. No card do app criado, clique em **"➕ Adicionar Número"**
2. Digite o número com código do país (ex: `5511999999999`)
3. Clique em **"💾 Adicionar"**

✅ **Número adicionado!**

### 6.4 - Executar Health Check

1. Clique no botão **"🔍 Health Check"** no topo
2. Confirme
3. Aguarde ~10-30 segundos
4. Veja os logs em **Logs do Sistema**

✅ Se o número aparece como **"✅ Ativo"**, está funcionando!

---

## 🧪 PASSO 7: Testar a API

### 7.1 - Testar no Navegador

Cole no navegador (substitua pela sua URL):
```
https://seu-app.onrender.com/api/get-active-number
```

**Resposta esperada:**
```json
{
  "success": true,
  "number": "5511999999999",
  "whatsappUrl": "https://wa.me/5511999999999",
  "totalActive": 1,
  "app": "app_1",
  "appName": "Meu App Principal"
}
```

✅ Se recebeu isso, **API funcionando perfeitamente!**

### 7.2 - Testar no WhatsApp

1. No dashboard, clique no ícone **💬** ao lado do número
2. Deve abrir o WhatsApp Web
3. Se abrir a conversa, está funcionando!

---

## 🔗 PASSO 8: Integrar com Typebot

### 8.1 - No Typebot

1. Adicione um bloco **"HTTP Request"**
2. Configure:
   ```
   Method: GET
   URL: https://seu-app.onrender.com/api/get-active-number
   ```
3. Salve em variável: `whatsappResponse`

### 8.2 - Extrair URL

1. Crie variável: `whatsappUrl`
2. Valor: `{{whatsappResponse.whatsappUrl}}`

### 8.3 - Redirecionar

1. Adicione bloco **"Redirect"**
2. URL: `{{whatsappUrl}}`

✅ **Typebot integrado!** Agora cada usuário será redirecionado para um número ativo aleatório.

---

## 📊 Monitoramento Contínuo

### Ver Logs em Tempo Real

1. No Render, vá para **"Logs"**
2. Deixe aberto para ver:
   - Health checks automáticos (a cada 15min)
   - Números banidos
   - Números recuperados
   - Erros

### Métricas

1. Vá para **"Metrics"**
2. Veja:
   - CPU usage
   - Memory usage
   - Response time
   - Bandwidth

---

## 🆘 TROUBLESHOOTING

### ❌ Erro: "Application failed to respond"

**Causa**: Service não iniciou corretamente.

**Solução:**
1. Veja os logs para erros
2. Verifique se `package.json` tem `"start": "node server.js"`
3. Tente "Manual Deploy" novamente

### ❌ Dados sendo perdidos

**Causa**: Disco não foi adicionado corretamente.

**Solução:**
1. Vá em Settings > Disks
2. Verifique se o disco está lá
3. Mount Path DEVE ser: `/opt/render/project/src/data`
4. Redeploy o service

### ❌ Health Check falhando

**Causa**: Token ou Phone Number ID inválido.

**Solução:**
1. Vá no Meta Business
2. Gere novo token
3. Verifique o Phone Number ID
4. Edite o app no dashboard
5. Execute health check novamente

### ❌ Service está "Sleeping"

**Causa**: Plano Free dorme após 15min inatividade.

**Solução Temporária:**
- Use UptimeRobot (gratuito) para fazer ping a cada 5min
- URL para ping: `https://seu-app.onrender.com/health`

**Solução Permanente:**
- Upgrade para Starter ($7/mês)

### ❌ "No active numbers available"

**Causa**: Todos os números estão inativos.

**Solução:**
1. Execute health check manual
2. Veja os logs de erro
3. Corrija tokens/credenciais
4. Adicione mais números

---

## ✅ CHECKLIST FINAL

- [x] Service está "Live" (verde)
- [ ] Disco persistente adicionado (1 GB)
- [x] Dashboard abre no navegador
- [x] Pelo menos 1 app adicionado
- [x] Pelo menos 1 número adicionado
- [x] Health check executado com sucesso
- [x] API `/api/get-active-number` retorna número
- [x] Logs mostram "Sistema iniciado"

---

## 🎉 PRONTO!

Seu WhatsApp Manager está **100% funcional** no Render.com!

### URLs Importantes:

- **Dashboard**: `https://seu-app.onrender.com`
- **API Status**: `https://seu-app.onrender.com/api/status`
- **Get Number**: `https://seu-app.onrender.com/api/get-active-number`
- **Health**: `https://seu-app.onrender.com/health`
- **Logs**: Render Dashboard > Logs

### O que acontece agora:

✅ **A cada 15 minutos**: Health check automático
✅ **A cada 6 horas**: Backup automático
✅ **Quando número cai**: Entra em quarentena
✅ **Após 3 falhas**: Removido automaticamente
✅ **Quando recupera**: Notificado e reativado

---

## 📞 Suporte

**Problemas?**
1. Veja os logs no Render
2. Consulte [README.md](README.md)
3. Consulte [API.md](API.md)
4. Abra issue no GitHub

---

**Made with ❤️ - WhatsApp Manager v2.0.0**

