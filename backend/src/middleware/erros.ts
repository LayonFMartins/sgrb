import type { NextFunction, Request, Response } from 'express';

// Erro de validacao da propria API (ex.: campo obrigatorio faltando).
export class ErroHttp extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

// Traduz os erros do PostgreSQL para respostas HTTP.
// As regras de negocio (triggers e CHECK) ja devolvem mensagens prontas,
// como "RI-09: o piquete P01 - Baixada esta lotado (25 de 25 cabecas)".
const MENSAGENS_CONSTRAINT: Record<string, string> = {
  ck_animal_sexo: 'Sexo deve ser M ou F.',
  ck_animal_mae_propria: 'RI-01: um animal não pode ser mãe de si mesmo.',
  ck_animal_compra_completa: 'RI-04: informe fornecedor, data e valor da compra juntos.',
  ck_animal_data_compra: 'RI-05: a data de compra não pode ser anterior ao nascimento.',
  ck_ocupa_datas: 'RI-07: a data de saída não pode ser anterior à entrada.',
  ex_ocupa_um_piquete_por_vez: 'RI-08: o animal já está em outro piquete nesse período.',
  ck_produto_faixa: 'RI-12: a idade máxima não pode ser menor que a mínima.',
  ck_usuario_login: 'RI-23: informe e-mail e senha juntos.',
  ck_usuario_senha_hash: 'RI-24: a senha precisa ser gravada como hash.',
  ck_fornecedor_uf: 'UF inválida. Use a sigla do estado (ex.: MG).',
  pk_telefone_fornecedor: 'Telefone repetido para o mesmo fornecedor.',
  ck_piquete_area: 'A área do piquete deve ser maior que zero.',
  ck_piquete_capacidade: 'A capacidade do piquete deve ser maior que zero.',
  ck_piquete_descanso: 'O descanso mínimo não pode ser negativo.',
  ck_produto_tipo: 'Tipo deve ser VACINA, VERMIFUGO ou ANTIBIOTICO.',
  ck_produto_carencia: 'A carência não pode ser negativa.',
  ck_produto_doses: 'O produto precisa ter pelo menos 1 dose.',
  ck_produto_intervalo: 'O intervalo de reforço deve ser maior que zero.',
  ck_produto_sexo: 'Sexo alvo deve ser M, F ou vazio.',
  ck_produto_idade_min: 'A idade mínima não pode ser negativa.',
  ck_produto_idade_max: 'A idade máxima não pode ser negativa.',
  ck_usuario_tipo: 'Tipo deve ser PROPRIETARIO ou FUNCIONARIO.',
  ck_usuario_email: 'E-mail inválido.',
  uk_usuario_email: 'Já existe um usuário com esse e-mail.',
  uk_raca_nome: 'Já existe uma raça com esse nome.',
  uk_piquete_nome: 'Já existe um piquete com esse nome.',
  uk_produto_nome: 'Já existe um produto com esse nome.',
  uk_baixa_animal: 'Esse animal já tem baixa registrada.',
  pk_animal: 'Já existe um animal com esse brinco.',
  pk_pesagem: 'Esse animal já tem pesagem nessa data.',
};

interface ErroPg {
  code?: string;
  constraint?: string;
  message: string;
}

export function tratarErros(erro: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (erro instanceof ErroHttp) {
    return res.status(erro.status).json({ erro: erro.message });
  }

  if ((erro as { type?: string }).type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'O corpo da requisição não é um JSON válido.' });
  }

  const e = erro as ErroPg;
  const mensagem = (e.constraint && MENSAGENS_CONSTRAINT[e.constraint]) || e.message;

  switch (e.code) {
    case '23514': // check_violation (CHECK e triggers das regras)
    case '23P01': // exclusion_violation (RI-08)
    case '23502': // not_null_violation
    case '22P02': // valor em formato invalido
    case '22007': // data invalida
    case '22008':
    case '22001': // texto maior que o tamanho da coluna
    case '22003': // numero fora do limite
      return res.status(400).json({ erro: mensagem });
    case '23505': // unique_violation
      return res.status(409).json({ erro: mensagem });
    case '23503': // foreign_key_violation
      return res.status(409).json({
        erro: e.message.includes('violates foreign key') || e.message.includes('viola a restrição')
          ? 'Operação bloqueada: o registro está em uso ou faz referência a algo que não existe.'
          : mensagem,
      });
  }

  console.error(erro);
  return res.status(500).json({ erro: 'Erro interno no servidor.' });
}
