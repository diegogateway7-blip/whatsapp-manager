# 🔍 Como Encontrar o Phone Number ID Correto

## ⚠️ Problema Comum

Muitas pessoas confundem:
- ❌ **WhatsApp Business Account ID** (WABA ID)
- ✅ **Phone Number ID** (o que precisamos!)

---

## 📱 Método 1: Via Meta Business Manager (Mais Fácil)

### Passo a Passo:

1. **Acesse**: https://business.facebook.com

2. **Vá em WhatsApp Manager**:
   - Menu lateral esquerdo
   - Clique em "WhatsApp Accounts" ou "Contas do WhatsApp"

3. **Selecione sua conta WABA**

4. **Vá em "Números de telefone"** ou "Phone Numbers"

5. **Veja a lista de números**:
   ```
   ┌─────────────────────────────────────────┐
   │ Números de Telefone                     │
   ├─────────────────────────────────────────┤
   │ +55 11 99999-9999                       │
   │ ID: 123456789012345  ◄─── COPIE ISSO!  │
   │ Status: Conectado                       │
   └─────────────────────────────────────────┘
   ```

6. **Copie o ID** do número (geralmente 15 dígitos)

---

## 🔧 Método 2: Via API Graph Explorer

### Passo a Passo:

1. **Acesse**: https://developers.facebook.com/tools/explorer

2. **Selecione seu App** no canto superior direito

3. **Cole esta chamada**:
   ```
   GET /{WABA-ID}/phone_numbers
   ```
   Substitua `{WABA-ID}` pelo ID da sua conta WhatsApp Business

4. **Clique em "Submit"** ou "Enviar"

5. **Resposta será algo assim**:
   ```json
   {
     "data": [
       {
         "id": "123456789012345",  ◄─── Phone Number ID
         "display_phone_number": "+55 11 99999-9999",
         "verified_name": "Minha Empresa",
         "quality_rating": "GREEN"
       }
     ]
   }
   ```

6. **Copie o campo "id"** (não o display_phone_number!)

---

## 🎯 Método 3: Via cURL (Avançado)

```bash
curl -X GET "https://graph.facebook.com/v21.0/{WABA-ID}/phone_numbers" \
  -H "Authorization: Bearer {SEU-TOKEN}"
```

**Resposta**:
```json
{
  "data": [
    {
      "id": "123456789012345",
      "display_phone_number": "+55 11 99999-9999"
    }
  ]
}
```

---

## 🔍 Como Saber se é o ID Correto?

### Phone Number ID:
- ✅ Geralmente tem **15 dígitos**
- ✅ Exemplo: `123456789012345`
- ✅ Cada NÚMERO tem seu próprio ID

### WhatsApp Business Account ID (WABA):
- ❌ Geralmente tem **15-17 dígitos** também
- ❌ Exemplo: `109876543210987`
- ❌ É o ID da CONTA, não do número
- ❌ Cada CONTA pode ter vários números

---

## 🧪 Como Testar se o ID está Correto

### Teste Rápido via Graph Explorer:

1. Acesse: https://developers.facebook.com/tools/explorer

2. Cole:
   ```
   GET /{PHONE-NUMBER-ID}
   ```

3. Se retornar algo assim, está **CORRETO**! ✅
   ```json
   {
     "id": "123456789012345",
     "display_phone_number": "+55 11 99999-9999",
     "verified_name": "Minha Empresa",
     "quality_rating": "GREEN"
   }
   ```

4. Se der erro `(#100)` ou `Invalid ID`, está **ERRADO**! ❌

---

## 📝 Onde Encontrar Cada Coisa

| O que procurar | Onde encontrar |
|----------------|----------------|
| **Phone Number ID** | Meta Business > WhatsApp > Phone Numbers > ID do número |
| **WABA ID** | Meta Business > WhatsApp > Configurações > ID da conta |
| **Token** | Meta Business > System Users > Gerar Token |
| **App ID** | Meta for Developers > Seu App > Configurações |

---

## 🎯 Checklist Completo

Quando adicionar um app no sistema, você precisa de:

```
✅ App ID (identificador único interno - você escolhe)
   Exemplo: "app_1"

✅ Nome do App (nome descritivo - você escolhe)
   Exemplo: "App Principal"

✅ Token Permanente (do Meta Business)
   Exemplo: "EAAxxxxxxxxxxxxx..." (longo!)
   Onde: System Users > Tokens
   
✅ Phone Number ID (do Meta Business)
   Exemplo: "123456789012345" (15 dígitos)
   Onde: WhatsApp > Phone Numbers > ID do número específico
```

---

## ⚠️ Erros Comuns

### Erro: "#100 Invalid parameter"

**Causa**: Phone Number ID incorreto ou campos inválidos

**Soluções**:
1. ✅ Verifique se copiou o **Phone Number ID** (não o WABA ID)
2. ✅ Teste o ID no Graph Explorer
3. ✅ Confirme que o número está na conta correta

### Erro: "#190 Token expired"

**Causa**: Token expirou ou é inválido

**Solução**:
1. ✅ Gere um novo token **permanente** (não temporário!)
2. ✅ Use System User (não User Token)

### Erro: "#200 Permissions error"

**Causa**: Token sem permissões

**Solução**:
1. ✅ Adicione permissões ao token:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`

---

## 🔑 Gerar Token Permanente Correto

1. **Meta Business Manager** > **System Users**

2. **Criar System User**:
   - Nome: "WhatsApp Manager Bot"
   - Role: Admin

3. **Gerar Token**:
   - Clique em "Generate New Token"
   - Selecione seu App
   - Permissões:
     - ✅ `whatsapp_business_management`
     - ✅ `whatsapp_business_messaging`
   - **IMPORTANTE**: Marque "Never expire" (Nunca expira)

4. **Copie o token** (começa com `EAA...`)

5. **Salve em local seguro** - só mostra uma vez!

---

## 📊 Estrutura Visual

```
Meta Business Manager
├── WhatsApp Accounts (WABA)
│   ├── Conta Principal (WABA ID: 109876543210987)
│   │   ├── Phone Numbers
│   │   │   ├── +55 11 99999-9999 (ID: 123456789012345) ◄─── Use isso!
│   │   │   ├── +55 11 88888-8888 (ID: 543210987654321) ◄─── Use isso!
│   │   │   └── +55 11 77777-7777 (ID: 987654321098765) ◄─── Use isso!
│   │   └── Settings
│   └── Conta Secundária (WABA ID: 123456789012345)
│       └── Phone Numbers
│           └── +55 21 99999-9999 (ID: 111222333444555) ◄─── Use isso!
└── System Users
    └── Bot Manager
        └── Token: EAAxxxxx... ◄─── Use isso!
```

---

## 🧪 Testar no Sistema

Depois de adicionar:

1. **Execute Health Check**

2. **Veja os logs no Render**:
   ```
   🔍 Testando Phone Number ID: 123456789012345
   🔑 Token: EAAxxxxxxxxxxxxx...
   ✅ Phone Number ID válido!
   📊 Campos disponíveis: id, display_phone_number, verified_name, quality_rating
   📱 Número: +55 11 99999-9999
   🏢 Nome: Minha Empresa
   ⭐ Quality: GREEN
   ✅ 5511999999999 - Ativo | Quality: GREEN | Display: +55 11 99999-9999 | Verified: Sim
   ```

3. **Se aparecer erro**:
   ```
   ❌ ERRO na API: Request failed with status code 400
   ❌ Código do erro: 100
   ❌ Mensagem: Invalid parameter
   ```
   → Phone Number ID está errado!

---

## 💡 Dica Final

**Atalho rápido para copiar tudo**:

1. Abra o Graph Explorer: https://developers.facebook.com/tools/explorer

2. Cole e execute:
   ```
   GET /{WABA-ID}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating
   ```

3. **Você terá tudo** que precisa na resposta:
   ```json
   {
     "data": [
       {
         "id": "123456789012345",           ◄─── Phone Number ID
         "display_phone_number": "+55 11 99999-9999",
         "verified_name": "Minha Empresa",
         "quality_rating": "GREEN"
       }
     ]
   }
   ```

---

## 🆘 Ainda com Erro?

Se mesmo seguindo tudo acima ainda dá erro, compartilhe:

1. **Erro completo** que aparece nos logs
2. **Tamanho do Phone Number ID** (quantos dígitos?)
3. **Como você obteve o ID** (qual método usou?)
4. **Token começa com** `EAA...`? (sim/não)

---

**🎯 Com o Phone Number ID correto, o sistema funcionará perfeitamente!**

