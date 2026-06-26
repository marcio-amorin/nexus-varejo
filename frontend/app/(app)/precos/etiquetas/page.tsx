'use client'
import { useEffect, useRef, useState } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import { Printer, Plus, X, Tag, Search } from 'lucide-react'

type ProdEtiqueta = { id: number; descricao: string; codigo: string; codigo_barras?: string; preco_venda: number; unidade: string; quantidade: number }

const MODELOS = [
  { key: '50x30', label: '50×30mm', w: 189, h: 113 },
  { key: '80x40', label: '80×40mm', w: 302, h: 151 },
  { key: '100x50', label: '100×50mm', w: 378, h: 189 },
]

export default function EtiquetasPage() {
  const [produtos, setProdutos] = useState<any[]>([])
  const [selecionados, setSel]  = useState<ProdEtiqueta[]>([])
  const [busca, setBusca]       = useState('')
  const [modelo, setModelo]     = useState('80x40')
  const [loading, setLoading]   = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get('/produtos/').then(r => { setProdutos(r.data); setLoading(false) })
  }, [])

  function addProd(p: any) {
    setSel(s => {
      if (s.find(x => x.id === p.id)) return s
      return [...s, { id: p.id, descricao: p.descricao, codigo: p.codigo, codigo_barras: p.codigo_barras, preco_venda: p.preco_venda, unidade: p.unidade, quantidade: 1 }]
    })
    setBusca('')
  }

  function setQty(id: number, q: number) {
    if (q <= 0) return setSel(s => s.filter(x => x.id !== id))
    setSel(s => s.map(x => x.id === id ? { ...x, quantidade: q } : x))
  }

  function imprimir() {
    const conteudo = printRef.current?.innerHTML
    if (!conteudo) return
    const janela = window.open('', '_blank', 'width=900,height=700')
    if (!janela) return
    janela.document.write(`
      <html><head><title>Etiquetas</title>
      <style>
        @page { margin: 8mm; }
        body { margin: 0; font-family: Arial, sans-serif; }
        .wrap { display: flex; flex-wrap: wrap; gap: 4mm; padding: 4mm; }
        .etq { border: 1px solid #ccc; border-radius: 2mm; padding: 2mm 3mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid; }
        .etq .nome { font-size: 8pt; font-weight: 700; line-height: 1.2; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .etq .cod { font-size: 6pt; color: #666; font-family: monospace; }
        .etq .preco { font-size: 14pt; font-weight: 900; color: #000; }
        .etq .preco-label { font-size: 6pt; color: #666; }
      </style></head>
      <body><div class="wrap">${conteudo}</div></body></html>
    `)
    janela.document.close()
    setTimeout(() => { janela.print(); janela.close() }, 300)
  }

  const mod = MODELOS.find(m => m.key === modelo) || MODELOS[1]
  const filtrados = produtos.filter(p =>
    busca && (p.descricao.toLowerCase().includes(busca.toLowerCase()) || p.codigo.toLowerCase().includes(busca.toLowerCase()))
  )

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-white">Etiquetas de Preço</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Impressão para gôndolas da loja</p>
        </div>
        <div className="flex gap-2">
          <select value={modelo} onChange={e => setModelo(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm"
            style={{ background: 'var(--card)', color: 'white', border: '1px solid var(--border)' }}>
            {MODELOS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <button onClick={imprimir} disabled={selecionados.length === 0}
            className="btn-primary flex items-center gap-2 text-sm">
            <Printer size={14} /> Imprimir {selecionados.reduce((s, x) => s + x.quantidade, 0)} Etiqueta(s)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Busca e seleção */}
        <div className="card space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full pl-8 pr-4 py-2.5 text-sm rounded-xl"
              style={{ background: 'var(--card2)', color: 'white', border: '1px solid var(--border)' }} />
          </div>
          {busca && filtrados.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {filtrados.slice(0, 8).map(p => (
                <button key={p.id} onClick={() => addProd(p)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <Tag size={14} color="#F59E0B" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.descricao}</p>
                    <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{p.codigo}</p>
                  </div>
                  <p className="font-black" style={{ color: '#F59E0B' }}>{fmtMoeda(p.preco_venda)}</p>
                </button>
              ))}
            </div>
          )}

          <div>
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--muted)' }}>
              SELECIONADOS ({selecionados.length} produto(s))
            </p>
            {selecionados.length === 0 ? (
              <div className="text-center py-8 rounded-xl" style={{ background: 'var(--card2)', color: 'var(--muted)' }}>
                <Tag size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Busque e adicione produtos</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {selecionados.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl"
                    style={{ background: 'var(--card2)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.descricao}</p>
                      <p className="text-xs font-black" style={{ color: '#F59E0B' }}>{fmtMoeda(p.preco_venda)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setQty(p.id, p.quantidade - 1)}
                        className="w-6 h-6 rounded-lg text-xs flex items-center justify-center"
                        style={{ background: 'var(--border)', color: 'var(--muted)' }}>−</button>
                      <input type="number" value={p.quantidade} min={1}
                        onChange={e => setQty(p.id, Number(e.target.value))}
                        className="w-10 text-center text-sm font-bold text-white rounded-lg py-0.5"
                        style={{ background: 'var(--border)' }} />
                      <button onClick={() => setQty(p.id, p.quantidade + 1)}
                        className="w-6 h-6 rounded-lg text-xs flex items-center justify-center"
                        style={{ background: 'var(--border)', color: 'var(--muted)' }}>+</button>
                    </div>
                    <button onClick={() => setSel(s => s.filter(x => x.id !== p.id))}
                      style={{ color: '#FF3B30' }}><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="card space-y-3">
          <p className="text-xs font-bold" style={{ color: 'var(--muted)' }}>PRÉVIA — MODELO {mod.label}</p>
          <div className="flex flex-wrap gap-2 max-h-96 overflow-y-auto" ref={printRef}>
            {selecionados.flatMap(p =>
              Array.from({ length: p.quantidade }, (_, i) => (
                <div key={`${p.id}-${i}`}
                  style={{
                    width: `${mod.w}px`, height: `${mod.h}px`,
                    border: '1px solid #3F3F46', borderRadius: '4px',
                    padding: '6px 8px',
                    background: 'white', color: 'black',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    boxSizing: 'border-box', flexShrink: 0,
                  }}>
                  <div>
                    <p style={{ fontSize: '8px', fontWeight: 900, lineHeight: 1.2, overflow: 'hidden',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                      {p.descricao}
                    </p>
                    <p style={{ fontSize: '7px', color: '#666', fontFamily: 'monospace', marginTop: '2px' }}>
                      Cód: {p.codigo}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '7px', color: '#999' }}>PREÇO</p>
                    <p style={{ fontSize: mod.key === '50x30' ? '12px' : '16px', fontWeight: 900 }}>
                      {fmtMoeda(p.preco_venda)}
                    </p>
                    <p style={{ fontSize: '7px', color: '#666' }}>/{p.unidade}</p>
                  </div>
                </div>
              ))
            )}
            {selecionados.length === 0 && (
              <div className="w-full text-center py-12" style={{ color: 'var(--muted)' }}>
                <Printer size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Adicione produtos para ver a prévia</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
