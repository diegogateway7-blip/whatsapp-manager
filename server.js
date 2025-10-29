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
  const { appId, appName, token, phoneNumberId } = req.body;
  
  if (!appId || !appName || !token || !phoneNumberId) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  try {
    let app = await App.findOne({ appId });
    
    if (!app) {
      app = new App({
        appId,
      appName,
      token,
      phoneNumberId,
        numbers: new Map()
      });
      await addLog('app', `App criado: ${appName}`, { appId });
  } else {
      app.appName = appName;
      app.token = token;
      app.phoneNumberId = phoneNumberId;
      app.updatedAt = new Date();
      await addLog('app', `App atualizado: ${appName}`, { appId });
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
      numberData.failedChecks = 0;
      numberData.error = null;
      numberData.errorCode = null;
    }

    app.numbers.set(number, numberData);
    await app.save();
    await addLog('number', `Número ${active ? 'ativado' : 'desativado'} manualmente: ${number}`, { appId, number });
    
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
    
    // Tentar enviar mensagem de teste
    const response = await axios.post(
      `https://graph.facebook.com/${CONFIG.META_API_VERSION}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: testPhoneNumber,
        type: 'text',
        text: {
          body: '✅ Health check automático - Número funcionando!'
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
        analysis.isTemporary = true;
      } else if (errorCode === 131047) {
        errorMessage = 'Janela de 24 horas expirou. Peça para o número de teste mandar uma mensagem novamente.';
        analysis.isTemporary = true;
        analysis.isBanned = false;
      } else if (errorCode === 131026) {
        errorMessage = 'Número de destino inválido ou não tem WhatsApp.';
        analysis.isTemporary = true;
        analysis.isBanned = false;
      } else if (errorCode === 130429) {
        errorMessage = 'Rate limit atingido. Aguarde antes de testar novamente.';
        analysis.isTemporary = true;
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
    removed: 0,
    errors: []
  };

  try {
    const apps = await App.find();
    const stats = await getStats();

    for (const app of apps) {
      console.log(`\n📱 Verificando ${app.appName} (${app.appId})...`);

      // Escolher método de verificação
      let result;
      if (app.testPhoneNumber) {
        console.log(`    💡 Usando TESTE REAL por envio de mensagem`);
        result = await checkWhatsAppNumberByMessageSend(app.token, app.phoneNumberId, app.testPhoneNumber);
        
        // Verificar se janela de 24h está próxima de expirar
        if (app.lastMessageWindowRenewal) {
          const hoursSinceRenewal = (new Date() - new Date(app.lastMessageWindowRenewal)) / (1000 * 60 * 60);
          if (hoursSinceRenewal > 23) {
            console.log(`    ⚠️  ATENÇÃO: Janela de 24h vai expirar em breve! Renove enviando mensagem do ${app.testPhoneNumber}`);
          } else {
            console.log(`    ⏰ Janela válida por mais ${Math.floor(24 - hoursSinceRenewal)}h`);
          }
        }
      } else {
        console.log(`    💡 Usando verificação por API (configure testPhoneNumber para teste real)`);
        result = await checkWhatsAppNumber(app.token, app.phoneNumberId);
      }
    
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
          numberData.qualityRating = result.qualityRating;
          numberData.displayPhoneNumber = result.displayPhoneNumber;
          numberData.verifiedName = result.verifiedName;
          results.active++;

          console.log(`  ✅ ${number} - Ativo | Quality: ${result.qualityRating} | Display: ${result.displayPhoneNumber || 'N/A'} | Verified: ${result.verifiedName ? 'Sim' : 'Não'}`);
        } else {
          // Número com erro
          numberData.error = result.error;
          numberData.errorCode = result.errorCode;
          numberData.failedChecks++;

          const analysis = result.analysis;
          console.log(`  ❌ ${number} - Erro: ${result.error} (Tentativa ${numberData.failedChecks}/${CONFIG.MAX_FAILED_CHECKS})`);

          // ===== LÓGICA DE QUARENTENA CORRIGIDA =====
          // QUALQUER erro desativa o número imediatamente
          // Após 3 falhas consecutivas, remove automaticamente
          
          if (numberData.failedChecks >= CONFIG.MAX_FAILED_CHECKS) {
            // 3ª FALHA: REMOVER número automaticamente
            await addLog('ban', `Número REMOVIDO automaticamente: ${number}`, { 
              appId: app.appId,
              reason: result.error,
              errorCode: result.errorCode,
              failedChecks: numberData.failedChecks,
              severity: analysis.severity || 'high'
            });

            await sendNotification(
              '🚫 Número Banido/Removido',
              `O número ${number} foi removido automaticamente após ${numberData.failedChecks} falhas consecutivas.`,
              { 
                appId: app.appId, 
                appName: app.appName, 
                number,
                reason: result.error,
                errorCode: result.errorCode
              }
            );

            app.numbers.delete(number);
            stats.totalBans++;
            results.removed++;
            console.log(`    🗑️  REMOVIDO AUTOMATICAMENTE (${numberData.failedChecks} falhas)`);
            
          } else {
            // 1ª ou 2ª FALHA: DESATIVAR e colocar em QUARENTENA
            numberData.active = false;
            numberData.lastStatusChange = new Date();
            results.disabled++;

            // Salvar as mudanças no Map
            app.numbers.set(number, numberData);

            // Log e notificação apenas na primeira falha
            if (numberData.failedChecks === 1) {
              await addLog('quarantine', `Número em QUARENTENA (1ª falha): ${number}`, { 
                appId: app.appId,
                reason: result.error,
                errorCode: result.errorCode,
                errorType: analysis.isTemporary ? 'temporário' : 'permanente'
              });

              await sendNotification(
                '⚠️ Número em Quarentena',
                `O número ${number} foi DESATIVADO após erro. Ele tem ${CONFIG.MAX_FAILED_CHECKS} chances antes de ser removido. (Tentativa ${numberData.failedChecks}/${CONFIG.MAX_FAILED_CHECKS})`,
                { 
                  appId: app.appId, 
                  appName: app.appName, 
                  number,
                  reason: result.error,
                  errorCode: result.errorCode
                }
              );
            }

            console.log(`    ⚠️  EM QUARENTENA - INATIVO (${numberData.failedChecks}/${CONFIG.MAX_FAILED_CHECKS} falhas)`);
            
            if (analysis.isTemporary) {
              console.log(`    💡 Tipo: Erro temporário (será tentado novamente no próximo check)`);
            }
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
    console.log(`⚠️  Desativados: ${results.disabled}`);
    console.log(`🗑️  Removidos: ${results.removed}`);
    console.log(`❌ Erros: ${results.errors.length}`);
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

