const mongoose = require('mongoose');

// Schema para Apps
const numberSchema = new mongoose.Schema({
  active: { type: Boolean, default: true },
  lastCheck: { type: Date, default: null },
  error: { type: String, default: null },
  errorCode: { type: Number, default: null },
  failedChecks: { type: Number, default: 0 },
  addedAt: { type: Date, default: Date.now },
  lastStatusChange: { type: Date, default: Date.now },
  qualityRating: { type: String, default: null }
}, { _id: false });

const appSchema = new mongoose.Schema({
  appId: { type: String, required: true, unique: true },
  appName: { type: String, required: true },
  token: { type: String, required: true },
  phoneNumberId: { type: String, required: true },
  wabaId: { type: String, required: true }, // WABA ID - OBRIGATÓRIO para verificar restrições
  numbers: { type: Map, of: numberSchema },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Schema para Stats
const statsSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  totalChecks: { type: Number, default: 0 },
  totalBans: { type: Number, default: 0 },
  totalRecoveries: { type: Number, default: 0 },
  lastHealthCheck: { type: Date, default: null }
});

// Schema para Logs
const logSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  type: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
});

// Criar índice para ordenar logs por data
logSchema.index({ timestamp: -1 });

const App = mongoose.model('App', appSchema);
const Stats = mongoose.model('Stats', statsSchema);
const Log = mongoose.model('Log', logSchema);

// Conectar ao MongoDB
async function connectDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI;
  
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI não configurada!');
    console.error('Configure a variável de ambiente MONGODB_URI no Render.com');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB Atlas');
  } catch (error) {
    console.error('❌ Erro ao conectar MongoDB:', error.message);
    process.exit(1);
  }
}

// Função helper para obter ou criar stats
async function getStats() {
  let stats = await Stats.findById('global');
  if (!stats) {
    stats = new Stats({ _id: 'global' });
    await stats.save();
  }
  return stats;
}

module.exports = {
  connectDatabase,
  App,
  Stats,
  Log,
  getStats
};

