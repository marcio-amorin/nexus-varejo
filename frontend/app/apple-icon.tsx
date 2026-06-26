import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        background: 'linear-gradient(135deg, #F97316, #EA580C)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
      }}
    >
      <span style={{ color: 'white', fontSize: 260, fontWeight: 900, lineHeight: 1, letterSpacing: -8 }}>N</span>
      <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 68, fontWeight: 800, letterSpacing: 10, marginTop: -10 }}>NEXUS</span>
    </div>,
    { ...size }
  )
}
