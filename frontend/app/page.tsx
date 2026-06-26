'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha]     = useState('')
  const [erro, setErro]       = useState('')
  const [loading, setLoading] = useState(false)
  const [focusU, setFocusU]   = useState(false)
  const [focusS, setFocusS]   = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErro('')
    try {
      // Acorda o servidor (cold start Render ~60s)
      try { await api.get('/health', { timeout: 90000 }) } catch {}
      const form = new FormData()
      form.append('username', usuario)
      form.append('password', senha)
      const { data } = await api.post('/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 90000,
      })
      localStorage.setItem('nexus_token', data.access_token)
      localStorage.setItem('nexus_user', JSON.stringify({ nome: data.nome, perfil: data.perfil }))
      router.push('/dashboard')
    } catch {
      setErro('Usuário ou senha incorretos. Se for o primeiro acesso, aguarde 60s e tente novamente.')
    }
    setLoading(false)
  }

  const inputS = (focused: boolean): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box' as const,
    padding: '15px 18px', fontSize: 17,
    fontWeight: 700,
    border: `${focused ? '2.5' : '2'}px solid ${focused ? '#F97316' : '#D1D5DB'}`,
    borderRadius: 12, outline: 'none',
    background: focused ? '#FFF7ED' : '#F8F8F8',
    color: '#111827', marginBottom: 14,
    transition: 'all 0.15s',
    fontFamily: 'inherit',
    boxShadow: focused ? '0 0 0 4px rgba(249,115,22,0.12)' : 'none',
    letterSpacing: 0.3,
  })

  const S: Record<string, React.CSSProperties> = {
    wrap: {
      display: 'flex', height: '100vh', overflow: 'hidden',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    },
    left: {
      flex: '0 0 58%', position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(150deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)',
    },
    glow1: {
      position: 'absolute', top: -120, right: -80,
      width: 500, height: 500, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(249,115,22,0.20) 0%, transparent 65%)',
      pointerEvents: 'none',
    },
    glow2: {
      position: 'absolute', bottom: -80, left: -60,
      width: 400, height: 400, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 65%)',
      pointerEvents: 'none',
    },
    glow3: {
      position: 'absolute', top: '40%', left: '45%',
      width: 260, height: 260, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
      pointerEvents: 'none',
    },
    grid: {
      position: 'absolute', inset: 0,
      backgroundImage: 'radial-gradient(rgba(249,115,22,0.07) 1px, transparent 1px)',
      backgroundSize: '28px 28px',
      pointerEvents: 'none',
    },
    ring1: {
      position: 'absolute', top: 40, right: 60,
      width: 200, height: 200, borderRadius: '50%',
      border: '1.5px solid rgba(249,115,22,0.18)',
      pointerEvents: 'none',
    },
    ring2: {
      position: 'absolute', top: 60, right: 80,
      width: 140, height: 140, borderRadius: '50%',
      border: '1px solid rgba(59,130,246,0.12)',
      pointerEvents: 'none',
    },
    ring3: {
      position: 'absolute', bottom: 100, left: 40,
      width: 240, height: 240, borderRadius: '50%',
      border: '1.5px solid rgba(59,130,246,0.15)',
      pointerEvents: 'none',
    },
    leftContent: {
      position: 'relative', zIndex: 1,
      height: '100%',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center',
      padding: '64px 60px',
    },
    logoBox: {
      background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
      borderRadius: 28,
      padding: '26px 40px',
      width: 'fit-content',
      marginBottom: 30,
      boxShadow: '0 24px 60px rgba(249,115,22,0.4)',
    },
    logoText1: {
      color: 'white', fontWeight: 900, fontSize: 56,
      lineHeight: 1, letterSpacing: -3, margin: 0,
    },
    logoText2: {
      color: 'rgba(255,255,255,0.8)', fontWeight: 700,
      fontSize: 20, margin: 0, letterSpacing: 6,
    },
    tagBox: {
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(12px)',
      borderRadius: 22,
      padding: '22px 36px',
      width: 'fit-content',
    },
    tagText: {
      color: 'white', fontWeight: 700,
      fontSize: 24, textAlign: 'center' as const,
      margin: 0, lineHeight: 1.4,
    },
    icons: {
      display: 'flex', gap: 14, marginTop: 44,
    },
    iconBox: {
      width: 50, height: 50, borderRadius: 14,
      background: 'rgba(249,115,22,0.1)',
      border: '1px solid rgba(249,115,22,0.2)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: 24,
    },
    leftFooter: {
      position: 'absolute', bottom: 22, left: 60, zIndex: 1,
    },
    leftFooterText: {
      color: 'rgba(255,255,255,0.25)', fontSize: 11, margin: 0,
    },
    right: {
      flex: 1, background: '#FFFFFF',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 52px', position: 'relative',
    },
    brandName: {
      color: '#F97316', fontWeight: 900, fontSize: 54,
      letterSpacing: -3, margin: 0, lineHeight: 1,
    },
    brandSub: {
      color: '#6B7280', fontSize: 14, fontWeight: 700, marginTop: 6,
      marginBottom: 38, textAlign: 'center' as const, letterSpacing: 1,
    },
    form: { width: '100%', maxWidth: 310 },
    btn: {
      width: '100%', padding: '14px 0',
      background: 'linear-gradient(135deg, #F97316, #EA580C)',
      color: 'white', fontWeight: 800,
      fontSize: 15, border: 'none',
      borderRadius: 50, cursor: 'pointer',
      letterSpacing: 2,
      boxShadow: '0 6px 24px rgba(249,115,22,0.4)',
      fontFamily: 'inherit',
      transition: 'opacity 0.2s',
      marginTop: 8,
    },
    erro: {
      color: '#EF4444', fontSize: 13,
      textAlign: 'center' as const,
      marginBottom: 12,
      background: '#FEF2F2',
      padding: '8px 16px',
      borderRadius: 8,
    },
    footer: {
      position: 'absolute', bottom: 20, right: 24,
      textAlign: 'right' as const,
    },
    footerText: { color: '#9CA3AF', fontSize: 11, margin: 0 },
    footerSub: { color: '#D1D5DB', fontSize: 10, margin: '2px 0 0' },
  }

  return (
    <div style={S.wrap}>
      {/* ── ESQUERDO ── */}
      <div style={S.left}>
        <div style={S.glow1} /><div style={S.glow2} /><div style={S.glow3} />
        <div style={S.grid} />
        <div style={S.ring1} /><div style={S.ring2} /><div style={S.ring3} />
        <div style={S.leftContent}>
          <div style={S.logoBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
              <span style={{ fontSize: 36 }}>🛒</span>
              <p style={{ ...S.logoText1, fontSize: 42 }}>NexusVarejo</p>
            </div>
            <p style={S.logoText2}>GESTÃO COMERCIAL</p>
          </div>
          <div style={S.tagBox}>
            <p style={S.tagText}>Somos Apaixonados<br />pelo Comércio.</p>
          </div>
          <div style={S.icons}>
            {['🛒','📦','💳','📊','🤝'].map((ic,i) => (
              <div key={i} style={{ ...S.iconBox, opacity: 0.55 }}>{ic}</div>
            ))}
          </div>
        </div>
        <div style={S.leftFooter}>
          <p style={S.leftFooterText}>Gestão Comercial Completa</p>
        </div>
      </div>

      {/* ── DIREITO ── */}
      <div style={S.right}>
        <div style={{ textAlign: 'center', marginBottom: 0 }}>
          <p style={S.brandName}>NexusVarejo</p>
          <p style={S.brandSub}>Gestão Comercial Completa</p>
        </div>

        <form onSubmit={entrar} style={S.form}>
          <input
            value={usuario}
            onChange={e => setUsuario(e.target.value)}
            onFocus={() => setFocusU(true)}
            onBlur={() => setFocusU(false)}
            type="text" required placeholder="Usuário"
            style={inputS(focusU)}
          />
          <input
            value={senha}
            onChange={e => setSenha(e.target.value)}
            onFocus={() => setFocusS(true)}
            onBlur={() => setFocusS(false)}
            type="password" required placeholder="senha"
            style={inputS(focusS)}
          />
          {erro && <p style={S.erro}>{erro}</p>}
          <button type="submit" disabled={loading} style={{ ...S.btn, opacity: loading ? 0.7 : 1 }}>
            {loading ? '⏳ CONECTANDO... (até 60s)' : 'ENTRAR'}
          </button>
        </form>

        <div style={S.footer}>
          <p style={S.footerText}>NexusVarejo — Versão 1.0.0</p>
          <p style={S.footerSub}>© 2025 NexusVarejo Gestão Comercial</p>
        </div>
      </div>
    </div>
  )
}
