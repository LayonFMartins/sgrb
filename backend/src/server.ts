import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { pool } from './db/pool.js';

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

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});