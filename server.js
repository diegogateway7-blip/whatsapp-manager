const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configurações
const CONFIG = {
  DATA_FILE: path.join(__dirname, 'data', 'database.json'),
  LOGS_FILE: path.join(__dirname, 'data', 'logs.json'),
  BACKUP_DIR: path.join(__dirname, 'data', 'backups'),
  MAX_FAILED_CHECKS: 3, // Após 3 falhas consecutivas, remove o número
  HEALTH_CHECK_INTERVAL: '*/15 * * * *', // A cada 15 minutos
  BACKUP_INTERVAL: '0 */6 * * *', // Backup a cada 6 horas
  WEBHOOK_URL: process.env.WEBHOOK_URL || null, // URL para notificações
  META_API_VERSION: 'v21.0'
};

// Criar diretórios necessários
[path.dirname(CONFIG.DATA_FILE), CONFIG.BACKUP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Banco de dados
let database = {
  apps: {},
  lastHealthCheck: null,
  stats: {
    totalChecks: 0,
    totalBans: 0,
    totalRecoveries: 0
  }
};

// Logs
let logs = [];

// ===== FUNÇÕES DE PERSISTÊNCIA =====

function loadDatabase() {
  try {
    if (fs.existsSync(CONFIG.DATA_FILE)) {
      const data = fs.readFileSync(CONFIG.DATA_FILE, 'utf8');
      database = JSON.parse(data);
      console.log('✅ Database carregado com sucesso');
    } else {
      console.log('📝 Criando novo database');
      saveDatabase();
    }
  } catch (error) {
    console.error('❌ Erro ao carregar database:', error);
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(database, null, 2));
  } catch (error) {
    console.error('❌ Erro ao salvar database:', error);
  }
}

function loadLogs() {
  try {
    if (fs.existsSync(CONFIG.LOGS_FILE)) {
      const data = fs.readFileSync(CONFIG.LOGS_FILE, 'utf8');
      logs = JSON.parse(data);
      // Manter apenas últimos 1000 logs
      if (logs.length > 1000) {
        logs = logs.slice(-1000);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao carregar logs:', error);
  }
}

function saveLogs() {
  try {
    fs.writeFileSync(CONFIG.LOGS_FILE, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('❌ Erro ao salvar logs:', error);
  }
}

function addLog(type, message, data = {}) {
  const log = {
    timestamp: new Date().toISOString(),
    type,
    message,
    data
  };
  
  logs.push(log);
  console.log(`[${type.toUpperCase()}] ${message}`, data);
  
  // Salvar logs a cada 10 entradas
  if (logs.length % 10 === 0) {
    saveLogs();
  }
}

function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(CONFIG.BACKUP_DIR, `backup-${timestamp}.json`);
    
    fs.writeFileSync(backupFile, JSON.stringify({
      database,
      logs: logs.slice(-100) // Últimos 100 logs
    }, null, 2));
    
    addLog('backup', 'Backup criado com sucesso', { file: backupFile });
    
    // Limpar backups antigos (manter últimos 10)
    const backups = fs.readdirSync(CONFIG.BACKUP_DIR)
      .filter(f => f.startsWith('backup-'))
      .sort()
      .reverse();
    
    if (backups.length > 10) {
      backups.slice(10).forEach(f => {
        fs.unlinkSync(path.join(CONFIG.BACKUP_DIR, f));
      });
    }
  } catch (error) {
    console.error('❌ Erro ao criar backup:', error);
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
    
    addLog('notification', 'Notificação enviada', { title, message });
  } catch (error) {
    console.error('❌ Erro ao enviar notificação:', error.message);
  }
}

// ===== ROTAS DE GERENCIAMENTO =====

// Obter todos os apps
app.get('/api/apps', (req, res) => {
  res.json(database.apps);
});

// Adicionar ou atualizar app
app.post('/api/apps', (req, res) => {
  const { appId, appName, token, phoneNumberId } = req.body;
  
  if (!appId || !appName || !token || !phoneNumberId) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const isNew = !database.apps[appId];

  if (isNew) {
    database.apps[appId] = {
      appName,
      token,
      phoneNumberId,
      numbers: {},
      createdAt: new Date().toISOString()
    };
    addLog('app', `App criado: ${appName}`, { appId });
  } else {
    database.apps[appId].appName = appName;
    database.apps[appId].token = token;
    database.apps[appId].phoneNumberId = phoneNumberId;
    database.apps[appId].updatedAt = new Date().toISOString();
    addLog('app', `App atualizado: ${appName}`, { appId });
  }

  saveDatabase();
  res.json({ success: true, app: database.apps[appId] });
});

// Deletar app
app.delete('/api/apps/:appId', (req, res) => {
  const { appId } = req.params;
  
  if (database.apps[appId]) {
    const appName = database.apps[appId].appName;
    delete database.apps[appId];
    saveDatabase();
    addLog('app', `App deletado: ${appName}`, { appId });
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'App não encontrado' });
  }
});

// Adicionar número a um app
app.post('/api/apps/:appId/numbers', (req, res) => {
  const { appId } = req.params;
  const { number } = req.body;

  if (!database.apps[appId]) {
    return res.status(404).json({ error: 'App não encontrado' });
  }

  if (!number || !/^\d+$/.test(number)) {
    return res.status(400).json({ error: 'Número inválido' });
  }

  database.apps[appId].numbers[number] = {
    active: true,
    lastCheck: null,
    error: null,
    errorCode: null,
    failedChecks: 0,
    addedAt: new Date().toISOString(),
    lastStatusChange: new Date().toISOString()
  };

  saveDatabase();
  addLog('number', `Número adicionado: ${number}`, { appId, number });
  res.json({ success: true, number: database.apps[appId].numbers[number] });
});

// Deletar número
app.delete('/api/apps/:appId/numbers/:number', (req, res) => {
  const { appId, number } = req.params;

  if (!database.apps[appId]) {
    return res.status(404).json({ error: 'App não encontrado' });
  }

  if (database.apps[appId].numbers[number]) {
    delete database.apps[appId].numbers[number];
    saveDatabase();
    addLog('number', `Número deletado: ${number}`, { appId, number });
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Número não encontrado' });
  }
});

// Ativar/desativar número manualmente
app.patch('/api/apps/:appId/numbers/:number', (req, res) => {
  const { appId, number } = req.params;
  const { active } = req.body;

  if (!database.apps[appId] || !database.apps[appId].numbers[number]) {
    return res.status(404).json({ error: 'App ou número não encontrado' });
  }

  const wasActive = database.apps[appId].numbers[number].active;
  database.apps[appId].numbers[number].active = active;
  database.apps[appId].numbers[number].lastStatusChange = new Date().toISOString();
  
  // Resetar contador de falhas se ativado manualmente
  if (active) {
    database.apps[appId].numbers[number].failedChecks = 0;
    database.apps[appId].numbers[number].error = null;
    database.apps[appId].numbers[number].errorCode = null;
  }

  saveDatabase();
  addLog('number', `Número ${active ? 'ativado' : 'desativado'} manualmente: ${number}`, { appId, number });
  
  res.json({ success: true, number: database.apps[appId].numbers[number] });
});

// ===== ROTAS PARA TYPEBOT =====

// Obter número ativo aleatório
app.get('/api/get-active-number', (req, res) => {
  const activeNumbers = [];

  // Coletar todos os números ativos
  for (const appId in database.apps) {
    const app = database.apps[appId];
    for (const number in app.numbers) {
      if (app.numbers[number].active) {
        activeNumbers.push({ 
          number, 
          appId,
          appName: app.appName,
          lastCheck: app.numbers[number].lastCheck
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
  
  addLog('redirect', `Número fornecido para redirect: ${random.number}`, { 
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
});

// Status do sistema
app.get('/api/status', (req, res) => {
  let totalNumbers = 0;
  let activeNumbers = 0;
  let inQuarantine = 0;

  for (const appId in database.apps) {
    const app = database.apps[appId];
    for (const number in app.numbers) {
      totalNumbers++;
      if (app.numbers[number].active) {
        activeNumbers++;
      }
      if (app.numbers[number].failedChecks > 0 && app.numbers[number].failedChecks < CONFIG.MAX_FAILED_CHECKS) {
        inQuarantine++;
      }
    }
  }

  res.json({
    status: 'online',
    totalApps: Object.keys(database.apps).length,
    totalNumbers,
    activeNumbers,
    inQuarantine,
    lastHealthCheck: database.lastHealthCheck,
    stats: database.stats,
    config: {
      maxFailedChecks: CONFIG.MAX_FAILED_CHECKS,
      healthCheckInterval: CONFIG.HEALTH_CHECK_INTERVAL,
      webhookConfigured: !!CONFIG.WEBHOOK_URL
    }
  });
});

// Obter logs
app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const type = req.query.type;
  
  let filteredLogs = logs;
  if (type) {
    filteredLogs = logs.filter(l => l.type === type);
  }
  
  res.json({
    logs: filteredLogs.slice(-limit).reverse(),
    total: filteredLogs.length
  });
});

// Limpar logs
app.delete('/api/logs', (req, res) => {
  logs = [];
  saveLogs();
  addLog('system', 'Logs limpos');
  res.json({ success: true });
});

// ===== HEALTH CHECK INTELIGENTE =====

function analyzeErrorCode(error) {
  // Códigos de erro da API do WhatsApp Business
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
  const message = errorData.message || '';

  // Erros permanentes que indicam ban/restrição
  const permanentErrors = [
    4, // API Service - Número banido temporariamente
    33, // Service temporarily unavailable
    80007, // Rate limit exceeded - pode ser permanente
    131031, // Account has been disabled
    131042, // Phone number not valid
    131047, // Re-engagement window has expired
    131048, // Message failed to send - número bloqueado
    131051, // Unsupported message type - pode indicar restrição
    200, // Permissions error
    190, // Access token expired/invalid - mas pode ser erro de config
    368, // Temporarily blocked for policies violations
  ];

  // Erros temporários
  const temporaryErrors = [
    1, // API Unknown error
    2, // API Service error
    10, // API Permission denied - verificar token
    130429, // Rate limit hit
    131056, // This message was not delivered to maintain healthy ecosystem engagement
  ];

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

    // Verificar também o status do número
    const numberData = response.data;
    const isVerified = numberData.verified_name || true;
    const qualityRating = numberData.quality_rating || 'UNKNOWN';

    return { 
      active: true, 
      error: null,
      errorCode: null,
      analysis: null,
      qualityRating,
      isVerified
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
  addLog('health_check', 'Health check iniciado');
  
  const results = {
    checked: 0,
    active: 0,
    disabled: 0,
    removed: 0,
    errors: []
  };

  for (const appId in database.apps) {
    const app = database.apps[appId];
    console.log(`\n📱 Verificando ${app.appName} (${appId})...`);

    const result = await checkWhatsAppNumber(app.token, app.phoneNumberId);
    
    // Atualizar status de todos os números deste app
    for (const number in app.numbers) {
      const numberData = app.numbers[number];
      const wasActive = numberData.active;
      results.checked++;

      numberData.lastCheck = new Date().toISOString();

      if (result.active) {
        // Número voltou a funcionar
        if (!wasActive && numberData.failedChecks > 0) {
          addLog('recovery', `Número recuperado: ${number}`, { 
            appId, 
            failedChecks: numberData.failedChecks 
          });
          
          await sendNotification(
            '✅ Número Recuperado',
            `O número ${number} voltou a funcionar!`,
            { appId, appName: app.appName, number }
          );
          
          database.stats.totalRecoveries++;
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
          addLog('ban', `Número REMOVIDO automaticamente: ${number}`, { 
            appId,
            reason: result.error,
            errorCode: result.errorCode,
            failedChecks: numberData.failedChecks,
            analysis
          });

          await sendNotification(
            '🚫 Número Banido/Removido',
            `O número ${number} foi removido automaticamente após ${numberData.failedChecks} falhas.`,
            { 
              appId, 
              appName: app.appName, 
              number,
              reason: result.error,
              errorCode: result.errorCode
            }
          );

          delete app.numbers[number];
          database.stats.totalBans++;
          results.removed++;
          console.log(`    🗑️  REMOVIDO AUTOMATICAMENTE`);
        } else if (analysis.isBanned) {
          // Desativar e marcar para quarentena
          numberData.active = false;
          numberData.lastStatusChange = new Date().toISOString();
          results.disabled++;

          if (numberData.failedChecks === 1) {
            addLog('quarantine', `Número em quarentena: ${number}`, { 
              appId,
              reason: result.error,
              errorCode: result.errorCode
            });

            await sendNotification(
              '⚠️ Número em Quarentena',
              `O número ${number} foi desativado. Tentativa ${numberData.failedChecks}/${CONFIG.MAX_FAILED_CHECKS}`,
              { 
                appId, 
                appName: app.appName, 
                number,
                reason: result.error
              }
            );
          }

          console.log(`    ⚠️  EM QUARENTENA (${numberData.failedChecks}/${CONFIG.MAX_FAILED_CHECKS})`);
        } else if (analysis.isTemporary) {
          // Erro temporário - não desativar imediatamente
          console.log(`    ⏳ ERRO TEMPORÁRIO - mantendo ativo por enquanto`);
          results.active++;
        }

        results.errors.push({
          appId,
          appName: app.appName,
          number,
          error: result.error,
          errorCode: result.errorCode,
          failedChecks: numberData.failedChecks
        });
      }
    }
  }

  database.lastHealthCheck = new Date().toISOString();
  database.stats.totalChecks++;
  saveDatabase();

  console.log('\n📊 ========== RESULTADO DO HEALTH CHECK ==========');
  console.log(`✅ Números verificados: ${results.checked}`);
  console.log(`✅ Ativos: ${results.active}`);
  console.log(`⚠️  Desativados: ${results.disabled}`);
  console.log(`🗑️  Removidos: ${results.removed}`);
  console.log(`❌ Erros: ${results.errors.length}`);
  console.log('================================================\n');

  addLog('health_check', 'Health check completo', results);

  return results;
}

// Executar health check manual
app.post('/api/health-check', async (req, res) => {
  try {
    const results = await performHealthCheck();
    res.json({ 
      success: true, 
      lastCheck: database.lastHealthCheck,
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
    metaApiVersion: CONFIG.META_API_VERSION
  });
});

// ===== CRON JOBS =====

// Health check automático
cron.schedule(CONFIG.HEALTH_CHECK_INTERVAL, () => {
  console.log('⏰ Executando health check automático...');
  performHealthCheck();
});

// Backup automático
cron.schedule(CONFIG.BACKUP_INTERVAL, () => {
  console.log('💾 Executando backup automático...');
  createBackup();
});

// Salvar logs periodicamente (a cada 5 minutos)
cron.schedule('*/5 * * * *', () => {
  saveLogs();
});

// ===== ROTA DE HEALTH (para Render.com) =====

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ===== INICIAR SERVIDOR =====

// Carregar dados
loadDatabase();
loadLogs();

app.listen(PORT, () => {
  console.log('\n🚀 ========== WHATSAPP MANAGER INICIADO ==========');
  console.log(`📡 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 URL: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}`);
  console.log(`📊 Dashboard: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}`);
  console.log(`🔗 API: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}/api`);
  console.log(`⏰ Health Check: ${CONFIG.HEALTH_CHECK_INTERVAL}`);
  console.log(`💾 Backup: ${CONFIG.BACKUP_INTERVAL}`);
  console.log(`📱 Apps cadastrados: ${Object.keys(database.apps).length}`);
  console.log('================================================\n');
  
  addLog('system', 'Sistema iniciado', {
    port: PORT,
    totalApps: Object.keys(database.apps).length
  });

  // Health check inicial (após 10 segundos)
  if (Object.keys(database.apps).length > 0) {
    setTimeout(() => {
      console.log('🔍 Executando health check inicial...');
      performHealthCheck();
    }, 10000);
  }

  // Backup inicial
  setTimeout(() => {
    createBackup();
  }, 5000);
});

// Salvar dados antes de fechar
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM recebido. Salvando dados...');
  saveDatabase();
  saveLogs();
  createBackup();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT recebido. Salvando dados...');
  saveDatabase();
  saveLogs();
  createBackup();
  process.exit(0);
});
