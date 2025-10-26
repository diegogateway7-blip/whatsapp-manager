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

async function checkWhatsAppNumber(token, phoneNumberId) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/${CONFIG.META_API_VERSION}/${phoneNumberId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 15000
      }
    );

    const numberData = response.data;
    const qualityRating = numberData.quality_rating || 'UNKNOWN';

    return { 
      active: true, 
      error: null,
      errorCode: null,
      analysis: null,
      qualityRating
    };
  } catch (error) {
    const analysis = analyzeErrorCode(error);
    let errorMessage = 'Erro desconhecido';
    let errorCode = null;
    
    if (error.response) {
      errorCode = error.response.data?.error?.code || error.response.status;
      errorMessage = error.response.data?.error?.message || `HTTP ${error.response.status}`;
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

      const result = await checkWhatsAppNumber(app.token, app.phoneNumberId);
      
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
          results.active++;

          console.log(`  ✅ ${number} - Ativo ${result.qualityRating ? `(${result.qualityRating})` : ''}`);
        } else {
          // Número com erro
          numberData.error = result.error;
          numberData.errorCode = result.errorCode;
          numberData.failedChecks++;

          const analysis = result.analysis;
          console.log(`  ❌ ${number} - Erro: ${result.error} (Tentativa ${numberData.failedChecks}/${CONFIG.MAX_FAILED_CHECKS})`);

          // Decidir ação baseada na análise
          if (analysis.shouldRemove || numberData.failedChecks >= CONFIG.MAX_FAILED_CHECKS) {
            // Remover número automaticamente
            await addLog('ban', `Número REMOVIDO automaticamente: ${number}`, { 
              appId: app.appId,
              reason: result.error,
              errorCode: result.errorCode,
              failedChecks: numberData.failedChecks,
              analysis
            });

            await sendNotification(
              '🚫 Número Banido/Removido',
              `O número ${number} foi removido automaticamente após ${numberData.failedChecks} falhas.`,
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
            console.log(`    🗑️  REMOVIDO AUTOMATICAMENTE`);
          } else if (analysis.isBanned) {
            // Desativar e marcar para quarentena
            numberData.active = false;
            numberData.lastStatusChange = new Date();
            results.disabled++;

            if (numberData.failedChecks === 1) {
              await addLog('quarantine', `Número em quarentena: ${number}`, { 
                appId: app.appId,
                reason: result.error,
                errorCode: result.errorCode
              });

              await sendNotification(
                '⚠️ Número em Quarentena',
                `O número ${number} foi desativado. Tentativa ${numberData.failedChecks}/${CONFIG.MAX_FAILED_CHECKS}`,
                { 
                  appId: app.appId, 
                  appName: app.appName, 
                  number,
                  reason: result.error
                }
              );
            }

            console.log(`    ⚠️  EM QUARENTENA (${numberData.failedChecks}/${CONFIG.MAX_FAILED_CHECKS})`);
          } else if (analysis.isTemporary) {
            console.log(`    ⏳ ERRO TEMPORÁRIO - mantendo ativo por enquanto`);
            results.active++;
          }

          app.numbers.set(number, numberData);

          results.errors.push({
            appId: app.appId,
            appName: app.appName,
            number,
            error: result.error,
            errorCode: result.errorCode,
            failedChecks: numberData.failedChecks
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

