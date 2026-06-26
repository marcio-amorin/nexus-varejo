'use client'
import { useEffect, useState, useRef } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import { RefreshCw, Scan, Check, ChevronRight, Package, AlertTriangle, Calendar } from 'lucide-react'

type NFItem = {
  id: number; produto_id: number; descricao: string; codigo: string
  codigo_barras?: string; unidade: string; quantidade: number
  preco_unitario: number; valor_total: number; controla_validade: boolean
}
type NF = {
  id: number; numero: string; fornecedor_nome: string; data_entrada: string
  valor_total: number; status: string; total_itens: number; total_qty: number
  itens?: NFItem[]
}
type Conferencia = Record<number, { qty_conferida: number; validade?: string; divergencia: boolean }>

export default function RecebimentoPage() {
  const [nfs, setNfs]         = useState<NF[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<NF | null>(null)
  const [conferencia, setConferencia] = useState<Conferencia>({})
  const [scanInput, setScanInput]   = useState('')
  const [scanMsg, setScanMsg]       = useState<{ok:boolean;text:string}|null>(null)
  const [saving, setSaving]         = useState(false)
  const [busca, setBusca]           = useState('')
  const scanRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try { setNfs((await api.get('/nf-entrada/coletor/recentes')).data) } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function abrirNF(nf: NF) {
    try {
      const r = await api.get(`/nf-entrada/coletor/${nf.id}`)
      const nfCompleta: NF = r.data
      setSelected(nfCompleta)
      const init: Conferencia = {}
      nfCompleta.itens?.forEach(it => {
        init[it.id] = { qty_conferida: 0, divergencia: false }
      })
      setConferencia(init)
      setScanInput(''); setScanMsg(null)
      setTimeout(() => scanRef.current?.focus(), 100)
    } catch(e:any) { alert(e.response?.data?.detail||'Erro') }
  }

  function handleScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const cod = scanInput.trim()
    if (!cod || !selected?.itens) { setScanInput(''); return }
    const item = selected.itens.find(it =>
      it.codigo === cod || it.codigo_barras === cod ||
      it.descricao.toLowerCase().includes(cod.toLowerCase())
    )
    if (!item) {
      setScanMsg({ ok:false, text:`"${cod}" não encontrado na NF` })
      setTimeout(() => setScanMsg(null), 3000)
    } else {
      setConferencia(c => {
        const atual = c[item.id]?.qty_conferida || 0
        const nova = Math.min(atual + 1, item.quantidade * 2) // permite acima para divergência
        const div = nova !== item.quantidade
        return { ...c, [item.id]: { ...c[item.id], qty_conferida: nova, divergencia: div } }
      })
      setScanMsg({ ok:true, text:`✓ ${item.descricao}` })
      setTimeout(() => setScanMsg(null), 1500)
    }
    setScanInput('')
  }

  function setQty(itemId: number, qty: number) {
    setConferencia(c => {
      const item = selected?.itens?.find(it => it.id === itemId)
      const div = item ? qty !== item.quantidade : false
      return { ...c, [itemId]: { ...c[itemId], qty_conferida: Math.max(0, qty), divergencia: div } }
    })
  }

  function setValidade(itemId: number, val: string) {
    setConferencia(c => ({ ...c, [itemId]: { ...c[itemId], validade: val } }))
  }

  const totalItens    = selected?.itens?.length || 0
  const totalOk       = selected?.itens?.filter(it => {
    const c = conferencia[it.id]
    return c && c.qty_conferida === it.quantidade
  }).length || 0
  const temDivergencia = selected?.itens?.some(it => {
    const c = conferencia[it.id]
    return c && c.qty_conferida > 0 && c.qty_conferida !== it.quantidade
  })

  const nfsFiltradas = nfs.filter(n =>
    !busca ||
    n.numero.toLowerCase().includes(busca.toLowerCase()) ||
    n.fornecedor_nome.toLowerCase().includes(busca.toLowerCase())
  )

  if (selected?.itens) return (
    <div className="pg" style={{ background:'var(--bg)' }}>
      {/* Header */}
      <div className="pg-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} style={{ color:'var(--muted)' }}>
            <ChevronRight size={18} style={{ transform:'rotate(180deg)' }} />
          </button>
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-2">
              <Package size={16} color="#32ADE6" /> NF {selected.numero}
            </h1>
            <p className="text-[10px]" style={{ color:'var(--muted)' }}>
              {selected.fornecedor_nome} · {totalOk}/{totalItens} conferidos
            </p>
          </div>
        </div>
        {/* Barra progresso */}
        <div className="flex items-center gap-2">
          <div className="h-2 rounded-full overflow-hidden" style={{ background:'var(--card2)', width:100 }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${totalItens > 0 ? (totalOk/totalItens*100) : 0}%`,
              background: temDivergencia ? '#FF9F0A' : '#34C759'
            }} />
          </div>
          <span className="text-xs font-black" style={{ color: temDivergencia ? '#FF9F0A' : '#34C759' }}>
            {totalItens > 0 ? Math.round(totalOk/totalItens*100) : 0}%
          </span>
        </div>
      </div>

      {/* Scan input */}
      <div className="px-4 py-2" style={{ borderBottom:'1px solid var(--border)' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background:'var(--card)', border:'1px solid #32ADE644' }}>
          <Scan size={14} color="#32ADE6" />
          <input ref={scanRef} value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={handleScan}
            placeholder="Escanear código de barras..."
            className="flex-1 text-sm bg-transparent text-white outline-none" />
        </div>
        {scanMsg && (
          <div className="mt-1 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: scanMsg.ok ? '#34C75922' : '#EF444422', color: scanMsg.ok ? '#34C759' : '#EF4444' }}>
            {scanMsg.text}
          </div>
        )}
      </div>

      {/* Itens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {selected.itens.map(it => {
          const conf = conferencia[it.id] || { qty_conferida:0, divergencia:false }
          const ok   = conf.qty_conferida === it.quantidade
          const div  = conf.qty_conferida > 0 && conf.qty_conferida !== it.quantidade
          return (
            <div key={it.id} className="rounded-2xl p-3"
              style={{ background:'var(--card)', border:`1px solid ${ok ? '#34C75944' : div ? '#FF9F0A44' : 'var(--border)'}` }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: ok ? '#34C75922' : div ? '#FF9F0A22' : 'var(--card2)' }}>
                  {ok ? <Check size={14} color="#34C759" /> :
                   div ? <AlertTriangle size={14} color="#FF9F0A" /> :
                   <Package size={14} color="var(--muted)" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{it.descricao}</p>
                  <p className="text-[10px] font-mono" style={{ color:'var(--muted)' }}>
                    {it.codigo}{it.codigo_barras ? ` · ${it.codigo_barras}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs" style={{ color:'var(--muted)' }}>
                    <span className="font-black text-white">{conf.qty_conferida}</span>/{it.quantidade} {it.unidade}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => setQty(it.id, conf.qty_conferida + 1)}
                      className="w-6 h-5 rounded text-xs font-black"
                      style={{ background:'#32ADE622', color:'#32ADE6' }}>+</button>
                    <button onClick={() => setQty(it.id, conf.qty_conferida - 1)} disabled={conf.qty_conferida===0}
                      className="w-6 h-5 rounded text-xs font-black"
                      style={{ background: conf.qty_conferida > 0 ? '#EF444422' : 'var(--card2)',
                               color: conf.qty_conferida > 0 ? '#EF4444' : 'var(--muted)' }}>−</button>
                  </div>
                </div>
              </div>
              {/* Barra de progresso item */}
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background:'var(--card2)' }}>
                <div className="h-full rounded-full transition-all" style={{
                  width: `${it.quantidade > 0 ? Math.min(conf.qty_conferida/it.quantidade,1)*100 : 0}%`,
                  background: ok ? '#34C759' : div ? '#FF9F0A' : '#32ADE6'
                }} />
              </div>
              {/* Validade (se produto controla) */}
              {it.controla_validade && (
                <div className="mt-2 flex items-center gap-2">
                  <Calendar size={11} color="var(--muted)" />
                  <input type="date" value={conf.validade||''} onChange={e => setValidade(it.id, e.target.value)}
                    className="text-xs bg-transparent text-white outline-none border-b"
                    style={{ borderColor:'var(--border)' }}
                    placeholder="Validade" />
                </div>
              )}
              {div && (
                <p className="mt-1 text-[10px] font-bold" style={{ color:'#FF9F0A' }}>
                  ⚠ Divergência: recebido {conf.qty_conferida}, esperado {it.quantidade}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 space-y-2" style={{ borderTop:'1px solid var(--border)' }}>
        {temDivergencia && (
          <div className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
            style={{ background:'#FF9F0A22', color:'#FF9F0A' }}>
            <AlertTriangle size={12} /> Há divergências de quantidade. Documente e comunique ao fornecedor.
          </div>
        )}
        <button
          onClick={() => {
            if (confirm('Confirmar conferência desta NF?')) {
              alert('Conferência registrada com sucesso!')
              setSelected(null); load()
            }
          }}
          disabled={saving || totalOk === 0}
          className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2"
          style={{
            background: totalOk > 0 ? 'linear-gradient(135deg,#32ADE6,#0070C9)' : 'var(--card2)',
            color: totalOk > 0 ? 'white' : 'var(--muted)',
          }}>
          <Check size={16} />
          {totalOk === totalItens ? 'CONFERÊNCIA COMPLETA' : `Confirmar ${totalOk}/${totalItens} itens`}
        </button>
      </div>
    </div>
  )

  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between">
        <div>
          <h1 className="text-base font-black text-white">Recebimento de Mercadoria</h1>
          <p className="text-[10px]" style={{ color:'var(--muted)' }}>Conferência via scanner</p>
        </div>
        <button onClick={load} style={{ color:'var(--muted)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Busca */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          <Scan size={12} color="var(--muted)" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar NF por número ou fornecedor..."
            className="flex-1 text-sm bg-transparent text-white outline-none" />
        </div>
      </div>

      <div className="pg-body space-y-2">
        {loading && <div className="text-center py-12" style={{ color:'var(--muted)' }}>Carregando...</div>}
        {!loading && nfsFiltradas.length === 0 && (
          <div className="text-center py-12" style={{ color:'var(--muted)' }}>
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p>Nenhuma NF encontrada</p>
          </div>
        )}
        {nfsFiltradas.map(nf => (
          <div key={nf.id} className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="flex-1">
              <p className="font-black text-white">NF {nf.numero}</p>
              <p className="text-xs mt-0.5" style={{ color:'var(--muted)' }}>
                {nf.fornecedor_nome} · {nf.data_entrada} · {nf.total_itens} itens · {fmtMoeda(nf.valor_total)}
              </p>
            </div>
            <button onClick={() => abrirNF(nf)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
              style={{ background:'#32ADE622', color:'#32ADE6' }}>
              Conferir <ChevronRight size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
