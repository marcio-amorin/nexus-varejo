'use client'
import { useEffect, useState } from 'react'
import { Settings, CheckCircle, Save, Eye, EyeOff, RefreshCw, ExternalLink, Sparkles, Zap, Link2 } from 'lucide-react'

const API    = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const GRAD   = 'linear-gradient(135deg,#ea580c 0%,#f97316 40%,#f59e0b 80%,#fbbf24 100%)'
const GRAD_IA = 'linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#ec4899 100%)'

function hdr() { return { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('nexus_token')}` } }

const PLATAFORMAS_FIXAS = [
  { plataforma:'ML_AFILIADOS', nome:'Mercado Livre',  icone:'🟡', tipo:'afiliado', ativo:false, configurado:false, extra_json:null },
  { plataforma:'SHOPEE',       nome:'Shopee',          icone:'🟠', tipo:'afiliado', ativo:false, configurado:false, extra_json:null },
  { plataforma:'AMAZON',       nome:'Amazon',          icone:'📦', tipo:'afiliado', ativo:false, configurado:false, extra_json:null },
  { plataforma:'TIKTOK_SHOP',  nome:'TikTok Shop',     icone:'🎵', tipo:'afiliado', ativo:false, configurado:false, extra_json:null },
  { plataforma:'INSTAGRAM',    nome:'Instagram',       icone:'📸', tipo:'social',   ativo:false, configurado:false, extra_json:null },
  { plataforma:'FACEBOOK',     nome:'Facebook',        icone:'👤', tipo:'social',   ativo:false, configurado:false, extra_json:null },
  { plataforma:'TIKTOK',       nome:'TikTok',          icone:'🎶', tipo:'social',   ativo:false, configurado:false, extra_json:null },
]

function getGuia(plat: string) {
  const base: Record<string, any> = {
    ML_AFILIADOS: {
      campos:[
        { key:'client_id',     label:'Client ID',      tipo:'text',     dica:'developers.mercadolivre.com → Suas Aplicações' },
        { key:'client_secret', label:'Client Secret',  tipo:'password', dica:'Secret gerado na criação da app' },
        { key:'extra_json',    label:'Affiliate ID',   tipo:'text',     dica:'{"user_id":"SEU_ID"}' },
      ],
      tutorial:`1. developers.mercadolivre.com → Criar App → Categoria "Afiliados"\n2. Redirect URI: ${API}/afiliados/ml-callback\n3. Copie Client ID + Secret → Salve → Clique "Conectar"`,
    },
    SHOPEE: {
      campos:[
        { key:'client_id',     label:'App ID',         tipo:'text',     dica:'open.shopee.com → Meu App' },
        { key:'client_secret', label:'Secret Key',     tipo:'password', dica:'Secret do app Shopee' },
        { key:'access_token',  label:'Access Token',   tipo:'password', dica:'Token OAuth Shopee' },
      ],
      tutorial:'open.shopee.com → Cadastre-se como dev → Crie App Affiliate',
    },
    AMAZON: {
      campos:[
        { key:'client_id',     label:'Access Key ID',  tipo:'text',     dica:'afiliados.amazon.com.br → PA API' },
        { key:'client_secret', label:'Secret Key',     tipo:'password', dica:'Chave PA API' },
        { key:'extra_json',    label:'Partner Tag',    tipo:'text',     dica:'{"partner_tag":"TAG-20"}' },
      ],
      tutorial:'afiliados.amazon.com.br → Ferramentas → PA API → Solicite acesso',
    },
    TIKTOK_SHOP: {
      campos:[
        { key:'client_id',     label:'App ID',         tipo:'text',     dica:'seller.tiktok.com → Developer' },
        { key:'client_secret', label:'App Secret',     tipo:'password', dica:'Secret do App TikTok Shop' },
        { key:'access_token',  label:'Access Token',   tipo:'password', dica:'Token OAuth TikTok Shop' },
      ],
      tutorial:`1. seller.tiktok.com → Conta → Developer\n2. Crie App → Categoria "Affiliate"\n3. Redirect URI: ${API}/afiliados/tiktok-callback\n4. Cole App ID + Secret → Salve → Conectar`,
    },
    INSTAGRAM: {
      campos:[
        { key:'access_token',  label:'Page Token',     tipo:'password', dica:'Meta Business Suite → Token' },
        { key:'extra_json',    label:'Business ID',    tipo:'text',     dica:'{"instagram_business_id":"ID"}' },
      ],
      tutorial:'Meta Business Suite → developers.facebook.com → Graph API Explorer → Page Access Token',
    },
    FACEBOOK: {
      campos:[
        { key:'access_token',  label:'Page Access Token', tipo:'password', dica:'Token da Página FB' },
        { key:'extra_json',    label:'Page ID',        tipo:'text',     dica:'{"page_id":"ID_DA_PAGINA"}' },
      ],
      tutorial:'developers.facebook.com → Seus Apps → Graph API Explorer → Page Token',
    },
    TIKTOK: {
      campos:[
        { key:'access_token',  label:'Access Token',   tipo:'password', dica:'developers.tiktok.com' },
        { key:'extra_json',    label:'Open ID',        tipo:'text',     dica:'{"open_id":"SEU_OPEN_ID"}' },
      ],
      tutorial:'developers.tiktok.com → Crie App → Content Posting API → OAuth',
    },
  }
  return base[plat] || null
}

const COR_PLAT: Record<string, string> = {
  ML_AFILIADOS:'#f59e0b', SHOPEE:'#ef4444', AMAZON:'#f97316',
  TIKTOK_SHOP:'#ff0050', INSTAGRAM:'#e1306c', FACEBOOK:'#1877f2', TIKTOK:'#010101',
}

export default function ConfigAfiliados() {
  const [configs, setConfigs]     = useState<any[]>(PLATAFORMAS_FIXAS)
  const [sel, setSel]             = useState<string|null>(null)
  const [form, setForm]           = useState<Record<string,string>>({})
  const [ativo, setAtivo]         = useState(false)
  const [salvando, setSalvando]   = useState(false)
  const [ok, setOk]               = useState(false)
  const [showPass, setShowPass]   = useState<Record<string,boolean>>({})
  const [iaStatus, setIaStatus]   = useState<any>(null)
  const [claudeKey, setClaudeKey] = useState('')
  const [groqKey,   setGroqKey]   = useState('')
  const [salvandoIA, setSalvandoIA] = useState(false)
  const [okIA, setOkIA]           = useState('')

  useEffect(() => {
    carregar(); carregarIA()
    if (typeof window !== 'undefined' && window.location.search.includes('ml_ok=1')) {
      setOk(true); setSel('ML_AFILIADOS'); setAtivo(true)
      setTimeout(() => setOk(false), 5000)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  async function carregar() {
    try {
      const r = await fetch(`${API}/afiliados/configs`, { headers:hdr() })
      if (!r.ok) return
      const data = await r.json()
      if (Array.isArray(data) && data.length > 0) setConfigs(data)
    } catch {}
  }

  async function carregarIA() {
    try {
      const r = await fetch(`${API}/afiliados/ia-config`, { headers:hdr() })
      if (!r.ok) { setIaStatus(null); return }
      setIaStatus(await r.json())
    } catch { setIaStatus(null) }
  }

  async function salvarIAConfig(plataforma: string, key: string) {
    const k = plataforma === 'CLAUDE_API' ? key.replace('__claude','') : key
    if (!k.trim()) return
    setSalvandoIA(true)
    await fetch(`${API}/afiliados/ia-config`, {
      method:'POST', headers:hdr(),
      body:JSON.stringify({ plataforma, access_token:k, ativo:true })
    })
    setSalvandoIA(false); setOkIA(plataforma); setClaudeKey(''); setGroqKey(''); carregarIA()
    setTimeout(() => setOkIA(''), 3000)
  }

  function abrir(plat:string, cfg:any) {
    setSel(plat); setAtivo(cfg.ativo||false)
    setForm({ client_id:'', client_secret:'', access_token:'', refresh_token:'', extra_json:cfg.extra_json||'' })
    setOk(false)
  }

  async function salvar() {
    if (!sel) return
    setSalvando(true)
    const body:any = { plataforma:sel }
    if (ativo) body.ativo = true
    if (form.client_id)     body.client_id     = form.client_id
    if (form.client_secret) body.client_secret = form.client_secret
    if (form.access_token)  body.access_token  = form.access_token
    if (form.extra_json)    body.extra_json    = form.extra_json
    const r = await fetch(`${API}/afiliados/configs`, { method:'POST', headers:hdr(), body:JSON.stringify(body) })
    setSalvando(false)
    if (!r.ok) { alert('Erro ao salvar. Tente novamente.'); return }
    setOk(true); carregar(); setTimeout(() => setOk(false), 2500)
  }

  async function conectarML() {
    if (form.client_id || form.client_secret) {
      const body: any = { plataforma: 'ML_AFILIADOS', ativo: true }
      if (form.client_id)     body.client_id     = form.client_id
      if (form.client_secret) body.client_secret = form.client_secret
      await fetch(`${API}/afiliados/configs`, { method:'POST', headers:hdr(), body:JSON.stringify(body) })
    }
    const r = await fetch(`${API}/afiliados/ml-auth-url`, { headers:hdr() })
    const d = await r.json()
    if (d.url) window.location.href = d.url
    else alert(d.detail || 'Salve o Client ID primeiro antes de conectar.')
  }

  async function renovarML() {
    setSalvando(true)
    const r = await fetch(`${API}/afiliados/ml-refresh-token`, { method:'POST', headers:hdr() })
    const d = await r.json()
    setSalvando(false)
    if (d.ok) { setOk(true); carregar(); setTimeout(()=>setOk(false),3000) }
    else alert(d.detail||'Erro ao renovar')
  }

  const cfgSel   = configs.find(c => c.plataforma === sel)
  const guia     = sel ? getGuia(sel) : null
  const afiliados = configs.filter(c => c.tipo === 'afiliado')
  const sociais   = configs.filter(c => c.tipo === 'social')
  const totalConfig = configs.filter(c => c.configurado).length

  return (
    <div className="pg" style={{ display:'flex', flexDirection:'column', gap:12 }}>

      {/* Header */}
      <div className="rounded-xl px-5 py-4" style={{ background:GRAD }}>
        <h1 className="text-base font-black text-white flex items-center gap-2"><Settings size={16}/> Configurações — Plataformas & Redes</h1>
        <p className="text-xs text-white/75 mt-0.5">
          {totalConfig > 0 ? `${totalConfig} plataforma(s) configurada(s) — tudo automático` : 'Configure suas plataformas de afiliados e redes sociais'}
        </p>
      </div>

      {/* Bloco IA */}
      <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--border)', background:'var(--card)' }}>
        <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom:'1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:GRAD_IA }}>
            <Sparkles size={14} color="#fff"/>
          </div>
          <div className="flex-1">
            <p className="text-xs font-black text-white">Geração de Conteúdo com IA</p>
            <p className="text-[10px]" style={{ color:'var(--muted)' }}>Posts automáticos para cada produto em todas as redes sociais</p>
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-full font-black"
            style={{ background:iaStatus?.ativo?'rgba(34,197,94,0.2)':'var(--card2)', color:iaStatus?.ativo?'#22c55e':'var(--muted)', border:`1px solid ${iaStatus?.ativo?'rgba(34,197,94,0.3)':'var(--border)'}` }}>
            {iaStatus?.ativo ? `✓ ${iaStatus.ia_ativa?.toUpperCase()} ATIVA` : 'SEM IA'}
          </span>
        </div>

        <div className="p-3 grid gap-3" style={{ gridTemplateColumns:'1fr 1fr' }}>
          {/* Groq */}
          <div className="rounded-xl p-3 space-y-2" style={{ background:iaStatus?.groq_ok?'rgba(34,197,94,0.08)':'var(--card2)', border:`1px solid ${iaStatus?.groq_ok?'rgba(34,197,94,0.4)':'var(--border)'}` }}>
            <div className="flex items-center gap-2">
              <Zap size={14} color={iaStatus?.groq_ok?'#22c55e':'#f59e0b'}/>
              <div className="flex-1">
                <p className="text-xs font-black text-white">Groq — Llama 3.3</p>
                <p className="text-[9px]" style={{ color:'var(--muted)' }}>Automático • 100% grátis</p>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black"
                style={{ background:iaStatus?.groq_ok?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.15)', color:iaStatus?.groq_ok?'#22c55e':'#ef4444' }}>
                {iaStatus?.groq_ok ? '✓ ATIVA' : 'Inativa'}
              </span>
            </div>
            {iaStatus?.groq_ok
              ? <p className="text-[9px] font-bold" style={{ color:'#22c55e' }}>⚡ Gera conteúdo automaticamente</p>
              : <div className="space-y-1.5">
                  <input type="password" value={groqKey} onChange={e=>setGroqKey(e.target.value)}
                    placeholder="gsk_..." className="w-full px-2 py-1.5 rounded-lg text-xs"/>
                  <p className="text-[9px]" style={{ color:'var(--muted)' }}>console.groq.com → API Keys → Create</p>
                  <button onClick={()=>salvarIAConfig('GROQ_API', groqKey)} disabled={salvandoIA||!groqKey.trim()}
                    className="w-full py-1.5 rounded-lg text-[10px] font-black text-white"
                    style={{ background:'linear-gradient(135deg,#16a34a,#22c55e)', opacity:groqKey.trim()?1:0.5 }}>
                    {salvandoIA?'Salvando...':'Ativar Groq Grátis'}
                  </button>
                </div>
            }
            {okIA==='GROQ_API' && <p className="text-[9px] font-bold text-green-400">✓ Salvo!</p>}
          </div>

          {/* Claude */}
          <div className="rounded-xl p-3 space-y-2" style={{ background:iaStatus?.claude_ok?'rgba(168,85,247,0.08)':'var(--card2)', border:`1px solid ${iaStatus?.claude_ok?'rgba(168,85,247,0.4)':'var(--border)'}` }}>
            <div className="flex items-center gap-2">
              <Sparkles size={14} color={iaStatus?.claude_ok?'#a855f7':'var(--muted)'}/>
              <div className="flex-1">
                <p className="text-xs font-black text-white">Claude — Anthropic</p>
                <p className="text-[9px]" style={{ color:'var(--muted)' }}>Máxima qualidade</p>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black"
                style={{ background:iaStatus?.claude_ok?'rgba(168,85,247,0.2)':'var(--card)', color:iaStatus?.claude_ok?'#a855f7':'var(--muted)', border:'1px solid var(--border)' }}>
                {iaStatus?.claude_ok ? '✓ ATIVO' : 'Não config.'}
              </span>
            </div>
            <div className="space-y-1.5">
              <input type="password" value={claudeKey} placeholder="sk-ant-api03-..." className="w-full px-2 py-1.5 rounded-lg text-xs"
                onChange={e=>setClaudeKey(e.target.value+'__claude')}/>
              <p className="text-[9px]" style={{ color:'var(--muted)' }}>console.anthropic.com → API Keys</p>
              <button onClick={()=>salvarIAConfig('CLAUDE_API', claudeKey)} disabled={salvandoIA}
                className="w-full py-1.5 rounded-lg text-[10px] font-black text-white" style={{ background:GRAD_IA }}>
                {salvandoIA?'Salvando...': iaStatus?.claude_ok ? '✓ Atualizar Key' : 'Configurar Claude'}
              </button>
            </div>
            {okIA==='CLAUDE_API' && <p className="text-[9px] font-bold" style={{ color:'#a855f7' }}>✓ Salvo!</p>}
          </div>
        </div>
      </div>

      {/* Grid principal */}
      <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:12, flex:1, minHeight:0 }}>

        {/* Lista de plataformas */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, overflowY:'auto' }}>

          <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="px-3 py-2" style={{ borderBottom:'1px solid var(--border)' }}>
              <p className="text-[9px] font-black tracking-widest" style={{ color:'var(--muted)' }}>AFILIADOS</p>
            </div>
            {afiliados.map(c => (
              <button key={c.plataforma} onClick={() => abrir(c.plataforma, c)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors"
                style={{ background:sel===c.plataforma?'rgba(249,115,22,0.1)':'transparent', borderBottom:'1px solid var(--border)', borderLeft:sel===c.plataforma?'3px solid #f97316':'3px solid transparent' }}>
                <span style={{ fontSize:18 }}>{c.icone}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <p className="text-xs font-bold truncate text-white">{c.nome}</p>
                  <p className="text-[9px]" style={{ color:c.configurado?'#22c55e':'var(--muted)' }}>
                    {c.configurado ? '✓ Configurado' : 'Não configurado'}
                  </p>
                </div>
                {c.ativo && <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', flexShrink:0 }}/>}
              </button>
            ))}
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="px-3 py-2" style={{ borderBottom:'1px solid var(--border)' }}>
              <p className="text-[9px] font-black tracking-widest" style={{ color:'var(--muted)' }}>REDES SOCIAIS</p>
            </div>
            {sociais.map(c => (
              <button key={c.plataforma} onClick={() => abrir(c.plataforma, c)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors"
                style={{ background:sel===c.plataforma?'rgba(249,115,22,0.1)':'transparent', borderBottom:'1px solid var(--border)', borderLeft:sel===c.plataforma?'3px solid #f97316':'3px solid transparent' }}>
                <span style={{ fontSize:18 }}>{c.icone}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <p className="text-xs font-bold truncate text-white">{c.nome}</p>
                  <p className="text-[9px]" style={{ color:c.configurado?'#22c55e':'var(--muted)' }}>
                    {c.configurado ? '✓ Conectado' : 'Não conectado'}
                  </p>
                </div>
                {c.ativo && <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', flexShrink:0 }}/>}
              </button>
            ))}
          </div>
        </div>

        {/* Painel direito */}
        <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          {!sel ? (
            /* Overview de todas as plataformas */
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm font-black text-white mb-1">Status das Plataformas</p>
                <p className="text-[10px]" style={{ color:'var(--muted)' }}>Clique em uma plataforma ao lado para configurar</p>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
                {configs.map(c => (
                  <button key={c.plataforma} onClick={() => abrir(c.plataforma, c)}
                    className="rounded-xl p-3 text-left transition-all"
                    style={{ background:'var(--card2)', border:`1.5px solid ${c.configurado ? COR_PLAT[c.plataforma]+'44' : 'var(--border)'}` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{ fontSize:22 }}>{c.icone}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p className="text-xs font-black text-white truncate">{c.nome}</p>
                        <p className="text-[9px]" style={{ color:c.configurado?'#22c55e':'var(--muted)' }}>
                          {c.configurado ? '✓ Conectado' : 'Não configurado'}
                        </p>
                      </div>
                    </div>
                    <div className="w-full rounded-full h-1" style={{ background:'var(--border)' }}>
                      <div className="h-1 rounded-full" style={{ width:c.configurado?'100%':c.tem_client_id?'50%':'0%', background:c.configurado?'#22c55e':COR_PLAT[c.plataforma]||'#f97316', transition:'width 0.4s' }}/>
                    </div>
                  </button>
                ))}
              </div>

              {totalConfig === 0 && (
                <div className="rounded-xl p-4 text-center" style={{ background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.2)' }}>
                  <p className="text-xs font-black text-white mb-1">Comece pelo Mercado Livre</p>
                  <p className="text-[10px]" style={{ color:'var(--muted)' }}>Configure o ML para começar a promover produtos automaticamente</p>
                  <button onClick={() => abrir('ML_AFILIADOS', configs.find(c=>c.plataforma==='ML_AFILIADOS')||{})}
                    className="mt-2 px-4 py-2 rounded-lg text-xs font-black text-white"
                    style={{ background:GRAD }}>
                    Configurar Mercado Livre →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight:'calc(100vh - 300px)' }}>

              {/* Header da plataforma selecionada */}
              <div className="flex items-center gap-3 pb-3" style={{ borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:28 }}>{configs.find(c=>c.plataforma===sel)?.icone}</span>
                <div className="flex-1">
                  <p className="text-sm font-black text-white">{configs.find(c=>c.plataforma===sel)?.nome}</p>
                  <p className="text-[10px]" style={{ color:'var(--muted)' }}>Configure as credenciais para ativar</p>
                </div>
                {/* Toggle ativo */}
                <div className="flex items-center gap-2">
                  <div className="relative cursor-pointer" style={{ width:36, height:20 }} onClick={() => setAtivo(!ativo)}>
                    <div className="absolute inset-0 rounded-full" style={{ background:ativo?'#22c55e':'var(--card2)' }}/>
                    <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform" style={{ transform:ativo?'translateX(18px)':'translateX(2px)' }}/>
                  </div>
                  <span className="text-xs font-bold" style={{ color:ativo?'#22c55e':'var(--muted)' }}>{ativo?'ATIVA':'OFF'}</span>
                  {cfgSel?.configurado && <span className="text-[9px] px-2 py-0.5 rounded-full font-black" style={{ background:'rgba(34,197,94,0.2)', color:'#22c55e' }}>✓ Configurado</span>}
                </div>
              </div>

              {/* Campos */}
              <div className="space-y-3">
                {guia?.campos.map((campo: any) => {
                  const salvo = campo.key==='client_id' ? cfgSel?.tem_client_id
                              : campo.key==='client_secret' ? cfgSel?.tem_client_secret
                              : campo.key==='access_token' ? cfgSel?.configurado : false
                  return (
                    <div key={campo.key}>
                      <label className="text-[10px] font-black flex items-center gap-1.5 mb-1" style={{ color:'var(--muted)' }}>
                        {campo.label}
                        {salvo && !form[campo.key] && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black" style={{ background:'rgba(34,197,94,0.2)', color:'#22c55e' }}>✓ SALVO</span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type={campo.tipo==='password' && !showPass[campo.key] ? 'password' : 'text'}
                          value={form[campo.key]||''}
                          placeholder={salvo && !form[campo.key] ? '●●●●●●●● (salvo no servidor)' : campo.dica}
                          onChange={e => setForm({...form,[campo.key]:e.target.value})}
                          className="w-full px-3 py-2 rounded-lg text-xs pr-8"/>
                        {campo.tipo==='password' && (
                          <button type="button" onClick={()=>setShowPass({...showPass,[campo.key]:!showPass[campo.key]})}
                            className="absolute right-2 top-1/2 -translate-y-1/2">
                            {showPass[campo.key] ? <EyeOff size={13} color="var(--muted)"/> : <Eye size={13} color="var(--muted)"/>}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Tutorial */}
              {guia?.tutorial && (
                <div className="p-3 rounded-xl text-xs" style={{ background:'rgba(56,189,248,0.08)', border:'1px solid rgba(56,189,248,0.2)', color:'#38bdf8', whiteSpace:'pre-line', lineHeight:1.6 }}>
                  {guia.tutorial}
                </div>
              )}

              {ok && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold"
                  style={{ background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', color:'#22c55e' }}>
                  <CheckCircle size={14}/> Salvo com sucesso!
                </div>
              )}

              {/* Botões */}
              <div className="space-y-2 pt-1">
                <button onClick={salvar} disabled={salvando}
                  className="w-full py-2.5 rounded-xl font-black text-white text-sm flex items-center justify-center gap-2"
                  style={{ background:GRAD }}>
                  {salvando ? <><RefreshCw size={14} className="animate-spin"/> Salvando...</> : <><Save size={14}/> Salvar Credenciais</>}
                </button>

                {sel==='ML_AFILIADOS' && (
                  <>
                    <button onClick={conectarML}
                      className="w-full py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2"
                      style={{ background:'#FFE600', color:'#333', border:'2px solid #f0d800' }}>
                      <Link2 size={14}/> 🟡 Conectar via OAuth2 (Necessário para busca automática)
                    </button>
                    {cfgSel?.configurado && (
                      <button onClick={renovarML} disabled={salvando}
                        className="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                        style={{ background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.3)', color:'#22c55e' }}>
                        <RefreshCw size={12}/> Renovar Token OAuth
                      </button>
                    )}
                  </>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
