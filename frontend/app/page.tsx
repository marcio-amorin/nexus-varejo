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

  function inpSt(focused: boolean): React.CSSProperties {
    return {
      width: '100%',
      padding: '14px 18px',
      fontSize: 16,
      fontWeight: 700,
      border: `2px solid ${focused ? '#F97316' : '#D1D5DB'}`,
      borderRadius: 12,
      outline: 'none',
      background: focused ? '#FFF7ED' : '#F8F8F8',
      color: '#111827',
      marginBottom: 14,
      transition: 'all 0.15s',
      fontFamily: 'inherit',
      boxShadow: focused ? '0 0 0 4px rgba(249,115,22,0.12)' : 'none',
      boxSizing: 'border-box' as const,
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Painel esquerdo — oculto no mobile, visivel no desktop */}
      <div className="hidden md:flex" style={{
        flex: '0 0 58%', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(150deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ position: 'absolute', top: -120, right: -80, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.20) 0%, transparent 65%)', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', bottom: -80, left: -60, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 65%)', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(249,115,22,0.07) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', top: 40, right: 60, width: 200, height: 200, borderRadius: '50%', border: '1.5px solid rgba(249,115,22,0.18)', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', top: 60, right: 80, width: 140, height: 140, borderRadius: '50%', border: '1px solid rgba(59,130,246,0.12)', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', bottom: 100, left: 40, width: 240, height: 240, borderRadius: '50%', border: '1.5px solid rgba(59,130,246,0.15)', pointerEvents: 'none' }}/>
        <div style={{ position: 'relative', zIndex: 1, padding: '48px 60px' }}>
          <div style={{ background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)', borderRadius: 28, padding: '26px 40px', width: 'fit-content', marginBottom: 30, boxShadow: '0 24px 60px rgba(249,115,22,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
              <span style={{ fontSize: 36 }}>🛒</span>
              <p style={{ color: 'white', fontWeight: 900, fontSize: 42, lineHeight: 1, letterSpacing: -3, margin: 0 }}>NexusVarejo</p>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: 6 }}>GESTÃO COMERCIAL</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', borderRadius: 22, padding: '22px 36px', width: 'fit-content' }}>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 24, margin: 0, lineHeight: 1.4 }}>Somos Apaixonados<br/>pelo Comércio.</p>
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 44 }}>
            {['🛒','📦','💳','📊','🤝'].map((ic, i) => (
              <div key={i} style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, opacity: 0.55 }}>{ic}</div>
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 22, left: 60, zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, margin: 0 }}>Gestão Comercial Completa</p>
        </div>
      </div>

      {/* Painel direito — form (ocupa tela inteira no mobile) */}
      <div style={{
        flex: 1, background: '#FFFFFF', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 28px', position: 'relative', minHeight: '100dvh',
      }}>

        {/* Logo mini — visivel apenas no mobile */}
        <div className="flex md:hidden" style={{ flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', borderRadius: 20, padding: '16px 28px', boxShadow: '0 12px 32px rgba(249,115,22,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 28 }}>🛒</span>
              <p style={{ color: 'white', fontWeight: 900, fontSize: 28, lineHeight: 1, letterSpacing: -1.5, margin: 0 }}>NexusVarejo</p>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 12, margin: 0, letterSpacing: 4 }}>GESTÃO COMERCIAL</p>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ color: '#F97316', fontWeight: 900, fontSize: 40, letterSpacing: -2, margin: 0, lineHeight: 1 }}>NexusVarejo</p>
          <p style={{ color: '#6B7280', fontSize: 13, fontWeight: 700, marginTop: 6, letterSpacing: 1, marginBottom: 0 }}>Gestão Comercial Completa</p>
        </div>

        <form onSubmit={entrar} style={{ width: '100%', maxWidth: 340 }}>
          <input
            value={usuario} onChange={e => setUsuario(e.target.value)}
            onFocus={() => setFocusU(true)} onBlur={() => setFocusU(false)}
            type="text" required placeholder="Usuário"
            style={inpSt(focusU)}
          />
          <input
            value={senha} onChange={e => setSenha(e.target.value)}
            onFocus={() => setFocusS(true)} onBlur={() => setFocusS(false)}
            type="password" required placeholder="Senha"
            style={inpSt(focusS)}
          />
          {erro && (
            <p style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 12, background: '#FEF2F2', padding: '10px 16px', borderRadius: 8 }}>
              {erro}
            </p>
          )}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '15px 0', marginTop: 4,
            background: 'linear-gradient(135deg, #F97316, #EA580C)',
            color: 'white', fontWeight: 800, fontSize: 16,
            border: 'none', borderRadius: 50, cursor: 'pointer',
            letterSpacing: 2, boxShadow: '0 6px 24px rgba(249,115,22,0.4)',
            fontFamily: 'inherit', opacity: loading ? 0.7 : 1, minHeight: 52,
          }}>
            {loading ? '⏳ CONECTANDO... (ate 60s)' : 'ENTRAR'}
          </button>
        </form>

        <div style={{ position: 'absolute', bottom: 16, right: 20, textAlign: 'right' }}>
          <p style={{ color: '#9CA3AF', fontSize: 11, margin: 0 }}>NexusVarejo &mdash; Versao 1.0.0</p>
          <p style={{ color: '#D1D5DB', fontSize: 10, margin: '2px 0 0' }}>&copy; 2025 NexusVarejo Gestao Comercial</p>
        </div>
      </div>
    </div>
  )
}
