import { ErroHttp } from '../middleware/erros.js';

// Ajudantes para ler o corpo das requisicoes dos cadastros.
// As regras de verdade (CHECK, UNIQUE, triggers) ficam no banco;
// aqui so convertemos os campos e barramos o que esta faltando.

// Texto obrigatorio: corta espacos e exige valor.
export function textoObrigatorio(valor: unknown, mensagem: string): string {
  const texto = typeof valor === 'string' || typeof valor === 'number' ? String(valor).trim() : '';
  if (!texto) throw new ErroHttp(400, mensagem);
  return texto;
}

// Texto opcional: vazio vira null.
export function textoOpcional(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto || null;
}

// Numero opcional: vazio vira null; texto que nao e numero gera erro 400.
export function numeroOpcional(valor: unknown, campo: string): number | null {
  if (valor === undefined || valor === null || valor === '') return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero)) throw new ErroHttp(400, `O campo ${campo} deve ser um número.`);
  return numero;
}

// Numero obrigatorio.
export function numeroObrigatorio(valor: unknown, campo: string): number {
  const numero = numeroOpcional(valor, campo);
  if (numero === null) throw new ErroHttp(400, `Informe o campo ${campo}.`);
  return numero;
}

// Id da URL (/:id). Evita mandar "abc" para o banco.
export function idDaRota(valor: unknown, mensagem404: string): number {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new ErroHttp(404, mensagem404);
  return id;
}

// Filtro booleano da query string (?ativo=true / ?ativo=false).
export function booleanoDaQuery(valor: unknown): boolean | null {
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  return null;
}
