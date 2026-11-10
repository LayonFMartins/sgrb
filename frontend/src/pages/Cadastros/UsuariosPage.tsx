import { Pencil, Plus, UserCheck, UserX } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { Can } from '../../auth/Can'
import { usePermissions } from '../../auth/permissions'
import { AvisoErro, CabecalhoCadastro, FormularioCadastro, Selecao } from '../../components/cadastro/FormularioCadastro'
import { EstadoDados } from '../../components/ui/EstadoDados'
import { Input } from '../../components/ui/Input'
import { Tabela, type Coluna } from '../../components/ui/Tabela'
import { useDados } from '../../hooks/useDados'
import { useAcaoLinha, useFormulario } from '../../hooks/useFormulario'
import type { UsuarioCadastro } from '../../types/cadastros'
import { enviar } from '../../utils/enviar'

const VAZIO = { nome: '', funcao: '', tipo: 'FUNCIONARIO', acesso: false, email: '', senha: '' }

// Funcionários e proprietários. Usuário não é excluído (aparece no histórico
// de pesagens e aplicações): é desativado.
export function UsuariosPage() {
  const { dados, ...estado } = useDados<UsuarioCadastro[]>('/usuarios')
  const { usuario: logado } = useAuth()
  const { pode } = usePermissions()
  const form = useFormulario(VAZIO)
  const linha = useAcaoLinha()
  const f = form.valores
  // Na edição de quem já tem login, a senha em branco mantém a atual.
  const editandoComLogin = form.editando && dados?.find(u => u.id_usuario === form.editandoId)?.tem_login

  function salvar() {
    const corpo = {
      nome: f.nome, funcao: f.funcao, tipo: f.tipo,
      email: f.acesso ? f.email : null,
      senha: f.acesso && f.senha ? f.senha : undefined,
    }
    form.executar(
      () => form.editando
        ? enviar(`/usuarios/${form.editandoId}`, 'PUT', corpo)
        : enviar('/usuarios', 'POST', corpo),
      estado.recarregar,
    )
  }

  function editar(u: UsuarioCadastro) {
    form.abrirEdicao(u.id_usuario, {
      nome: u.nome, funcao: u.funcao, tipo: u.tipo,
      acesso: u.tem_login, email: u.email ?? '', senha: '',
    })
  }

  function alternarAtivo(u: UsuarioCadastro) {
    if (u.ativo && !window.confirm(`Desativar ${u.nome}? Ele(a) não poderá mais entrar nem ser responsável por novos manejos.`)) return
    linha.executar(() => enviar(`/usuarios/${u.id_usuario}/${u.ativo ? 'desativar' : 'ativar'}`, 'PATCH'), estado.recarregar)
  }

  const verEmail = pode('usuarios.editar')
  const colunas: Coluna<UsuarioCadastro>[] = [
    { titulo: 'Nome', valor: u => <strong>{u.nome}</strong> },
    { titulo: 'Função', valor: u => u.funcao },
    { titulo: 'Perfil', valor: u => u.tipo === 'PROPRIETARIO' ? 'Proprietário' : 'Funcionário' },
    { titulo: 'Acesso ao sistema', valor: u => u.tem_login
      ? (verEmail ? u.email : 'Sim')
      : <span className="texto-secundario">Sem login</span> },
    { titulo: 'Situação', valor: u => <span className={`etiqueta etiqueta--${u.ativo ? 'ok' : 'neutra'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span> },
  ]
  if (pode('usuarios.editar') || pode('usuarios.desativar')) {
    colunas.push({ titulo: 'Ações', alinhar: 'direita', valor: u => <div className="acoes-linha">
      <Can permissao="usuarios.editar">
        <button type="button" className="acao-linha" onClick={() => editar(u)} aria-label={`Editar ${u.nome}`}><Pencil size={14} aria-hidden="true" />Editar</button>
      </Can>
      <Can permissao="usuarios.desativar">
        {u.id_usuario !== logado?.id && <button type="button" disabled={linha.ocupado} onClick={() => alternarAtivo(u)}
          className={`acao-linha${u.ativo ? ' acao-linha--perigo' : ''}`} aria-label={`${u.ativo ? 'Desativar' : 'Reativar'} ${u.nome}`}>
          {u.ativo ? <UserX size={14} aria-hidden="true" /> : <UserCheck size={14} aria-hidden="true" />}
          {u.ativo ? 'Desativar' : 'Reativar'}
        </button>}
      </Can>
    </div> })
  }

  return <>
    <CabecalhoCadastro titulo="Funcionários" descricao="Pessoas que acessam o sistema ou são responsáveis pelos manejos."
      acao={!form.aberto && <Can permissao="usuarios.criar">
        <button type="button" className="botao-novo" onClick={form.abrirNovo}><Plus size={18} aria-hidden="true" />Novo funcionário</button>
      </Can>} />

    {form.aberto && <FormularioCadastro titulo={form.editando ? 'Editar funcionário' : 'Novo funcionário'}
      salvando={form.salvando} erro={form.erro} onSalvar={salvar} onCancelar={form.fechar}>
      <Input label="Nome" value={f.nome} maxLength={100} required autoFocus
        onChange={e => form.alterar('nome', e.target.value)} />
      <Input label="Função" value={f.funcao} maxLength={50} required placeholder="Vaqueiro"
        onChange={e => form.alterar('funcao', e.target.value)} />
      <Selecao label="Perfil" value={f.tipo} onChange={e => form.alterar('tipo', e.target.value)}>
        <option value="FUNCIONARIO">Funcionário</option>
        <option value="PROPRIETARIO">Proprietário</option>
      </Selecao>
      <label className="cadastro-checkbox cadastro-form__campo-largo">
        <input type="checkbox" checked={f.acesso} onChange={e => form.alterar('acesso', e.target.checked)} />
        Pode entrar no sistema (e-mail e senha)
      </label>
      {f.acesso && <>
        <Input label="E-mail" value={f.email} type="email" maxLength={120} required autoComplete="off"
          onChange={e => form.alterar('email', e.target.value)} />
        <Input label={editandoComLogin ? 'Nova senha (opcional)' : 'Senha'} value={f.senha} type="password"
          minLength={6} autoComplete="new-password" required={!editandoComLogin}
          placeholder={editandoComLogin ? 'Deixe em branco para manter' : 'Mínimo de 6 caracteres'}
          onChange={e => form.alterar('senha', e.target.value)} />
      </>}
      {!f.acesso && <p className="cadastro-form__dica cadastro-form__campo-largo">
        Sem acesso, a pessoa não entra no sistema, mas pode ser escolhida como responsável pelas pesagens e aplicações.
      </p>}
    </FormularioCadastro>}

    <section className="content-card" aria-label="Lista de funcionários">
      <AvisoErro mensagem={linha.aviso} onFechar={linha.limparAviso} />
      <EstadoDados {...estado}>
        {dados && <Tabela legenda="Funcionários" colunas={colunas} linhas={dados}
          chave={u => String(u.id_usuario)} vazio="Nenhum funcionário cadastrado." />}
      </EstadoDados>
    </section>
  </>
}
