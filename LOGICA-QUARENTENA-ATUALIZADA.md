# 🔄 Lógica de Quarentena Atualizada

## 📋 Resumo das Mudanças

O sistema foi **corrigido** para garantir que números problemáticos sejam **DESATIVADOS** (não removidos) após 3 falhas, permitindo que o **operador decida** manualmente se reativa ou exclui o número.

---

## ✅ Nova Lógica Implementada

### 🎯 Comportamento Atual

```
┌─────────────────────────────────────┐
│ Health Check: Enviar Mensagem Real │
└──────────────┬──────────────────────┘
               │
        ┌──────┴───────┐
        │   Sucesso?   │
        └──────┬───────┘
               │
       ┌───────┴────────┐
       │                │
      SIM              NÃO
       │                │
       ▼                ▼
   ┌────────┐    ┌─────────────┐
   │ ATIVO  │    │ DESATIVA    │
   │        │    │ Falha +1    │
   │ Reset  │    │             │
   │ falhas │    └──────┬──────┘
   └────────┘           │
                 ┌──────┴──────┐
                 │  Quantas    │
                 │  falhas?    │
                 └──────┬──────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
    1ª FALHA       2ª FALHA       3ª FALHA
         │              │              │
         ▼              ▼              ▼
  ┌────────────┐ ┌────────────┐ ┌──────────────┐
  │ QUARENTENA │ │ QUARENTENA │ │ DESATIVADO   │
  │            │ │            │ │ PERMANENTE   │
  │ Inativo    │ │ Inativo    │ │              │
  │ Testa no   │ │ Última     │ │ OPERADOR     │
  │ próximo    │ │ chance     │ │ DECIDE:      │
  │ check      │ │            │ │ - Reativar   │
  │            │ │            │ │ - Excluir    │
  └────────────┘ └────────────┘ └──────────────┘
```

---

## 🔧 Mudanças Implementadas

### **1. Tratamento de TODOS os Erros**

**ANTES:**
```javascript
if (errorCode === 131047) {
  errorMessage = 'Janela de 24 horas expirou...';
  analysis.isTemporary = true;
  analysis.isBanned = false; // ❌ Tratava como temporário
}
```

**AGORA:**
```javascript
if (errorCode === 131047) {
  errorMessage = 'Erro ao enviar mensagem (#131047). Pode ser: janela de 24h expirou OU conta restrita. Operador deve verificar.';
  analysis.isBanned = true; // ✅ Trata como erro sério
  analysis.shouldRemove = false;
}
```

**Motivo:** O erro #131047 é **ambíguo** - pode ser apenas janela expirada OU conta restrita. Agora o sistema desativa e o operador verifica manualmente.

---

### **2. Números NÃO São Mais Removidos Automaticamente**

**ANTES:**
```javascript
if (numberData.failedChecks >= CONFIG.MAX_FAILED_CHECKS) {
  // 3ª FALHA: REMOVER número automaticamente ❌
  app.numbers.delete(number); // ❌ REMOVIA!
  results.removed++;
}
```

**AGORA:**
```javascript
if (numberData.failedChecks >= CONFIG.MAX_FAILED_CHECKS) {
  // 3ª FALHA: DESATIVADO PERMANENTEMENTE ✅
  numberData.active = false; // ✅ APENAS DESATIVA!
  // NÃO remove do banco
  // Operador decide se reativa ou exclui
}
```

---

### **3. Qualquer Erro Desativa Imediatamente**

**ANTES:**
- 1ª falha: Quarentena
- 2ª falha: Ainda em quarentena
- 3ª falha: Remove

**AGORA:**
- **QUALQUER erro = DESATIVA imediatamente**
- 1ª falha: Desativado + Quarentena (testa novamente)
- 2ª falha: Desativado + Quarentena (última chance)
- 3ª falha: Desativado permanente (operador decide)

---

### **4. Operador Decide o Destino Final**

Após 3 falhas, o número fica **DESATIVADO** mas **não é excluído**.

O operador pode:

#### **Opção A: REATIVAR** (se descobriu que era problema temporário)
```http
PATCH /api/apps/:appId/numbers/:number
Body: { "active": true }
```
✅ Reseta contador de falhas  
✅ Remove mensagens de erro  
✅ Número volta a ser testado normalmente

#### **Opção B: EXCLUIR** (se confirmar que está banido)
```http
DELETE /api/apps/:appId/numbers/:number
```
✅ Remove permanentemente da lista

---

## 📊 Fluxo Detalhado

### **Cenário 1: Janela de 24h Expirou (Temporário)**

```
Health Check 1:
├─ Enviar mensagem → Erro #131047
├─ Sistema: DESATIVA número
├─ Contador: 1/3 falhas
└─ Notificação: ⚠️ Número em quarentena

Operador:
├─ Vê notificação
├─ Verifica: "Ah! Janela expirou"
├─ Renova janela (envia mensagem do número teste)
└─ REATIVA número manualmente no dashboard

Health Check 2:
├─ Enviar mensagem → SUCESSO ✅
├─ Sistema: Número volta a ATIVO
└─ Contador: Reset para 0
```

---

### **Cenário 2: Conta Realmente Restrita (Permanente)**

```
Health Check 1:
├─ Enviar mensagem → Erro #131047
├─ Sistema: DESATIVA número
├─ Contador: 1/3 falhas
└─ Notificação: ⚠️ Número em quarentena

Health Check 2 (15 min depois):
├─ Enviar mensagem → Erro #131047 novamente
├─ Sistema: Continua DESATIVADO
├─ Contador: 2/3 falhas
└─ Notificação: ⚠️ Número ainda em quarentena (última chance)

Health Check 3 (15 min depois):
├─ Enviar mensagem → Erro #131047 novamente
├─ Sistema: DESATIVADO PERMANENTEMENTE
├─ Contador: 3/3 falhas
└─ Notificação: 🚫 AÇÃO NECESSÁRIA - Verificar manualmente

Operador:
├─ Vê notificação
├─ Verifica no Meta Business: "Conta restrita" ❌
├─ Decisão: EXCLUIR número definitivamente
└─ Clica em deletar no dashboard
```

---

## 🎯 Códigos de Erro Tratados

Todos agora são tratados como **erros sérios** que desativam o número:

| Código | Descrição | Tratamento |
|--------|-----------|------------|
| **131031** | Conta desabilitada/restrita | Desativa → 3 chances → Operador decide |
| **131056** | Sem permissão para enviar | Desativa → 3 chances → Operador decide |
| **368** | Bloqueio por violação | Desativa → 3 chances → Operador decide |
| **131047** | Janela expirou OU conta restrita | Desativa → 3 chances → Operador decide ⭐ |
| **131026** | Número destino inválido | Desativa → 3 chances → Operador decide |
| **130429** | Rate limit | Desativa → 3 chances → Operador decide |

---

## 📝 Logs e Notificações

### **1ª Falha:**
```
Log: "Número em QUARENTENA (1ª falha)"
Notificação: "⚠️ Número em Quarentena - Tentativa 1/3"
Status: Desativado (será testado novamente)
```

### **2ª Falha:**
```
Log: Atualiza contador
Status: Continua desativado (será testado novamente)
```

### **3ª Falha:**
```
Log: "Número DESATIVADO após 3 falhas"
Notificação: "🚫 AÇÃO NECESSÁRIA: Verificar manualmente e decidir se reativa ou exclui"
Status: Desativado permanentemente (aguarda decisão operador)
```

### **Reativação Manual:**
```
Log: "Número REATIVADO manualmente - Contador de falhas resetado"
Status: Ativo (contador volta a 0)
```

---

## 💡 Vantagens da Nova Lógica

| Vantagem | Descrição |
|----------|-----------|
| **Não perde números** | Sistema não remove automaticamente - operador decide |
| **Detecta problemas** | Qualquer erro desativa imediatamente |
| **Dá chances** | 3 tentativas antes de desativar permanentemente |
| **Flexível** | Operador pode reativar se descobrir que era temporário |
| **Seguro** | Números com problema NÃO são usados para redirect |
| **Claro** | Notificações informam exatamente o que fazer |

---

## 🔄 Fluxo de Trabalho do Operador

### **Diariamente:**

1. **Renovar janelas de 24h**
   - Enviar 1 mensagem de cada número teste para os apps
   - Mantém janela sempre ativa

2. **Verificar notificações**
   - Se receber "⚠️ Quarentena": verificar se janela expirou
   - Se receber "🚫 Desativado": investigar no Meta Business

3. **Tomar decisões**
   - Era só janela? → Reativar no dashboard
   - Conta realmente restrita? → Excluir número

---

## 🧪 Como Testar

### **Testar Cenário de Janela Expirada:**

1. Não renove a janela de 24h propositalmente
2. Aguarde health check (15 min)
3. Veja número ir para quarentena
4. Renove janela (envie mensagem)
5. **REATIVE número manualmente** no dashboard
6. Próximo health check deve passar ✅

### **Testar Cenário de Conta Restrita:**

1. Use conta que sabe que está restrita
2. Health check vai falhar 3 vezes
3. Após 3ª falha: número fica desativado permanente
4. Dashboard mostra número inativo
5. Operador decide: reativar ou excluir

---

## 📊 Estatísticas

O dashboard agora mostra:

```
✅ Números Ativos: X
⚠️ Em Quarentena (1-2 falhas): Y  
🚫 Desativados (3+ falhas): Z
```

---

## 🎯 Resumo

### **Sistema agora:**
✅ Testa enviando mensagem REAL (100% confiável)  
✅ Desativa ao primeiro erro (segurança)  
✅ Dá 3 chances antes de desativar permanente  
✅ **NÃO remove números** - operador decide  
✅ Permite reativação manual com reset de contador  
✅ Notifica o operador para ação manual  

### **Operador pode:**
✅ Reativar números se descobrir que era problema temporário  
✅ Excluir números se confirmar que estão banidos  
✅ Ver histórico completo de falhas  
✅ Tomar decisões informadas  

---

**🎉 Agora o sistema é mais inteligente e flexível, dando controle total ao operador!**

