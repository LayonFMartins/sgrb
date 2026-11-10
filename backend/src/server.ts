import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { pool } from './db/pool.js';
import { autenticar } from './middleware/auth.js';
import { tratarErros } from './middleware/erros.js';
import { authRouter } from './routes/auth.js';
import { racasRouter } from './routes/racas.js';
import { animaisRouter } from './routes/animais.js';
import { comprasRouter } from './routes/compras.js';
import { consultasRouter } from './routes/consultas.js';

const app = express();

const PORT = Number(process.env.PORT) || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}));

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'API do SGRB funcionando!'
  });
});

app.get('/api/health/database', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        CURRENT_DATABASE() AS database,
        NOW() AS server_time
    `);

    res.status(200).json({
      status: 'ok',
      database: result.rows[0].database,
      serverTime: result.rows[0].server_time
    });
  } catch (error) {
    console.error('Erro ao conectar ao banco:', error);

    res.status(503).json({
      status: 'error',
      message: 'Banco de dados indisponível'
    });
  }
});

// Login (rota publica)
app.use('/api/auth', authRouter);

// Daqui para baixo, todas as rotas exigem login
app.use('/api', autenticar);
app.use('/api/racas', racasRouter);
app.use('/api/animais', animaisRouter);
app.use('/api/compras', comprasRouter);
app.use('/api/consultas', consultasRouter);

// Tratamento de erros: sempre por ultimo
app.use(tratarErros);

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
