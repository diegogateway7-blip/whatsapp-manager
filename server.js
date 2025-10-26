const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Banco de dados em memória
let database = {
  apps: {},
  lastHealthCheck: null
};

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

  if (!database.apps[appId]) {
    database.apps[appId] = {
      appName,
      token,
      phoneNumberId,
      numbers: {}
    };
  } else {
    database.apps[appId].appName = appName;
    database.apps[appId].token = token;
    database.apps[appId].phoneNumberId = phoneNumberId;
  }

  res.json({ success: true, app: database.apps[appId] });
});

// Deletar app
app.delete('/api/apps/:appId', (req, res) => {
  const { appId } = req.params;
  
  if (database.apps[appId]) {
    delete database.apps[appId];
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
    error: null
  };

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

  database.apps[appId].numbers[number].active = active;
  res.json({ success: true, number: database.apps[appId].numbers[number] });
});

// ===== HEALTH CHECK =====

async function checkWhatsAppNumber(token, phoneNumberId) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v21.0/${phoneNumberId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 10000
      }
    );

    return { active: true, error: null };
  } catch (error) {
    let errorMessage = 'Erro desconhecido';
    
    if (error.response) {
      errorMessage = error.response.data?.error?.message || `HTTP ${error.response.status}`;
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Timeout na requisição';
    } else {
      errorMessage = error.message;
    }

    return { active: false, error: errorMessage };
  }
}

async function performHealthCheck() {
  console.log('🔍 Iniciando Health Check...');
  
  for (const appId in database.apps) {
    const app = database.apps[appId];
    console.log(`Verificando ${app.appName}...`);

    const result = await checkWhatsAppNumber(app.token, app.phoneNumberId);
    
    // Atualizar status de todos os números deste app
    for (const number in app.numbers) {
      app.numbers[number].active = result.active;
      app.numbers[number].lastCheck = new Date().toISOString();
      app.numbers[number].error = result.error;
    }
  }

  database.lastHealthCheck = new Date().toISOString();
  console.log('✅ Health Check completo!');
}

// Executar health check manual
app.post('/api/health-check', async (req, res) => {
  try {
    console.log('🔍 Health check manual iniciado...');
    await performHealthCheck();
    res.json({ success: true, lastCheck: database.lastHealthCheck });
  } catch (error) {
    console.error('❌ Erro no health check:', error);
    res.status(500).json({ error: error.message });
  }
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
        activeNumbers.push({ number, appId });
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
  
  res.json({
    success: true,
    number: random.number,
    whatsappUrl: `https://wa.me/${random.number}`,
    totalActive: activeNumbers.length,
    app: random.appId
  });
});

// Status do sistema
app.get('/api/status', (req, res) => {
  let totalNumbers = 0;
  let activeNumbers = 0;

  for (const appId in database.apps) {
    const app = database.apps[appId];
    for (const number in app.numbers) {
      totalNumbers++;
      if (app.numbers[number].active) {
        activeNumbers++;
      }
    }
  }

  res.json({
    status: 'online',
    totalApps: Object.keys(database.apps).length,
    totalNumbers,
    activeNumbers,
    lastHealthCheck: database.lastHealthCheck
  });
});

// ===== CRON JOB =====

// Executar a cada 30 minutos
cron.schedule('*/30 * * * *', () => {
  console.log('⏰ Executando health check automático...');
  performHealthCheck();
});

// ===== INICIAR SERVIDOR =====

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  
  // Health check inicial (apenas se houver apps)
  if (Object.keys(database.apps).length > 0) {
    console.log('🔍 Executando health check inicial...');
    performHealthCheck();
  }
});
