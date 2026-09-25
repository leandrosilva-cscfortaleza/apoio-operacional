import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from './supabase'

function QrScanner({ onVoltar, onAmbienteEncontrado }) {
  const scannerRef = useRef(null)
  const iniciandoRef = useRef(false)

  const [iniciando, setIniciando] = useState(true)
  const [erro, setErro] = useState('')
  const [lido, setLido] = useState(false)

  useEffect(() => {
    iniciarLeitor()

    return () => {
      pararLeitor()
    }
  }, [])

  async function iniciarLeitor() {
    if (iniciandoRef.current) return

    iniciandoRef.current = true
    setErro('')
    setIniciando(true)

    try {
      const scanner = new Html5Qrcode('qr-reader')

      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: {
            width: 280,
            height: 280,
          },
          aspectRatio: 1,
        },
        async (codigo) => {
          if (lido) return

          setLido(true)

          await processarQr(codigo)
        },
        () => {
          // Erros de leitura são ignorados enquanto a câmera procura o QR.
        }
      )

      setIniciando(false)
    } catch (error) {
      console.error('Erro ao iniciar câmera:', error)

      setErro(
        'Não foi possível acessar a câmera. Verifique a permissão do navegador.'
      )

      setIniciando(false)
    }
  }

  async function processarQr(codigo) {
    try {
      const qrToken = codigo.trim()

      const { data, error } = await supabase
        .from('ambientes')
        .select(`
          id,
          codigo,
          nome,
          tipo,
          descricao,
          unidade_id,
          bloco_id,
          pavimento_id,
          qr_token,
          ativo
        `)
        .eq('qr_token', qrToken)
        .eq('ativo', true)
        .maybeSingle()

      if (error) {
        console.error(error)

        setErro(
          'Não foi possível consultar este QR Code.'
        )

        setLido(false)
        return
      }

      if (!data) {
        setErro(
          'QR Code não reconhecido ou ambiente inativo.'
        )

        setLido(false)
        return
      }

      await pararLeitor()

      onAmbienteEncontrado(data)

    } catch (error) {
      console.error(error)

      setErro(
        'Ocorreu um erro ao processar o QR Code.'
      )

      setLido(false)
    }
  }
  async function abrirAmbienteTeste() {
    setErro('')
    setLido(true)

    const { data, error } = await supabase
      .from('ambientes')
      .select(`
        id,
        codigo,
        nome,
        tipo,
        descricao,
        unidade_id,
        bloco_id,
        pavimento_id,
        qr_token,
        ativo
      `)
      .eq('codigo', 'ENV-001')
      .eq('ativo', true)
      .maybeSingle()

    if (error) {
      console.error('Erro ao carregar ambiente de teste:', error)
      setErro('Não foi possível carregar o ambiente de teste.')
      setLido(false)
      return
    }

    if (!data) {
      setErro('Ambiente de teste não encontrado ou inativo.')
      setLido(false)
      return
    }

    await pararLeitor()
    onAmbienteEncontrado(data)
  }

  async function pararLeitor() {
    const scanner = scannerRef.current

    if (!scanner) return

    try {
      const estado = scanner.getState()

      if (estado === 2) {
        await scanner.stop()
      }
    } catch (error) {
      console.warn('Não foi possível parar o leitor:', error)
    }

    try {
      scanner.clear()
    } catch (error) {
      console.warn('Não foi possível limpar o leitor:', error)
    }

    scannerRef.current = null
    iniciandoRef.current = false
  }

  async function voltar() {
    await pararLeitor()
    onVoltar()
  }

  return (
    <div className="qr-page">

      <div className="qr-header">

        <button
          className="qr-back"
          onClick={voltar}
        >
          ← Voltar
        </button>

        <div>
          <span className="qr-eyebrow">
            APOIO OPERACIONAL
          </span>

          <h1>
            Ler QR Code
          </h1>
        </div>

      </div>

      <div className="qr-content">

        <div className="qr-card">

          <div className="qr-title-area">

            <div className="qr-camera-icon">
              ▣
            </div>

            <div>
              <h2>
                Aponte a câmera
              </h2>

              <p>
                Posicione o QR Code do ambiente dentro da área indicada.
              </p>
            </div>

          </div>

          <div className="scanner-container">

            <div
              id="qr-reader"
              className="qr-reader"
            />

            {iniciando && (
              <div className="scanner-overlay">
                <div className="scanner-spinner" />

                <span>
                  Iniciando câmera...
                </span>
              </div>
            )}

          </div>

          {erro && (
            <div className="qr-error">
              {erro}
            </div>
          )}

          <div className="qr-instructions">

            <div>
              <strong>
                1
              </strong>

              <span>
                Permita o acesso à câmera.
              </span>
            </div>

            <div>
              <strong>
                2
              </strong>

              <span>
                Aponte para o QR Code do ambiente.
              </span>
            </div>

            <div>
              <strong>
                3
              </strong>

              <span>
                O ambiente será identificado automaticamente.
              </span>
            </div>

          </div>

        </div>

      </div>

      <style>{`
        .qr-page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 20% 10%,
              rgba(122,31,43,.16),
              transparent 35%
            ),
            #0b101c;
          color: #fff;
          padding: 28px;
          box-sizing: border-box;
        }

        .qr-header {
          max-width: 900px;
          margin: 0 auto 25px;
          display: flex;
          align-items: center;
          gap: 25px;
        }

        .qr-back {
          border: 1px solid rgba(255,255,255,.09);
          background: rgba(255,255,255,.03);
          color: #cbd5e1;
          padding: 11px 16px;
          border-radius: 10px;
          cursor: pointer;
        }

        .qr-back:hover {
          background: rgba(122,31,43,.20);
        }

        .qr-eyebrow {
          color: #b64a5b;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.4px;
        }

        .qr-header h1 {
          margin: 5px 0 0;
          color: #fff;
          font-size: 28px;
        }

        .qr-content {
          max-width: 900px;
          margin: 0 auto;
        }

        .qr-card {
          background: #111a2a;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 22px;
          padding: 25px;
          box-shadow: 0 25px 70px rgba(0,0,0,.30);
        }

        .qr-title-area {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 22px;
        }

        .qr-camera-icon {
          width: 48px;
          height: 48px;
          border-radius: 13px;
          background: rgba(122,31,43,.20);
          color: #d26a79;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
        }

        .qr-title-area h2 {
          margin: 0;
          color: #fff;
          font-size: 18px;
        }

        .qr-title-area p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .scanner-container {
          position: relative;
          width: 100%;
          max-width: 650px;
          min-height: 360px;
          margin: 0 auto;
          border-radius: 18px;
          overflow: hidden;
          background: #050914;
          border: 1px solid rgba(255,255,255,.08);
        }

        .qr-reader {
          width: 100%;
        }

        .qr-reader video {
          width: 100% !important;
          border-radius: 18px;
        }

        .scanner-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: rgba(5,9,20,.88);
          color: #cbd5e1;
        }

        .scanner-spinner {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 3px solid rgba(255,255,255,.15);
          border-top-color: #7a1f2b;
          animation: qrspin .8s linear infinite;
        }

        @keyframes qrspin {
          to {
            transform: rotate(360deg);
          }
        }

        .qr-error {
          margin-top: 16px;
          padding: 13px 15px;
          border-radius: 11px;
          background: rgba(122,31,43,.12);
          border: 1px solid rgba(180,74,91,.25);
          color: #f0a0aa;
          font-size: 13px;
        }

        .qr-instructions {
          max-width: 650px;
          margin: 20px auto 0;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .qr-instructions div {
          padding: 13px;
          border-radius: 12px;
          background: rgba(255,255,255,.025);
          border: 1px solid rgba(255,255,255,.05);
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .qr-instructions strong {
          width: 25px;
          height: 25px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #7a1f2b;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }

        .qr-instructions span {
          color: #94a3b8;
          font-size: 11px;
          line-height: 1.35;
        }

        @media (max-width: 700px) {
          .qr-page {
            padding: 18px;
          }

          .qr-header {
            align-items: flex-start;
            flex-direction: column;
            gap: 14px;
          }

          .scanner-container {
            min-height: 300px;
          }

          .qr-instructions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

    </div>
  )
}

export default QrScanner
