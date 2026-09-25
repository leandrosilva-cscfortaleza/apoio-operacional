import { QRCodeSVG } from 'qrcode.react'

function QrCodeAmbiente({ ambiente }) {
  if (!ambiente?.qr_token) {
    return (
      <div>
        QR Code indisponível para este ambiente.
      </div>
    )
  }

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '18px',
        padding: '24px',
        width: 'fit-content',
        textAlign: 'center',
      }}
    >
      <QRCodeSVG
        value={ambiente.qr_token}
        size={240}
        level="H"
        includeMargin
      />

      <div
        style={{
          marginTop: '16px',
          color: '#111827',
          fontWeight: 800,
          fontSize: '18px',
        }}
      >
        {ambiente.nome}
      </div>

      <div
        style={{
          marginTop: '5px',
          color: '#6b7280',
          fontSize: '13px',
        }}
      >
        Código: {ambiente.codigo}
      </div>

      <div
        style={{
          marginTop: '12px',
          color: '#7a1f2b',
          fontWeight: 800,
          fontSize: '11px',
          letterSpacing: '1px',
        }}
      >
        APOIO OPERACIONAL
      </div>
    </div>
  )
}

export default QrCodeAmbiente
