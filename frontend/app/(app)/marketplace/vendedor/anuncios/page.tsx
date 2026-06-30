'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Package, RefreshCw, ExternalLink, Trash2, Zap } from 'lucide-react'

const API  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const GRAD = 'linear-gradient(135deg,#7c3aed 0%,#f97316 100%)'

function fmtR(v:number) { return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }
function hdr() { return { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('nexus_token')}` } }

const STATUS_COR: Record<string,{bg:string;cor:string}> = {
  ATIVO:    { bg:'rgba(34,197,94,0.15)',  cor:'#22c55e' },
  PENDENTE: { bg:'rgba(245,158,11,0.15)', cor:'#f59e0b' },
  PAUSADO:  { bg:'rgba(100,116,139,0.15)',cor:'#94a3b8' },
  ERRO:     { bg:'rgba(239,68,68,0.15)',  cor:'#ef4444' },
  VENDIDO:  { bg:'rgba(59,130,246,0.15)', cor:'#3b82f6' },
}

const PLAT_LABEL: Record<string,string> = {
  ML_VENDEDOR:     '🟡 ML',
  SHOPEE_VENDEDOR: '🟠 Shopee',
  TIKTOK_VENDEDOR: '🎵 TikTok',
}

export default function MeusAnuncios() {
  const router = useRouter()
  const [anuncios, setAnuncios] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtroSt, setFiltroSt] = useState('')
  const [filtroPlat, setFiltroPlat] = useState('')

  useEffect(() => { carregar() }, [filtroSt, filtroPlat])

  async function carregar() {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (filtroSt)   p.set('status', filtroSt)
      if (filtroPlat) p.set('plataforma', filtroPlat)
      const r = await fetch(`${API}/vendedor/anuncios?${p}`, { headers: hdr() })
      const d = await r.json()
      setAnuncios(Array.isArray(d) ? d : [])
    } catch { setAnuncios([]) }
    setLoading(false)
  }

  async function limparDuplicados() {
    await fetch(`${API}/vendedor/anuncios/limpar-duplicados`, { method:'POST', headers: hdr() })
    carregar()
  }

  async function sincronizarCatalogo() {
    setLoading(true)
    const r = await fetch(`${API}/vendedor/publicar-catalogo-tudo`, { method:'POST', headers: hdr() })
    const d = await r.json()
    carregar()
    if (d.criados > 0 || d.atualizados > 0)
      alert(`✅ ${d.criados} criados, ${d.atualizados} atualizados de ${d.total_catalogo} produtos no catálogo.`)
  }

  async function remover(id: number) {
    if (!confirm('Remover anúncio?')) return
    await fetch(`${API}/vendedor/anuncios/${id}`, { method:'DELETE', headers:hdr() })
    carregar()
  }

  async function pausar(id: number, status: string) {
    await fetch(`${API}/vendedor/anuncios/${id}`, {
      method:'PATCH', headers:hdr(),
      body:JSON.stringify({ status: status === 'ATIVO' ? 'PAUSADO' : 'ATIVO' })
    })
    carregar()
  }

  const [reparandoId, setReparandoId] = useState<number|null>(null)
  async function reparar(id: number) {
    setReparandoId(id)
    try {
      const r = await fetch(`${API}/vendedor/anuncios/${id}/reparar`, { method:'POST', headers:hdr() })
      const d = await r.json()
      if (!r.ok) { alert('❌ ' + (d.detail || 'Erro ao reparar')); return }
      alert(d.atualizado_no_ml ? '✅ Preço e foto corrigidos no anúncio do ML.' : '✅ Corrigido localmente. (Não foi possível atualizar no ML — confira a conta vendedor)')
    } catch (e:any) { alert('❌ ' + e.message) }
    setReparandoId(null)
    carregar()
  }

  return (
    <div className="pg">
      <div className="pg-header rounded-xl overflow-hidden" style={{ background: GRAD }}>
        <div className="px-4 py-3 flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-auto sm:flex-1 min-w-0">
            <h1 className="text-base font-black text-white flex items-center gap-2"><Package size={16}/> Meus Anúncios</h1>
            <p className="text-xs text-white/75 mt-0.5">{anuncios.length} anúncios publicados nas plataformas</p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={sincronizarCatalogo}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black text-white"
              style={{ background:'rgba(34,197,94,0.3)', border:'1px solid rgba(34,197,94,0.5)' }}>
              <RefreshCw size={11}/> Sincronizar
            </button>
            <button onClick={limparDuplicados}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black text-white"
              style={{ background:'rgba(239,68,68,0.3)', border:'1px solid rgba(239,68,68,0.5)' }}>
              🗑️ Limpar
            </button>
            <button onClick={() => router.push('/marketplace/afiliados/catalogo')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black text-white"
              style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.35)' }}>
              <Zap size={11}/> Novo
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="pg-stats flex gap-2 flex-wrap">
        {['','ATIVO','PENDENTE','PAUSADO','ERRO'].map(s => (
          <button key={s} onClick={() => setFiltroSt(s)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
            style={{ background:filtroSt===s?(s?STATUS_COR[s]?.bg:'rgba(249,115,22,0.2)'):'var(--card)', color:filtroSt===s?(s?STATUS_COR[s]?.cor:'#f97316'):'var(--muted)', border:`1px solid ${filtroSt===s?'transparent':'var(--border)'}` }}>
            {s||'Todos'}
          </button>
        ))}
        <div className="h-4 w-px mx-1" style={{ background:'var(--border)' }}/>
        {['','ML_VENDEDOR','SHOPEE_VENDEDOR','TIKTOK_VENDEDOR'].map(p => (
          <button key={p} onClick={() => setFiltroPlat(p)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
            style={{ background:filtroPlat===p?'rgba(124,58,237,0.2)':'var(--card)', color:filtroPlat===p?'#a855f7':'var(--muted)', border:`1px solid ${filtroPlat===p?'rgba(168,85,247,0.4)':'var(--border)'}` }}>
            {p ? PLAT_LABEL[p] : 'Plataformas'}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="pg-body">
        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw size={24} color="#f97316" className="animate-spin"/></div>
        ) : anuncios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color:'var(--muted)' }}>
            <Package size={40}/>
            <p className="text-sm font-bold text-white">Nenhum anúncio publicado ainda</p>
            <p className="text-xs">Sincronize os produtos salvos no catálogo ou adicione novos</p>
            <button onClick={sincronizarCatalogo}
              className="px-5 py-2 rounded-xl text-xs font-black text-white mt-2 flex items-center gap-1.5"
              style={{ background:'linear-gradient(135deg,#16a34a,#22c55e)' }}>
              <RefreshCw size={12}/> Sincronizar do Catálogo
            </button>
            <button onClick={() => router.push('/marketplace/afiliados/catalogo')}
              className="px-5 py-2 rounded-xl text-xs font-black text-white"
              style={{ background:'linear-gradient(135deg,#7c3aed,#f97316)' }}>
              <Zap size={12} className="inline mr-1"/> Ir ao Catálogo
            </button>
          </div>
        ) : (
          <div className="grid gap-2 p-2" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))' }}>
            {anuncios.map((a,i) => {
              const sc = STATUS_COR[a.status] || STATUS_COR.PENDENTE
              return (
                <div key={i} className="rounded-xl overflow-hidden flex flex-col" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
                  {/* Foto */}
                  <div className="relative flex items-center justify-center" style={{ background:'#fff', height:120 }}>
                    {a.imagem_url
                      ? <img src={a.imagem_url} className="w-full h-full object-contain p-2"/>
                      : <Package size={32} color="#ccc"/>}
                    <span className="absolute top-2 left-2 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background:sc.bg, color:sc.cor }}>{a.status}</span>
                    <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background:'rgba(0,0,0,0.6)', color:'#fff' }}>{PLAT_LABEL[a.plataforma]||a.plataforma}</span>
                  </div>
                  {/* Info */}
                  <div className="p-2 flex flex-col gap-1 flex-1">
                    <p className="text-[10px] font-bold text-white leading-tight"
                      style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {a.titulo}
                    </p>
                    <div className="flex justify-between text-[10px] mt-0.5">
                      <span style={{ color:'var(--muted)' }}>Custo: {fmtR(a.preco_custo)}</span>
                      <span className="font-black" style={{ color:'#22c55e' }}>Margem: {a.margem_pct}%</span>
                    </div>
                    <p className="text-sm font-black" style={{ color:'#f97316' }}>{fmtR(a.preco_venda)}</p>
                    {(!a.imagem_url || !a.preco_venda) && (
                      <button onClick={() => reparar(a.id)} disabled={reparandoId===a.id}
                        className="w-full py-1.5 rounded-lg text-[9px] font-black flex items-center justify-center gap-1"
                        style={{ background:'rgba(245,158,11,0.18)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.4)', opacity:reparandoId===a.id?0.6:1 }}>
                        {reparandoId===a.id ? <><RefreshCw size={9} className="animate-spin"/> Reparando...</> : '🛠️ Reparar preço/foto'}
                      </button>
                    )}
                    {/* Ações */}
                    <div className="flex gap-1 mt-auto pt-1">
                      {a.url_anuncio && (
                        <a href={a.url_anuncio} target="_blank"
                          className="flex-1 py-1.5 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1"
                          style={{ background:'rgba(59,130,246,0.15)', color:'#3b82f6', border:'1px solid rgba(59,130,246,0.3)' }}>
                          <ExternalLink size={9}/> Ver
                        </a>
                      )}
                      <button onClick={() => pausar(a.id, a.status)}
                        className="flex-1 py-1.5 rounded-lg text-[9px] font-bold"
                        style={{ background:a.status==='ATIVO'?'rgba(245,158,11,0.15)':'rgba(34,197,94,0.15)', color:a.status==='ATIVO'?'#f59e0b':'#22c55e', border:`1px solid ${a.status==='ATIVO'?'rgba(245,158,11,0.3)':'rgba(34,197,94,0.3)'}` }}>
                        {a.status==='ATIVO'?'Pausar':'Ativar'}
                      </button>
                      <button onClick={() => remover(a.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.25)' }}>
                        <Trash2 size={10} color="#ef4444"/>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
