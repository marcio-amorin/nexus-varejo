'use client'
import { useEffect, useState } from 'react'
import { Settings, Store, CheckCircle, RefreshCw, Zap } from 'lucide-react'

const API  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const GRAD = 'linear-gradient(135deg,#7c3aed 0%,#f97316 100%)'

function hdr() { return { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('nexus_token')}` } }

const PLATS = [
  { key:'ML_VENDEDOR',      nome:'Mercado Livre Vendedor',  cor:'#f59e0b', icone:'🟡', desc:'Publique produtos na sua conta de vendedor ML', temOAuth: true },
  { key:'SHOPEE_VENDEDOR',  nome:'Shopee Vendedor',         cor:'#ef4444', icone:'🟠', desc:'Publique na sua loja Shopee',                   temOAuth: false },
  { key:'TIKTOK_VENDEDOR',  nome:'TikTok Shop Vendedor',    cor:'#ff0050', icone:'🎵', desc:'Publique no seu TikTok Shop',                  temOAuth: false },
]

export default function ConfigVendedor() {
  const [configs, setConfigs]   = useState<any>({})
  const [form, setForm]         = useState<Record<string,any>>({})
  const [salvando, setSalvando] = useState<string|null>(null)
  const [salvo, setSalvo]       = useState<string|null>(null)
  const [conectando, setConectando] = useState(false)
  const [sucesso, setSucesso]   = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSucesso(new URLSearchParams(window.location.search).get('ml_ok') === '1')
    }
    carregar()
  }, [])

  async function carregar() {
    try {
      const r = await fetch(`${API}/vendedor/config`, { headers: hdr() })
      const d = await r.json()
      setConfigs(d)
      const f: Record<string,any> = {}
      Object.keys(d).forEach(k => { f[k] = { ...d[k], client_id:'', client_secret:'', access_token:'' } })
      setForm(f)
    } catch {}
  }

  async function salvar(plat: string) {
    setSalvando(plat)
    const f = form[plat] || {}
    const body: any = { plataforma: plat }
    if (f.seller_id)     body.seller_id     = f.seller_id
    if (f.client_id)     body.client_id     = f.client_id
    if (f.client_secret) body.client_secret = f.client_secret
    if (f.access_token)  body.access_token  = f.access_token
    if (f.ativo !== undefined) body.ativo   = f.ativo
    try {
      await fetch(`${API}/vendedor/config`, { method:'POST', headers:hdr(), body:JSON.stringify(body) })
      setSalvo(plat); setTimeout(() => setSalvo(null), 2500)
      carregar()
    } catch {}
    setSalvando(null)
  }

  async function conectarML() {
    setConectando(true)
    try {
      const r = await fetch(`${API}/vendedor/ml-auth-url`, { headers: hdr() })
      const d = await r.json()
      if (d.url) window.location.href = d.url
      else alert('Erro ao gerar URL de autorização. Configure o Client ID em Config. Afiliados primeiro.')
    } catch { alert('Erro ao conectar com Mercado Livre.') }
    setConectando(false)
  }

  function upd(plat: string, key: string, val: any) {
    setForm(f => ({ ...f, [plat]: { ...(f[plat]||{}), [key]: val } }))
  }

  return (
    <div className="pg">
      <div className="pg-header rounded-xl overflow-hidden" style={{ background: GRAD }}>
        <div className="px-5 py-4">
          <h1 className="text-base font-black text-white flex items-center gap-2"><Settings size={16}/> Config. Vendedor</h1>
          <p className="text-xs text-white/75 mt-0.5">Configure suas contas de vendedor para publicacao automatica</p>
        </div>
      </div>

      {/* Sucesso OAuth */}
      {sucesso && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.4)' }}>
          <CheckCircle size={18} color="#22c55e"/>
          <div>
            <p className="text-sm font-black text-white">Conta ML Vendedor conectada com sucesso!</p>
            <p className="text-xs" style={{ color:'var(--muted)' }}>Token salvo automaticamente. Ja pode usar o Publicar Tudo.</p>
          </div>
        </div>
      )}

      <div className="pg-body p-3 space-y-3">

        {/* Botao principal de conexao ML */}
        <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid rgba(245,158,11,0.3)' }}>
          <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom:'1px solid var(--border)', background:'rgba(245,158,11,0.08)' }}>
            <span className="text-2xl">🟡</span>
            <div className="flex-1">
              <p className="text-sm font-black text-white">Mercado Livre Vendedor</p>
              <p className="text-xs" style={{ color:'var(--muted)' }}>
                {configs['ML_VENDEDOR']?.tem_token
                  ? `✅ Conectado — Seller ID: ${configs['ML_VENDEDOR']?.seller_id || '—'}`
                  : 'Nao conectado ainda'}
              </p>
            </div>
            {configs['ML_VENDEDOR']?.tem_token && (
              <span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background:'rgba(34,197,94,0.2)', color:'#22c55e' }}>ATIVO</span>
            )}
          </div>
          <div className="p-4">
            <p className="text-xs mb-3" style={{ color:'var(--muted)' }}>
              Clique no botao abaixo para autorizar o sistema a publicar produtos na sua conta de vendedor do Mercado Livre. Voce sera redirecionado para o ML e voltara automaticamente.
            </p>
            <button onClick={conectarML} disabled={conectando}
              className="w-full py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2"
              style={{ background: configs['ML_VENDEDOR']?.tem_token
                ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                : 'linear-gradient(135deg,#f59e0b,#d97706)',
                opacity: conectando ? 0.7 : 1 }}>
              {conectando
                ? <><RefreshCw size={14} className="animate-spin"/> Redirecionando...</>
                : configs['ML_VENDEDOR']?.tem_token
                ? <><RefreshCw size={14}/> Reconectar ML Vendedor</>
                : <><Zap size={14}/> Conectar conta ML Vendedor</>}
            </button>
          </div>
        </div>

        {/* Shopee e TikTok — manual */}
        {PLATS.filter(p => !p.temOAuth).map(plat => {
          const cfg  = configs[plat.key] || {}
          const f    = form[plat.key]   || {}
          const ativo = f.ativo !== undefined ? f.ativo : cfg.ativo
          return (
            <div key={plat.key} className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:`1px solid ${plat.cor}30` }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--border)', background:`${plat.cor}10` }}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{plat.icone}</span>
                  <div>
                    <p className="text-xs font-black text-white">{plat.nome}</p>
                    <p className="text-[10px]" style={{ color:'var(--muted)' }}>{plat.desc}</p>
                  </div>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <div className="relative w-9 h-5">
                    <input type="checkbox" className="sr-only" checked={!!ativo} onChange={e => upd(plat.key,'ativo',e.target.checked)}/>
                    <div className="w-9 h-5 rounded-full transition-colors" style={{ background:ativo?plat.cor:'var(--card2)', border:'1px solid var(--border)' }}/>
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform" style={{ transform:ativo?'translateX(16px)':'translateX(0)' }}/>
                  </div>
                  <span className="text-[10px] font-bold" style={{ color:ativo?plat.cor:'var(--muted)' }}>{ativo?'Ativo':'Inativo'}</span>
                </label>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {[
                  { key:'seller_id',     label:'Seller ID',    ph:'ID da sua conta' },
                  { key:'client_id',     label:'Client ID',    ph:'ID do app' },
                  { key:'client_secret', label:'Client Secret', ph:'Senha do app', type:'password' },
                  { key:'access_token',  label:'Access Token',  ph:'Token de acesso', type:'password' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-[10px] font-bold block mb-1" style={{ color:'var(--muted)' }}>{field.label}</label>
                    <input
                      type={field.type||'text'}
                      value={f[field.key]||''}
                      onChange={e => upd(plat.key, field.key, e.target.value)}
                      placeholder={field.ph}
                      className="w-full px-2.5 py-2 rounded-lg text-[11px]"
                    />
                  </div>
                ))}
              </div>
              <div className="px-4 pb-4">
                <button onClick={() => salvar(plat.key)} disabled={salvando===plat.key}
                  className="w-full py-2 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1.5"
                  style={{ background: salvo===plat.key ? 'rgba(34,197,94,0.8)' : GRAD }}>
                  {salvando===plat.key ? <><RefreshCw size={12} className="animate-spin"/> Salvando...</>
                    : salvo===plat.key ? <><CheckCircle size={12}/> Salvo!</>
                    : <><Store size={12}/> Salvar</>}
                </button>
              </div>
            </div>
          )
        })}

        <div className="rounded-xl p-4 space-y-1.5" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          <p className="text-[10px] font-black" style={{ color:'var(--muted)' }}>INFO SOBRE A CONEXAO ML</p>
          <p className="text-[10px] text-white">O botao "Conectar ML Vendedor" usa o mesmo app (Client ID: 315350893755305) configurado nos Afiliados — so que com permissao de vendedor (write:items).</p>
          <p className="text-[10px] text-white">Apos clicar, o Mercado Livre vai pedir para voce fazer login e confirmar as permissoes. O token e salvo automaticamente.</p>
        </div>
      </div>
    </div>
  )
}
