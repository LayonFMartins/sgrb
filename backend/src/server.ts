import express from 'express';
import cors from 'cors';
import 'dotenv/config';

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

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});