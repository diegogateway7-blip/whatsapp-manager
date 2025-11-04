const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const path = require('path');
const { connectDatabase, App, Stats, Log, getStats } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configurações
const CONFIG = {
  MAX_FAILED_CHECKS: 3,
  HEALTH_CHECK_INTERVAL: '*/15 * * * *',
  WEBHOOK_URL: process.env.WEBHOOK_URL || null,
  META_API_VERSION: 'v21.0'
};

// ===== FUNÇÕES DE LOG =====

async function addLog(type, message, data = {}) {
  try {
    const log = new Log({
      type,
      message,
      data
    });
    await log.save();
    console.log(`[${type.toUpperCase()}] ${message}`, data);
    
    // Limpar logs antigos (manter últimos 1000)
    const count = await Log.countDocuments();
    if (count > 1000) {
      const logsToDelete = await Log.find()
        .sort({ timestamp: 1 })
        .limit(count - 1000)
        .select('_id');
      await Log.deleteMany({ _id: { $in: logsToDelete.map(l => l._id) } });
    }
  } catch (error) {
    console.error('Erro ao salvar log:', error);
  }
}

// ===== NOTIFICAÇÕES =====

async function sendNotification(title, message, data = {}) {
  if (!CONFIG.WEBHOOK_URL) return;
  
  try {
    await axios.post(CONFIG.WEBHOOK_URL, {
      title,
      message,
      data,
      timestamp: new Date().toISOString()
    }, { timeout: 5000 });
    
    await addLog('notification', 'Notificação enviada', { title, message });
  } catch (error) {
    console.error('❌ Erro ao enviar notificação:', error.message);
  }
}

// ===== ROTAS DE GERENCIAMENTO =====

// Obter todos os apps
app.get('/api/apps', async (req, res) => {
  try {
    const apps = await App.find();
    const appsObj = {};
    apps.forEach(app => {
      appsObj[app.appId] = {
        appName: app.appName,
        token: app.token,
        phoneNumberId: app.phoneNumberId,
        wabaId: app.wabaId, // WABA ID - OBRIGATÓRIO
        numbers: Object.fromEntries(app.numbers),
        createdAt: app.createdAt
      };
    });
    res.json(appsObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicionar ou atualizar app
app.post('/api/apps', async (req, res) => {
  const { appId, appName, token, phoneNumberId, wabaId } = req.body;
  
  // WABA ID é obrigatório! phoneNumberId é opcional (não mais usado)
  if (!appId || !appName || !token || !wabaId) {
    return res.status(400).json({ error: 'Campos obrigatórios: appId, appName, token, wabaId' });
  }

  try {
    let app = await App.findOne({ appId });
    
    if (!app) {
      app = new App({
        appId,
        appName,
        token,
        phoneNumberId: phoneNumberId || null, // Opcional
        wabaId,
        numbers: new Map()
      });
      await addLog('app', `App criado: ${appName}`, { appId, wabaId });
    } else {
      app.appName = appName;
      app.token = token;
      app.phoneNumberId = phoneNumberId || null; // Opcional
      app.wabaId = wabaId;
      app.updatedAt = new Date();
      
      await addLog('app', `App atualizado: ${appName}`, { appId, wabaId });
    }
    
    await app.save();
    res.json({ success: true, app });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Renovar janela de 24h manualmente
app.post('/api/apps/:appId/renew-window', async (req, res) => {
  const { appId } = req.params;
  
  try {
    const app = await App.findOne({ appId });
    if (!app) {
      return res.status(404).json({ error: 'App não encontrado' });
    }

    app.lastMessageWindowRenewal = new Date();
    await app.save();
    
    await addLog('app', `Janela de 24h renovada: ${app.appName}`, { appId });
    res.json({ 
      success: true, 
      renewedAt: app.lastMessageWindowRenewal,
      message: 'Janela renovada! Envie uma mensagem do número de teste para o WhatsApp do app para manter ativa.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar app
app.delete('/api/apps/:appId', async (req, res) => {
  const { appId } = req.params;
  
  try {
    const app = await App.findOne({ appId });
    if (app) {
      await App.deleteOne({ appId });
      await addLog('app', `App deletado: ${app.appName}`, { appId });
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'App não encontrado' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicionar número a um app
app.post('/api/apps/:appId/numbers', async (req, res) => {
  const { appId } = req.params;
  const { number } = req.body;

  if (!number || !/^\d+$/.test(number)) {
    return res.status(400).json({ error: 'Número inválido' });
  }

  try {
    const app = await App.findOne({ appId });
    if (!app) {
      return res.status(404).json({ error: 'App não encontrado' });
    }

    app.numbers.set(number, {
    active: true,
    lastCheck: null,
      error: null,
      errorCode: null,
      failedChecks: 0,
      addedAt: new Date(),
      lastStatusChange: new Date()
    });

    await app.save();
    await addLog('number', `Número adicionado: ${number}`, { appId, number });
    res.json({ success: true, number: app.numbers.get(number) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar número
app.delete('/api/apps/:appId/numbers/:number', async (req, res) => {
  const { appId, number } = req.params;

  try {
    const app = await App.findOne({ appId });
    if (!app) {
    return res.status(404).json({ error: 'App não encontrado' });
  }

    if (app.numbers.has(number)) {
      app.numbers.delete(number);
      await app.save();
      await addLog('number', `Número deletado: ${number}`, { appId, number });
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Número não encontrado' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ativar/desativar número manualmente
app.patch('/api/apps/:appId/numbers/:number', async (req, res) => {
  const { appId, number } = req.params;
  const { active } = req.body;

  try {
    const app = await App.findOne({ appId });
    if (!app || !app.numbers.has(number)) {
      return res.status(404).json({ error: 'App ou número não encontrado' });
    }

    const numberData = app.numbers.get(number);
    numberData.active = active;
    numberData.lastStatusChange = new Date();
    
    if (active) {
      // Ao reativar, reseta contador de falhas e erros
      numberData.failedChecks = 0;
      numberData.error = null;
      numberData.errorCode = null;
      await addLog('number', `Número REATIVADO manualmente: ${number} - Contador de falhas resetado`, { appId, number });
    } else {
      await addLog('number', `Número desativado manualmente: ${number}`, { appId, number });
    }

    app.numbers.set(number, numberData);
    await app.save();
    
    res.json({ success: true, number: numberData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ROTAS PARA TYPEBOT =====

// Obter número ativo aleatório
app.get('/api/get-active-number', async (req, res) => {
  try {
    const apps = await App.find();
  const activeNumbers = [];

  // Coletar todos os números ativos
    for (const app of apps) {
      for (const [number, data] of app.numbers) {
        if (data.active) {
          activeNumbers.push({ 
            number, 
            appId: app.appId,
            appName: app.appName,
            lastCheck: data.lastCheck
          });
      }
    }
  }

  if (activeNumbers.length === 0) {
    return res.status(404).json({ 
      success: false,
      message: 'Nenhum número ativo disponível',
      totalActive: 0
    });
  }

  // Selecionar número aleatório
  const random = activeNumbers[Math.floor(Math.random() * activeNumbers.length)];
    
    await addLog('redirect', `Número fornecido para redirect: ${random.number}`, { 
      appId: random.appId,
      totalActive: activeNumbers.length 
    });
  
  res.json({
    success: true,
    number: random.number,
    whatsappUrl: `https://wa.me/${random.number}`,
    totalActive: activeNumbers.length,
      app: random.appId,
      appName: random.appName
  });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Status do sistema
app.get('/api/status', async (req, res) => {
  try {
    const apps = await App.find();
    const stats = await getStats();
    
  let totalNumbers = 0;
  let activeNumbers = 0;
    let inQuarantine = 0;

    for (const app of apps) {
      for (const [number, data] of app.numbers) {
      totalNumbers++;
        if (data.active) {
        activeNumbers++;
      }
        if (data.failedChecks > 0 && data.failedChecks < CONFIG.MAX_FAILED_CHECKS) {
          inQuarantine++;
        }
    }
  }

  res.json({
    status: 'online',
      totalApps: apps.length,
    totalNumbers,
    activeNumbers,
      inQuarantine,
      lastHealthCheck: stats.lastHealthCheck,
      stats: {
        totalChecks: stats.totalChecks,
        totalBans: stats.totalBans,
        totalRecoveries: stats.totalRecoveries
      },
      config: {
        maxFailedChecks: CONFIG.MAX_FAILED_CHECKS,
        healthCheckInterval: CONFIG.HEALTH_CHECK_INTERVAL,
        webhookConfigured: !!CONFIG.WEBHOOK_URL
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter logs
app.get('/api/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const type = req.query.type;
    
    const query = type ? { type } : {};
    const logs = await Log.find(query)
      .sort({ timestamp: -1 })
      .limit(limit);
    
    const total = await Log.countDocuments(query);
    
    res.json({
      logs,
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Limpar logs
app.delete('/api/logs', async (req, res) => {
  try {
    await Log.deleteMany({});
    await addLog('system', 'Logs limpos');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== VERIFICAÇÃO DE WABA STATUS (MÉTODO ÚNICO) =====

async function checkWABAStatus(token, wabaId) {
  try {
    console.log(`    🏢 Verificando WABA: ${wabaId}`);
    
    const response = await axios.get(
      `https://graph.facebook.com/${CONFIG.META_API_VERSION}/${wabaId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          fields: 'id,name,account_review_status,messaging_limit_tier,business_verification_status'
        },
        timeout: 15000
      }
    );

    const data = response.data;
    
    console.log(`    📊 WABA: ${data.name || 'N/A'}`);
    console.log(`    📋 Status: ${data.account_review_status || 'N/A'}`);
    console.log(`    📊 Tier: ${data.messaging_limit_tier || 'N/A'}`);
    console.log(`    ✓ Verificação: ${data.business_verification_status || 'N/A'}`);

    // ===== VERIFICAÇÃO 1: Account Review Status =====
    if (data.account_review_status === 'REJECTED') {
      return {
        active: false,
        error: 'WABA REJEITADA pelo WhatsApp. Conta não pode enviar mensagens.',
        errorCode: 'WABA_REJECTED',
        wabaStatus: data
      };
    }

    if (data.account_review_status === 'RESTRICTED') {
      return {
        active: false,
        error: 'WABA RESTRITA pelo WhatsApp. Conta com limitações para enviar mensagens.',
        errorCode: 'WABA_RESTRICTED',
        wabaStatus: data
      };
    }

    if (data.account_review_status === 'PENDING') {
      return {
        active: false,
        error: 'WABA aguardando aprovação. Ainda não pode enviar mensagens.',
        errorCode: 'WABA_PENDING',
        wabaStatus: data
      };
    }

    // ===== VERIFICAÇÃO 2: Messaging Limit Tier =====
    if (data.messaging_limit_tier === 'TIER_0' || !data.messaging_limit_tier) {
      return {
        active: false,
        error: 'WABA sem permissão para enviar mensagens (TIER_0).',
        errorCode: 'WABA_NO_MESSAGING',
        wabaStatus: data
      };
    }

    // ✅ WABA APROVADA E FUNCIONANDO!
    console.log(`    ✅ WABA APROVADA! Status: ${data.account_review_status} | Tier: ${data.messaging_limit_tier}`);

    return {
      active: true,
      error: null,
      errorCode: null,
      wabaStatus: {
        name: data.name,
        account_review_status: data.account_review_status,
        messaging_limit_tier: data.messaging_limit_tier,
        business_verification_status: data.business_verification_status
      }
    };

  } catch (error) {
    console.log(`    ❌ ERRO ao verificar WABA:`, error.message);

    let errorMessage = 'Erro ao verificar WABA';
    let errorCode = null;

    if (error.response) {
      const apiErrorMessage = error.response.data?.error?.message || `HTTP ${error.response.status}`;
      errorCode = error.response.data?.error?.code || error.response.status;
      errorMessage = apiErrorMessage;
      
      console.log(`    ❌ Código do erro: ${errorCode}`);
      console.log(`    ❌ Mensagem: ${errorMessage}`);
      
      // Erros comuns
      if (errorCode === 100) {
        errorMessage = `Erro #100 - ${apiErrorMessage}. Verifique se o WABA ID está correto e se o token possui acesso (permissão whatsapp_business_management) à conta ${wabaId}.`;
      } else if (errorCode === 190) {
        errorMessage = `Erro #190 - Token inválido ou expirado. Gere um novo token. Detalhe: ${apiErrorMessage}`;
      } else if (errorCode === 200 || errorCode === 10) {
        errorMessage = `Erro #${errorCode} - Token sem permissões para acessar a WABA. Adicione a permissão whatsapp_business_management. Detalhe: ${apiErrorMessage}`;
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Timeout na requisição para WABA';
    }

    return {
      active: false,
      error: errorMessage,
      errorCode,
      wabaStatus: null
    };
  }
}

// ===== HEALTH CHECK INTELIGENTE =====

function analyzeErrorCode(error) {
  const errorAnalysis = {
    isBanned: false,
    isTemporary: false,
    shouldRemove: false,
    severity: 'low'
  };

  if (!error.response) {
    errorAnalysis.isTemporary = true;
    errorAnalysis.severity = 'low';
    return errorAnalysis;
  }

  const status = error.response.status;
  const errorData = error.response.data?.error || {};
  const code = errorData.code;

  const permanentErrors = [4, 33, 80007, 131031, 131042, 131047, 131048, 131051, 200, 190, 368];
  const temporaryErrors = [1, 2, 10, 130429, 131056];

  if (status === 401 || status === 403) {
    errorAnalysis.isBanned = true;
    errorAnalysis.severity = 'high';
    errorAnalysis.shouldRemove = true;
  } else if (permanentErrors.includes(code)) {
    errorAnalysis.isBanned = true;
    errorAnalysis.severity = 'high';
  } else if (temporaryErrors.includes(code) || status >= 500) {
    errorAnalysis.isTemporary = true;
    errorAnalysis.severity = 'medium';
  } else if (status === 404) {
    errorAnalysis.isBanned = true;
    errorAnalysis.severity = 'high';
    errorAnalysis.shouldRemove = true;
  }

  return errorAnalysis;
}

// Função para testar envio REAL de mensagem (método mais confiável!)
async function checkWhatsAppNumberByMessageSend(token, phoneNumberId, testPhoneNumber) {
  try {
    console.log(`    📤 TESTE REAL: Enviando mensagem para ${testPhoneNumber}`);
    
    // Enviar mensagem de teste para verificar se número está ativo
    const now = new Date();
    const timeStr = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    
    const response = await axios.post(
      `https://graph.facebook.com/${CONFIG.META_API_VERSION}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: testPhoneNumber,
        type: 'text',
        text: {
          body: `✅ Número ativo - ${timeStr}`
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log(`    ✅ MENSAGEM ENVIADA! Número 100% funcional!`);
    console.log(`    📊 Message ID:`, response.data.messages?.[0]?.id || 'N/A');

    return {
      active: true,
      error: null,
      errorCode: null,
      analysis: null,
      testMethod: 'MESSAGE_SEND',
      messageId: response.data.messages?.[0]?.id,
      qualityRating: 'TESTED' // Testado por envio real!
    };

  } catch (error) {
    console.log(`    ❌ ERRO AO ENVIAR MENSAGEM:`, error.message);

    const analysis = analyzeErrorCode(error);
    let errorMessage = 'Erro desconhecido';
    let errorCode = null;

    if (error.response) {
      errorCode = error.response.data?.error?.code || error.response.status;
      const errorDetails = error.response.data?.error || {};
      errorMessage = errorDetails.message || `HTTP ${error.response.status}`;

      console.log(`    ❌ Código do erro: ${errorCode}`);
      console.log(`    ❌ Mensagem: ${errorMessage}`);
      console.log(`    ❌ Tipo de erro:`, errorDetails.error_subcode || 'N/A');

      // Análise específica de erros de envio
      // QUALQUER ERRO desativa o número - operador decide se reativa ou exclui
      if (errorCode === 131031) {
        errorMessage = 'CONTA DESABILITADA/RESTRITA pelo WhatsApp. Não pode enviar mensagens!';
        analysis.isBanned = true;
        analysis.shouldRemove = false;
      } else if (errorCode === 131056) {
        errorMessage = 'Messaging not allowed. Conta sem permissão para enviar mensagens.';
        analysis.isBanned = true;
        analysis.shouldRemove = false;
      } else if (errorCode === 368) {
        errorMessage = 'Conta temporariamente bloqueada por violação de políticas.';
        analysis.isBanned = true;
        analysis.shouldRemove = false;
      } else if (errorCode === 131047) {
        errorMessage = 'Erro ao enviar mensagem (#131047). Pode ser: janela de 24h expirou OU conta restrita. Operador deve verificar.';
        analysis.isBanned = true; // Trata como erro sério
        analysis.shouldRemove = false;
      } else if (errorCode === 131026) {
        errorMessage = 'Número de destino inválido ou não tem WhatsApp.';
        analysis.isBanned = true;
        analysis.shouldRemove = false;
      } else if (errorCode === 130429) {
        errorMessage = 'Rate limit atingido. Aguarde antes de testar novamente.';
        analysis.isBanned = true;
        analysis.shouldRemove = false;
      }
    }

    return {
      active: false,
      error: errorMessage,
      errorCode,
      analysis,
      testMethod: 'MESSAGE_SEND'
    };
  }
}

// Função para verificar via API (método fallback)
async function checkWhatsAppNumber(token, phoneNumberId) {
  try {
    console.log(`    🔍 Testando Phone Number ID: ${phoneNumberId}`);
    console.log(`    🔑 Token: ${token.substring(0, 20)}...`);
    
    // PRIMEIRO: Buscar informações do Phone Number
    const response = await axios.get(
      `https://graph.facebook.com/${CONFIG.META_API_VERSION}/${phoneNumberId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          fields: 'id,display_phone_number,verified_name,quality_rating,account_mode,name_status'
        },
        timeout: 15000
      }
    );

    console.log(`    ✅ Phone Number ID válido!`);
    console.log(`    📊 Campos disponíveis:`, Object.keys(response.data).join(', '));

    const numberData = response.data;
    
    // Extrair informações do Phone Number
    const displayPhoneNumber = numberData.display_phone_number || null;
    const verifiedName = numberData.verified_name || null;
    const qualityRating = numberData.quality_rating || 'UNKNOWN';
    const accountMode = numberData.account_mode || 'UNKNOWN';
    const nameStatus = numberData.name_status || 'UNKNOWN';

    console.log(`    📱 Número: ${displayPhoneNumber || 'N/A'}`);
    console.log(`    🏢 Nome: ${verifiedName || 'Não verificado'}`);
    console.log(`    ⭐ Quality: ${qualityRating}`);
    console.log(`    🔒 Account Mode: ${accountMode}`);
    console.log(`    📝 Name Status: ${nameStatus}`);

    // SEGUNDO: Tentar verificar status da WABA (conta)
    // Pegar o WABA ID do número
    let wabaRestricted = false;
    let wabaStatus = 'UNKNOWN';
    
    try {
      // Buscar a qual WABA este número pertence
      const wabaResponse = await axios.get(
        `https://graph.facebook.com/${CONFIG.META_API_VERSION}/${phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          params: {
            fields: 'account_mode,is_official_business_account'
          },
          timeout: 10000
        }
      );
      
      wabaStatus = wabaResponse.data.account_mode || 'UNKNOWN';
      
      // SANDBOX ou LIVE mode
      if (wabaResponse.data.account_mode === 'SANDBOX') {
        console.log(`    ⚠️  Conta em modo SANDBOX - funcionalidade limitada`);
      }
      
    } catch (wabaError) {
      console.log(`    ⚠️  Não foi possível verificar status da WABA:`, wabaError.message);
    }

    // ===== VERIFICAÇÃO DE QUALITY RATING =====
    if (qualityRating === 'RED') {
      return {
        active: false,
        error: 'Quality Rating: RED - Qualidade muito baixa. Número restrito ou banido.',
        errorCode: 'QUALITY_RED',
        analysis: {
          isBanned: true,
          isTemporary: true,
          shouldRemove: false,
          severity: 'high'
        },
        qualityRating,
        displayPhoneNumber,
        verifiedName,
        accountMode,
        wabaStatus
      };
    }

    // ===== VERIFICAÇÃO DE NAME STATUS =====
    // Se nome foi rejeitado, pode ter restrições
    if (nameStatus === 'DECLINED' || nameStatus === 'PENDING_REVIEW') {
      console.log(`    ⚠️  Name Status: ${nameStatus} - Pode ter limitações`);
    }

    // ===== AVISO SE QUALITY RATING AMARELO =====
    if (qualityRating === 'YELLOW') {
      console.log(`    ⚠️  Quality Rating: YELLOW - Atenção necessária! Conta pode ser restrita em breve.`);
    }

    // ===== AVISO IMPORTANTE =====
    // Se a conta aparece como "Conectado" mas não envia, pode ser restrição no nível da WABA
    // Isso NÃO aparece na API do Phone Number!
    console.log(`    💡 Nota: Se o número está "Conectado" mas não envia mensagens,`);
    console.log(`    💡 verifique manualmente no Meta Business Manager se a CONTA está restrita.`);

    // Tudo OK na verificação da API
    return { 
      active: true, 
      error: null,
      errorCode: null,
      analysis: null,
      qualityRating,
      displayPhoneNumber,
      verifiedName,
      accountMode,
      wabaStatus
    };
    
  } catch (error) {
    console.log(`    ❌ ERRO na API:`, error.message);
    
    const analysis = analyzeErrorCode(error);
    let errorMessage = 'Erro desconhecido';
    let errorCode = null;
    
    if (error.response) {
      errorCode = error.response.data?.error?.code || error.response.status;
      const errorDetails = error.response.data?.error || {};
      errorMessage = errorDetails.message || `HTTP ${error.response.status}`;
      
      console.log(`    ❌ Código do erro: ${errorCode}`);
      console.log(`    ❌ Mensagem: ${errorMessage}`);
      console.log(`    ❌ Detalhes completos:`, JSON.stringify(errorDetails, null, 2));
      
      // Mensagens de erro mais úteis
      if (errorCode === 100) {
        errorMessage = `Erro #100: Campo inválido ou Phone Number ID incorreto. 
        
Verifique:
1. Phone Number ID (não é o Business Account ID!)
2. Token tem permissões: whatsapp_business_management, whatsapp_business_messaging
3. Número está registrado na conta correta

Phone Number ID usado: ${phoneNumberId}`;
      } else if (errorCode === 190) {
        errorMessage = 'Token inválido ou expirado. Gere um novo token permanente no Meta Business.';
      } else if (errorCode === 200 || errorCode === 10) {
        errorMessage = 'Token sem permissões corretas. Adicione: whatsapp_business_management e whatsapp_business_messaging';
      } else if (errorCode === 131031 || errorCode === 131056) {
        errorMessage = 'CONTA RESTRITA ou BANIDA pelo WhatsApp. Não pode enviar mensagens.';
        analysis.isBanned = true;
        analysis.shouldRemove = false; // Pode ser temporário
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Timeout na requisição';
      analysis.isTemporary = true;
    } else {
      errorMessage = error.message;
      analysis.isTemporary = true;
    }

    return { 
      active: false, 
      error: errorMessage,
      errorCode,
      analysis
    };
  }
}

async function performHealthCheck() {
  console.log('\n🔍 ========== INICIANDO HEALTH CHECK ==========');
  await addLog('health_check', 'Health check iniciado');
  
  const results = {
    checked: 0,
    active: 0,
    disabled: 0,
    errors: []
  };

  try {
    const apps = await App.find();
    const stats = await getStats();

    for (const app of apps) {
      console.log(`\n📱 Verificando ${app.appName} (${app.appId})...`);

      // Verificar WABA Status (método ÚNICO e definitivo)
      const result = await checkWABAStatus(app.token, app.wabaId);
      
      // Atualizar status de todos os números deste app
      for (const [number, numberData] of app.numbers) {
        const wasActive = numberData.active;
        results.checked++;

        numberData.lastCheck = new Date();

        if (result.active) {
          // Número voltou a funcionar
          if (!wasActive && numberData.failedChecks > 0) {
            await addLog('recovery', `Número recuperado: ${number}`, { 
              appId: app.appId, 
              failedChecks: numberData.failedChecks 
            });
            
            await sendNotification(
              '✅ Número Recuperado',
              `O número ${number} voltou a funcionar!`,
              { appId: app.appId, appName: app.appName, number }
            );
            
            stats.totalRecoveries++;
          }

          numberData.active = true;
          numberData.error = null;
          numberData.errorCode = null;
          numberData.failedChecks = 0;
          numberData.qualityRating = `WABA: ${result.wabaStatus?.account_review_status || 'OK'}`;
          results.active++;

          console.log(`  ✅ ${number} - Ativo | WABA Status: ${result.wabaStatus?.account_review_status} | Tier: ${result.wabaStatus?.messaging_limit_tier}`);
        } else {
          // Número com erro (WABA com problema)
          numberData.error = result.error;
          numberData.errorCode = result.errorCode;

          const previousFailedChecks = numberData.failedChecks || 0;
          const nextFailedChecks = Math.min(previousFailedChecks + 1, CONFIG.MAX_FAILED_CHECKS);
          const reachedLimit = nextFailedChecks === CONFIG.MAX_FAILED_CHECKS;
          const hitLimitNow = reachedLimit && previousFailedChecks < CONFIG.MAX_FAILED_CHECKS;

          numberData.failedChecks = nextFailedChecks;

          console.log(`  ❌ ${number} - Erro WABA: ${result.error} (Tentativa ${numberData.failedChecks}/${CONFIG.MAX_FAILED_CHECKS})`);

          // ===== LÓGICA DE QUARENTENA CORRIGIDA =====
          // QUALQUER erro desativa o número imediatamente
          // Após 3 falhas consecutivas, DESATIVA permanentemente (não remove!)
          // Operador decide se reativa ou exclui manualmente
          
          // SEMPRE DESATIVA o número ao ter erro
          numberData.active = false;
          numberData.lastStatusChange = new Date();
          
          // Salvar as mudanças no Map
          app.numbers.set(number, numberData);
          
          if (reachedLimit) {
            results.disabled++;

            if (hitLimitNow) {
              // 3ª FALHA: DESATIVADO PERMANENTEMENTE (não remove!)
              await addLog('ban', `Número DESATIVADO após 3 falhas (WABA com problema): ${number}`, { 
                appId: app.appId,
                reason: result.error,
                errorCode: result.errorCode,
                failedChecks: numberData.failedChecks,
                wabaStatus: result.wabaStatus
              });

              await sendNotification(
                '🚫 Número Desativado Permanentemente',
                `O número ${number} foi DESATIVADO após ${numberData.failedChecks} falhas consecutivas (WABA com problema). AÇÃO NECESSÁRIA: Verificar manualmente e decidir se reativa ou exclui.`,
                { 
                  appId: app.appId, 
                  appName: app.appName, 
                  number,
                  reason: result.error,
                  errorCode: result.errorCode,
                  action: 'VERIFICAÇÃO MANUAL NECESSÁRIA'
                }
              );

              stats.totalBans++;
              console.log(`    🚫 DESATIVADO PERMANENTEMENTE (${numberData.failedChecks} falhas) - Verificação manual necessária`);
            } else {
              console.log('    🔁 Número permanece desativado permanentemente (aguardando ação manual).');
            }
            
          } else {
            // 1ª ou 2ª FALHA: DESATIVAR e colocar em QUARENTENA
            results.disabled++;

            if (numberData.failedChecks === 1) {
              await addLog('quarantine', `Número em QUARENTENA (1ª falha - WABA com problema): ${number}`, { 
                appId: app.appId,
                reason: result.error,
                errorCode: result.errorCode,
                wabaStatus: result.wabaStatus
              });

              await sendNotification(
                '⚠️ Número em Quarentena',
                `O número ${number} foi DESATIVADO após erro WABA. Tentativa ${numberData.failedChecks}/${CONFIG.MAX_FAILED_CHECKS}. Será testado novamente no próximo health check.`,
                { 
                  appId: app.appId, 
                  appName: app.appName, 
                  number,
                  reason: result.error,
                  errorCode: result.errorCode,
                  wabaStatus: result.wabaStatus
                }
              );
            }

            console.log(`    ⚠️  EM QUARENTENA - INATIVO (${numberData.failedChecks}/${CONFIG.MAX_FAILED_CHECKS} falhas)`);
            console.log(`    💡 Será testado novamente no próximo health check`);
          }

          results.errors.push({
            appId: app.appId,
            appName: app.appName,
            number,
            error: result.error,
            errorCode: result.errorCode,
            failedChecks: numberData.failedChecks,
            inQuarantine: numberData.failedChecks < CONFIG.MAX_FAILED_CHECKS
          });
        }
      }

      await app.save();
    }

    stats.lastHealthCheck = new Date();
    stats.totalChecks++;
    await stats.save();

    console.log('\n📊 ========== RESULTADO DO HEALTH CHECK ==========');
    console.log(`✅ Números verificados: ${results.checked}`);
    console.log(`✅ Ativos: ${results.active}`);
    console.log(`⚠️  Desativados/Quarentena: ${results.disabled}`);
    console.log(`❌ Erros detectados: ${results.errors.length}`);
    console.log('================================================\n');

    await addLog('health_check', 'Health check completo', results);

    return results;
  } catch (error) {
    console.error('Erro no health check:', error);
    throw error;
  }
}

// Executar health check manual
app.post('/api/health-check', async (req, res) => {
  try {
    const results = await performHealthCheck();
    const stats = await getStats();
    res.json({ 
      success: true, 
      lastCheck: stats.lastHealthCheck,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ROTA DE TESTE DE WABA =====

app.post('/api/test-waba', async (req, res) => {
  const { token, wabaId } = req.body;
  
  if (!token || !wabaId) {
    return res.status(400).json({ 
      success: false,
      error: 'Token e WABA ID são obrigatórios',
      details: 'Forneça "token" e "wabaId" no body da requisição'
    });
  }
  
  try {
    console.log(`🧪 TESTE: Verificando acesso ao WABA ${wabaId}...`);
    
    const response = await axios.get(
      `https://graph.facebook.com/${CONFIG.META_API_VERSION}/${wabaId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          fields: 'id,name,account_review_status,messaging_limit_tier,business_verification_status'
        },
        timeout: 15000
      }
    );
    
    const data = response.data;
    
    console.log(`✅ SUCESSO: Token tem acesso à WABA!`);
    console.log(`   Nome: ${data.name || 'N/A'}`);
    console.log(`   Status: ${data.account_review_status || 'N/A'}`);
    console.log(`   Tier: ${data.messaging_limit_tier || 'N/A'}`);
    
    res.json({
      success: true,
      waba: {
        id: data.id,
        name: data.name,
        account_review_status: data.account_review_status,
        messaging_limit_tier: data.messaging_limit_tier,
        business_verification_status: data.business_verification_status
      },
      message: '✅ Token tem acesso à WABA!',
      recommendation: data.account_review_status === 'APPROVED' && data.messaging_limit_tier !== 'TIER_0' 
        ? '✅ WABA está aprovada e pode enviar mensagens!' 
        : '⚠️ WABA pode ter restrições. Verifique o status acima.'
    });
    
  } catch (error) {
    console.log(`❌ ERRO: ${error.message}`);
    
    let errorDetails = {
      success: false,
      error: 'Erro ao acessar WABA',
      details: error.message
    };
    
    if (error.response) {
      const apiError = error.response.data?.error || {};
      const errorCode = apiError.code || error.response.status;
      
      errorDetails = {
        success: false,
        error: `Erro #${errorCode}: ${apiError.message || 'Erro desconhecido'}`,
        errorCode: errorCode,
        details: '',
        recommendations: []
      };
      
      // Diagnóstico específico
      if (errorCode === 100) {
        errorDetails.details = 'O token NÃO TEM ACESSO ao WABA ID especificado.';
        errorDetails.recommendations = [
          '1. Verifique se o WABA ID está correto (copie do Meta Business Manager)',
          '2. Verifique se o token foi gerado no App correto (que tem acesso a essa WABA)',
          '3. Verifique se o App está conectado à WABA em "Aplicativos conectados"',
          '4. Gere um novo token com permissões: whatsapp_business_management e whatsapp_business_messaging'
        ];
      } else if (errorCode === 190) {
        errorDetails.details = 'Token inválido ou expirado.';
        errorDetails.recommendations = [
          '1. Gere um novo token no Meta Developers',
          '2. Use um System User Token (permanente) ao invés de Temporary Token',
          '3. Verifique se copiou o token completo (começa com EAA...)'
        ];
      } else if (errorCode === 200 || errorCode === 10) {
        errorDetails.details = 'Token sem permissões suficientes.';
        errorDetails.recommendations = [
          '1. Ao gerar o token, selecione as permissões:',
          '   - whatsapp_business_management',
          '   - whatsapp_business_messaging',
          '2. Use um System User Token com função de Administrador'
        ];
      }
    } else if (error.code === 'ECONNABORTED') {
      errorDetails.details = 'Timeout na requisição. API do Meta não respondeu a tempo.';
      errorDetails.recommendations = [
        '1. Tente novamente em alguns segundos',
        '2. Verifique sua conexão com a internet'
      ];
    }
    
    res.status(400).json(errorDetails);
  }
});

// ===== ROTAS DE CONFIGURAÇÃO =====

app.get('/api/config', (req, res) => {
  res.json({
    maxFailedChecks: CONFIG.MAX_FAILED_CHECKS,
    healthCheckInterval: CONFIG.HEALTH_CHECK_INTERVAL,
    webhookConfigured: !!CONFIG.WEBHOOK_URL,
    metaApiVersion: CONFIG.META_API_VERSION,
    database: 'MongoDB Atlas'
  });
});

// ===== CRON JOBS =====

// Health check automático
cron.schedule(CONFIG.HEALTH_CHECK_INTERVAL, () => {
  console.log('⏰ Executando health check automático...');
  performHealthCheck().catch(err => console.error('Erro no health check automático:', err));
});

// ===== ROTA DE HEALTH (para Render.com) =====

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: 'MongoDB'
  });
});

// ===== INICIAR SERVIDOR =====

async function startServer() {
  try {
    // Conectar ao banco
    await connectDatabase();
    
    // Iniciar servidor
    app.listen(PORT, async () => {
      console.log('\n🚀 ========== WHATSAPP MANAGER INICIADO ==========');
      console.log(`📡 Servidor rodando na porta ${PORT}`);
      console.log(`🌐 URL: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}`);
      console.log(`📊 Dashboard: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}`);
      console.log(`🔗 API: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}/api`);
      console.log(`⏰ Health Check: ${CONFIG.HEALTH_CHECK_INTERVAL}`);
      console.log(`💾 Database: MongoDB Atlas`);
      
      const apps = await App.find();
      console.log(`📱 Apps cadastrados: ${apps.length}`);
      console.log('================================================\n');
      
      await addLog('system', 'Sistema iniciado', {
        port: PORT,
        totalApps: apps.length,
        database: 'MongoDB'
      });

      // Health check inicial (após 10 segundos)
      if (apps.length > 0) {
        setTimeout(() => {
          console.log('🔍 Executando health check inicial...');
          performHealthCheck().catch(err => console.error('Erro no health check inicial:', err));
        }, 10000);
      }
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Salvar dados antes de fechar
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM recebido. Encerrando...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT recebido. Encerrando...');
  process.exit(0);
});

// Iniciar
startServer();

