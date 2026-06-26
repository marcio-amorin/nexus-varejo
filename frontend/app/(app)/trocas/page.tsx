'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'

type Troca = {
  id: number; numero: string; tipo: string; status: string; data_solicitacao: string
  cliente_id?: number; cliente_nome?: string; fornecedor_id?: number; fornecedor_nome?: string
  venda_id?: number; motivo: string; resolucao?: string; valor_total: number; observacoes?: string
  itens: TrocaItem[]
}
type TrocaItem = { id?: number; produto_id?: number; descricao: string; quantidade: number; valor_unit: number; valor_total: number }
type Prod = { id: number; codigo: string; descricao: string; preco_venda: number; unidade: string }
type Cli  = { id: number; nome: string; documento?: string }
type Forn = { id: number; razao_social: string; fantasia?: string }

const MOTIVOS    = ['DEFEITO','VENCIMENTO','AVARIA','INSATISFACAO','ERRO_PEDIDO']
const RESOLUCOES = ['PRODUTO','CREDITO','REEMBOLSO','DESCONTO']
const MOTIVO_LABEL: Record<string,string> = { DEFEITO:'Defeito', VENCIMENTO:'Vencimento', AVARIA:'Avaria', INSATISFACAO:'Insatisfação', ERRO_PEDIDO:'Erro de Pedido' }
const RESOLUCAO_LABEL: Record<string,string> = { PRODUTO:'Troca por Produto', CREDITO:'Crédito em Conta', REEMBOLSO:'Reembolso', DESCONTO:'Desconto Próxima Compra' }
const STATUS_COR: Record<string,string> = { PENDENTE:'#F97316', APROVADA:'#3B82F6', CONCLUIDA:'#34C759', CANCELADA:'#EF4444' }

const inp = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none'
const s   = { background:'var(--input)', border:'1px solid var(--border)', color:'var(--text)' }
const R   = (v: number) => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })

const emptyItem: TrocaItem = { descricao:'', quantidade:1, valor_unit:0, valor_total:0 }

export default function TrocasPage() {
  const [tab, setTab]       = useState<'CLIENTE'|'FORNECEDOR'>('CLIENTE')
  const [lista, setLista]   = useState<Troca[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca]   = useState('')
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState<Troca | null>(null)

  // form
  const hoje = new Date().toISOString().slice(0,10)
  const [form, setForm] = useState({ data_solicitacao: hoje, cliente_id: 0, fornecedor_id: 0, motivo: 'DEFEITO', resolucao: 'PRODUTO', observacoes: '' })
  const [itens, setItens] = useState<TrocaItem[]>([{ ...emptyItem }])

  // listas
  const [clientes, setClientes]   = useState<Cli[]>([])
  const [fornecedores, setForn]   = useState<Forn[]>([])
  const [produtos, setProdutos]   = useState<Prod[]>([])
  const [prodBusca, setProdBusca] = useState('')

  useEffect(() => { load() }, [tab, busca])
  useEffect(() => {
    api.get('/clientes/').then(r => setClientes(r.data)).catch(() => {})
    api.get('/fornecedores/').then(r => setForn(r.data)).catch(() => {})
    api.get('/produtos/').then(r => setProdutos(r.data)).catch(() => {})
  }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await api.get('/trocas/', { params: { tipo: tab, busca: busca || undefined } })
      setLista(r.data)
    } finally { setLoading(false) }
  }

  async function salvar() {
    const payload = {
      tipo: tab,
      data_solicitacao: form.data_solicitacao,
      cliente_id: tab === 'CLIENTE' ? (form.cliente_id || null) : null,
      fornecedor_id: tab === 'FORNECEDOR' ? (form.fornecedor_id || null) : null,
      motivo: form.motivo,
      resolucao: form.resolucao || null,
      observacoes: form.observacoes || null,
      itens: itens.filter(i => i.descricao).map(i => ({ ...i, valor_total: i.quantidade * i.valor_unit })),
    }
    await api.post('/trocas/', payload)
    setShowForm(false); load()
  }

  async function mudarStatus(id: number, status: string, resolucao?: string) {
    await api.put(`/trocas/${id}/status`, { status, resolucao })
    load()
    if (detail?.id === id) {
      const r = await api.get(`/trocas/${id}`)
      setDetail(r.data)
    }
  }

  function addItem() { setItens(v => [...v, { ...emptyItem }]) }
  function removeItem(i: number) { setItens(v => v.filter((_,j) => j !== i)) }
  function setItem(i: number, key: keyof TrocaItem, val: any) {
    setItens(v => v.map((it, j) => j !== i ? it : { ...it, [key]: val }))
  }

  function selecionarProd(idx: number, prodId: number) {
    const p = produtos.find(x => x.id === prodId)
    if (p) setItens(v => v.map((it, j) => j !== idx ? it : { ...it, produto_id: p.id, descricao: p.descricao, valor_unit: p.preco_venda, valor_total: it.quantidade * p.preco_venda }))
  }

  const prodsFiltrados = produtos.filter(p => !prodBusca || p.descricao.toLowerCase().includes(prodBusca.toLowerCase()) || p.codigo.includes(prodBusca))
  const totalForm = itens.reduce((s, i) => s + i.quantidade * i.valor_unit, 0)

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background:'var(--bg)' }}>
      {/* Header */}
      <div className="flex-shrink-0 p-3 space-y-2" style={{ borderBottom:'1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-black" style={{ color:'var(--text)' }}>🔄 TROCAS E DEVOLUÇÕES</h1>
            <p className="text-[10px]" style={{ color:'var(--muted)' }}>Controle de trocas com clientes e fornecedores</p>
          </div>
          <button onClick={() => { setForm({ data_solicitacao: hoje, cliente_id:0, fornecedor_id:0, motivo:'DEFEITO', resolucao:'PRODUTO', observacoes:'' }); setItens([{...emptyItem}]); setShowForm(true) }}
            className="px-3 py-1.5 rounded-lg text-[11px] font-black"
            style={{ background:'#F97316', color:'white' }}>
            + Nova Troca
          </button>
        </div>
        {/* Abas */}
        <div className="flex gap-2">
          {(['CLIENTE','FORNECEDOR'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all"
              style={{ background: tab===t ? '#F97316' : 'var(--card)', color: tab===t ? 'white' : 'var(--muted)', border:'1px solid var(--border)' }}>
              {t === 'CLIENTE' ? '👤 Clientes' : '🏭 Fornecedores'}
            </button>
          ))}
          <input value={busca} onChange={e => setBusca(e.target.value)}
            className="ml-auto px-2.5 py-1 rounded-lg text-[11px] outline-none"
            style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)', width:180 }}
            placeholder="Buscar..." />
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-auto p-3">
        {loading ? (
          <p className="text-center text-xs py-8" style={{ color:'var(--muted)' }}>Carregando...</p>
        ) : lista.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <p className="text-2xl mb-2">🔄</p>
            <p className="text-xs" style={{ color:'var(--muted)' }}>Nenhuma troca registrada para {tab === 'CLIENTE' ? 'clientes' : 'fornecedores'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lista.map(t => (
              <div key={t.id} className="rounded-xl overflow-hidden cursor-pointer"
                style={{ background:'var(--card)', border:'1px solid var(--border)' }}
                onClick={() => setDetail(t)}>
                <div className="px-3 py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black" style={{ color:'var(--text)' }}>{t.numero}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: STATUS_COR[t.status] + '22', color: STATUS_COR[t.status] }}>
                        {t.status}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background:'var(--card2)', color:'var(--muted)' }}>
                        {MOTIVO_LABEL[t.motivo] || t.motivo}
                      </span>
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color:'var(--muted)' }}>
                      {t.cliente_nome || t.fornecedor_nome || '—'} · {new Date(t.data_solicitacao+'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <p className="text-sm font-black flex-shrink-0" style={{ color:'var(--text)' }}>{R(t.valor_total)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Detalhe */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-xl rounded-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="px-4 py-3 flex justify-between items-center flex-shrink-0" style={{ background:'var(--card2)', borderBottom:'1px solid var(--border)' }}>
              <div>
                <h2 className="text-sm font-black" style={{ color:'var(--text)' }}>{detail.numero}</h2>
                <p className="text-[10px]" style={{ color:'var(--muted)' }}>
                  {detail.cliente_nome || detail.fornecedor_nome} · {MOTIVO_LABEL[detail.motivo]}
                </p>
              </div>
              <button onClick={() => setDetail(null)} style={{ color:'var(--muted)' }}>✕</button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {/* Itens */}
              <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--border)' }}>
                <div className="px-3 py-1.5" style={{ background:'var(--card2)' }}>
                  <p className="text-[10px] font-black" style={{ color:'var(--muted)' }}>ITENS DA TROCA</p>
                </div>
                {detail.itens.map((i, idx) => (
                  <div key={idx} className="flex justify-between px-3 py-1.5" style={{ borderTop:'1px solid var(--border)' }}>
                    <div>
                      <p className="text-xs font-bold" style={{ color:'var(--text)' }}>{i.descricao}</p>
                      <p className="text-[9px]" style={{ color:'var(--muted)' }}>{i.quantidade} un × {R(i.valor_unit)}</p>
                    </div>
                    <p className="text-xs font-black" style={{ color:'var(--text)' }}>{R(i.valor_total)}</p>
                  </div>
                ))}
                <div className="px-3 py-1.5 flex justify-between" style={{ background:'var(--card2)' }}>
                  <span className="text-[10px] font-black" style={{ color:'var(--muted)' }}>TOTAL</span>
                  <span className="text-sm font-black" style={{ color:'#F97316' }}>{R(detail.valor_total)}</span>
                </div>
              </div>
              {detail.resolucao && (
                <p className="text-[10px]" style={{ color:'var(--muted)' }}>
                  Resolução: <strong style={{ color:'var(--text)' }}>{RESOLUCAO_LABEL[detail.resolucao] || detail.resolucao}</strong>
                </p>
              )}
              {detail.observacoes && (
                <p className="text-[10px]" style={{ color:'var(--muted)' }}>{detail.observacoes}</p>
              )}
            </div>
            {/* Ações de status */}
            {detail.status === 'PENDENTE' && (
              <div className="flex gap-2 p-3 flex-shrink-0" style={{ borderTop:'1px solid var(--border)' }}>
                <button onClick={() => mudarStatus(detail.id, 'CANCELADA')}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-bold"
                  style={{ background:'#EF444422', color:'#EF4444', border:'1px solid #EF444433' }}>
                  ✕ Cancelar
                </button>
                <button onClick={() => mudarStatus(detail.id, 'APROVADA')}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-bold"
                  style={{ background:'#3B82F622', color:'#3B82F6', border:'1px solid #3B82F633' }}>
                  ✓ Aprovar
                </button>
              </div>
            )}
            {detail.status === 'APROVADA' && (
              <div className="p-3 flex-shrink-0" style={{ borderTop:'1px solid var(--border)' }}>
                <button onClick={() => mudarStatus(detail.id, 'CONCLUIDA')}
                  className="w-full py-1.5 rounded-lg text-[10px] font-black"
                  style={{ background:'#34C759', color:'white' }}>
                  ✅ Concluir e Movimentar Estoque
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Nova Troca */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2" style={{ background:'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-2xl max-h-[95vh] flex flex-col rounded-2xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="px-4 py-3 flex justify-between items-center flex-shrink-0" style={{ background:'var(--card2)', borderBottom:'1px solid var(--border)' }}>
              <h2 className="text-sm font-black" style={{ color:'var(--text)' }}>
                🔄 Nova Troca — {tab === 'CLIENTE' ? 'Cliente → Loja' : 'Loja → Fornecedor'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ color:'var(--muted)' }}>✕</button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>DATA</label>
                  <input type="date" value={form.data_solicitacao} onChange={e => setForm(f => ({ ...f, data_solicitacao:e.target.value }))}
                    className={inp} style={s} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>MOTIVO</label>
                  <select value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo:e.target.value }))}
                    className={inp} style={s}>
                    {MOTIVOS.map(m => <option key={m} value={m}>{MOTIVO_LABEL[m]}</option>)}
                  </select>
                </div>
              </div>
              {tab === 'CLIENTE' && (
                <div>
                  <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>CLIENTE</label>
                  <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id:+e.target.value }))}
                    className={inp} style={s}>
                    <option value={0}>Selecionar cliente...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              )}
              {tab === 'FORNECEDOR' && (
                <div>
                  <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>FORNECEDOR</label>
                  <select value={form.fornecedor_id} onChange={e => setForm(f => ({ ...f, fornecedor_id:+e.target.value }))}
                    className={inp} style={s}>
                    <option value={0}>Selecionar fornecedor...</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.fantasia || f.razao_social}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>RESOLUÇÃO</label>
                <select value={form.resolucao} onChange={e => setForm(f => ({ ...f, resolucao:e.target.value }))}
                  className={inp} style={s}>
                  {RESOLUCOES.map(r => <option key={r} value={r}>{RESOLUCAO_LABEL[r]}</option>)}
                </select>
              </div>

              {/* Itens */}
              <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--border)' }}>
                <div className="flex items-center justify-between px-3 py-1.5" style={{ background:'var(--card2)' }}>
                  <p className="text-[10px] font-black" style={{ color:'var(--muted)' }}>ITENS DA TROCA</p>
                  <div className="flex items-center gap-2">
                    <input value={prodBusca} onChange={e => setProdBusca(e.target.value)}
                      className="px-2 py-0.5 rounded text-[10px] outline-none"
                      style={{ background:'var(--input)', border:'1px solid var(--border)', color:'var(--text)', width:120 }}
                      placeholder="Buscar produto..." />
                    <button onClick={addItem} className="text-[9px] font-black px-2 py-0.5 rounded"
                      style={{ background:'#34C75922', color:'#34C759' }}>+ Item</button>
                  </div>
                </div>
                {itens.map((item, idx) => (
                  <div key={idx} className="px-3 py-2 grid grid-cols-12 gap-1.5 items-end" style={{ borderTop:'1px solid var(--border)' }}>
                    <div className="col-span-5">
                      <label className="block text-[9px] mb-0.5" style={{ color:'var(--muted)' }}>Produto</label>
                      <select value={item.produto_id || ''} onChange={e => selecionarProd(idx, +e.target.value)}
                        className={`${inp} text-[10px]`} style={s}>
                        <option value="">Outro (digitar)</option>
                        {prodsFiltrados.slice(0,50).map(p => <option key={p.id} value={p.id}>{p.descricao}</option>)}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[9px] mb-0.5" style={{ color:'var(--muted)' }}>Descrição</label>
                      <input value={item.descricao} onChange={e => setItem(idx,'descricao',e.target.value)}
                        className={`${inp} text-[10px]`} style={s} />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-[9px] mb-0.5" style={{ color:'var(--muted)' }}>Qtd</label>
                      <input type="number" min={0.01} step={0.01} value={item.quantidade}
                        onChange={e => setItem(idx,'quantidade',+e.target.value)}
                        className={`${inp} text-[10px]`} style={s} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[9px] mb-0.5" style={{ color:'var(--muted)' }}>Valor un.</label>
                      <input type="number" min={0} step={0.01} value={item.valor_unit}
                        onChange={e => setItem(idx,'valor_unit',+e.target.value)}
                        className={`${inp} text-[10px]`} style={s} />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button onClick={() => removeItem(idx)} className="text-[10px] pb-1" style={{ color:'#EF4444' }}>✕</button>
                    </div>
                  </div>
                ))}
                <div className="px-3 py-1.5 flex justify-between" style={{ background:'var(--card2)' }}>
                  <span className="text-[10px] font-black" style={{ color:'var(--muted)' }}>TOTAL</span>
                  <span className="text-sm font-black" style={{ color:'#F97316' }}>{R(totalForm)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>OBSERVAÇÕES</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes:e.target.value }))}
                  className={inp} style={s} rows={2} />
              </div>
            </div>
            <div className="flex gap-2 p-3 flex-shrink-0" style={{ borderTop:'1px solid var(--border)' }}>
              <button onClick={() => setShowForm(false)} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold"
                style={{ background:'var(--card2)', color:'var(--muted)', border:'1px solid var(--border)' }}>
                Cancelar
              </button>
              <button onClick={salvar} className="flex-1 py-1.5 rounded-lg text-[10px] font-black"
                style={{ background:'#F97316', color:'white' }}>
                Registrar Troca
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
