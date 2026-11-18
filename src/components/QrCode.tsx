import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function QrCode({ text, size = 280 }: { text: string; size?: number }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    QRCode.toDataURL(text, { width: size * 2, margin: 1 }).then(setSrc).catch(() => setSrc(''))
  }, [text, size])
  return src ? <img src={src} width={size} height={size} alt="방 들어가기 QR" className="qr" /> : null
}

export const joinUrl = (code: string) => `${location.origin}/r/${code}`
