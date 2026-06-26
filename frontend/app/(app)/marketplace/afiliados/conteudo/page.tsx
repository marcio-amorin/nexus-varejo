'use client'
import { useEffect, useState } from 'react'
import { Image, Zap, Send, Copy, Check, RefreshCw, ShoppingBag, Sparkles } from 'lucide-react'

const API      = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const GRAD     = 'linear-gradient(135deg,#ea580c 0%,#f97316 40%,#f59e0b 80%,#fbbf24 100%)'
const GRAD_GEM = 'linear-gradient(135deg,#1a73e8 0%,#34a853 100%)'
const GRAD_CLA = 'linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#ec4899 100%)'

const REDES = [
  { value:'INSTAGRAM', label:'Instagram', cor:'#E1306C', icone:'ðŸ“¸' },
  { value:'FACEBOOK',  label:'Facebook',  cor:'#1877F2', icone:'ðŸ‘¤' },
  { value:'TIKTOK',    label:'TikTok',    cor:'#38bdf8', icone:'ðŸŽµ' },
  { value:'TODOS',     label:'Todas',     cor:'#f97316', icone:'ðŸŒ' },
]
const TIPOS = ['POST','STORIES','REELS','VIDEO']

function hdr() { return { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('nexus_token')}` } }

export default function CriadorConteudo() {
  const [produtos, setProdutos]     = useState<any[]>([])
  const [prodId, setProdId]         = useState<number|null>(null)
  const [rede, setRede]             = useState('INSTAGRAM')
  const [tipo, setTipo]             = useState('POST')
  const [conteudos, setConteudos]   = useState<any[]>([])
  const [lista, setLista]           = useState<any[]>([])
  const [gerando, setGerando]       = useState<string|null>(null)
  const [iaStatus, setIaStatus]     = useState<any>(null)
  const [publicando, setPublicando] = useState<number|null>(null)
  const [copiado, setCopiado]       = useState<number|null>(null)
  const [filtroRede, setFiltroRede] = useState('')

  useEffect(() => {
    fetch(`${API}/afiliados/catalogo`, { headers: hdr() }).then(r=>r.json()).then(d => setProdutos(Array.isArray(d) ? d : []))
    fetch(`${API}/afiliados/ia-config`, { headers: hdr() }).then(r=>r.json()).then(setIaStatus)
    carregarLista()
  }, [])
  useEffect(() => { carregarLista() }, [filtroRede])

  async function carregarLista() {
    const p = filtroRede ? `?rede_social=${filtroRede}` : ''
    const r = await fetch(`${API}/afiliados/conteudos${p}`, { headers: hdr() })
    setLista(await r.json())
  }

  async function gerar(forcar_ia?: string) {
    // Claude nÃ£o configurado â€” redireciona para config
    if (forcar_ia === 'claude' && !iaStatus?.claude_ok) {
      window.location.href = '/marketplace/afiliados/config'
      return
    }
    setGerando(forcar_ia || 'auto')
    const r = await fetch(`${API}/afiliados/conteudo/gerar`, {
      method:'POST', headers:hdr(),
      body:JSON.stringify({ produto_id:prodId, rede_social:rede, tipo_conteudo:tipo, forcar_ia: forcar_ia || null })
    })
    const d = await r.json()
    setConteudos(d.conteudos||[])
    setGerando(null); carregarLista()
    // Atualiza status da IA
    fetch(`${API}/afiliados/ia-config`, { headers: hdr() }).then(r=>r.json()).then(setIaStatus)
  }

  async function publicar(id:number) {
    setPublicando(id)
    const r = await fetch(`${API}/afiliados/conteudos/${id}/publicar`, { method:'PATCH', headers:hdr() })
    const d = await r.json()
    if (!d.ok) alert(`Erro: ${d.detail||'Erro ao publicar'}`)
    setPublicando(null); carregarLista()
  }

  async function copiar(c:any) {
    await navigator.clipboard.writeText(`${c.texto_post}\n\n${c.hashtags}\n\nðŸ”— ${c.link_afiliado}`)
    setCopiado(c.id); setTimeout(() => setCopiado(null), 2000)
  }

  const prodSel = Array.isArray(produtos) ? produtos.find(p => p.id === prodId) : undefined

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header rounded-xl overflow-hidden" style={{ background: GRAD }}>
        <div className="px-5 py-4">
          <h1 className="text-base font-black text-white flex items-center gap-2"><Image size={16}/> Criador de ConteÃºdo IA</h1>
          <p className="text-xs text-white/75 mt-0.5">Gera posts automÃ¡ticos para Instagram, Facebook e TikTok</p>
        </div>
      </div>

      {/* Gerador */}
      <div className="pg-stats rounded-xl p-3 space-y-2" style={{ background:'var(--card)', border:'1px solid #f97316' }}>
        <div className="grid gap-2" style={{ gridTemplateColumns:'1fr 1fr 1fr' }}>
          <div>
            <p className="text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>PRODUTO</p>
            <select value={prodId||''} onChange={e => setProdId(e.target.value?Number(e.target.value):null)} className="w-full px-2 py-2 rounded-lg text-xs">
              <option value="">Sem produto</option>
              {produtos.map(p => <option key={p.id} value={p.id}>{p.titulo.slice(0,45)}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>REDE SOCIAL</p>
            <div className="flex gap-1 flex-wrap">
              {REDES.map(r => (
                <button key={r.value} onClick={() => setRede(r.value)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold"
                  style={{ background:rede===r.value?r.cor+'25':'var(--card2)', border:`1px solid ${rede===r.value?r.cor:'var(--border)'}`, color:rede===r.value?r.cor:'var(--muted)' }}>
                  {r.icone} {r.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>TIPO</p>
            <div className="flex gap-1 flex-wrap">
              {TIPOS.map(t => (
                <button key={t} onClick={() => setTipo(t)}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold"
                  style={{ background:tipo===t?'#f97316':'var(--card2)', border:`1px solid ${tipo===t?'#f97316':'var(--border)'}`, color:tipo===t?'#fff':'var(--muted)' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {prodSel && (
          <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background:'var(--card2)', border:'1px solid var(--border)' }}>
            {prodSel.imagem_url && <img src={prodSel.imagem_url} className="w-8 h-8 object-contain rounded-md"/>}
            <div>
              <p className="text-xs font-bold text-white">{prodSel.titulo.slice(0,60)}</p>
              <p className="text-[10px]" style={{ color:'#22c55e' }}>ComissÃ£o: {prodSel.comissao_pct}% â€” R$ {prodSel.comissao_valor?.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* BotÃµes â€” Gemini automÃ¡tico + Claude opcional */}
        <div className="flex gap-2">
          {/* BotÃ£o principal â€” Groq automÃ¡tico (grÃ¡tis, 14.400 req/dia) */}
          <button onClick={() => gerar('groq')} disabled={!!gerando}
            className="flex-1 py-3 rounded-lg font-black text-white flex items-center justify-center gap-2 text-sm"
            style={{ background: GRAD }}>
            {gerando==='groq'
              ? <><RefreshCw size={15} className="animate-spin"/> Gerando...</>
              : <><Zap size={15}/> Gerar ConteÃºdo</>}
          </button>

          {/* BotÃ£o Claude â€” redireciona para config se nÃ£o ativo */}
          <button onClick={() => gerar('claude')} disabled={!!gerando}
            title={iaStatus?.claude_ok ? 'Gerar com Claude (Anthropic)' : 'Clique para configurar o Claude'}
            className="px-5 py-3 rounded-lg font-black flex items-center justify-center gap-1.5 text-xs flex-shrink-0 relative"
            style={{ background: iaStatus?.claude_ok ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.08)', border:`2px solid ${iaStatus?.claude_ok ? 'rgba(168,85,247,0.7)' : 'rgba(168,85,247,0.3)'}`, color: iaStatus?.claude_ok ? '#a855f7' : 'rgba(168,85,247,0.5)' }}>
            {gerando==='claude'
              ? <><RefreshCw size={13} className="animate-spin"/> Gerando...</>
              : <><Sparkles size={13}/> {iaStatus?.claude_ok ? 'Gerar com Claude' : 'Claude (configurar)'}</>}
          </button>
        </div>
      </div>

      {/* ConteÃºdos gerados */}
      {conteudos.length > 0 && (
        <div className="pg-stats space-y-2">
          {conteudos.map((c,i) => {
            const r = REDES.find(r => r.value===c.rede_social)
            return (
              <div key={i} className="rounded-xl overflow-hidden" style={{ background:'var(--card)', border:`1px solid ${r?.cor||'var(--border)'}40` }}>
                <div className="px-3 py-2 flex items-center justify-between" style={{ background:r?.cor+'20', borderBottom:`1px solid ${r?.cor}30` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color:r?.cor }}>{r?.icone} {r?.label} â€” {c.tipo_conteudo}</span>
                    {c.gerado_por==='groq'   && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background:'rgba(34,197,94,0.2)', color:'#22c55e' }}>âš¡ Groq</span>}
                    {c.gerado_por==='gemini' && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background:'rgba(26,115,232,0.2)', color:'#34a853' }}>ðŸ”µ Gemini</span>}
                    {c.gerado_por==='claude' && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background:'rgba(124,58,237,0.2)', color:'#a855f7' }}>âœ¦ Claude</span>}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => copiar(c)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"
                      style={{ background:'var(--card2)', border:`1px solid ${r?.cor}`, color:r?.cor }}>
                      {copiado===c.id ? <><Check size={10}/> Copiado!</> : <><Copy size={10}/> Copiar</>}
                    </button>
                    <button onClick={() => publicar(c.id)} disabled={publicando===c.id}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 text-white"
                      style={{ background:r?.cor }}>
                      {publicando===c.id ? <RefreshCw size={10} className="animate-spin"/> : <Send size={10}/>} Publicar
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs whitespace-pre-wrap text-white mb-1.5">{c.texto_post}</p>
                  <p className="text-[10px]" style={{ color:'var(--muted)' }}>{c.hashtags}</p>
                  {c.link_afiliado && <p className="text-[10px] mt-1 font-medium" style={{ color:'#38bdf8' }}>ðŸ”— {c.link_afiliado.slice(0,60)}...</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Lista histÃ³rico */}
      <div className="flex-1 flex flex-col min-h-0 rounded-xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
        <div className="px-4 py-2.5 flex items-center justify-between flex-shrink-0" style={{ borderBottom:'1px solid var(--border)' }}>
          <p className="text-[10px] font-black tracking-widest" style={{ color:'var(--muted)' }}>HISTÃ“RICO</p>
          <div className="flex gap-1">
            <button onClick={() => setFiltroRede('')}
              className="px-2 py-1 rounded-lg text-[10px] font-bold"
              style={{ background:!filtroRede?GRAD:'var(--card2)', color:!filtroRede?'#fff':'var(--muted)', border:filtroRede?'1px solid var(--border)':'none' }}>
              Todos
            </button>
            {REDES.filter(r=>r.value!=='TODOS').map(r => (
              <button key={r.value} onClick={() => setFiltroRede(r.value)}
                className="px-2 py-1 rounded-lg text-[10px] font-bold"
                style={{ background:filtroRede===r.value?r.cor+'25':'var(--card2)', border:`1px solid ${filtroRede===r.value?r.cor:'var(--border)'}`, color:filtroRede===r.value?r.cor:'var(--muted)' }}>
                {r.icone}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {lista.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color:'var(--muted)' }}>
              <Image size={28}/><p className="text-xs">Nenhum conteÃºdo gerado ainda</p>
            </div>
          ) : lista.map((c,i) => {
            const r = REDES.find(r=>r.value===c.rede_social)
            return (
              <div key={i} className="flex items-start gap-2 px-3 py-2" style={{ borderBottom:'1px solid var(--border)' }}>
                <span className="text-base flex-shrink-0 mt-0.5">{r?.icone}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-white">{c.titulo_produto||'Sem produto'}</p>
                  <p className="text-[10px] truncate" style={{ color:'var(--muted)' }}>{c.texto_post}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background:c.status==='PUBLICADO'?'rgba(34,197,94,0.2)':c.status==='AGENDADO'?'rgba(59,130,246,0.2)':'var(--card2)', color:c.status==='PUBLICADO'?'#22c55e':c.status==='AGENDADO'?'#3b82f6':'var(--muted)' }}>
                    {c.status}
                  </span>
                  {c.status!=='PUBLICADO' && (
                    <button onClick={() => publicar(c.id)} disabled={publicando===c.id}
                      className="w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background:r?.cor+'25', color:r?.cor }}>
                      <Send size={10}/>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

