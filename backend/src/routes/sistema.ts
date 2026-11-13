import { Router } from 'express';
import { pool } from '../db/pool.js';
import { exigirPermissao } from '../middleware/auth.js';

// Informacoes do sistema e do banco de dados (tela Configuracoes, so proprietario).
// Tudo vem dos catalogos do proprio PostgreSQL (information_schema e pg_catalog).
export const sistemaRouter = Router();

sistemaRouter.get('/', exigirPermissao('sistema.visualizar'), async (_req, res) => {
  const inicio = performance.now();
  const banco = await pool.query(`
    SELECT current_database()                                    AS nome,
           split_part(version(), ' ', 2)                         AS versao,
           pg_size_pretty(pg_database_size(current_database()))  AS tamanho,
           now()                                                 AS horario_servidor`);
  const latencia_ms = Math.round(performance.now() - inicio);

  const [tabelas, objetos, regras] = await Promise.all([
    // Quantidade exata de registros de cada tabela (query_to_xml executa um count por tabela)
    pool.query(`
      SELECT table_name AS tabela,
             (xpath('/row/total/text()',
                    query_to_xml(format('SELECT count(*) AS total FROM %I', table_name), false, true, '')))[1]::text::int
               AS registros
        FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`),
    pool.query(`
      SELECT (SELECT count(*) FROM information_schema.views WHERE table_schema = 'public')::int AS views,
             -- funcoes do projeto (sem as que vem da extensao btree_gist)
             (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public'
                 AND NOT EXISTS (SELECT 1 FROM pg_depend d
                                  WHERE d.objid = p.oid AND d.deptype = 'e'))::int              AS funcoes,
             (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
               JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND NOT t.tgisinternal)::int                         AS triggers,
             -- PK, FK, UNIQUE, CHECK e EXCLUDE (sem contar os NOT NULL)
             (SELECT count(*) FROM pg_constraint co JOIN pg_namespace n ON n.oid = co.connamespace
               WHERE n.nspname = 'public' AND co.contype IN ('p', 'f', 'u', 'c', 'x'))::int     AS restricoes`),
    // Triggers das regras de negocio: nome, tabela, momento e eventos
    pool.query(`
      SELECT t.tgname AS nome,
             c.relname AS tabela,
             CASE WHEN t.tgconstraint <> 0 THEN 'Ao confirmar a transação'
                  WHEN t.tgtype & 2 = 2 THEN 'Antes' ELSE 'Depois' END AS momento,
             concat_ws(', ',
               CASE WHEN t.tgtype & 4  = 4  THEN 'inserção' END,
               CASE WHEN t.tgtype & 16 = 16 THEN 'alteração' END,
               CASE WHEN t.tgtype & 8  = 8  THEN 'exclusão' END) AS eventos
        FROM pg_trigger t
        JOIN pg_class c     ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND NOT t.tgisinternal
       ORDER BY c.relname, t.tgname`),
  ]);

  res.json({
    banco: { ...banco.rows[0], latencia_ms },
    objetos: objetos.rows[0],
    tabelas: tabelas.rows,
    regras: regras.rows,
  });
});
