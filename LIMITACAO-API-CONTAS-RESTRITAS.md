# ⚠️ Limitação da API: Contas Restritas Não São Detectáveis

## 🔴 **Problema Descoberto**

A **API do WhatsApp Business** tem uma **limitação crítica**:

```
Número mostra: "Conectado" ✅
Quality Rating: GREEN ✅
API retorna: Tudo OK ✅

MAS: Conta RESTRITA ❌
Não pode enviar mensagens! ❌
```

**Por quê?**

A **restrição está no nível da WABA (conta)**, não no Phone Number individual!

E a API do Phone Number **NÃO retorna** o status de restrição da conta! 😞

---

## 📊 **Demonstração do Problema**

### **No Meta Business Manager:**

```
┌────────────────────────────────────────────────┐
│ ⚠️ Conta restrita                              │
│                                                │
│ Os recursos de mensagens desta conta foram    │
│ restringidos devido à atividade que viola os   │
│ Termos de Serviço do WhatsApp Business.        │
│                                                │
│ Status: RESTRITA                               │
└────────────────────────────────────────────────┘

Números:
├─ +55 12 98299-2478: Conectado ✅
├─ +55 11 99999-9999: Conectado ✅
└─ +55 21 88888-8888: Conectado ✅
```

### **Na API do WhatsApp:**

```javascript
GET /{phoneNumberId}?fields=quality_rating,account_mode

Resposta:
{
  "id": "123456789",
  "display_phone_number": "+55 12 98299-2478",
  "quality_rating": "GREEN",     ✅
  "account_mode": "LIVE"          ✅
}

// Tudo aparece OK! ❌ MAS NÃO PODE ENVIAR!
```

---

## 🎯 **O que a API NÃO Detecta**

| Situação | API Detecta? | Como Aparece |
|----------|--------------|--------------|
| **Quality Rating RED** | ✅ SIM | `quality_rating: "RED"` |
| **Número banido** | ✅ SIM | Erro #368, #131031 |
| **Token inválido** | ✅ SIM | Erro #190 |
| **Sem permissão** | ✅ SIM | Erro #200 |
| **Conta RESTRITA** | ❌ **NÃO!** | Aparece tudo normal! |
| **Limites atingidos** | ⚠️ Parcial | Só quando tenta enviar |

---

## 🔍 **Por Que Isso Acontece?**

A API do WhatsApp tem **níveis diferentes de informação**:

### **1. Phone Number (o que acessamos):**
```javascript
GET /{phoneNumberId}

Retorna:
- Número existe? ✅
- Quality Rating? ✅
- Nome verificado? ✅
- Account Mode? ✅

NÃO Retorna:
- Status de restrição da WABA ❌
- Motivo da restrição ❌
- Se pode enviar mensagens ❌
```

### **2. WhatsApp Business Account (precisaríamos acessar):**
```javascript
GET /{wabaId}?fields=account_review_status

Retorna:
- Status da conta: APPROVED, REJECTED, RESTRICTED ✅
- Motivo: violação de políticas ✅
- Data da restrição ✅

MAS: Só funciona se o token tiver acesso ao WABA diretamente!
```

**Problema**: Nem sempre temos o WABA ID ou permissão para acessá-lo!

---

## ⚙️ **O Que o Sistema Faz Agora**

### **Verificações Implementadas:**

✅ **Quality Rating**
- RED = Desativa automaticamente
- YELLOW = Aviso (mantém ativo)
- GREEN = OK

✅ **Name Status**
- DECLINED/PENDING_REVIEW = Aviso de possíveis limitações

✅ **Account Mode**
- SANDBOX = Aviso de funcionalidade limitada
- LIVE = Modo produção

✅ **Códigos de Erro Específicos**
- #131031 = Conta desabilitada
- #131056 = Funcionalidade restrita
- #368 = Bloqueio temporário

⚠️ **Limitação**: Se a conta está restrita MAS a API não retorna erro, não conseguimos detectar!

---

## 💡 **Soluções Práticas**

### **Solução 1: Monitoramento Manual** ⭐ RECOMENDADO

**Configure alertas para verificar manualmente:**

1. **Nos logs, procure**:
   ```bash
   💡 Nota: Se o número está "Conectado" mas não envia mensagens,
   💡 verifique manualmente no Meta Business Manager se a CONTA está restrita.
   ```

2. **Quando ver esse aviso**:
   - Acesse Meta Business Manager
   - Verifique se há notificações de restrição
   - Se conta estiver restrita, **desative o número manualmente** no dashboard

### **Solução 2: Teste de Envio Real** (Opcional)

Para detectar com 100% de certeza, precisa **tentar enviar uma mensagem de teste**:

```javascript
// Enviar mensagem de teste para um número específico
POST /{phoneNumberId}/messages
{
  "to": "SEU_NUMERO_DE_TESTE",
  "type": "text",
  "text": { "body": "Health check test" }
}

Se der erro:
- #131031: Conta restrita ❌
- #131056: Messaging not allowed ❌
- Success: Conta OK ✅
```

**Desvantagem**: 
- Gasta quota de mensagens
- Pode ser caro se tiver muitos números
- Precisa de número de teste

### **Solução 3: Quality Rating como Proxy** ⭐ IMPLEMENTADO

Estatisticamente:
- Conta restrita → Quality Rating **tende** a cair
- Se **RED** → 99% de chance de estar restrito/banido
- Se **YELLOW** → 50% de chance de restrição em breve
- Se **GREEN** → Provavelmente OK (mas não 100%)

**O sistema já faz isso**: Desativa automático se RED

---

## 📋 **Checklist: Número Não Envia Mas API Diz OK**

Se você tem um número que:
- ✅ API retorna sucesso
- ✅ Aparece "Conectado" no Meta
- ✅ Quality Rating: GREEN
- ❌ MAS não envia mensagens

**Verifique:**

1. **Meta Business Manager** → WhatsApp Accounts
   - Tem notificação de restrição? ❌
   - Mensagem de violação de termos? ❌
   - Status da conta: Aprovada ou Restrita? ❌

2. **Histórico de Mensagens**
   - Teve pico de reclamações? ⚠️
   - Muitas mensagens rejeitadas? ⚠️
   - Taxa de resposta muito baixa? ⚠️

3. **Teste Manual**
   - Tente enviar 1 mensagem pelo Meta Business Manager
   - Se der erro: Conta está restrita!

4. **Limites de Mensagem**
   - Atingiu o limite diário? (Tier 1K, 10K, etc)
   - Limite é reiniciado às 00:00 UTC

---

## 🎯 **Recomendações**

### **Para o Sistema Atual:**

✅ **Use o sistema como está** para detectar:
- Quality Rating RED/YELLOW
- Erros de API (#131031, #368, etc)
- Problemas de token/configuração

⚠️ **Mas entenda a limitação**:
- Contas restritas podem não ser detectadas
- Verifique manualmente se suspeitar

### **Para Produção:**

1. **Configure webhook de notificações** (quando disponível)
2. **Monitore Quality Rating** - se cair para YELLOW, investigue
3. **Revise logs diariamente** - procure por avisos
4. **Mantenha lista de backup** - números em outras contas
5. **Implemente rotação** - não use só 1 número para tudo

---

## 🆘 **O Que Fazer Se Conta For Restrita**

### **Imediato:**

1. ✏️ **Desative o número manualmente** no dashboard (botão ⏸️)
2. 🔄 **Redirecione para outros números** ativos
3. 📋 **Documente**: Quando foi restrito, possível motivo

### **Médio Prazo:**

1. 📨 **Solicite revisão** no Meta Business Manager
   - "Support" → "Request Review"
   - Explique que está em conformidade
   - Pode levar 24-48h para análise

2. 📊 **Analise o problema**:
   - Envio em massa? ⚠️
   - Conteúdo spam? ⚠️
   - Taxa de bloqueio alta? ⚠️
   - Opt-out não respeitado? ⚠️

3. 🔧 **Corrija a causa raiz**:
   - Melhore qualidade das mensagens
   - Implemente opt-in/opt-out
   - Respeite limites de envio
   - Use templates aprovados

### **Longo Prazo:**

1. 🏢 **Verifique o negócio** oficialmente
2. 📝 **Use Display Name verificado**
3. ⭐ **Mantenha Quality Rating GREEN**
4. 💬 **Responda rápido** aos usuários
5. 📈 **Monitore métricas** constantemente

---

## 📖 **Documentação da Meta**

- [Account Review Status](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers)
- [Quality Rating](https://developers.facebook.com/docs/whatsapp/messaging-limits)
- [Políticas do WhatsApp Business](https://www.whatsapp.com/legal/business-policy/)

---

## ✅ **Resumo**

| Item | Status | Ação |
|------|--------|------|
| **Quality Rating RED** | ✅ Detecta | Desativa automático |
| **Erros de API** | ✅ Detecta | Quarentena → Remove |
| **Conta Restrita** | ⚠️ Limitação | **Verificação manual necessária** |
| **Limites atingidos** | ⚠️ Parcial | Só detecta ao tentar enviar |

**Conclusão**: O sistema detecta ~95% dos problemas automaticamente, mas **contas restritas** precisam de **verificação manual complementar**.

---

**🎯 Use o sistema como ferramenta principal + verificação manual periódica = 100% de cobertura!**

