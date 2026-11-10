import 'dotenv/config';
import pg from 'pg';

const { Pool, types } = pg;

types.setTypeParser(types.builtins.DATE, (valor) => valor);
types.setTypeParser(types.builtins.NUMERIC, (valor) => parseFloat(valor));

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não configurada.');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});