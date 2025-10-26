# 🚀 Guia de Deploy no Render.com

Este guia passo a passo mostra como fazer deploy do WhatsApp Manager no Render.com.

## 📋 Pré-requisitos

- Conta no GitHub
- Conta no Render.com (gratuita)
- Repositório com o código (fork ou clone deste projeto)

## 🔧 Passo 1: Preparar o Repositório

1. **Fork ou Clone este repositório**

```bash
git clone https://github.com/seu-usuario/whatsapp-manager.git
cd whatsapp-manager
```

2. **Faça commit e push para seu GitHub**

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

## 🌐 Passo 2: Criar Web Service no Render

1. **Acesse Render.com**
   - Vá para https://render.com
   - Faça login com sua conta

2. **Criar Novo Web Service**
   - Clique em "New +" → "Web Service"
   - Conecte sua conta do GitHub se ainda não conectou
   - Selecione o repositório `whatsapp-manager`
   - Clique em "Connect"

3. **Configurar o Web Service**

   **Informações Básicas**:
   - **Name**: `whatsapp-manager` (ou qualquer nome que preferir)
   - **Region**: Escolha o mais próximo (ex: Oregon)
   - **Branch**: `main`
   - **Root Directory**: (deixe em branco)

   **Build & Deploy**:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

   **Plan**:
   - Selecione **Free** (ou Starter se preferir)

4. **Configurar Health Check**
   - Em "Advanced" → "Health Check Path"
   - Digite: `/health`

## 💾 Passo 3: Configurar Disco Persistente

**⚠️ IMPORTANTE**: Sem o disco persistente, seus dados serão perdidos a cada deploy!

1. **Após criar o service**, vá para "Settings" do seu web service

2. **Na seção "Disks"**, clique em "Add Disk"

3. **Configure o disco**:
   - **Name**: `data`
   - **Mount Path**: `/opt/render/project/src/data`
   - **Size**: `1 GB` (suficiente para a maioria dos casos)

4. **Salvar**
   - Clique em "Save"
   - O service será redeploy automaticamente

## 🔐 Passo 4: Configurar Variáveis de Ambiente (Opcional)

1. **No seu web service**, vá para "Environment"

2. **Adicionar Variável (opcional)**:
   - **Key**: `WEBHOOK_URL`
   - **Value**: `https://seu-webhook.com/notify`
   - Clique em "Add"

   > 📝 **Nota**: O `WEBHOOK_URL` é opcional. Configure se você quiser receber notificações via Discord, Slack, Make.com, etc. Veja [WEBHOOKS.md](WEBHOOKS.md) para mais detalhes.

3. **Outras variáveis** (geralmente não precisa alterar):
   - `PORT`: Render define automaticamente
   - `NODE_ENV`: Já está como `production` no render.yaml

## ✅ Passo 5: Deploy

1. **Deploy Automático**
   - O deploy inicia automaticamente
   - Aguarde alguns minutos
   - Acompanhe os logs em tempo real

2. **Verificar Deploy**
   - Quando completar, você verá "Live" em verde
   - Clique na URL gerada (algo como `https://whatsapp-manager-xxxx.onrender.com`)

3. **Testar a Aplicação**
   - Acesse a URL
   - Você deve ver o dashboard
   - Adicione um app para testar

## 🎯 Passo 6: Configurar Auto-Deploy (Opcional)

Por padrão, Render faz deploy automaticamente quando você faz push para o GitHub.

**Para desabilitar auto-deploy**:
1. Settings → "Build & Deploy"
2. Desmarque "Auto-Deploy"

**Para fazer deploy manual**:
1. Clique em "Manual Deploy"
2. Selecione a branch
3. Clique em "Deploy"

## 📊 Passo 7: Usar a Aplicação

### Adicionar Apps e Números

1. **Acesse o dashboard**: `https://seu-app.onrender.com`

2. **Adicionar App**:
   - Clique em "Adicionar App"
   - Preencha:
     - **App ID**: `app_1`
     - **Nome**: `Meu App Principal`
     - **Token**: Token do Meta Business
     - **Phone Number ID**: ID do número no Meta

3. **Adicionar Números**:
   - No card do app, clique "Adicionar Número"
   - Digite o número com código do país (ex: `5511999999999`)

4. **Health Check Automático**:
   - O sistema verifica automaticamente a cada 15 minutos
   - Ou clique em "Health Check" para verificar manualmente

### Integrar com Typebot

1. **No Typebot**, adicione um bloco "HTTP Request"

2. **Configure**:
   - **Method**: GET
   - **URL**: `https://seu-app.onrender.com/api/get-active-number`
   - **Save response in variable**: `whatsappResponse`

3. **Extrair o link**:
   - Crie uma variável: `whatsappUrl`
   - Valor: `{{whatsappResponse.whatsappUrl}}`

4. **Redirecionar usuário**:
   - Use "Redirect" block
   - URL: `{{whatsappUrl}}`

## 🔍 Monitoramento

### Ver Logs em Tempo Real

1. No Render, vá para "Logs" do seu service
2. Você verá todos os logs em tempo real:
   - Health checks
   - Números banidos
   - Números recuperados
   - Etc.

### Métricas

1. Vá para "Metrics"
2. Veja:
   - CPU usage
   - Memory usage
   - Response time
   - Etc.

## 🐛 Troubleshooting

### Erro: "Out of Memory"

**Solução**: Upgrade para o plano Starter ($7/mês) que tem mais memória.

### Disco não está persistindo

**Verifique**:
1. Disco está criado em "Settings" → "Disks"?
2. Mount Path está correto? `/opt/render/project/src/data`
3. Aguarde o redeploy após criar o disco

### Health checks falhando

**Verifique**:
1. O endpoint `/health` está respondendo?
2. Teste manualmente: `curl https://seu-app.onrender.com/health`
3. Verifique os logs para erros

### Apps não estão carregando

**Verifique**:
1. O disco está montado corretamente?
2. Olhe os logs: há erros ao carregar `database.json`?
3. Tente adicionar um app manualmente pelo dashboard

### Timeout no Health Check

**Possíveis causas**:
1. Token do Meta inválido
2. Phone Number ID incorreto
3. Rate limit da API do Meta
4. Internet lenta

**Solução**:
- Verifique as credenciais
- Aguarde alguns minutos (rate limit)
- Verifique os logs para detalhes do erro

### Service está "Sleeping"

No plano Free, o service "dorme" após 15 minutos de inatividade.

**Soluções**:
1. **Upgrade para Starter** ($7/mês) - melhor opção
2. **Use um keep-alive service** como:
   - UptimeRobot (https://uptimerobot.com) - gratuito
   - Configure para fazer ping a cada 5 minutos em `/health`

**⚠️ Importante**: Se usar keep-alive no plano Free, o health check automático pode não rodar durante o sleep.

### Webhook não está funcionando

**Verifique**:
1. `WEBHOOK_URL` está configurada em "Environment"?
2. A URL está correta?
3. O endpoint aceita POST com JSON?
4. Teste com webhook.site primeiro

## 🔄 Atualizar a Aplicação

### Via Git (Recomendado)

```bash
# Fazer mudanças no código
git add .
git commit -m "Descrição das mudanças"
git push origin main

# Render faz deploy automaticamente
```

### Manual no Render

1. Vá para seu service
2. Clique em "Manual Deploy"
3. Selecione a branch
4. Clique em "Deploy"

## 💰 Custos

### Plano Free
- ✅ Grátis para sempre
- ✅ 750 horas/mês (suficiente)
- ✅ 512 MB RAM
- ✅ 1 GB disco (nosso caso)
- ⚠️ Service "dorme" após inatividade
- ⚠️ Build pode ser mais lento

### Plano Starter ($7/mês)
- ✅ Sempre ativo (sem sleep)
- ✅ 512 MB RAM
- ✅ Build mais rápido
- ✅ Melhor para produção

**Recomendação**: Comece com Free para testar, depois upgrade para Starter quando for usar em produção.

## 🔐 Segurança

### Recomendações

1. **Adicione autenticação** se for expor publicamente
2. **Use HTTPS** (Render já fornece)
3. **Não compartilhe** a URL publicamente
4. **Rotacione tokens** periodicamente
5. **Monitore** os logs regularmente

### Adicionar Basic Auth (Opcional)

Se quiser proteger o dashboard com usuário/senha:

1. **Instale o pacote**:
```bash
npm install express-basic-auth
```

2. **No server.js**, adicione:
```javascript
const basicAuth = require('express-basic-auth');

// Depois dos middlewares
app.use(basicAuth({
  users: { 
    'admin': process.env.ADMIN_PASSWORD || 'changeme123'
  },
  challenge: true
}));
```

3. **Configure no Render**:
   - Environment: `ADMIN_PASSWORD=sua-senha-forte`

## 📞 Suporte

**Problemas com Render.com?**
- Docs: https://render.com/docs
- Community: https://community.render.com
- Support: https://render.com/support

**Problemas com a aplicação?**
- Abra uma issue no GitHub
- Verifique os logs
- Consulte o README.md

---

**🎉 Pronto! Sua aplicação está no ar!**

URL: `https://seu-app.onrender.com`

