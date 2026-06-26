'use client'
import { useEffect, useState } from 'react'
import { Settings, CheckCircle, Save, Eye, EyeOff, RefreshCw, ExternalLink, Sparkles, Zap } from 'lucide-react'

const API    = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const GRAD   = 'linear-gradient(135deg,#ea580c 0%,#f97316 40%,#f59e0b 80%,#fbbf24 100%)'
const GRAD_IA = 'linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#ec4899 100%)'

function hdr() { return { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('nexus_token')}` } }

const GUIAS: Record<string,{campos:{key:string;label:string;tipo:string;dica:string}[];tutorial:string}> = {
  ML_AFILIADOS: {
    campos:[
      { key:'client_id',     label:'Client ID',      tipo:'text',     dica:'developers.mercadolivre.com → Suas Aplicações' },
      { key:'client_secret', label:'Client Secret',  tipo:'password', dica:'Secret gerado na criação da app' },
      { key:'extra_json',    label:'Affiliate ID',   tipo:'text',     dica:'{"affiliate_id":"SEU_ID"}' },
    ],
    tutorial:'1. developers.mercadolivre.com → Criar App → Categoria "Afiliados"\n2. Redirect URI: https://nexus-varejo-backend.onrender.com/afiliados/ml-callback\n3. Copie Client ID + Secret → Salve → Clique "Conectar"',
  },
  SHOPEE:      { campos:[{key:'client_id',label:'App ID',tipo:'text',dica:'open.shopee.com → Meu App'},{key:'client_secret',label:'Secret Key',tipo:'password',dica:'Secret do app Shopee'},{key:'access_token',label:'Access Token',tipo:'password',dica:'Token OAuth Shopee'}], tutorial:'open.shopee.com → Cadastre-se como dev → Crie App Affiliate' },
  AMAZON:      { campos:[{key:'client_id',label:'Access Key ID',tipo:'text',dica:'afiliados.amazon.com.br → PA API'},{key:'client_secret',label:'Secret Key',tipo:'password',dica:'Chave PA API'},{key:'extra_json',label:'Partner Tag',tipo:'text',dica:'{"partner_tag":"TAG-20"}'}], tutorial:'afiliados.amazon.com.br → Ferramentas → PA API → Solicite acesso' },
  TIKTOK_SHOP: { campos:[{key:'client_id',label:'App ID',tipo:'text',dica:'seller.tiktok.com → Developer'},{key:'client_secret',label:'App Secret',tipo:'password',dica:'Secret do App TikTok Shop'},{key:'access_token',label:'Access Token',tipo:'password',dica:'Token OAuth TikTok Shop'}], tutorial:'1. seller.tiktok.com → Conta → Developer\n2. Crie App → Categoria "Affiliate"\n3. Redirect URI: https://nexus-varejo-backend.onrender.com/afiliados/tiktok-callback\n4. Cole App ID + Secret → Salve → Conectar' },
  INSTAGRAM:{ campos:[{key:'access_token',label:'Page Token',tipo:'password',dica:'Meta Business Suite → Token'},{key:'extra_json',label:'Instagram Business ID',tipo:'text',dica:'{"instagram_business_id":"ID"}'}], tutorial:'Meta Business Suite → developers.facebook.com → Graph API Explorer → Page Access Token' },
  FACEBOOK: { campos:[{key:'access_token',label:'Page Access Token',tipo:'password',dica:'Token da Página FB'},{key:'extra_json',label:'Page ID',tipo:'text',dica:'{"page_id":"ID_DA_PAGINA"}'}], tutorial:'developers.facebook.com → Seus Apps → Graph API Explorer → Page Token' },
  TIKTOK:   { campos:[{key:'access_token',label:'Access Token',tipo:'password',dica:'developers.tiktok.com'},{key:'extra_json',label:'Open ID',tipo:'text',dica:'{"open_id":"SEU_OPEN_ID"}'}], tutorial:'developers.tiktok.com → Crie App → Content Posting API → OAuth' },
}

const PLATAFORMAS_FIXAS = [
  { plataforma:'ML_AFILIADOS', nome:'Mercado Livre Afiliados', icone:'🟡', tipo:'afiliado', ativo:false, configurado:false, extra_json:null },
  { plataforma:'SHOPEE',       nome:'Shopee Afiliados',         icone:'🟠', tipo:'afiliado', ativo:false, configurado:false, extra_json:null },
  { plataforma:'AMAZON',       nome:'Amazon Associates',        icone:'📦', tipo:'afiliado', ativo:false, configurado:false, extra_json:null },
  { plataforma:'INSTAGRAM',    nome:'Instagram',                icone:'📸', tipo:'social',   ativo:false, configurado:false, extra_json:null },
  { plataforma:'FACEBOOK',     nome:'Facebook',                 icone:'👤', tipo:'social',   ativo:false, configurado:false, extra_json:null },
  { plataforma:'TIKTOK',       nome:'TikTok',                   icone:'🎵', tipo:'social',   ativo:false, configurado:false, extra_json:null },
]

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
  const [showKey, setShowKey]     = useState(false)
  const [salvandoIA, setSalvandoIA] = useState(false)
  const [okIA, setOkIA]           = useState(false)

  useEffect(() => { carregar(); carregarIA() }, [])

  async function carregar() {
    try {
      const r = await fetch(`${API}/afiliados/configs`, { headers:hdr() })
      if (!r.ok) return
      const data = await r.json()
      if (Array.isArray(data) && data.length > 0) setConfigs(data)
    } catch { /* mantém lista estática */ }
  }

  async function carregarIA() {
    try {
      const r = await fetch(`${API}/afiliados/ia-config`, { headers:hdr() })
      if (!r.ok) { setIaStatus(null); return }
      setIaStatus(await r.json())
    } catch { setIaStatus(null) }
  }

  async function salvarIAConfig(plataforma: string = 'GEMINI_API') {
    const key = claudeKey.replace('__claude','')
    if (!key.trim()) return
    setSalvandoIA(true)
    await fetch(`${API}/afiliados/ia-config`, {
      method:'POST', headers:hdr(),
      body:JSON.stringify({ plataforma, access_token:key, ativo:true })
    })
    setSalvandoIA(false); setOkIA(true); setClaudeKey(''); carregarIA()
    setTimeout(() => setOkIA(false), 3000)
  }

  function abrir(plat:string, cfg:any) {
    setSel(plat); setAtivo(cfg.ativo||false)
    setForm({ client_id:'', client_secret:'', access_token:'', refresh_token:'', extra_json:cfg.extra_json||'' })
    setOk(false)
  }

  async function salvar() {
    if (!sel) return
    setSalvando(true)
    const body:any = { plataforma:sel, ativo }
    if (form.client_id)     body.client_id     = form.client_id
    if (form.client_secret) body.client_secret = form.client_secret
    if (form.access_token)  body.access_token  = form.access_token
    if (form.extra_json)    body.extra_json    = form.extra_json
    const r = await fetch(`${API}/afiliados/configs`, { method:'POST', headers:hdr(), body:JSON.stringify(body) })
    setSalvando(false)
    if (r.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; return }
    if (!r.ok) { alert('Erro ao salvar. Tente novamente.'); return }
    setOk(true); carregar(); setTimeout(() => setOk(false), 2500)
  }

  async function conectarML() {
    if (form.client_id && form.client_secret) await salvar()
    // Abre janela imediatamente (resposta direta ao click) para não ser bloqueada pelo browser
    const popup = window.open('about:blank', 'mlauth', 'width=640,height=720,left=200,top=100')
    const r = await fetch(`${API}/afiliados/ml-auth-url`, { headers:hdr() })
    if (r.status === 401) { if (popup) popup.close(); localStorage.removeItem('nexus_token'); window.location.href = '/login'; return }
    const d = await r.json()
    if (d.url && popup) {
      popup.location.href = d.url
      setTimeout(() => carregar(), 10000)
    } else {
      if (popup) popup.close()
      alert(d.detail || 'Erro ao gerar URL de autenticação')
    }
  }

  async function renovarML() {
    setSalvando(true)
    const r = await fetch(`${API}/afiliados/ml-refresh-token`, { method:'POST', headers:hdr() })
    const d = await r.json()
    setSalvando(false)
    if (d.ok) { setOk(true); carregar(); setTimeout(()=>setOk(false),3000) }
    else alert(d.detail||'Erro ao renovar')
  }

  const cfgSel   = configs.find(c=>c.plataforma===sel)
  const guia     = sel?GUIAS[sel]:null
  const afiliados = configs.filter(c=>c.tipo==='afiliado')
  const sociais   = configs.filter(c=>c.tipo==='social')

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header rounded-xl overflow-hidden" style={{ background:GRAD }}>
        <div className="px-5 py-4">
          <h1 className="text-base font-black text-white flex items-center gap-2"><Settings size={16}/> Configurações — Plataformas & Redes</h1>
          <p className="text-xs text-white/75 mt-0.5">Vincule suas contas de afiliados e redes sociais</p>
        </div>
      </div>

      {/* Bloco IA */}
      <div className="pg-stats rounded-xl overflow-hidden" style={{ border:'1px solid var(--border)', background:'var(--card)' }}>
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom:'1px solid var(--border)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:GRAD_IA }}>
            <Sparkles size={16} color="#fff"/>
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-white">Geração de Conteúdo com IA</p>
            <p className="text-[10px]" style={{ color:'var(--muted)' }}>Posts originais criados por IA para cada produto e rede social</p>
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-full font-black"
            style={{ background: iaStatus?.ativo ? 'rgba(34,197,94,0.2)' : 'var(--card2)', color: iaStatus?.ativo ? '#22c55e' : 'var(--muted)', border: iaStatus?.ativo ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)' }}>
            {iaStatus?.ativo ? `✓ ${iaStatus.ia_ativa?.toUpperCase()} ATIVA` : 'SEM IA'}
          </span>
        </div>

        <div className="p-4 grid gap-4" style={{ gridTemplateColumns:'1fr 1fr' }}>
          {/* Groq — Automático */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: iaStatus?.groq_ok ? 'rgba(34,197,94,0.08)' : 'var(--card2)', border:`1px solid ${iaStatus?.groq_ok ? 'rgba(34,197,94,0.4)' : 'var(--border)'}` }}>
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <div>
                <p className="text-xs font-black text-white">Groq — Llama 3.3</p>
                <p className="text-[9px]" style={{ color:'var(--muted)' }}>Automático • 100% grátis</p>
              </div>
              {iaStatus?.groq_ok
                ? <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-black" style={{ background:'rgba(34,197,94,0.2)', color:'#22c55e' }}>✓ ATIVA</span>
                : <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444' }}>Inativa</span>}
            </div>
            {!iaStatus?.groq_ok && (
              <div className="space-y-1.5">
                <div className="relative">
                  <input type={showKey?'text':'password'} value={claudeKey} onChange={e=>setClaudeKey(e.target.value)}
                    placeholder="gsk_..." className="w-full px-2 py-1.5 rounded-lg text-xs pr-7"/>
                  <button type="button" onClick={()=>setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2">
                    {showKey?<EyeOff size={11} color="var(--muted)"/>:<Eye size={11} color="var(--muted)"/>}
                  </button>
                </div>
                <p className="text-[9px]" style={{ color:'var(--muted)' }}>console.groq.com → API Keys → Create</p>
                <button onClick={()=>salvarIAConfig('GROQ_API')} disabled={salvandoIA||!claudeKey.trim()}
                  className="w-full py-1.5 rounded-lg text-[10px] font-black text-white"
                  style={{ background:'linear-gradient(135deg,#16a34a,#22c55e)', opacity:claudeKey.trim()?1:0.5 }}>
                  {salvandoIA?'Salvando...':'Ativar Groq'}
                </button>
              </div>
            )}
            {iaStatus?.groq_ok && <p className="text-[9px] font-bold" style={{ color:'#22c55e' }}>⚡ Botão "Gerar Conteúdo" usa Groq automaticamente</p>}
          </div>

          {/* Claude — Premium */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: iaStatus?.claude_ok ? 'rgba(168,85,247,0.08)' : 'var(--card2)', border:`1px solid ${iaStatus?.claude_ok ? 'rgba(168,85,247,0.4)' : 'var(--border)'}` }}>
            <div className="flex items-center gap-2">
              <Sparkles size={16} color={iaStatus?.claude_ok ? '#a855f7' : 'var(--muted)'}/>
              <div>
                <p className="text-xs font-black text-white">Claude — Anthropic</p>
                <p className="text-[9px]" style={{ color:'var(--muted)' }}>Botão exclusivo • Máxima qualidade</p>
              </div>
              {iaStatus?.claude_ok
                ? <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-black" style={{ background:'rgba(168,85,247,0.2)', color:'#a855f7' }}>✓ ATIVO</span>
                : <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background:'var(--card)', color:'var(--muted)', border:'1px solid var(--border)' }}>Não config.</span>}
            </div>
            <div className="space-y-1.5">
              <input type="password" placeholder="sk-ant-api03-..." className="w-full px-2 py-1.5 rounded-lg text-xs"
                onChange={e=>setClaudeKey(e.target.value+'__claude')}/>
              <p className="text-[9px]" style={{ color:'var(--muted)' }}>console.anthropic.com → API Keys</p>
              <button onClick={()=>salvarIAConfig('CLAUDE_API')} disabled={salvandoIA}
                className="w-full py-1.5 rounded-lg text-[10px] font-black text-white"
                style={{ background:GRAD_IA }}>
                {salvandoIA?'Salvando...': iaStatus?.claude_ok ? '✓ Atualizar key' : 'Configurar Claude'}
              </button>
            </div>
          </div>
        </div>

        {okIA && (
          <div className="px-4 pb-3 flex items-center gap-2 text-xs font-bold" style={{ color:'#22c55e' }}>
            <CheckCircle size={13}/> Configuração salva com sucesso!
          </div>
        )}
      </div>

      <div className="flex-1 grid gap-3 min-h-0" style={{ gridTemplateColumns:'200px 1fr' }}>

        {/* Lista lateral */}
        <div className="flex flex-col gap-2 overflow-auto">
          <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="px-3 py-2" style={{ borderBottom:'1px solid var(--border)' }}>
              <p className="text-[9px] font-black tracking-widest" style={{ color:'var(--muted)' }}>AFILIADOS</p>
            </div>
            {afiliados.map(c => (
              <button key={c.plataforma} onClick={() => abrir(c.plataforma,c)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                style={{ background:sel===c.plataforma?'var(--card2)':'transparent', borderBottom:'1px solid var(--border)', borderLeft:sel===c.plataforma?'3px solid #f97316':'3px solid transparent' }}>
                <span className="text-lg">{c.icone}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate text-white">{c.nome}</p>
                  <p className="text-[9px]" style={{ color:c.configurado?'#22c55e':'var(--muted)' }}>{c.configurado?'✓ Configurado':'Não configurado'}</p>
                </div>
                {c.ativo && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:'#22c55e' }}/>}
              </button>
            ))}
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="px-3 py-2" style={{ borderBottom:'1px solid var(--border)' }}>
              <p className="text-[9px] font-black tracking-widest" style={{ color:'var(--muted)' }}>REDES SOCIAIS</p>
            </div>
            {sociais.map(c => (
              <button key={c.plataforma} onClick={() => abrir(c.plataforma,c)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                style={{ background:sel===c.plataforma?'var(--card2)':'transparent', borderBottom:'1px solid var(--border)', borderLeft:sel===c.plataforma?'3px solid #f97316':'3px solid transparent' }}>
                <span className="text-lg">{c.icone}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate text-white">{c.nome}</p>
                  <p className="text-[9px]" style={{ color:c.configurado?'#22c55e':'var(--muted)' }}>{c.configurado?'✓ Conectado':'Não conectado'}</p>
                </div>
                {c.ativo && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:'#22c55e' }}/>}
              </button>
            ))}
          </div>
        </div>

        {/* Formulário */}
        <div className="pg-body p-3">
          {!sel ? (
            <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color:'var(--muted)' }}>
              <Settings size={36}/><p className="text-sm font-bold text-white">Selecione uma plataforma</p>
              <p className="text-xs">Clique ao lado para configurar</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-lg">
              {/* Status */}
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-5 rounded-full cursor-pointer transition-colors"
                  style={{ background:ativo?'#22c55e':'var(--card2)' }} onClick={() => setAtivo(!ativo)}>
                  <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                    style={{ transform:ativo?'translateX(22px)':'translateX(2px)' }}/>
                </div>
                <span className="text-xs font-bold text-white">{ativo?'ATIVA':'DESATIVADA'}</span>
                {cfgSel?.configurado && <span className="badge" style={{ background:'rgba(34,197,94,0.2)', color:'#22c55e' }}>Configurado</span>}
              </div>

              {/* Campos */}
              {guia?.campos.map(campo => (
                <div key={campo.key}>
                  <label className="text-[10px] font-bold block mb-1" style={{ color:'var(--muted)' }}>{campo.label}</label>
                  <div className="relative">
                    <input type={campo.tipo==='password'&&!showPass[campo.key]?'password':'text'}
                      value={form[campo.key]||''} placeholder={campo.dica}
                      onChange={e => setForm({...form,[campo.key]:e.target.value})}
                      className="w-full px-3 py-2 rounded-lg text-xs pr-8"/>
                    {campo.tipo==='password' && (
                      <button type="button" onClick={() => setShowPass({...showPass,[campo.key]:!showPass[campo.key]})}
                        className="absolute right-2 top-1/2 -translate-y-1/2">
                        {showPass[campo.key] ? <EyeOff size={13} color="var(--muted)"/> : <Eye size={13} color="var(--muted)"/>}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Tutorial */}
              {guia?.tutorial && (
                <div className="p-3 rounded-xl text-xs" style={{ background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.2)', color:'#38bdf8', whiteSpace:'pre-line' }}>
                  {guia.tutorial}
                </div>
              )}

              {ok && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold"
                  style={{ background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', color:'#22c55e' }}>
                  <CheckCircle size={14}/> Salvo com sucesso!
                </div>
              )}

              <button onClick={salvar} disabled={salvando}
                className="w-full py-2.5 rounded-xl font-black text-white text-sm flex items-center justify-center gap-2"
                style={{ background:GRAD }}>
                {salvando ? <><RefreshCw size={14} className="animate-spin"/> Salvando...</> : <><Save size={14}/> Salvar Configuração</>}
              </button>

              {/* Botão OAuth ML */}
              {sel==='ML_AFILIADOS' && (
                <div className="space-y-2 pt-1" style={{ borderTop:'1px solid var(--border)' }}>
                  <button onClick={conectarML}
                    className="w-full py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2"
                    style={{ background:'#FFE600', color:'#333', border:'2px solid #f0d800' }}>
                    <ExternalLink size={14}/> 🟡 Conectar Mercado Livre (OAuth2)
                  </button>
                  {cfgSel?.configurado && (
                    <button onClick={renovarML} disabled={salvando}
                      className="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                      style={{ background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', color:'#22c55e' }}>
                      <RefreshCw size={12}/> Renovar Token
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
