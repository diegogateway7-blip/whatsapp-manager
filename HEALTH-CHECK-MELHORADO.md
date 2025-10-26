# 🔍 Health Check Melhorado - Verificação REAL de Envio de Mensagens

## 🎯 Problema Identificado

**ANTES:**
```javascript
// Só verificava se o número existe
GET /v21.0/{phoneNumberId}

✅ Retorna sucesso se número existe
❌ MAS não garante que pode enviar mensagens!
```

**Resultado:** Número mostrava "Conectado" mas não conseguia enviar mensagens! ❌

---

## ✅ Solução Implementada

**AGORA:**
```javascript
// Verifica campos críticos para envio de mensagens
GET /v21.0/{phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,account_review_status,messaging_limit_tier

✅ Verifica se número existe
✅ Verifica account_review_status (APPROVED, REJECTED, RESTRICTED)
✅ Verifica quality_rating (GREEN, YELLOW, RED)
✅ Verifica messaging_limit_tier (se está configurado)
✅ Verifica verified_name
```

---

## 📊 Novos Campos Verificados

### 1. **account_review_status** (CRÍTICO!)

| Status | Descrição | Pode Enviar? | Ação do Sistema |
|--------|-----------|--------------|-----------------|
| **APPROVED** | Conta aprovada | ✅ SIM | Mantém ativo |
| **PENDING** | Em análise | ⚠️ LIMITADO | Mantém ativo com aviso |
| **REJECTED** | Conta rejeitada | ❌ NÃO | **DESATIVA número** |
| **RESTRICTED** | Conta restrita | ❌ NÃO | **DESATIVA número** |

**Erro mostrado:**
```
"Conta REJEITADA/RESTRITA pelo WhatsApp Business. 
Não pode enviar mensagens."
```

---

### 2. **quality_rating** (Qualidade)

| Rating | Descrição | Pode Enviar? | Ação do Sistema |
|--------|-----------|--------------|-----------------|
| **GREEN** | Qualidade alta | ✅ SIM | Mantém ativo |
| **YELLOW** | Qualidade média | ⚠️ SIM | Mantém ativo com aviso |
| **RED** | Qualidade baixa | ❌ RISCO | **DESATIVA número** |
| **UNKNOWN** | Desconhecido | ⚠️ SIM | Mantém ativo |

**Erro mostrado (se RED):**
```
"Quality Rating: RED - Qualidade muito baixa. 
Risco de bloqueio iminente."
```

---

### 3. **messaging_limit_tier** (Limite de Mensagens)

| Tier | Limite Diário | Pode Enviar? | Ação do Sistema |
|------|---------------|--------------|-----------------|
| **TIER_1K** | 1.000 conversas | ✅ SIM | Mantém ativo |
| **TIER_10K** | 10.000 conversas | ✅ SIM | Mantém ativo |
| **TIER_100K** | 100.000 conversas | ✅ SIM | Mantém ativo |
| **TIER_UNLIMITED** | Ilimitado | ✅ SIM | Mantém ativo |
| **NOT_SET** | Não configurado | ❌ PROBLEMA | **DESATIVA número** |
| **UNKNOWN** | Desconhecido | ❌ PROBLEMA | **DESATIVA número** |

**Erro mostrado (se NOT_SET):**
```
"Messaging Limit Tier não configurado. 
Número pode não conseguir enviar mensagens."
```

---

### 4. **verified_name** (Nome Verificado)

```javascript
// Informativo - não bloqueia
verified_name: "Minha Empresa Ltda" ✅
verified_name: null ⚠️ (pode ter limitações)
```

---

## 🔄 Fluxo de Verificação

```
┌────────────────────────────────────────┐
│ Health Check Executado                 │
└───────────────┬────────────────────────┘
                │
                ▼
┌────────────────────────────────────────┐
│ GET /phoneNumberId com campos:         │
│ - account_review_status                │
│ - quality_rating                       │
│ - messaging_limit_tier                 │
│ - verified_name                        │
└───────────────┬────────────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
┌─────────────┐   ┌─────────────────────┐
│ ✅ API OK   │   │ ❌ Erro na API      │
└──────┬──────┘   └──────┬──────────────┘
       │                 │
       ▼                 ▼
┌─────────────────────────────────┐
│ VERIFICAR account_review_status │
└───────────┬─────────────────────┘
            │
    ┌───────┴─────────┐
    ▼                 ▼
┌──────────┐    ┌─────────────────────┐
│ APPROVED │    │ REJECTED/RESTRICTED │
│ ✅ OK    │    │ ❌ DESATIVA         │
└────┬─────┘    └─────────────────────┘
     │
     ▼
┌──────────────────────┐
│ VERIFICAR quality    │
│ rating               │
└──────┬───────────────┘
       │
   ┌───┴────┐
   ▼        ▼
┌────┐  ┌─────┐
│GREEN│  │ RED │
│✅   │  │❌   │
└─┬──┘  └──┬──┘
  │        │
  │        └──> DESATIVA
  │
  ▼
┌──────────────────────────┐
│ VERIFICAR messaging_tier │
└──────┬───────────────────┘
       │
   ┌───┴─────┐
   ▼         ▼
┌─────┐  ┌────────┐
│TIER │  │NOT_SET │
│✅   │  │❌      │
└──┬──┘  └───┬────┘
   │         │
   │         └──> DESATIVA
   │
   ▼
┌─────────────────┐
│ ✅ NÚMERO ATIVO │
│ Pode enviar     │
│ mensagens!      │
└─────────────────┘
```

---

## 📝 Logs Detalhados

### Antes (Básico)

```bash
✅ 5511999999999 - Ativo (GREEN)
```

### Agora (Completo)

```bash
✅ 5511999999999 - Ativo | Quality: GREEN | Status: APPROVED | Tier: TIER_1K
```

### Exemplos de Erros Detectados

```bash
# Conta rejeitada
❌ 5511111111111 - Erro: Conta REJEITADA pelo WhatsApp Business. Não pode enviar mensagens.
   ⚠️  EM QUARENTENA - INATIVO (1/3 falhas)

# Quality rating ruim
❌ 5522222222222 - Erro: Quality Rating: RED - Qualidade muito baixa. Risco de bloqueio iminente.
   ⚠️  EM QUARENTENA - INATIVO (1/3 falhas)

# Tier não configurado
❌ 5533333333333 - Erro: Messaging Limit Tier não configurado. Número pode não conseguir enviar mensagens.
   ⚠️  EM QUARENTENA - INATIVO (1/3 falhas)

# Conta em análise (aviso, mas mantém ativo)
✅ 5544444444444 - Ativo | Quality: GREEN | Status: PENDING | Tier: TIER_1K
   ⚠️  Conta em análise (PENDING) - Funcionalidade pode estar limitada

# Quality rating amarelo (aviso, mas mantém ativo)
✅ 5555555555555 - Ativo | Quality: YELLOW | Status: APPROVED | Tier: TIER_10K
   ⚠️  Quality Rating: YELLOW - Atenção necessária
```

---

## 🎯 Casos de Uso Reais

### Caso 1: Conta Restrita (Seu problema!)

```
Situação: WABA mostra "Conectado" mas não envia mensagens

ANTES:
- Health check: ✅ Passa
- Número: ✅ Ativo
- API retorna: ✅ Sim
- Usuários redirecionados: ✅ Sim (PROBLEMA!)
- Mensagens enviadas: ❌ Não

AGORA:
- Health check: ❌ Detecta account_review_status = RESTRICTED
- Número: ❌ Desativado
- API retorna: ❌ Não
- Usuários redirecionados: ❌ Não
- Erro no dashboard: "Conta RESTRITA pelo WhatsApp Business"
```

### Caso 2: Quality Rating RED

```
Situação: Número com muitas reclamações

ANTES:
- Health check: ✅ Passa
- Número continua ativo até ban total

AGORA:
- Health check: ❌ Detecta quality_rating = RED
- Número: ❌ Desativado preventivamente
- Evita enviar usuários para número problemático
- Erro: "Quality Rating: RED - Risco de bloqueio iminente"
```

### Caso 3: Tier Não Configurado

```
Situação: Número novo sem configuração completa

ANTES:
- Health check: ✅ Passa
- Tenta enviar mensagens: ❌ Falha

AGORA:
- Health check: ❌ Detecta messaging_limit_tier = NOT_SET
- Número: ❌ Desativado
- Erro: "Messaging Limit Tier não configurado"
- Admin pode corrigir antes de ativar
```

---

## 📊 Dashboard Mostra Mais Informações

### Antes

```
5511999999999  ✅ Ativo
```

### Agora

```
5511999999999  ✅ Ativo
🎯 Rating: GREEN
📊 Status: APPROVED  
📈 Tier: TIER_1K (1.000/dia)
✓ Nome verificado
```

### Em Quarentena

```
5522222222222  ⚠️ Quarentena - 1/3 falhas
⚠️ Conta RESTRITA pelo WhatsApp Business
🎯 Rating: YELLOW
📊 Status: RESTRICTED
📈 Tier: TIER_1K
```

---

## 🧪 Como Testar

### Teste 1: Conta com Status Ruim

1. Use um número que você sabe que está restrito
2. Execute Health Check
3. **Esperado:** Número vai para quarentena imediatamente
4. **Mensagem:** "Conta REJEITADA/RESTRITA pelo WhatsApp Business"

### Teste 2: Quality Rating

Não é fácil testar, mas:
- Quality Rating muda baseado em como usuários interagem
- Se muitas pessoas bloqueiam/reportam: vira YELLOW → RED
- Sistema detecta automaticamente

### Teste 3: Tier Não Configurado

1. Use número recém criado (sem configuração completa)
2. Execute Health Check
3. **Esperado:** Número vai para quarentena
4. **Mensagem:** "Messaging Limit Tier não configurado"

---

## 🔍 Verificar se Está Funcionando

### 1. Logs do Render

Procure por logs com mais informações:

```bash
ANTES:
✅ 5511999999999 - Ativo

AGORA:
✅ 5511999999999 - Ativo | Quality: GREEN | Status: APPROVED | Tier: TIER_1K
```

### 2. Testar com Número Conhecido

Se você tem um número que sabe que está com problema:

```bash
# Execute health check
# Veja nos logs se detecta o problema
# Número deve ir para quarentena com mensagem específica
```

### 3. Ver Resposta da API

```bash
GET https://seu-app.onrender.com/api/status

# Deve mostrar informações extras nos números
```

---

## 💡 Benefícios

✅ **Detecção Precisa**: Identifica números que NÃO podem enviar mensagens

✅ **Proteção Proativa**: Desativa antes de causar problemas

✅ **Informações Detalhadas**: Dashboard mostra exatamente o problema

✅ **Evita Frustração**: Usuários não são redirecionados para números ruins

✅ **Quality Monitoring**: Acompanha saúde de cada número

✅ **Alertas Preventivos**: Avisa quando quality rating está amarelo

✅ **Logs Completos**: Fácil diagnosticar problemas

---

## 🆘 Troubleshooting

### Número desativado mas deveria estar ativo

**Verificar:**
1. Vá no Meta Business Manager
2. Configurações > WhatsApp Business Account
3. Veja o status real da conta
4. Verifique Quality Rating
5. Confirme Messaging Limit Tier está configurado

**Possíveis causas:**
- Conta realmente está restrita
- Quality rating está RED
- Tier não foi configurado (número novo)

### Todos números foram desativados

**Possível causa:** Problema no token ou permissões

**Solução:**
1. Gere novo token permanente no Meta
2. Certifique que tem permissões:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
3. Atualize token no dashboard
4. Execute health check novamente

### Quality rating não aparece

**Normal!** Números novos podem ter quality_rating = null

Sistema trata como "UNKNOWN" e mantém ativo

---

## 📚 Referências Meta API

- [Phone Number - Graph API](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account-to-number-current-status)
- [Quality Rating](https://developers.facebook.com/docs/whatsapp/messaging-limits)
- [Account Review Status](https://developers.facebook.com/docs/whatsapp/overview/getting-started)

---

## 🎉 Resultado

**Agora o sistema verifica se o número REALMENTE pode enviar mensagens!**

Não basta estar "Conectado" - precisa:
- ✅ Status APPROVED
- ✅ Quality rating OK (não RED)
- ✅ Messaging tier configurado
- ✅ API responder sem erros

**Seu problema está resolvido!** 🎯

---

*Atualização: 26/10/2024*  
*Versão: 2.2.0*

