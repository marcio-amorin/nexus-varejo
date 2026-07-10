'use client'
import { useEffect, useState, useCallback } from 'react'
import { Search, RefreshCw, ExternalLink, TrendingDown, Building2, ShoppingBag, Clock, Tag, MapPin, AlertCircle, Gavel, Percent } from 'lucide-react'

const API  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const GRAD = 'linear-gradient(135deg,#ea580c 0%,#f97316 40%,#f59e0b 80%,#fbbf24 100%)'
function hdr() { return { Authorization: `Bearer ${localStorage.getItem('nexus_token')}` } }
function fmtR(v: any) { return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }

type Aba = 'leiloes' | 'licitacoes' | 'ofertas'

const ABA_INFO = {
  leiloes:    { label: '🔨 Leilões',            cor: '#f59e0b' },
  licitacoes: { label: '🏛️ Licitações Públicas', cor: '#3b82f6' },
  ofertas:    { label: '🎯 Radar de Ofertas',    cor: '#10b981' },
}

export default function Oportunidades() {
  const [aba, setAba]           = useState<Aba>('leiloes')
  const [leiloes, setLeiloes]   = useState<any>({ itens: [], plataformas: [], total: 0, atualizado_em: null, atualizando: false })
  const [licit, setLicit]       = useState<any>({ itens: [], total: 0, atualizado_em: null, atualizando: false })
  const [ofertas, setOfertas]   = useState<any>({ itens: [], total: 0, atualizado_em: null, atualizando: false })
  const [loading, setLoading]   = useState(false)
  const [status, setStatus]     = useState<any>(null)
  const [q, setQ]               = useState('')
  const [uf, setUf]             = useState('')
  const [catOferta, setCatOferta] = useState('')
  const [descontoMin, setDescMin] = useState(15)
  const [atualizandoSec, setAtuSec] = useState<string | null>(null)

  const buscarLeiloes = useCallback(async () => {
    try {
      const r = await fetch(`${API}/oportunidades/leiloes?q=${encodeURIComponent(q)}`, { headers: hdr() })
      if (r.ok) setLeiloes(await r.json())
    } catch {}
  }, [q])

  const buscarLicitacoes = useCallback(async () => {
    try {
      const r = await fetch(`${API}/oportunidades/licitacoes?q=${encodeURIComponent(q)}&uf=${uf}`, { headers: hdr() })
      if (r.ok) setLicit(await r.json())
    } catch {}
  }, [q, uf])

  const buscarOfertas = useCallback(async () => {
    try {
      const r = await fetch(`${API}/oportunidades/ofertas?q=${encodeURIComponent(q)}&categoria=${encodeURIComponent(catOferta)}&desconto_min=${descontoMin}`, { headers: hdr() })
      if (r.ok) setOfertas(await r.json())
    } catch {}
  }, [q, catOferta, descontoMin])

  const buscarStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API}/oportunidades/status`, { headers: hdr() })
      if (r.ok) setStatus(await r.json())
    } catch {}
  }, [])

  // Carga inicial e polling de status a cada 2 min
  useEffect(() => {
    setLoading(true)
    Promise.all([buscarLeiloes(), buscarLicitacoes(), buscarOfertas(), buscarStatus()])
      .finally(() => setLoading(false))
    const iv = setInterval(() => {
      buscarLeiloes(); buscarLicitacoes(); buscarOfertas(); buscarStatus()
    }, 2 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  // Re-busca ao mudar filtros
  useEffect(() => { if (aba === 'leiloes')    buscarLeiloes() },    [buscarLeiloes, aba])
  useEffect(() => { if (aba === 'licitacoes') buscarLicitacoes() }, [buscarLicitacoes, aba])
  useEffect(() => { if (aba === 'ofertas')    buscarOfertas() },    [buscarOfertas, aba])

  async function forcarAtualizacao(secao: string) {
    setAtuSec(secao)
    try {
      await fetch(`${API}/oportunidades/atualizar/${secao}`, { method: 'POST', headers: hdr() })
      await new Promise(r => setTimeout(r, 3000))
      if (secao === 'leiloes')    await buscarLeiloes()
      if (secao === 'licitacoes') await buscarLicitacoes()
      if (secao === 'ofertas')    await buscarOfertas()
      await buscarStatus()
    } finally { setAtuSec(null) }
  }

  const secAtual = aba === 'leiloes' ? leiloes : aba === 'licitacoes' ? licit : ofertas
  const isAtu    = atualizandoSec === aba || secAtual.atualizando

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-sm" style={{ background: GRAD }}>🎯</div>
            <div>
              <h1 className="font-black text-sm" style={{ color: 'var(--fg)' }}>Radar de Oportunidades</h1>
              <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>Atualiza automaticamente a cada 30 min</p>
            </div>
          </div>
          {/* Status das seções */}
          {status && (
            <div className="flex items-center gap-3">
              {Object.entries(status).filter(([k]) => k !== 'proximo_refresh_min').map(([k, v]: any) => (
                <div key={k} className="text-[10px] text-center hidden md:block" style={{ color: 'var(--fg-muted)' }}>
                  <div className="font-bold">{k === 'leiloes' ? '🔨' : k === 'licitacoes' ? '🏛️' : '🎯'} {v.total}</div>
                  <div>{v.atualizado_em || '...'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Abas */}
        <div className="flex gap-1">
          {(Object.keys(ABA_INFO) as Aba[]).map(a => (
            <button key={a} onClick={() => { setAba(a); setQ('') }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: aba === a ? ABA_INFO[a].cor : 'var(--card)',
                color: aba === a ? 'white' : 'var(--fg-muted)',
                border: `1px solid ${aba === a ? ABA_INFO[a].cor : 'var(--border)'}`,
              }}>
              {ABA_INFO[a].label}
              {aba === a && (
                <span className="ml-1.5 text-[9px] opacity-80">({secAtual.total})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="flex-shrink-0 px-4 py-2 flex gap-2 items-center" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex-1 relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder={aba === 'ofertas' ? 'Buscar produto...' : 'Buscar por objeto ou órgão...'}
            className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs border"
            style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--fg)' }} />
        </div>

        {aba === 'licitacoes' && (
          <select value={uf} onChange={e => setUf(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-xs border"
            style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--fg)' }}>
            <option value="">Todos os estados</option>
            {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        {aba === 'ofertas' && (
          <>
            <select value={catOferta} onChange={e => setCatOferta(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-xs border"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--fg)' }}>
              <option value="">Todas as categorias</option>
              {['Celulares','TV & Vídeo','Informática','Games','Eletrodomésticos','Áudio','Smartwatches','Esporte'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={descontoMin} onChange={e => setDescMin(Number(e.target.value))}
              className="px-2 py-1.5 rounded-lg text-xs border"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--fg)' }}>
              <option value={10}>≥ 10% off</option>
              <option value={15}>≥ 15% off</option>
              <option value={20}>≥ 20% off</option>
              <option value={30}>≥ 30% off</option>
              <option value={40}>≥ 40% off</option>
              <option value={50}>≥ 50% off</option>
            </select>
          </>
        )}

        {/* Botão atualizar */}
        <button onClick={() => forcarAtualizacao(aba)} disabled={!!isAtu}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all"
          style={{ background: ABA_INFO[aba].cor, opacity: isAtu ? 0.6 : 1 }}>
          <RefreshCw size={11} className={isAtu ? 'animate-spin' : ''} />
          {isAtu ? 'Buscando...' : 'Atualizar'}
        </button>
      </div>

      {/* Última atualização */}
      {secAtual.atualizado_em && (
        <div className="px-4 py-1 text-[10px] flex items-center gap-1" style={{ color: 'var(--fg-muted)', background: 'var(--card-alt)' }}>
          <Clock size={9} />
          Última atualização: {secAtual.atualizado_em} · próxima em ~30 min
        </div>
      )}

      {/* Conteúdo das abas */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <RefreshCw size={24} className="animate-spin" style={{ color: ABA_INFO[aba].cor }} />
            <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Carregando oportunidades...</p>
          </div>
        )}

        {/* ── ABA LEILÕES ─────────────────────────────────────────────── */}
        {!loading && aba === 'leiloes' && (
          <div>
            {/* Plataformas externas */}
            <h2 className="text-xs font-black mb-2" style={{ color: 'var(--fg-muted)' }}>PLATAFORMAS EXTERNAS — ACESSE DIRETAMENTE</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {(leiloes.plataformas || PLATAFORMAS_LEILAO_FE).map((p: any, i: number) => (
                <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col gap-1 p-3 rounded-xl border transition-all hover:shadow-md"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg">{p.icone}</span>
                    <span className="font-bold text-xs" style={{ color: 'var(--fg)' }}>{p.nome}</span>
                    <ExternalLink size={9} className="ml-auto" style={{ color: 'var(--fg-muted)' }} />
                  </div>
                  <p className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>{p.desc}</p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full w-fit"
                    style={{
                      background: p.tipo === 'governo' ? '#dbeafe' : p.tipo === 'banco' ? '#d1fae5' : '#fef9c3',
                      color: p.tipo === 'governo' ? '#1d4ed8' : p.tipo === 'banco' ? '#065f46' : '#92400e',
                    }}>
                    {p.tipo}
                  </span>
                </a>
              ))}
            </div>

            {/* Leilões do PNCP */}
            {leiloes.itens.length > 0 && (
              <>
                <h2 className="text-xs font-black mb-2" style={{ color: 'var(--fg-muted)' }}>LEILÕES PÚBLICOS — PNCP ({leiloes.itens.length})</h2>
                <div className="space-y-2">
                  {leiloes.itens.map((item: any, i: number) => (
                    <CardLicitacao key={i} item={item} cor="#f59e0b" />
                  ))}
                </div>
              </>
            )}
            {leiloes.itens.length === 0 && !isAtu && (
              <div className="text-center py-8" style={{ color: 'var(--fg-muted)' }}>
                <Gavel size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum leilão público encontrado no PNCP agora.</p>
                <p className="text-xs mt-1">Use as plataformas externas acima para encontrar leilões privados.</p>
              </div>
            )}
          </div>
        )}

        {/* ── ABA LICITAÇÕES ──────────────────────────────────────────── */}
        {!loading && aba === 'licitacoes' && (
          <div>
            <div className="mb-3 p-3 rounded-xl border text-xs" style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1e40af' }}>
              <strong>💡 Como participar:</strong> Cadastre-se no PNCP ou no sistema de origem do órgão. Tenha CNPJ ativo, certidões em dia e proposta com preço competitivo.
            </div>
            {licit.itens.length === 0 && !isAtu ? (
              <div className="text-center py-12" style={{ color: 'var(--fg-muted)' }}>
                <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aguardando dados do PNCP...</p>
                <button onClick={() => forcarAtualizacao('licitacoes')} className="mt-3 px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: '#3b82f6' }}>
                  Buscar Agora
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {licit.itens.map((item: any, i: number) => (
                  <CardLicitacao key={i} item={item} cor="#3b82f6" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ABA OFERTAS ─────────────────────────────────────────────── */}
        {!loading && aba === 'ofertas' && (
          <div>
            <div className="mb-3 p-3 rounded-xl border text-xs" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#065f46' }}>
              <strong>💡 Como funciona:</strong> Compra o produto com desconto no ML → revende com margem de ~15%. Quanto maior o desconto, maior o potencial de lucro.
            </div>
            {ofertas.itens.length === 0 && !isAtu ? (
              <div className="text-center py-12" style={{ color: 'var(--fg-muted)' }}>
                <ShoppingBag size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aguardando dados do Mercado Livre...</p>
                <button onClick={() => forcarAtualizacao('ofertas')} className="mt-3 px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: '#10b981' }}>
                  Buscar Agora
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {ofertas.itens.map((item: any, i: number) => (
                  <CardOferta key={i} item={item} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Componentes de card ───────────────────────────────────────────────────────

function CardLicitacao({ item, cor }: { item: any, cor: string }) {
  return (
    <div className="p-3 rounded-xl border transition-all hover:shadow-md"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: cor + '22', color: cor }}>{item.modalidade || 'Compra'}</span>
            {item.uf && (
              <span className="flex items-center gap-0.5 text-[9px]" style={{ color: 'var(--fg-muted)' }}>
                <MapPin size={8} />{item.uf}
              </span>
            )}
            {item.situacao && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: '#f0fdf4', color: '#065f46' }}>{item.situacao}</span>
            )}
          </div>
          <p className="text-xs font-semibold mb-0.5 line-clamp-2" style={{ color: 'var(--fg)' }}>
            {item.objeto || 'Objeto não informado'}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>{item.orgao}</p>
        </div>
        <div className="text-right flex-shrink-0">
          {item.valor && (
            <p className="text-sm font-black" style={{ color: cor }}>
              {(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          )}
          {item.encerramento && (
            <p className="text-[9px] mt-0.5" style={{ color: 'var(--fg-muted)' }}>
              até {item.encerramento}
            </p>
          )}
        </div>
      </div>
      {item.link && (
        <a href={item.link} target="_blank" rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1 text-[10px] font-bold"
          style={{ color: cor }}>
          <ExternalLink size={9} /> Ver no portal
        </a>
      )}
    </div>
  )
}

function CardOferta({ item }: { item: any }) {
  return (
    <div className="rounded-xl border overflow-hidden transition-all hover:shadow-md"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      {/* Badge desconto */}
      <div className="relative">
        {item.imagem ? (
          <img src={item.imagem} alt={item.titulo} className="w-full h-36 object-contain p-2"
            style={{ background: '#f9fafb' }} />
        ) : (
          <div className="w-full h-36 flex items-center justify-center text-3xl" style={{ background: '#f3f4f6' }}>📦</div>
        )}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-black text-white"
          style={{ background: item.desconto_pct >= 40 ? '#ef4444' : item.desconto_pct >= 30 ? '#f97316' : '#f59e0b' }}>
          -{item.desconto_pct}% OFF
        </div>
        {item.frete_gratis && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ background: '#10b981' }}>
            FRETE GRÁTIS
          </div>
        )}
      </div>

      <div className="p-2.5">
        <p className="text-xs font-semibold line-clamp-2 mb-1.5" style={{ color: 'var(--fg)' }}>{item.titulo}</p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] line-through" style={{ color: 'var(--fg-muted)' }}>
              {item.preco_original.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
            </p>
            <p className="text-base font-black" style={{ color: '#10b981' }}>
              {item.preco.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px]" style={{ color: 'var(--fg-muted)' }}>margem est.</p>
            <p className="text-xs font-bold" style={{ color: '#f97316' }}>
              +{item.margem_estimada.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--card-alt)', color: 'var(--fg-muted)' }}>
            {item.categoria}
          </span>
          {item.vendas > 0 && (
            <span className="text-[9px]" style={{ color: 'var(--fg-muted)' }}>{item.vendas} vendas</span>
          )}
        </div>
        <a href={item.url} target="_blank" rel="noopener noreferrer"
          className="mt-2 flex items-center justify-center gap-1 w-full py-1.5 rounded-lg text-[10px] font-bold text-white"
          style={{ background: '#10b981' }}>
          <ExternalLink size={9} /> Ver no ML
        </a>
      </div>
    </div>
  )
}

const PLATAFORMAS_LEILAO_FE = [
  { nome: 'Receita Federal', url: 'https://www.gov.br/receitafederal/pt-br/servicos/leilao/leiloes-de-mercadorias', tipo: 'governo', icone: '🏛️', desc: 'Mercadorias apreendidas' },
  { nome: 'Leilão.com.br',   url: 'https://www.leilao.com.br',       tipo: 'privado', icone: '🔨', desc: 'Maior do Brasil' },
  { nome: 'SuperUsados',     url: 'https://www.superusados.com.br',   tipo: 'privado', icone: '📦', desc: 'Paletes e estoque' },
  { nome: 'Lex Leilões',     url: 'https://www.lexleiloes.com.br',    tipo: 'privado', icone: '⚖️', desc: 'Judiciais e extrajudiciais' },
  { nome: 'Zukerman',        url: 'https://www.zukerman.com.br',      tipo: 'privado', icone: '🔨', desc: 'Industriais' },
  { nome: 'BB Leilões',      url: 'https://www.lbb.com.br',           tipo: 'banco',   icone: '🏦', desc: 'Bens recuperados BB' },
  { nome: 'Caixa Leilões',   url: 'https://venda.caixa.gov.br',       tipo: 'banco',   icone: '🏦', desc: 'Imóveis Caixa' },
  { nome: 'OLX Paletes',     url: 'https://www.olx.com.br/brasil?q=palete', tipo: 'privado', icone: '🏷️', desc: 'Liquidação OLX' },
]
