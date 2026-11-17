import type { PoolClient } from 'pg';
import { textoObrigatorio } from './campos.js';
import { ErroHttp } from '../middleware/erros.js';

// Ajudantes das rotas de manejo (pesagens, aplicacoes, movimentacoes).
// Todos recebem o "client" da transacao (emTransacao), para conferir e gravar
// na mesma conexao. As regras de verdade (RI-xx) continuam nos triggers do banco;
// aqui so conferimos o que o banco diria de forma pouco clara (ex.: "animal nao existe").

// 'AAAA-MM-DD' -> 'DD/MM/AAAA' sem criar Date (evita o bug de fuso horario).
export function dataBr(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

// Data obrigatoria no formato AAAA-MM-DD (o que o <input type="date"> envia).
export function dataObrigatoria(valor: unknown, mensagem: string): string {
  const texto = textoObrigatorio(valor, mensagem);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw new ErroHttp(400, 'Use a data no formato AAAA-MM-DD.');
  return texto;
}

// Manejo registrado "no futuro" quase sempre e erro de digitacao.
// Usa o dia de hoje no horario de Brasilia (o servidor do Neon roda em UTC).
export async function exigirDataNaoFutura(client: PoolClient, data: string, descricao: string) {
  try {
    const { rows } = await client.query<{ futura: boolean }>(
      "SELECT $1::date > (now() AT TIME ZONE 'America/Sao_Paulo')::date AS futura", [data]);
    if (rows[0].futura) throw new ErroHttp(400, `A data ${descricao} não pode estar no futuro.`);
  } catch (erro) {
    const codigo = (erro as { code?: string }).code;
    if (codigo === '22007' || codigo === '22008') throw new ErroHttp(400, 'Data inválida.');
    throw erro;
  }
}

// Le a lista de brincos do corpo: aceita { brincos: [...] } ou { brinco: "0101" }.
export function listaDeBrincos(corpo: Record<string, unknown>): string[] {
  const bruto: unknown[] = Array.isArray(corpo.brincos)
    ? corpo.brincos
    : corpo.brinco !== undefined && corpo.brinco !== null ? [corpo.brinco] : [];
  const brincos = bruto.map(b => String(b ?? '').trim()).filter(Boolean);
  if (brincos.length === 0) throw new ErroHttp(400, 'Escolha pelo menos um animal.');
  const repetido = brincos.find((b, i) => brincos.indexOf(b) !== i);
  if (repetido) throw new ErroHttp(400, `O animal ${repetido} aparece mais de uma vez.`);
  return brincos;
}

// Todos os brincos precisam existir (o erro de chave estrangeira do banco nao diria qual).
export async function exigirAnimaisExistentes(client: PoolClient, brincos: string[]) {
  const { rows } = await client.query<{ brinco: string }>(
    'SELECT brinco FROM animal WHERE brinco = ANY($1::varchar[])', [brincos]);
  const faltando = brincos.filter(b => !rows.some(r => r.brinco === b));
  if (faltando.length) throw new ErroHttp(404, `Animal não encontrado: ${faltando.join(', ')}.`);
}

// O responsavel e escolhido no formulario (vaqueiro nao tem login), entao vem no corpo.
// Se estiver inativo, o banco recusa com a RI-26.
export async function exigirResponsavel(client: PoolClient, idUsuario: number) {
  const { rowCount } = await client.query('SELECT 1 FROM usuario WHERE id_usuario = $1', [idUsuario]);
  if (!rowCount) throw new ErroHttp(404, 'Responsável não encontrado.');
}
