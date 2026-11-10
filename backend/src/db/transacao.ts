import type { PoolClient } from 'pg';
import { pool } from './pool.js';

// Executa varios comandos SQL numa unica transacao (mesma conexao).
// Necessario quando o banco confere regras no COMMIT, como a compra
// (animal + GTA de entrada) e a venda (baixa + venda + GTA de saida).
export async function emTransacao<T>(trabalho: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await trabalho(client);
    await client.query('COMMIT');
    return resultado;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}
