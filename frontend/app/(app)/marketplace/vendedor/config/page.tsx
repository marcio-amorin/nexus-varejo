'use client'
import { useEffect, useState } from 'react'
import { Settings, CheckCircle, RefreshCw, Zap, ExternalLink, AlertCircle, User, Store } from 'lucide-react'

const API  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const GRAD = 'linear-gradient(135deg,#7c3aed 0%,#f97316 100%)'

function hdr() { return { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('nexus_token')}` } }

export default function ConfigVendedor() {
  const [conectando, setConectando]   = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [conta, setConta]             = useState<any>(null)   // dados da conta ML conectada
  const [erro, setErro]               = useState('')
  const [sucesso, setSucesso]         = useState(false)
  const [configs, setConfigs]         = useState<any>({})

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('ml_ok') === '1') {
        setSucesso(true)
        verificarConta()
      }
    }
    carregarConfig()
    verificarConta()
  }, [])

  async function carregarConfig() {
    try {
      const r = await fetch(`${API}/vendedor/config`, { headers: hdr() })
      const d = await r.json()
      setConfigs(d)
    } catch {}
  }

  async function verificarConta() {
    setVerificando(true)
    try {
      const r = await fetch(`${API}/vendedor/ml-verificar`, { headers: hdr() })
      const d = await r.json()
      if (d.ok) {
        setConta(d)
        setErro('')
      } else {
        setConta(null)
        if (d.msg && d.msg.includes('expirado')) setErro(d.msg)
      }
    } catch {}
    setVerificando(false)
  }

  async function conectarML() {
    setConectando(true); setErro('')
    try {
      const r = await fetch(`${API}/vendedor/ml-auth-url`, { headers: hdr() })
      const d = await r.json()
      if (d.url) {
        window.location.href = d.url
      } else {
        setErro('Erro ao gerar URL. Configure o Client ID em Config. Afiliados primeiro.')
      }
    } catch {
      setErro('Erro ao conectar. Verifique se o backend está rodando.')
    }
    setConectando(false)
  }

  const temConta = !!conta?.ok
  const cfg = configs['ML_VENDEDOR'] || {}

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header rounded-xl overflow-hidden" style={{ background: GRAD }}>
        <div className="px-4 py-3">
          <h1 className="text-base font-black text-white flex items-center gap-2"><Settings size={16}/> Config. Vendedor ML</h1>
          <p className="text-xs text-white/75 mt-0.5">Conecte a conta de vendedor para publicar anúncios automaticamente</p>
        </div>
      </div>

      {/* Banner sucesso */}
      {sucesso && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.4)' }}>
          <CheckCircle size={20} color="#22c55e"/>
          <div>
            <p className="text-sm font-black text-white">Conta ML conectada com sucesso!</p>
            <p className="text-xs" style={{ color:'var(--muted)' }}>Token salvo. O "Publicar Tudo" agora cria anúncios reais na conta.</p>
          </div>
        </div>
      )}

      {/* Banner erro */}
      {erro && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)' }}>
          <AlertCircle size={18} color="#ef4444"/>
          <p className="text-xs" style={{ color:'#fca5a5' }}>{erro}</p>
        </div>
      )}

      <div className="pg-body p-3 space-y-3">

        {/* Card conta conectada */}
        {verificando ? (
          <div className="rounded-xl p-6 flex items-center justify-center gap-2" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <RefreshCw size={16} color="#f97316" className="animate-spin"/>
            <span className="text-xs" style={{ color:'var(--muted)' }}>Verificando conexão...</span>
          </div>
        ) : temConta ? (
          /* ── CONTA CONECTADA ── */
          <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'2px solid rgba(34,197,94,0.4)' }}>
            <div className="px-4 py-3 flex items-center gap-3" style={{ background:'rgba(34,197,94,0.08)', borderBottom:'1px solid rgba(34,197,94,0.2)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background:'rgba(34,197,94,0.2)', border:'2px solid #22c55e' }}>
                <CheckCircle size={20} color="#22c55e"/>
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-white">Conta ML Vendedor Conectada</p>
                <p className="text-[10px]" style={{ color:'#22c55e' }}>✓ Token ativo — publicação automática habilitada</p>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full font-black" style={{ background:'rgba(34,197,94,0.2)', color:'#22c55e' }}>
                ATIVO
              </span>
            </div>
            <div className="p-4 space-y-3">
              {/* Dados da conta */}
              <div className="rounded-xl p-3 flex items-center gap-3" style={{ background:'var(--card2)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:'rgba(245,158,11,0.2)' }}>
                  <User size={18} color="#f59e0b"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white">{conta.nickname || '—'}</p>
                  <p className="text-[10px]" style={{ color:'var(--muted)' }}>{conta.email || ''}</p>
                  {conta.seller_id && (
                    <p className="text-[9px] mt-0.5" style={{ color:'var(--muted)' }}>Seller ID: {conta.seller_id}</p>
                  )}
                </div>
                {conta.permalink && (
                  <a href={conta.permalink} target="_blank"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                    style={{ background:'rgba(59,130,246,0.15)', color:'#3b82f6', border:'1px solid rgba(59,130,246,0.3)' }}>
                    <ExternalLink size={10}/> Ver loja
                  </a>
                )}
              </div>

              {/* O que está habilitado */}
              <div className="space-y-1.5">
                {[
                  '✅ Publicar anúncios na conta ML da Karla automaticamente',
                  '✅ Atualizar preços e estoque via sistema',
                  '✅ Receber pedidos sincronizados (Sync Pedidos)',
                  '✅ Botão "Publicar Tudo" cria anúncio real no ML',
                ].map((t,i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-white">
                    <span>{t}</span>
                  </div>
                ))}
              </div>

              <button onClick={conectarML} disabled={conectando}
                className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                style={{ background:'var(--card2)', color:'var(--muted)', border:'1px solid var(--border)' }}>
                <RefreshCw size={12}/> Reconectar (renovar token)
              </button>
            </div>
          </div>
        ) : (
          /* ── SEM CONTA — PASSO A PASSO ── */
          <div className="space-y-3">
            {/* Explicação */}
            <div className="rounded-xl p-4" style={{ background:'var(--card)', border:'1px solid rgba(245,158,11,0.3)' }}>
              <p className="text-xs font-black text-white mb-2 flex items-center gap-2">
                <Store size={14} color="#f59e0b"/> Como funciona a conexão
              </p>
              <p className="text-[10px] leading-relaxed" style={{ color:'var(--muted)' }}>
                Ao conectar a conta da Karla no Mercado Livre, o sistema passa a criar anúncios reais na conta dela automaticamente quando você clicar em <strong style={{color:'#f97316'}}>"Publicar Tudo"</strong> no catálogo.
              </p>
            </div>

            {/* Passos */}
            <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
              <div className="px-4 py-2.5" style={{ borderBottom:'1px solid var(--border)' }}>
                <p className="text-[9px] font-black tracking-widest" style={{ color:'var(--muted)' }}>PASSO A PASSO</p>
              </div>
              <div className="p-3 space-y-2">
                {[
                  { num:'1', title:'Clique no botão abaixo', desc:'O sistema vai abrir a página do Mercado Livre' },
                  { num:'2', title:'Faça login com a conta da Karla', desc:'Use o e-mail e senha da conta vendedora dela no ML' },
                  { num:'3', title:'Autorize as permissões', desc:'Clique em "Permitir" na tela do Mercado Livre' },
                  { num:'4', title:'Pronto!', desc:'Você volta automaticamente para cá com a conta conectada' },
                ].map((p,i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black text-white"
                      style={{ background: i===3?'#22c55e':'linear-gradient(135deg,#7c3aed,#f97316)' }}>
                      {p.num}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-white">{p.title}</p>
                      <p className="text-[9px]" style={{ color:'var(--muted)' }}>{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Botão conectar */}
            <button onClick={conectarML} disabled={conectando}
              className="w-full py-4 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2.5"
              style={{ background:'linear-gradient(135deg,#f59e0b,#d97706)', opacity: conectando ? 0.7 : 1, boxShadow:'0 4px 20px rgba(245,158,11,0.35)' }}>
              {conectando
                ? <><RefreshCw size={16} className="animate-spin"/> Abrindo Mercado Livre...</>
                : <><Zap size={16}/> Conectar Conta ML da Karla</>}
            </button>

            <p className="text-[9px] text-center" style={{ color:'var(--muted)' }}>
              O sistema usa o App ML já configurado (ID: 3153350893755305). Nenhuma senha é salva no sistema — apenas o token de acesso gerado pelo ML.
            </p>
          </div>
        )}

        {/* Info técnica */}
        <div className="rounded-xl p-3 space-y-1.5" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          <p className="text-[9px] font-black tracking-widest" style={{ color:'var(--muted)' }}>INFORMAÇÕES TÉCNICAS</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label:'App ML ID', value:'3153350893755305' },
              { label:'Redirect URI', value:'Render /afiliados/ml-callback' },
              { label:'Scope', value:'offline_access (token renovável)' },
              { label:'Seller ID salvo', value: cfg?.seller_id || conta?.seller_id || '—' },
            ].map((i,idx) => (
              <div key={idx} className="rounded-lg p-2" style={{ background:'var(--card2)' }}>
                <p className="text-[9px] font-bold" style={{ color:'var(--muted)' }}>{i.label}</p>
                <p className="text-[9px] text-white mt-0.5 break-all">{i.value}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
