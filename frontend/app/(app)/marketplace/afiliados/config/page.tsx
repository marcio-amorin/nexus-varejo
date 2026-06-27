'use client'
import { useEffect, useState } from 'react'
import { Settings, CheckCircle, Save, Eye, EyeOff, RefreshCw, ExternalLink, Sparkles, Zap, Link2, ChevronDown, ChevronUp } from 'lucide-react'

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
        { key:'client_id',     label:'Client ID',     tipo:'text',     dica:'developers.mercadolivre.com → Suas Apps' },
        { key:'client_secret', label:'Client Secret', tipo:'password', dica:'Secret da aplicação ML' },
        { key:'extra_json',    label:'Affiliate ID',  tipo:'text',     dica:'{"user_id":"SEU_ID"}' },
      ],
      passos:[
        'developers.mercadolivre.com → Criar App',
        'Categoria: "Afiliados"',
        `Redirect URI: ${API}/afiliados/ml-callback`,
        'Cole Client ID + Secret → Salve',
        'Clique "Conectar OAuth2" abaixo',
      ],
    },
    SHOPEE: {
      campos:[
        { key:'client_id',     label:'App ID',        tipo:'text',     dica:'open.shopee.com → Meu App' },
        { key:'client_secret', label:'Secret Key',    tipo:'password', dica:'Secret do app Shopee' },
        { key:'access_token',  label:'Access Token',  tipo:'password', dica:'Token OAuth Shopee' },
      ],
      passos:['open.shopee.com → Cadastre-se como dev', 'Crie App Affiliate', 'Cole credenciais → Salve'],
    },
    AMAZON: {
      campos:[
        { key:'client_id',     label:'Access Key ID', tipo:'text',     dica:'afiliados.amazon.com.br → PA API' },
        { key:'client_secret', label:'Secret Key',    tipo:'password', dica:'Chave PA API' },
        { key:'extra_json',    label:'Partner Tag',   tipo:'text',     dica:'{"partner_tag":"TAG-20"}' },
      ],
      passos:['afiliados.amazon.com.br → Ferramentas', 'PA API → Solicite acesso', 'Cole credenciais → Salve'],
    },
    TIKTOK_SHOP: {
      campos:[
        { key:'client_id',     label:'App ID',        tipo:'text',     dica:'seller.tiktok.com → Developer' },
        { key:'client_secret', label:'App Secret',    tipo:'password', dica:'Secret do App TikTok Shop' },
        { key:'access_token',  label:'Access Token',  tipo:'password', dica:'Token OAuth TikTok Shop' },
      ],
      passos:['seller.tiktok.com → Developer', 'Crie App → Affiliate', `Redirect: ${API}/afiliados/tiktok-callback`, 'Cole credenciais → Salve → Conectar'],
    },
    INSTAGRAM: {
      campos:[
        { key:'access_token',  label:'Page Token',    tipo:'password', dica:'Meta Business Suite → Token' },
        { key:'extra_json',    label:'Business ID',   tipo:'text',     dica:'{"instagram_business_id":"ID"}' },
      ],
      passos:['Meta Business Suite', 'developers.facebook.com', 'Graph API Explorer', 'Page Access Token'],
    },
    FACEBOOK: {
      campos:[
        { key:'access_token',  label:'Page Token',    tipo:'password', dica:'Token da Página FB' },
        { key:'extra_json',    label:'Page ID',       tipo:'text',     dica:'{"page_id":"ID_DA_PAGINA"}' },
      ],
      passos:['developers.facebook.com → Seus Apps', 'Graph API Explorer', 'Page Access Token'],
    },
    TIKTOK: {
      campos:[
        { key:'access_token',  label:'Access Token',  tipo:'password', dica:'developers.tiktok.com' },
        { key:'extra_json',    label:'Open ID',       tipo:'text',     dica:'{"open_id":"SEU_OPEN_ID"}' },
      ],
      passos:['developers.tiktok.com → Crie App', 'Content Posting API', 'OAuth → Cole token'],
    },
  }
  return base[plat] || null
}

export default function ConfigAfiliados() {
  const [configs, setConfigs]   = useState<any[]>(PLATAFORMAS_FIXAS)
  const [sel, setSel]           = useState<string|null>(null)
  const [form, setForm]         = useState<Record<string,string>>({})
  const [ativo, setAtivo]       = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [ok, setOk]             = useState(false)
  const [showPass, setShowPass] = useState<Record<string,boolean>>({})
  const [iaStatus, setIaStatus] = useState<any>(null)
  const [iaKey, setIaKey]       = useState('')
  const [iaPlat, setIaPlat]     = useState<'GROQ_API'|'CLAUDE_API'>('GROQ_API')
  const [salvandoIA, setSalvIA] = useState(false)
  const [showIA, setShowIA]     = useState(false)

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
      if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d.length) setConfigs(d) }
    } catch {}
  }

  async function carregarIA() {
    try {
      const r = await fetch(`${API}/afiliados/ia-config`, { headers:hdr() })
      if (r.ok) setIaStatus(await r.json()); else setIaStatus(null)
    } catch { setIaStatus(null) }
  }

  async function salvarIA() {
    const k = iaPlat === 'CLAUDE_API' ? iaKey.replace('__claude','') : iaKey
    if (!k.trim()) return
    setSalvIA(true)
    await fetch(`${API}/afiliados/ia-config`, { method:'POST', headers:hdr(), body:JSON.stringify({ plataforma:iaPlat, access_token:k, ativo:true }) })
    setSalvIA(false); setIaKey(''); carregarIA(); setShowIA(false)
  }

  function abrir(plat: string, cfg: any) {
    setSel(plat); setAtivo(cfg.ativo||false)
    setForm({ client_id:'', client_secret:'', access_token:'', refresh_token:'', extra_json:cfg.extra_json||'' })
    setOk(false)
  }

  async function salvar() {
    if (!sel) return
    setSalvando(true)
    const body: any = { plataforma:sel }
    if (ativo)             body.ativo         = true
    if (form.client_id)    body.client_id     = form.client_id
    if (form.client_secret)body.client_secret = form.client_secret
    if (form.access_token) body.access_token  = form.access_token
    if (form.extra_json)   body.extra_json    = form.extra_json
    const r = await fetch(`${API}/afiliados/configs`, { method:'POST', headers:hdr(), body:JSON.stringify(body) })
    setSalvando(false)
    if (!r.ok) { alert('Erro ao salvar.'); return }
    setOk(true); carregar(); setTimeout(() => setOk(false), 2500)
  }

  async function conectarML() {
    if (form.client_id || form.client_secret) {
      const body: any = { plataforma:'ML_AFILIADOS', ativo:true }
      if (form.client_id)    body.client_id     = form.client_id
      if (form.client_secret)body.client_secret = form.client_secret
      await fetch(`${API}/afiliados/configs`, { method:'POST', headers:hdr(), body:JSON.stringify(body) })
    }
    const r = await fetch(`${API}/afiliados/ml-auth-url`, { headers:hdr() })
    const d = await r.json()
    if (d.url) window.location.href = d.url
    else alert(d.detail || 'Salve o Client ID antes de conectar.')
  }

  async function renovarML() {
    setSalvando(true)
    const r = await fetch(`${API}/afiliados/ml-refresh-token`, { method:'POST', headers:hdr() })
    const d = await r.json()
    setSalvando(false)
    if (d.ok) { setOk(true); carregar(); setTimeout(()=>setOk(false),3000) }
    else alert(d.detail||'Erro ao renovar token')
  }

  const cfgSel    = configs.find(c => c.plataforma === sel)
  const guia      = sel ? getGuia(sel) : null
  const afiliados = configs.filter(c => c.tipo === 'afiliado')
  const sociais   = configs.filter(c => c.tipo === 'social')

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, height:'100%', overflow:'hidden', padding:'8px 12px' }}>

      {/* ── HEADER + IA numa faixa ─────────────────────────────── */}
      <div className="rounded-xl px-4 py-2.5 flex items-center gap-4" style={{ background:GRAD, flexShrink:0 }}>
        <div style={{ flex:1 }}>
          <p className="text-sm font-black text-white flex items-center gap-2"><Settings size={13}/> Configurações — Plataformas & Redes</p>
          <p className="text-[10px] text-white/70">
            {configs.filter(c=>c.configurado).length} plataforma(s) ativa(s) — {iaStatus?.ativo ? `IA ${iaStatus.ia_ativa?.toUpperCase()} ligada` : 'IA não configurada'}
          </p>
        </div>

        {/* IA status compacto */}
        <div className="flex items-center gap-2">
          {iaStatus?.groq_ok
            ? <span className="text-[10px] px-2 py-1 rounded-full font-black" style={{ background:'rgba(34,197,94,0.25)', color:'#22c55e' }}>⚡ Groq ATIVA</span>
            : <button onClick={()=>setShowIA(!showIA)} className="text-[10px] px-2 py-1 rounded-full font-black flex items-center gap-1"
                style={{ background:'rgba(255,255,255,0.2)', color:'white' }}>
                <Zap size={10}/> Config. IA {showIA ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
              </button>
          }
          {iaStatus?.claude_ok
            ? <span className="text-[10px] px-2 py-1 rounded-full font-black" style={{ background:'rgba(168,85,247,0.3)', color:'#e9d5ff' }}>✦ Claude ATIVO</span>
            : <button onClick={()=>{setShowIA(true);setIaPlat('CLAUDE_API')}} className="text-[10px] px-2 py-1 rounded-full font-black"
                style={{ background:'rgba(168,85,247,0.3)', color:'#e9d5ff' }}>+ Claude</button>
          }
        </div>
      </div>

      {/* IA expandido */}
      {showIA && (
        <div className="rounded-xl p-3 flex items-end gap-3" style={{ background:'var(--card)', border:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ flex:1 }}>
            <div className="flex gap-2 mb-1.5">
              <button onClick={()=>setIaPlat('GROQ_API')} className="text-[10px] px-2.5 py-1 rounded-full font-black"
                style={{ background:iaPlat==='GROQ_API'?'rgba(34,197,94,0.2)':'var(--card2)', color:iaPlat==='GROQ_API'?'#22c55e':'var(--muted)', border:`1px solid ${iaPlat==='GROQ_API'?'rgba(34,197,94,0.4)':'var(--border)'}` }}>
                ⚡ Groq — 100% Grátis
              </button>
              <button onClick={()=>setIaPlat('CLAUDE_API')} className="text-[10px] px-2.5 py-1 rounded-full font-black"
                style={{ background:iaPlat==='CLAUDE_API'?'rgba(168,85,247,0.2)':'var(--card2)', color:iaPlat==='CLAUDE_API'?'#a855f7':'var(--muted)', border:`1px solid ${iaPlat==='CLAUDE_API'?'rgba(168,85,247,0.4)':'var(--border)'}` }}>
                ✦ Claude — Máxima qualidade
              </button>
            </div>
            <input type="password" value={iaKey} onChange={e=>setIaKey(e.target.value)}
              placeholder={iaPlat==='GROQ_API' ? 'gsk_... (console.groq.com → API Keys)' : 'sk-ant-api03-... (console.anthropic.com → API Keys)'}
              className="w-full px-3 py-1.5 rounded-lg text-xs"/>
          </div>
          <button onClick={salvarIA} disabled={salvandoIA||!iaKey.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-black text-white whitespace-nowrap"
            style={{ background:iaPlat==='GROQ_API'?'linear-gradient(135deg,#16a34a,#22c55e)':GRAD_IA, opacity:iaKey.trim()?1:0.5 }}>
            {salvandoIA ? 'Salvando...' : 'Ativar IA'}
          </button>
        </div>
      )}

      {/* ── CORPO PRINCIPAL ─────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'190px 1fr', gap:8, flex:1, minHeight:0, overflow:'hidden' }}>

        {/* Lista lateral */}
        <div style={{ display:'flex', flexDirection:'column', gap:6, overflowY:'auto' }}>

          <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="px-3 py-1.5" style={{ borderBottom:'1px solid var(--border)' }}>
              <p className="text-[9px] font-black tracking-widest" style={{ color:'var(--muted)' }}>AFILIADOS</p>
            </div>
            {afiliados.map(c => (
              <button key={c.plataforma} onClick={() => abrir(c.plataforma, c)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left"
                style={{ background:sel===c.plataforma?'rgba(249,115,22,0.12)':'transparent', borderBottom:'1px solid var(--border)', borderLeft:sel===c.plataforma?'3px solid #f97316':'3px solid transparent' }}>
                <span style={{ fontSize:16 }}>{c.icone}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <p className="text-[11px] font-bold truncate text-white">{c.nome}</p>
                  <p className="text-[9px]" style={{ color:c.configurado?'#22c55e':'var(--muted)' }}>
                    {c.configurado ? '✓ Configurado' : 'Não configurado'}
                  </p>
                </div>
                {c.ativo && <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', flexShrink:0 }}/>}
              </button>
            ))}
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="px-3 py-1.5" style={{ borderBottom:'1px solid var(--border)' }}>
              <p className="text-[9px] font-black tracking-widest" style={{ color:'var(--muted)' }}>REDES SOCIAIS</p>
            </div>
            {sociais.map(c => (
              <button key={c.plataforma} onClick={() => abrir(c.plataforma, c)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left"
                style={{ background:sel===c.plataforma?'rgba(249,115,22,0.12)':'transparent', borderBottom:'1px solid var(--border)', borderLeft:sel===c.plataforma?'3px solid #f97316':'3px solid transparent' }}>
                <span style={{ fontSize:16 }}>{c.icone}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <p className="text-[11px] font-bold truncate text-white">{c.nome}</p>
                  <p className="text-[9px]" style={{ color:c.configurado?'#22c55e':'var(--muted)' }}>
                    {c.configurado ? '✓ Conectado' : 'Não conectado'}
                  </p>
                </div>
                {c.ativo && <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', flexShrink:0 }}/>}
              </button>
            ))}
          </div>
        </div>

        {/* Painel direito */}
        <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)', display:'flex', flexDirection:'column' }}>

          {!sel ? (
            /* ── Overview ── */
            <div style={{ padding:16, display:'flex', flexDirection:'column', gap:12, flex:1 }}>
              <div>
                <p className="text-sm font-black text-white">Status das Plataformas</p>
                <p className="text-[10px]" style={{ color:'var(--muted)' }}>Clique em uma plataforma ao lado para configurar</p>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:8 }}>
                {configs.map(c => (
                  <button key={c.plataforma} onClick={() => abrir(c.plataforma, c)}
                    className="rounded-xl p-3 text-left"
                    style={{ background:'var(--card2)', border:`1.5px solid ${c.configurado?'rgba(34,197,94,0.3)':'var(--border)'}` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{ fontSize:20 }}>{c.icone}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p className="text-[11px] font-black text-white truncate">{c.nome}</p>
                        <p className="text-[9px]" style={{ color:c.configurado?'#22c55e':'var(--muted)' }}>
                          {c.configurado ? '✓ Ativo' : 'Configurar'}
                        </p>
                      </div>
                    </div>
                    <div className="w-full rounded-full" style={{ height:3, background:'var(--border)' }}>
                      <div className="rounded-full" style={{ height:3, width:c.configurado?'100%':c.tem_client_id?'50%':'0%', background:c.configurado?'#22c55e':'#f97316', transition:'width 0.4s' }}/>
                    </div>
                  </button>
                ))}
              </div>
              {configs.filter(c=>c.configurado).length === 0 && (
                <div className="rounded-xl p-3 text-center" style={{ background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.2)' }}>
                  <p className="text-xs font-black text-white">Comece pelo Mercado Livre</p>
                  <p className="text-[10px] mb-2" style={{ color:'var(--muted)' }}>Configure para buscar produtos automaticamente</p>
                  <button onClick={()=>abrir('ML_AFILIADOS', configs.find(c=>c.plataforma==='ML_AFILIADOS')||{})}
                    className="px-4 py-1.5 rounded-lg text-xs font-black text-white" style={{ background:GRAD }}>
                    Configurar Agora →
                  </button>
                </div>
              )}
            </div>

          ) : (
            /* ── Formulário ── */
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0, flex:1, overflow:'hidden' }}>

              {/* Coluna esquerda: campos */}
              <div style={{ padding:14, borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:10, overflowY:'auto' }}>

                {/* Header */}
                <div className="flex items-center gap-2 pb-2" style={{ borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontSize:22 }}>{cfgSel?.icone}</span>
                  <div style={{ flex:1 }}>
                    <p className="text-xs font-black text-white">{cfgSel?.nome}</p>
                    <p className="text-[9px]" style={{ color:'var(--muted)' }}>Credenciais de acesso</p>
                  </div>
                  {/* Toggle ativo */}
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div className="cursor-pointer" style={{ position:'relative', width:32, height:18 }} onClick={()=>setAtivo(!ativo)}>
                      <div style={{ position:'absolute', inset:0, borderRadius:9, background:ativo?'#22c55e':'var(--card2)' }}/>
                      <div style={{ position:'absolute', top:2, width:14, height:14, borderRadius:'50%', background:'white', boxShadow:'0 1px 3px rgba(0,0,0,0.3)', transform:ativo?'translateX(16px)':'translateX(2px)', transition:'transform 0.15s' }}/>
                    </div>
                    <span className="text-[9px] font-black" style={{ color:ativo?'#22c55e':'var(--muted)' }}>{ativo?'ATIVA':'OFF'}</span>
                  </div>
                  {cfgSel?.configurado && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black" style={{ background:'rgba(34,197,94,0.2)', color:'#22c55e' }}>✓ OK</span>}
                </div>

                {/* Campos */}
                {guia?.campos.map((campo: any) => {
                  const salvo = campo.key==='client_id' ? cfgSel?.tem_client_id
                              : campo.key==='client_secret' ? cfgSel?.tem_client_secret
                              : campo.key==='access_token' ? cfgSel?.configurado : false
                  return (
                    <div key={campo.key}>
                      <label className="text-[9px] font-black flex items-center gap-1 mb-1" style={{ color:'var(--muted)' }}>
                        {campo.label}
                        {salvo && !form[campo.key] && <span className="text-[8px] px-1 py-0.5 rounded-full font-black" style={{ background:'rgba(34,197,94,0.2)', color:'#22c55e' }}>✓ SALVO</span>}
                      </label>
                      <div style={{ position:'relative' }}>
                        <input type={campo.tipo==='password'&&!showPass[campo.key]?'password':'text'}
                          value={form[campo.key]||''}
                          placeholder={salvo&&!form[campo.key]?'●●●●●●●● (salvo)':campo.dica}
                          onChange={e=>setForm({...form,[campo.key]:e.target.value})}
                          style={{ width:'100%', padding:'6px 28px 6px 10px', borderRadius:8, fontSize:11, background:'var(--card2)', border:'1px solid var(--border)', color:'var(--text)', outline:'none' }}/>
                        {campo.tipo==='password' && (
                          <button type="button" onClick={()=>setShowPass({...showPass,[campo.key]:!showPass[campo.key]})}
                            style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                            {showPass[campo.key]?<EyeOff size={11} color="var(--muted)"/>:<Eye size={11} color="var(--muted)"/>}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {ok && (
                  <div className="flex items-center gap-1.5 p-2 rounded-lg text-[10px] font-bold"
                    style={{ background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.3)', color:'#22c55e' }}>
                    <CheckCircle size={11}/> Salvo com sucesso!
                  </div>
                )}
              </div>

              {/* Coluna direita: tutorial + botões */}
              <div style={{ padding:14, display:'flex', flexDirection:'column', gap:10, overflowY:'auto' }}>

                <div>
                  <p className="text-[10px] font-black text-white mb-2">Passo a Passo</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {guia?.passos.map((passo: string, i: number) => (
                      <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                        <div style={{ width:18, height:18, borderRadius:'50%', background:GRAD, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:9, fontWeight:900, color:'white' }}>
                          {i+1}
                        </div>
                        <p className="text-[10px]" style={{ color:'var(--text)', lineHeight:1.5, wordBreak:'break-all' }}>{passo}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botões */}
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:'auto' }}>
                  <button onClick={salvar} disabled={salvando}
                    className="w-full py-2 rounded-xl font-black text-white text-xs flex items-center justify-center gap-1.5"
                    style={{ background:GRAD }}>
                    {salvando ? <><RefreshCw size={12} className="animate-spin"/> Salvando...</> : <><Save size={12}/> Salvar Credenciais</>}
                  </button>

                  {sel==='ML_AFILIADOS' && (
                    <>
                      <button onClick={conectarML}
                        className="w-full py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5"
                        style={{ background:'#FFE600', color:'#333', border:'2px solid #f0d800' }}>
                        <Link2 size={12}/> 🟡 Conectar via OAuth2 (Busca Automática)
                      </button>
                      {cfgSel?.configurado && (
                        <button onClick={renovarML} disabled={salvando}
                          className="w-full py-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1"
                          style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', color:'#22c55e' }}>
                          <RefreshCw size={10}/> Renovar Token
                        </button>
                      )}
                    </>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
