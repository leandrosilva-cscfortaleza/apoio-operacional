import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import QrScanner from './QrScanner'
import QrCodeAmbiente from './QrCodeAmbiente'

function App() {
  const [sessao, setSessao] = useState(null)
  const [usuario, setUsuario] = useState(null)
  const [atividades, setAtividades] = useState([])
  const [itensRotina, setItensRotina] = useState([])
  const [observacaoRotina, setObservacaoRotina] = useState('')
  const [tela, setTela] = useState('home')
  const [ambienteSelecionado, setAmbienteSelecionado] = useState(null)
  const [checklistsAmbiente, setChecklistsAmbiente] = useState([])
  const [checklistSelecionado, setChecklistSelecionado] = useState(null)
  const [rotinaAtual, setRotinaAtual] = useState(null)
  const [detalheAtividade, setDetalheAtividade] = useState(null)
  const [detalheItens, setDetalheItens] = useState([])
  useEffect(() => {
  if (tela !== 'detalhe' || !rotinaAtual) return

  async function carregarDetalheAtividade() {
    const { data, error } = await supabase
      .from('rotinas')
      .select(`
        id,
        codigo,
        data_execucao,
        iniciada_em,
        finalizada_em,
        status,
        observacao,
        ambiente_id,
checklist_id,
usuario_id,
ambientes (
  nome,
  codigo
),
checklists (
  nome
),
usuarios (
  nome,
  email
)
      `)
      .eq('id', rotinaAtual)
      .maybeSingle()

    if (error) {
      console.error('Erro ao carregar atividade:', error)
      return
    }

    if (!data) {
      console.error('Rotina não encontrada.')
      return
    }

    setDetalheAtividade(data)
    const { data: itens, error: itensError } = await supabase
  .from('rotina_itens')
  .select(`
    id,
    resposta,
    observacao,
    respondido_em,
    checklist_item_id,
    checklist_itens (
      ordem,
      obrigatorio,
      itens (
        nome,
        descricao,
        tipo_resposta
      )
    )
  `)
  .eq('rotina_id', rotinaAtual)
  .order('ordem', {
  foreignTable: 'checklist_itens',
  ascending: true,
})

if (itensError) {
  console.error('Erro ao carregar itens da atividade:', itensError)
  return
}

setDetalheItens(itens || [])
  }

  carregarDetalheAtividade()
}, [tela, rotinaAtual])


  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [lembrar, setLembrar] = useState(true)

  const [carregando, setCarregando] = useState(true)
  const [entrando, setEntrando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [tipoMensagem, setTipoMensagem] = useState('info')

  useEffect(() => {
    iniciarAplicacao()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessao(session)

      if (!session) {
        setUsuario(null)
        setAtividades([])
        setTela('home')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function iniciarAplicacao() {
    try {
      const { data } = await supabase.auth.getSession()

      setSessao(data.session)

      if (data.session?.user) {
        await carregarUsuario(data.session.user.id)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setCarregando(false)
    }
  }

  async function carregarUsuario(authUserId) {
    const { data, error } = await supabase
      .from('usuarios')
      .select(`
        id,
        nome,
        email,
        telefone,
        cargo,
        ativo,
        perfil_id,
        perfis (
          nome
        )
      `)
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (error) {
      console.error('Erro ao carregar usuário:', error)
      setMensagem('Não foi possível carregar seu perfil.')
      setTipoMensagem('erro')
      return
    }

    if (!data) {
      await supabase.auth.signOut()
      setMensagem('Usuário não cadastrado no sistema.')
      setTipoMensagem('erro')
      return
    }

    if (!data.ativo) {
      await supabase.auth.signOut()
      setMensagem('Este usuário está inativo.')
      setTipoMensagem('erro')
      return
    }

    setUsuario(data)

    await carregarAtividades(data.id)
  }

  async function carregarAtividades(usuarioId) {
    const { data, error } = await supabase
      .from('rotinas')
      .select(`
        id,
        data_execucao,
        iniciada_em,
        finalizada_em,
        status,
        observacao,
        ambientes (
          codigo,
          nome,
          tipo
        ),
        checklists (
          nome
        )
      `)
      .eq('usuario_id', usuarioId)
      .order('iniciada_em', { ascending: false })
      .limit(8)

    if (error) {
      console.error('Erro ao carregar atividades:', error)
      return
    }

    setAtividades(data || [])
  }

  async function entrar(event) {
    event.preventDefault()

    setMensagem('')
    setEntrando(true)

    const emailLimpo = email.trim()
await supabase.auth.setPersistence?.(
  lembrar ? 'local' : 'session'
)
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: emailLimpo,
        password: senha,
      })

    if (error) {
      setMensagem(error.message || 'E-mail ou senha inválidos.')
      setTipoMensagem('erro')
      setEntrando(false)
      return
    }

    if (!data.user) {
      setMensagem('Não foi possível identificar o usuário.')
      setTipoMensagem('erro')
      setEntrando(false)
      return
    }

    const {
      data: usuarioEncontrado,
      error: erroUsuario,
    } = await supabase
      .from('usuarios')
      .select(`
        id,
        nome,
        email,
        telefone,
        cargo,
        ativo,
        perfil_id,
        perfis (
          nome
        )
      `)
      .eq('auth_user_id', data.user.id)
      .maybeSingle()

    if (erroUsuario || !usuarioEncontrado) {
      await supabase.auth.signOut()

      setMensagem('Usuário não cadastrado no sistema.')
      setTipoMensagem('erro')
      setEntrando(false)
      return
    }

    if (!usuarioEncontrado.ativo) {
      await supabase.auth.signOut()

      setMensagem('Este usuário está inativo.')
      setTipoMensagem('erro')
      setEntrando(false)
      return
    }

    setSessao(data.session)
    setUsuario(usuarioEncontrado)

    await carregarAtividades(usuarioEncontrado.id)

    setMensagem('')
    setTipoMensagem('info')
    setEntrando(false)
  }

  async function esqueciSenha() {
    const emailLimpo = email.trim()

    if (!emailLimpo) {
      setMensagem('Digite seu e-mail primeiro.')
      setTipoMensagem('erro')
      return
    }

    setMensagem('Enviando instruções...')
    setTipoMensagem('info')

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        emailLimpo,
        {
          redirectTo: window.location.origin,
        }
      )

    if (error) {
      console.error(error)
      setMensagem(
        'Não foi possível enviar o e-mail de recuperação.'
      )
      setTipoMensagem('erro')
      return
    }

    setMensagem(
      'Instruções de recuperação foram enviadas para seu e-mail.'
    )
    setTipoMensagem('sucesso')
  }

  async function sair() {
    await supabase.auth.signOut()

    setSessao(null)
    setUsuario(null)
    setAtividades([])
    setObservacaoRotina('')
    setEmail('')
    setSenha('')
    setTela('home')
  }

  function abrirQr() {
    setMensagem('')
    setTela('qr')
  }

  function voltarHome() {
  setAmbienteSelecionado(null)
  setChecklistSelecionado(null)
  setChecklistsAmbiente([])
  setRotinaAtual(null)
  setItensRotina([])
  setObservacaoRotina('')
  setTela('home')
}

  async function ambienteEncontrado(ambiente) {
  setAmbienteSelecionado(ambiente)
  setChecklistSelecionado(null)
  setItensRotina([])
  setRotinaAtual(null)
  setObservacaoRotina('')

  const { data, error } = await supabase
    .from('ambiente_checklists')
    .select(`
      id,
      checklist_id,
      checklists (
        id,
        nome,
        descricao,
        periodicidade,
        ativo
      )
    `)
    .eq('ambiente_id', ambiente.id)
    .eq('ativo', true)

  if (error) {
    console.error('Erro ao carregar checklists:', error)
    setChecklistsAmbiente([])
  } else {
    const lista = (data || [])
      .map((registro) => registro.checklists)
      .filter((checklist) => checklist && checklist.ativo)

    setChecklistsAmbiente(lista)
  }

  setTela('ambiente')
}

  function formatarData(data) {
    if (!data) return '-'

    return new Date(data).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  }

  function formatarDataAtual() {
    return new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    })
  }

  function statusTexto(status) {
    const mapa = {
      EM_EXECUCAO: 'Em execução',
      EXECUTADA: 'Executada',
      CANCELADA: 'Cancelada',
      ARQUIVADA: 'Arquivada',
    }

    return mapa[status] || status
  }

  function statusClasse(status) {
    if (status === 'EXECUTADA') return 'status sucesso'
    if (status === 'EM_EXECUCAO') return 'status andamento'
    if (status === 'CANCELADA') return 'status cancelada'
    if (status === 'ARQUIVADA') return 'status arquivada'

    return 'status'
  }

  if (carregando) {
    return (
      <>
        <style>{estilosCSS}</style>

        <div className="loading-page">
          <div className="loading-logo">AO</div>
          <div className="loading-spinner" />
          <strong>APOIO OPERACIONAL</strong>
          <span>Carregando sistema...</span>
        </div>
      </>
    )
  }

  if (!sessao || !usuario) {
    return (
      <>
        <style>{estilosCSS}</style>

        <div className="login-page">

          <div className="login-glow glow-one" />
          <div className="login-glow glow-two" />

          <main className="login-container">

            <section className="login-card">

              <div className="brand">

                <div className="brand-logo">
                  AO
                </div>

                <div>
                  <div className="brand-title">
                    APOIO OPERACIONAL
                  </div>

                  <div className="brand-subtitle">
                    Gestão Operacional Integrada
                  </div>
                </div>

              </div>

              <div className="divider" />

              <div className="login-heading">

                <span className="eyebrow">
                  ACESSO SEGURO
                </span>

                <h1>
                  Acesso ao sistema
                </h1>

                <p>
                  Entre com seu e-mail e senha para continuar.
                </p>

              </div>

              <form onSubmit={entrar}>

                <div className="field">

                  <label>
                    E-mail
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="seu@email.com"
                    autoComplete="email"
                    required
                  />

                </div>

                <div className="field">

                  <label>
                    Senha
                  </label>

                  <input
                    type="password"
                    value={senha}
                    onChange={(event) =>
                      setSenha(event.target.value)
                    }
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    required
                  />

                </div>

                <div className="login-options">

                  <label className="remember">

                    <input
                      type="checkbox"
                      checked={lembrar}
                      onChange={(event) =>
                        setLembrar(event.target.checked)
                      }
                    />

                    <span>
                      Continuar conectado
                    </span>

                  </label>

                  <button
                    type="button"
                    className="forgot-button"
                    onClick={esqueciSenha}
                  >
                    Esqueci minha senha
                  </button>

                </div>

                {mensagem && (
                  <div
                    className={`message ${tipoMensagem}`}
                  >
                    {mensagem}
                  </div>
                )}

                <button
                  type="submit"
                  className="login-button"
                  disabled={entrando}
                >
                  {entrando ? (
                    <>
                      <span className="button-spinner" />
                      ENTRANDO...
                    </>
                  ) : (
                    'ENTRAR'
                  )}
                </button>

              </form>

              <div className="login-footer">
                APOIO OPERACIONAL V2
              </div>

            </section>

          </main>

        </div>
      </>
    )
  }

  /*
   * TELA DO LEITOR QR
   */

  if (tela === 'qr') {
    return (
      <>
        <QrScanner
          onVoltar={voltarHome}
          onAmbienteEncontrado={ambienteEncontrado}
        />
      </>
    )
  }
/*
 * DETALHES DA ATIVIDADE
 */
if (tela === 'detalhe' && rotinaAtual) {
  return (
    <div className="app">
      <main className="main">
        <section
          style={{
            padding: '32px',
            maxWidth: '1000px',
            margin: '0 auto',
          }}
        >
          <button
            type="button"
           onClick={() => {
  setRotinaAtual(null)
  setAmbienteSelecionado(null)
  setChecklistSelecionado(null)
  setItensRotina([])
  setObservacaoRotina('')
  setTela('home')
}}
            style={{
              background: '#7a1f2b',
              color: '#ffffff',
              border: 0,
              borderRadius: '10px',
              padding: '10px 18px',
              fontWeight: 800,
              cursor: 'pointer',
              marginBottom: '24px',
            }}
          >
            ← VOLTAR
          </button>

          <div
            style={{
              background: '#111827',
              borderRadius: '18px',
              padding: '28px',
              border: '1px solid #263142',
            }}
          >
            <div
              style={{
                color: '#c35d6d',
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '1.5px',
                marginBottom: '8px',
              }}
            >
              DETALHES DA ATIVIDADE
            </div>

            <h1
              style={{
                margin: 0,
                color: '#ffffff',
                fontSize: '28px',
              }}
            >
              Rotina executada
            </h1>

            <div
              style={{
                marginTop: '20px',
                padding: '18px',
                background: '#0b111b',
                borderRadius: '12px',
              }}
            >
              <div
                style={{
                  color: '#8fa0b8',
                  fontSize: '12px',
                  marginBottom: '6px',
                }}
              >
                Nº DA ROTINA
              </div>

              <div
                style={{
                  color: '#ffffff',
                  fontWeight: 700,
                  wordBreak: 'break-all',
                }}
              >
               {detalheAtividade?.codigo != null
  ? String(detalheAtividade.codigo).padStart(6, '0')
  : '-'}
              </div>
            </div>

            <div
              style={{
                marginTop: '24px',
                color: '#8fa0b8',
              }}
            >
              {detalheAtividade ? (
  <div
    style={{
      marginTop: '24px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '14px',
    }}
  >
    <div className="detail-box">
      <span style={{ display: 'block', marginBottom: '8px' }}>DATA</span>
      <strong>{detalheAtividade.data_execucao || '-'}</strong>
    </div>

    <div className="detail-box">
     <span style={{ display: 'block', marginBottom: '8px' }}>INÍCIO</span>
      <strong>
        {detalheAtividade.iniciada_em
          ? new Date(detalheAtividade.iniciada_em).toLocaleString('pt-BR')
          : '-'}
      </strong>
    </div>

    <div
  className="detail-box"
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'center',
  }}
>
      <span style={{ display: 'block', marginBottom: '8px' }}>FINALIZAÇÃO</span>
      <strong>
        {detalheAtividade.finalizada_em
          ? new Date(detalheAtividade.finalizada_em).toLocaleString('pt-BR')
          : '-'}
      </strong>
    </div>

   <div
  className="detail-box"
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'center',
  }}
>
      <span style={{ display: 'block', marginBottom: '8px' }}>STATUS</span>
      <strong>{detalheAtividade.status || '-'}</strong>
    </div>

   <div
  className="detail-box"
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'center',
  }}
>
      <span>AMBIENTE</span>
      <strong>{detalheAtividade.ambientes?.nome || detalheAtividade.ambiente_id || '-'}</strong>
    </div>

    <div
  className="detail-box"
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'center',
  }}
>
      <span>CHECKLIST</span>
      <strong>{detalheAtividade.checklists?.nome || detalheAtividade.checklist_id || '-'}</strong>
    </div>
  <div
  style={{
  gridColumn: '1 / -1',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: '28px',
}}
>
  <div
    style={{
      color: '#c35d6d',
      fontSize: '13px',
      fontWeight: 800,
      letterSpacing: '1px',
      marginBottom: '18px',
    }}
  >
    {detalheAtividade?.observacao ? (
  <div
    style={{
      marginTop: '24px',
      marginBottom: '24px',
      padding: '18px 20px',
      background: '#0b111f',
      border: '1px solid #263247',
      borderRadius: '14px',
      textAlign: 'left',
    }}
  >
    <div
      style={{
        color: '#c35d6d',
        fontSize: '13px',
        fontWeight: 800,
        letterSpacing: '1px',
        marginBottom: '8px',
      }}
    >
      OBSERVAÇÃO DA ROTINA
    </div>

    <div
      style={{
        color: '#dbe4f0',
        fontSize: '15px',
        lineHeight: 1.6,
      }}
    >
      {detalheAtividade.observacao}
    </div>
  </div>
) : null}
    ITENS EXECUTADOS
  </div>

  {detalheItens.length === 0 ? (
    <div
      style={{
        color: '#8fa0b8',
        textAlign: 'center',
        padding: '20px',
      }}
    >
      Nenhum item encontrado para esta rotina.
    </div>
  ) : (
    <div
     style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '14px',
  width: '100%',
  alignItems: 'stretch',
}}
    >
      {detalheItens.map((item, index) => (
        <div
          key={item.id}
          style={{
            padding: '16px',
            background: '#111927',
            borderRadius: '12px',
            border: '1px solid #263244',
          }}
        >
          <div
            style={{
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '15px',
              marginBottom: '8px',
            }}
          >
            {index + 1}. {item.checklist_itens?.itens?.nome || 'Item sem nome'}
          </div>

          {item.checklist_itens?.itens?.descricao && (
            <div
              style={{
                color: '#8fa0b8',
                fontSize: '13px',
                marginBottom: '12px',
              }}
            >
              {item.checklist_itens.itens.descricao}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                color: '#8fa0b8',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              RESPOSTA
            </span>

            <strong
              style={{
                color: '#ffffff',
                fontSize: '14px',
              }}
            >
              {item.resposta || '-'}
            </strong>
          </div>

          {item.observacao && (
            <div
              style={{
                marginTop: '10px',
                color: '#b7c2d4',
                fontSize: '13px',
              }}
            >
              Observação: {item.observacao}
            </div>
          )}
        </div>
      ))}
    </div>
  )}
</div>
  </div>
) : (
  <div
    style={{
      marginTop: '24px',
      color: '#8fa0b8',
      textAlign: 'center',
    }}
  >
    Carregando informações da execução...
  </div>
)}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
  /*
   * AMBIENTE ENCONTRADO
   */

  if (tela === 'ambiente' && ambienteSelecionado) {
    return (
      <>
        <style>{estilosCSS}</style>

        <div className="environment-page">

          <header className="environment-header">

            <button
              className="back-button"
              onClick={voltarHome}
            >
              ← Voltar
            </button>

            <div>
              <span className="eyebrow">
                AMBIENTE IDENTIFICADO
              </span>

              <h1>
                {ambienteSelecionado.nome}
              </h1>
            </div>

          </header>

          <main className="environment-content">

            <section className="environment-card">
              <div
  style={{
    marginTop: '20px',
    display: 'flex',
    justifyContent: 'center',
  }}
>
  <QrCodeAmbiente
    ambiente={ambienteSelecionado}
  />
</div>

              <div className="environment-icon">
                ✓
              </div>

              <div className="environment-info">

                <span className="environment-type">
                  {ambienteSelecionado.tipo ||
                    'AMBIENTE'}
                </span>

                <h2>
                  {ambienteSelecionado.nome}
                </h2>

                <div className="environment-code">
                  Código: {ambienteSelecionado.codigo}
                </div>

                {ambienteSelecionado.descricao && (
                  <p>
                    {ambienteSelecionado.descricao}
                  </p>
                )}

              </div>

            </section>

            <section className="next-card">

              <div>
                <span className="card-label">
                  PRÓXIMA ETAPA
                </span>

                <h2>
                  Checklist do ambiente
                </h2>

                <p>
                  O ambiente foi identificado corretamente.
                  Na próxima etapa serão carregados os checklists
                  vinculados a este ambiente.
                </p>
              </div>
          {checklistsAmbiente.length === 0 && (    
    <button
      type="button"
      onClick={voltarHome}
      style={{
        marginTop: '14px',
        width: '100%',
        padding: '12px 16px',
        borderRadius: '10px',
        border: '1px solid #7a1f2b',
        background: '#7a1f2b',
        color: '#ffffff',
        fontWeight: 700,
        cursor: 'pointer',
      }}

    >
      ← Voltar para Home
    </button>
    )}
              <div
  style={{
    marginTop: '20px',
    display: 'grid',
    gap: '12px',
  }}
>
  {checklistsAmbiente.length === 0 ? (
    <div
      style={{
        padding: '18px',
        borderRadius: '14px',
        background: 'rgba(255,255,255,.04)',
        color: '#94a3b8',
        textAlign: 'center',
      }}
    >
      Nenhum checklist disponível para este ambiente.
    </div>
  ) : (
    checklistsAmbiente.map((checklist) => (
      <button
        key={checklist.id}
        type="button"
        onClick={() => setChecklistSelecionado(checklist)}
        style={{
          width: '100%',
          padding: '18px 20px',
          borderRadius: '14px',
          border:
            checklistSelecionado?.id === checklist.id
              ? '2px solid #c35d6d'
              : '1px solid rgba(255,255,255,.10)',
          background:
            checklistSelecionado?.id === checklist.id
              ? 'rgba(122,31,43,.35)'
              : 'rgba(255,255,255,.04)',
          color: '#ffffff',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            fontSize: '17px',
            fontWeight: 800,
          }}
        >
          {checklist.nome}
        </div>

        <div
          style={{
            marginTop: '6px',
            fontSize: '13px',
            color: '#94a3b8',
          }}
        >
          Periodicidade: {checklist.periodicidade || 'Não definida'}
        </div>

        {checklist.descricao && (
          <div
            style={{
              marginTop: '6px',
              fontSize: '13px',
              color: '#64748b',
            }}
          >
            {checklist.descricao}
          </div>
        )}
      </button>
    ))
  )}

  {checklistSelecionado && (
    <div
      style={{
        marginTop: '8px',
        padding: '20px',
        borderRadius: '16px',
        background: '#111827',
        border: '1px solid rgba(255,255,255,.08)',
      }}
    >
      <div
        style={{
          color: '#c35d6d',
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}
      >
        Checklist selecionado
      </div>

      <h3
        style={{
          margin: '8px 0 5px',
          color: '#ffffff',
        }}
      >
        {checklistSelecionado.nome}
      </h3>

      <button
        type="button"
        onClick={async () => {
  if (!ambienteSelecionado || !checklistSelecionado) {
    alert('Selecione um checklist antes de iniciar.')
    return
  }

  const { data, error } = await supabase.rpc(
    'iniciar_rotina',
    {
      p_ambiente_id: ambienteSelecionado.id,
      p_checklist_id: checklistSelecionado.id,
    }
  )
  let rotinaId = data

  if (error) {
  console.error('ERRO AO INICIAR ROTINA:', error)

  if (error.message?.includes('Já existe uma rotina em execução')) {
    const { data: rotinaExistente, error: erroBusca } = await supabase
      .from('rotinas')
      .select('id')
      .eq('usuario_id', usuario.id)
      .eq('ambiente_id', ambienteSelecionado.id)
      .eq('checklist_id', checklistSelecionado.id)
      .eq('status', 'EM_EXECUCAO')
      .order('iniciada_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (erroBusca || !rotinaExistente) {
      alert('Não foi possível localizar a rotina que já está em execução.')
      return
    }

    rotinaId = rotinaExistente.id
  } else {
    alert(`Não foi possível iniciar a rotina: ${error.message}`)
    return
  }
}

const { data: itens, error: erroItens } = await supabase
  .from('rotina_itens')
  .select(`
    id,
    resposta,
    observacao,
    respondido_em,
    checklist_item_id,
    checklist_itens (
      ordem,
      obrigatorio,
      configuracao,
      itens (
        id,
        nome,
        descricao,
        tipo_resposta
      )
    )
  `)
  .eq('rotina_id', rotinaId)

if (erroItens) {
  console.error('Erro ao carregar itens da rotina:', erroItens)
  alert(`A rotina foi criada, mas não foi possível carregar os itens: ${erroItens.message}`)
  return
}
setObservacaoRotina('')
setItensRotina(itens || [])
setRotinaAtual(rotinaId)
setTela('rotina')
}}
>
  INICIAR ROTINA
</button>
        
    </div>
  )}
</div>
   

            </section>

          </main>

        </div>
      </>
    )
  }
 
 async function finalizarRotina() {
  if (!rotinaAtual) {
    alert('Não foi possível identificar a rotina.')
    return
  }

  const itensIncompletos = itensRotina.filter(
    (item) => !item.resposta
  )

  if (itensIncompletos.length > 0) {
    alert('Responda todos os itens antes de finalizar a rotina.')
    return
  }

  try {
    const atualizacoes = itensRotina.map((item) =>
      supabase
        .from('rotina_itens')
        .update({
          resposta: item.resposta,
          respondido_em: item.respondido_em || new Date().toISOString(),
        })
        .eq('id', item.id)
    )

    const resultados = await Promise.all(atualizacoes)

    const erroItem = resultados.find((resultado) => resultado.error)

    if (erroItem?.error) {
      console.error('Erro ao salvar respostas:', erroItem.error)
      alert(
        `Não foi possível salvar as respostas: ${erroItem.error.message}`
      )
      return
    }

    const { error } = await supabase.rpc(
      'finalizar_rotina',
      {
        p_rotina_id: rotinaAtual,
       p_observacao: observacaoRotina.trim() || null,
      }
    )

    if (error) {
      console.error('Erro ao finalizar rotina:', error)
      alert(`Não foi possível finalizar a rotina: ${error.message}`)
      return
    }

    alert('Rotina finalizada com sucesso!')

    
    setRotinaAtual(null)
    setAmbienteSelecionado(null)
    setChecklistSelecionado(null)
    setTela('home')
    await carregarAtividades(usuario.id)

  } catch (error) {
    console.error('Erro inesperado ao finalizar rotina:', error)
    alert('Ocorreu um erro ao finalizar a rotina.')
  }
}
 
 
  /*
   * TELA DA ROTINA
   */
  if (tela === 'rotina' && rotinaAtual) {
    return (
      <>
        <style>{estilosCSS}</style>

        <div className="app">
          <main className="main">

            <div className="environment-page">

              <header className="environment-header">
                <button
                  className="back-button"
                  onClick={() => {
  setRotinaAtual(null)
  setAmbienteSelecionado(null)
  setChecklistSelecionado(null)
  setItensRotina([])
  setObservacaoRotina('')
  setTela('home')
}}
                >
                  ← Voltar
                </button>

                <div>
                  <span className="eyebrow">
                    ROTINA EM EXECUÇÃO
                  </span>

                  <h1>
                    {ambienteSelecionado?.nome}
                  </h1>

                  <p style={{ color: '#8da0bd' }}>
                    {checklistSelecionado?.nome}
                  </p>
                </div>
              </header>

              <section
                className="next-card"
                style={{ marginTop: '24px' }}
              >
                <div>
                  <span className="card-label">
                    CHECKLIST
                  </span>

                  <h2>
                    {checklistSelecionado?.nome}
                  </h2>

                  <p>
                    Responda aos itens abaixo para registrar a atividade.
                  </p>
                </div>
              </section>

              <section
                style={{
                  marginTop: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >

                {itensRotina.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      background: '#111a28',
                      border: '1px solid #253247',
                      borderRadius: '18px',
                      padding: '20px',
                    }}
                  >

                    <div
                      style={{
                        display: 'flex',
                        gap: '14px',
                        alignItems: 'flex-start',
                      }}
                    >

                      <div
                        style={{
                          minWidth: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: '#7a1f2b',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                        }}
                      >
                        {index + 1}
                      </div>

                      <div style={{ flex: 1 }}>
                        <h3
                          style={{
                            margin: 0,
                            color: '#ffffff',
                            fontSize: '18px',
                          }}
                        >
                          {item.checklist_itens?.itens?.nome}
                        </h3>

                        {item.checklist_itens?.itens?.descricao && (
                          <p
                            style={{
                              color: '#8da0bd',
                              marginTop: '7px',
                            }}
                          >
                            {item.checklist_itens.itens.descricao}
                          </p>
                        )}

                        <div
                          style={{
                            display: 'flex',
                            gap: '10px',
                            marginTop: '16px',
                          }}
                        >

                          <button
                            type="button"
                            onClick={() => {
                              setItensRotina((lista) =>
                                lista.map((x) =>
                                  x.id === item.id
                                    ? {
                                        ...x,
                                        resposta: 'CONFORME',
                                        respondido_em:
                                          new Date().toISOString(),
                                      }
                                    : x
                                )
                              )
                            }}
                            style={{
                              flex: 1,
                              padding: '12px',
                              border: 0,
                              borderRadius: '10px',
                              background:
                                item.resposta === 'CONFORME'
                                  ? '#166534'
                                  : '#243244',
                              color: '#ffffff',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            ✓ CONFORME
                          </button>

<button
  type="button"
  onClick={() => {
    setItensRotina((lista) =>
      lista.map((x) =>
        x.id === item.id
          ? {
              ...x,
              resposta: 'NAO_SE_APLICA',
              respondido_em: new Date().toISOString(),
            }
          : x
      )
    )
  }}
  style={{
    background:
  item.resposta === 'NAO_SE_APLICA'
    ? '#7a1f2b'
    : '#243244',
    color: '#ffffff',
    fontWeight: 800,
    cursor: 'pointer',
  }}
>
  — NÃO SE APLICA

</button>
                          <button
                            type="button"
                            onClick={() => {
                              setItensRotina((lista) =>
                                lista.map((x) =>
                                  x.id === item.id
                                    ? {
                                        ...x,
                                        resposta: 'NAO_CONFORME',
                                        respondido_em:
                                          new Date().toISOString(),
                                      }
                                    : x
                                )
                              )
                            }}
                            style={{
                              flex: 1,
                              padding: '12px',
                              border: 0,
                              borderRadius: '10px',
                              background:
                                item.resposta === 'NAO_CONFORME'
                                  ? '#991b1b'
                                  : '#243244',
                              color: '#ffffff',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            ✕ NÃO CONFORME
                          </button>

                        </div>

                      </div>

                    </div>

                  </div>
                ))}
                <div
  style={{
    marginTop: '24px',
    padding: '18px',
    background: '#111927',
    border: '1px solid #243244',
    borderRadius: '12px',
  }}
>
  <label
    style={{
      display: 'block',
      color: '#c35d6d',
      fontSize: '13px',
      fontWeight: 800,
      letterSpacing: '1px',
      marginBottom: '10px',
    }}
  >
    OBSERVAÇÃO DA ROTINA
  </label>

  <textarea
    value={observacaoRotina}
    onChange={(e) => setObservacaoRotina(e.target.value)}
    placeholder="Digite uma observação, se necessário..."
    rows={4}
    style={{
      width: '100%',
      boxSizing: 'border-box',
      padding: '12px',
      borderRadius: '10px',
      border: '1px solid #243244',
      background: '#0b1220',
      color: '#ffffff',
      fontSize: '14px',
      resize: 'vertical',
      outline: 'none',
    }}
  />
</div>
{itensRotina.length > 0 &&
  itensRotina.every((item) => item.resposta) && (
    <button
      type="button"
      onClick={finalizarRotina}
      style={{
        marginTop: '20px',
        width: '100%',
        padding: '16px',
        border: 0,
        borderRadius: '12px',
        background: '#7a1f2b',
        color: '#ffffff',
        fontWeight: 800,
        fontSize: '16px',
        cursor: 'pointer',
      }}
    >

  FINALIZAR ROTINA
   </button>  
  )}


              </section>

            </div>

          </main>
        </div>
      </>
    )
  }
  /*
   * HOME
   */

  return (
    <>
      <style>{estilosCSS}</style>

      <div className="app">

        <header className="topbar">

          <div className="brand">

            <div className="brand-logo">
              AO
            </div>

            <div>
              <div className="brand-title">
                APOIO OPERACIONAL
              </div>

              <div className="brand-subtitle">
                Gestão Operacional Integrada
              </div>
            </div>

          </div>

          <div className="user-area">

            <div className="user-avatar">
              {usuario.nome
                ?.charAt(0)
                ?.toUpperCase()}
            </div>

            <div className="user-data">

              <strong>
                {usuario.nome}
              </strong>

              <span>
                {usuario.cargo || 'Colaborador'}
              </span>

            </div>

            <button
              className="logout-button"
              onClick={sair}
            >
              Sair
            </button>

          </div>

        </header>

        <main className="main">

          <section className="welcome">

            <div>

              <span className="role-badge">
                {usuario.perfis?.nome ||
                  'COLABORADOR'}
              </span>

              <h1>
                Olá,{' '}
                {usuario.nome?.split(' ')[0]}
                <span className="wave">
                  👋
                </span>
              </h1>

              <p>
                Pronto para registrar suas atividades?
              </p>

            </div>

            <div className="current-date">
              {formatarDataAtual()}
            </div>

          </section>

          <section className="dashboard-grid">

           <button
  className="qr-card"
  onClick={abrirQr}
>
  <div className="qr-icon">
    ▣
  </div>

  <div className="qr-content">
    <strong>Ler QR Code</strong>
    <span>
      Escaneie o QR Code do ambiente para iniciar uma rotina.
    </span>
  </div>
</button>


              <div className="qr-symbol">
                <span>
                  ▣
                </span>
              </div>

              <div className="qr-content">

                <span className="qr-title">
                  LER QR CODE
                </span>

                <span className="qr-description">
                  Acesse a rotina do ambiente
                </span>

              </div>

              <div className="qr-arrow">
                →
              </div>

           

            <div className="summary-card">

              <span className="card-label">
                MINHAS ATIVIDADES
              </span>

              <strong className="activity-number">
                {atividades.length}
              </strong>

              <span className="card-description">
                registros recentes
              </span>

            </div>

          </section>

          <section className="history-section">

            <div className="section-header">

              <div>

                <span className="card-label">
                  HISTÓRICO RECENTE
                </span>

                <h2>
                  Minhas atividades
                </h2>

              </div>

              <span className="record-count">
                {atividades.length}{' '}
                {atividades.length === 1
                  ? 'registro'
                  : 'registros'}
              </span>

            </div>

            {atividades.length === 0 ? (

              <div className="empty-state">

                <div className="empty-icon">
                  ✓
                </div>

                <strong>
                  Nenhuma atividade registrada
                </strong>

                <span>
                  Suas atividades executadas aparecerão aqui.
                </span>

              </div>

            ) : (

              <div className="activity-list">

                {atividades.map((atividade) => (

                  <button
  type="button"
  className="activity-item"
  key={atividade.id}
  onClick={() => {
  setRotinaAtual(atividade.id)
  setTela('detalhe')
}}
  style={{
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
  }}
>
                    

                    <div className="activity-icon">
                      ✓
                    </div>

                    <div className="activity-info">

                      <strong>
                        {atividade.checklists?.nome ||
                          'Checklist'}
                      </strong>

                      <span>
                        {atividade.ambientes?.nome ||
                          'Ambiente'}
                      </span>

                      <small>
                        Iniciada em{' '}
                        {formatarData(
                          atividade.iniciada_em
                        )}
                      </small>

                    </div>

                    <div className="activity-status">

                      <span
                        className={statusClasse(
                          atividade.status
                        )}
                      >
                        {statusTexto(
                          atividade.status
                        )}
                      </span>

                      {atividade.finalizada_em && (
                        <small>
                          Finalizada:{' '}
                          {formatarData(
                            atividade.finalizada_em
                          )}
                        </small>
                      )}

                    </div>

                  </button>

                ))}

              </div>

            )}

          </section>

        </main>

        <footer className="footer">
          APOIO OPERACIONAL V2
        </footer>

      </div>
    </>
  )
}

const estilosCSS = `

* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  min-height: 100%;
}

body {
  background: #080d16;
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Arial,
    sans-serif;
}

button,
input {
  font-family: inherit;
}

/* =========================
   LOADING
========================= */

.loading-page {
  min-height: 100vh;
  background:
    radial-gradient(
      circle at 50% 20%,
      rgba(122,31,43,.20),
      transparent 35%
    ),
    #080d16;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.loading-logo {
  width: 58px;
  height: 58px;
  border-radius: 17px;
  background: linear-gradient(135deg,#7a1f2b,#a93648);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid rgba(255,255,255,.12);
  border-top-color: #b64a5b;
  animation: spin .8s linear infinite;
}

.loading-page span {
  color: #64748b;
  font-size: 13px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* =========================
   LOGIN
========================= */

.login-page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(
      circle at 15% 20%,
      rgba(122,31,43,.18),
      transparent 35%
    ),
    radial-gradient(
      circle at 85% 80%,
      rgba(169,54,72,.08),
      transparent 35%
    ),
    #080d16;
  color: #ffffff;
}

.login-glow {
  position: absolute;
  width: 420px;
  height: 420px;
  border-radius: 50%;
  filter: blur(90px);
  pointer-events: none;
}

.glow-one {
  left: -180px;
  top: -150px;
  background: rgba(122,31,43,.12);
}

.glow-two {
  right: -180px;
  bottom: -160px;
  background: rgba(169,54,72,.08);
}

.login-container {
  min-height: 100vh;
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 470px;
  padding: 38px;
  border-radius: 25px;
  background: rgba(17,24,36,.97);
  border: 1px solid rgba(255,255,255,.08);
  box-shadow: 0 30px 90px rgba(0,0,0,.50);
}

.brand {
  display: flex;
  align-items: center;
  gap: 13px;
}

.brand-logo {
  width: 50px;
  height: 50px;
  border-radius: 15px;
  background: linear-gradient(135deg,#7a1f2b,#a93648);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 900;
  font-size: 17px;
  box-shadow: 0 10px 30px rgba(122,31,43,.25);
}

.brand-title {
  color: #ffffff;
  font-weight: 850;
  font-size: 17px;
  letter-spacing: .4px;
}

.brand-subtitle {
  color: #64748b;
  font-size: 11px;
  margin-top: 4px;
}

.divider {
  height: 1px;
  background: rgba(255,255,255,.08);
  margin: 30px 0;
}

.eyebrow {
  color: #c35d6d;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 1.5px;
}

.login-heading {
  margin-bottom: 25px;
}

.login-heading h1 {
  color: #ffffff;
  margin: 8px 0 7px;
  font-size: 28px;
}

.login-heading p {
  color: #94a3b8;
  margin: 0;
  font-size: 14px;
}

.field {
  margin-top: 18px;
}

.field label {
  display: block;
  color: #cbd5e1;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 8px;
}

.field input {
  width: 100%;
  height: 50px;
  padding: 0 15px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.09);
  outline: none;
  background: #0d1421;
  color: #ffffff;
  font-size: 14px;
}

.field input::placeholder {
  color: #475569;
}

.field input:focus {
  border-color: #8f3040;
  box-shadow: 0 0 0 3px rgba(122,31,43,.15);
}

.login-options {
  margin-top: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.remember {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
}

.remember input {
  accent-color: #7a1f2b;
}

.forgot-button {
  border: 0;
  background: transparent;
  color: #c35d6d;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}

.message {
  margin-top: 18px;
  padding: 12px 14px;
  border-radius: 11px;
  font-size: 13px;
}

.message.info {
  background: rgba(122,31,43,.10);
  border: 1px solid rgba(180,74,91,.22);
  color: #e6a0aa;
}

.message.erro {
  background: rgba(239,68,68,.10);
  border: 1px solid rgba(239,68,68,.20);
  color: #fecaca;
}

.message.sucesso {
  background: rgba(34,197,94,.10);
  border: 1px solid rgba(34,197,94,.20);
  color: #bbf7d0;
}

.login-button,
.primary-button {
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg,#7a1f2b,#a93648);
  color: #ffffff;
  font-weight: 850;
  cursor: pointer;
  transition: .2s ease;
}

.login-button {
  width: 100%;
  height: 52px;
  margin-top: 22px;
  font-size: 14px;
}

.login-button:hover,
.primary-button:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.login-footer {
  margin-top: 28px;
  text-align: center;
  color: #475569;
  font-size: 10px;
  letter-spacing: 1.5px;
}

/* =========================
   HOME
========================= */

.app {
  min-height: 100vh;
  background:
    radial-gradient(
      circle at 12% 8%,
      rgba(122,31,43,.08),
      transparent 30%
    ),
    #080d16;
  color: #ffffff;
}

.topbar {
  min-height: 78px;
  padding: 0 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(10,15,25,.96);
  border-bottom: 1px solid rgba(255,255,255,.07);
}

.user-area {
  display: flex;
  align-items: center;
  gap: 11px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg,#7a1f2b,#a93648);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 850;
}

.user-data {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.user-data strong {
  color: #ffffff;
  font-size: 14px;
}

.user-data span {
  color: #94a3b8;
  font-size: 11px;
}

.logout-button,
.back-button {
  border: 1px solid rgba(255,255,255,.09);
  background: transparent;
  color: #cbd5e1;
  border-radius: 9px;
  cursor: pointer;
}

.logout-button {
  margin-left: 15px;
  padding: 9px 15px;
}

.logout-button:hover,
.back-button:hover {
  background: rgba(122,31,43,.12);
  border-color: rgba(180,74,91,.25);
}

.main {
  max-width: 1180px;
  margin: 0 auto;
  padding: 44px 28px 30px;
}

.welcome {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 28px;
}

.role-badge {
  display: inline-flex;
  padding: 6px 10px;
  border-radius: 7px;
  background: rgba(122,31,43,.12);
  color: #c35d6d;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 1.2px;
}

.welcome h1 {
  margin: 10px 0 6px;
  color: #ffffff;
  font-size: 40px;
  font-weight: 850;
}

.welcome p {
  margin: 0;
  color: #94a3b8;
  font-size: 15px;
}

.current-date {
  color: #64748b;
  font-size: 12px;
  text-transform: capitalize;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 18px;
}

.qr-card {
  min-height: 178px;
  border: 0;
  border-radius: 21px;
  padding: 28px;
  display: flex;
  align-items: center;
  gap: 20px;
  text-align: left;
  color: #ffffff;
  cursor: pointer;
  background: linear-gradient(135deg,#7a1f2b,#a93648);
  box-shadow: 0 22px 55px rgba(0,0,0,.28);
  transition: .2s ease;
}

.qr-card:hover {
  transform: translateY(-2px);
  filter: brightness(1.06);
}

.qr-symbol {
  width: 68px;
  height: 68px;
  flex-shrink: 0;
  border-radius: 18px;
  background: rgba(255,255,255,.14);
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-symbol span {
  font-size: 34px;
  font-weight: 900;
}

.qr-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.qr-title {
  color: #ffffff;
  font-size: 23px;
  font-weight: 900;
}

.qr-description {
  color: rgba(255,255,255,.78);
  font-size: 13px;
}

.qr-arrow {
  font-size: 30px;
}

.summary-card {
  min-height: 178px;
  padding: 28px;
  border-radius: 21px;
  border: 1px solid rgba(255,255,255,.07);
  background: #111925;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.card-label {
  color: #64748b;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 1.3px;
}

.activity-number {
  color: #ffffff;
  font-size: 50px;
  line-height: 1;
  margin: 11px 0;
}

.card-description {
  color: #94a3b8;
  font-size: 13px;
}

.history-section {
  margin-top: 34px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
}

.section-header h2 {
  margin: 7px 0 0;
  color: #ffffff;
  font-size: 23px;
}

.record-count {
  color: #64748b;
  font-size: 12px;
}

.empty-state {
  min-height: 205px;
  border-radius: 18px;
  border: 1px dashed rgba(255,255,255,.10);
  background: rgba(15,23,42,.25);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.empty-icon,
.environment-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(122,31,43,.15);
  color: #d26a79;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.empty-state strong {
  color: #cbd5e1;
}

.empty-state span {
  color: #64748b;
  font-size: 13px;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.activity-item {
  padding: 17px;
  border-radius: 15px;
  border: 1px solid rgba(255,255,255,.06);
  background: #111925;
  display: flex;
  align-items: center;
  gap: 15px;
}

.activity-icon {
  width: 41px;
  height: 41px;
  border-radius: 12px;
  background: rgba(122,31,43,.13);
  color: #d26a79;
  display: flex;
  align-items: center;
  justify-content: center;
}

.activity-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.activity-info strong {
  color: #ffffff;
  font-size: 14px;
}

.activity-info span {
  color: #94a3b8;
  font-size: 13px;
}

.activity-info small,
.activity-status small {
  color: #64748b;
  font-size: 11px;
}

.activity-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.status {
  padding: 6px 9px;
  border-radius: 8px;
  background: rgba(148,163,184,.10);
  color: #94a3b8;
  font-size: 11px;
}

.status.sucesso {
  background: rgba(34,197,94,.10);
  color: #86efac;
}

.status.andamento {
  background: rgba(245,158,11,.10);
  color: #fcd34d;
}

.status.cancelada {
  background: rgba(239,68,68,.10);
  color: #fca5a5;
}

.status.arquivada {
  background: rgba(100,116,139,.12);
  color: #94a3b8;
}

.footer {
  padding: 28px;
  text-align: center;
  color: #334155;
  font-size: 10px;
  letter-spacing: 1.5px;
}

/* =========================
   AMBIENTE
========================= */

.environment-page {
  min-height: 100vh;
  background:
    radial-gradient(
      circle at 15% 10%,
      rgba(122,31,43,.12),
      transparent 35%
    ),
    #080d16;
  color: #ffffff;
}

.environment-header {
  max-width: 1000px;
  margin: 0 auto;
  padding: 30px 25px;
  display: flex;
  align-items: center;
  gap: 22px;
}

.back-button {
  padding: 11px 16px;
}

.environment-header h1 {
  margin: 5px 0 0;
  color: #ffffff;
}

.environment-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 10px 25px 50px;
}

.environment-card {
  padding: 28px;
  border-radius: 20px;
  background: #111925;
  border: 1px solid rgba(255,255,255,.07);
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.environment-icon {
  flex-shrink: 0;
  background: rgba(34,197,94,.10);
  color: #86efac;
}

.environment-type {
  color: #c35d6d;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 1.3px;
}

.environment-info h2 {
  margin: 7px 0;
  color: #ffffff;
  font-size: 25px;
}

.environment-code {
  color: #94a3b8;
  font-size: 13px;
}

.environment-info p {
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

.next-card {
  margin-top: 18px;
  padding: 28px;
  border-radius: 20px;
  background: #111925;
  border: 1px solid rgba(255,255,255,.07);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 25px;
}

.next-card h2 {
  color: #ffffff;
  margin: 7px 0;
}

.next-card p {
  color: #64748b;
  max-width: 620px;
  line-height: 1.5;
  font-size: 13px;
}

.primary-button {
  padding: 14px 22px;
  white-space: nowrap;
}

/* =========================
   MOBILE
========================= */

@media (max-width: 800px) {

  .topbar {
    padding: 14px 18px;
  }

  .brand-subtitle {
    display: none;
  }

  .user-data {
    display: none;
  }

  .logout-button {
    margin-left: 4px;
  }

  .main {
    padding: 30px 17px;
  }

  .welcome {
    align-items: flex-start;
    flex-direction: column;
    gap: 15px;
  }

  .welcome h1 {
    font-size: 32px;
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .qr-card,
  .summary-card {
    min-height: 150px;
  }

  .activity-item {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .activity-status {
    width: 100%;
    margin-left: 56px;
    align-items: flex-start;
  }

  .environment-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .next-card {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 520px) {

  .login-card {
    padding: 28px 22px;
  }

  .brand-title {
    font-size: 14px;
  }

  .brand-logo {
    width: 43px;
    height: 43px;
  }

  .welcome h1 {
    font-size: 29px;
  }

  .qr-card {
    padding: 22px;
  }

  .qr-symbol {
    width: 58px;
    height: 58px;
  }

  .qr-title {
    font-size: 19px;
  }

  .qr-arrow {
    font-size: 24px;
  }
}
`

export default App
