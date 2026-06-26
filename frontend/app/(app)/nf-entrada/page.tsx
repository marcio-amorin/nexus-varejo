'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda, fmtData } from '@/lib/api'
import { Plus, FileText, X, Trash2, Eye, AlertCircle, TrendingUp } from 'lucide-react'

export default function NFEntradaPage() {
  const [nfs, setNfs]               = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [showDetail, setShowDetail] = useState<any>(null)
  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [produtos, setProdutos]     = useState<any[]>([])
  const [saving, setSaving]         = useState(false)

  const [form, setForm] = useState({
    numero: '', serie: '1', fornecedor_id: '',
    data_emissao: '', data_entrada: new Date().toISOString().slice(0, 10),
    chave_nfe: '', valor_frete: '', valor_outros: '', valor_desconto: '',
    condicao_pagamento: 'A_VISTA', prazo_dias: '', observacoes: '',
  })
  const [itens, setItens] = useState<any[]>([])

  async function load() {
    setLoading(true)
    const [rn, rf, rp] = await Promise.all([
      api.get('/nf-entrada/'),
      api.get('/fornecedores/'),
      api.get('/produtos/'),
    ])
    setNfs(rn.data); setFornecedores(rf.data); setProdutos(rp.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function addItem() {
    setItens(it => [...it, { produto_id: '', quantidade: 1, preco_unitario: '', desconto: 0, margem_aplicada: '', atualizar_preco: true }])
  }

  function updateItem(idx: number, field: string, value: any) {
    setItens(it => it.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      // auto-fill margem do produto selecionado
      if (field === 'produto_id') {
        const prod = produtos.find(p => p.id === Number(value))
        if (prod) updated.margem_aplicada = prod.margem || 30
      }
      return updated
    }))
  }

  function calcVenda(item: any) {
    const custo  = parseFloat(item.preco_unitario) || 0
    const margem = parseFloat(item.margem_aplicada) || 30
    if (custo <= 0) return null
    return custo / (1 - margem / 100)
  }

  async function salvar() {
    if (!form.numero || !form.fornecedor_id || !form.data_emissao || itens.length === 0) {
      alert('Preencha número, fornecedor, data de emissão e ao menos um item'); return
    }
    setSaving(true)
    try {
      await api.post('/nf-entrada/', {
        ...form,
        fornecedor_id: Number(form.fornecedor_id),
        valor_frete: Number(form.valor_frete) || 0,
        valor_outros: Number(form.valor_outros) || 0,
        valor_desconto: Number(form.valor_desconto) || 0,
        itens: itens.map(i => ({
          produto_id: Number(i.produto_id),
          quantidade: Number(i.quantidade),
          preco_unitario: Number(i.preco_unitario),
          desconto: Number(i.desconto) || 0,
          margem_aplicada: Number(i.margem_aplicada) || 30,
          atualizar_preco: i.atualizar_preco,
        })),
      })
      setShowForm(false); load()
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Erro ao lançar NF')
    }
    setSaving(false)
  }

  async function cancelar(id: number) {
    if (!confirm('Cancelar esta NF? O estoque será revertido.')) return
    await api.delete(`/nf-entrada/${id}`); load()
  }

  // ─── XML Import ────────────────────────────────────────────────────────────
  const [showXml, setShowXml]       = useState(false)
  const [xmlText, setXmlText]       = useState('')
  const [xmlData, setXmlData]       = useState<any>(null)
  const [xmlLoading, setXmlLoading] = useState(false)
  const [xmlItens, setXmlItens]     = useState<any[]>([])

  async function parseXML() {
    if (!xmlText.trim()) return
    setXmlLoading(true)
    try {
      const r = await api.post('/nf-entrada/parse-xml', { xml: xmlText })
      setXmlData(r.data)
      setXmlItens(r.data.itens.map((i: any) => ({ ...i, criar_produto: !i.produto_encontrado, margem: 30, atualizar_preco: true })))
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Erro ao processar XML')
    }
    setXmlLoading(false)
  }

  async function confirmarXML() {
    if (!xmlData) return
    setXmlLoading(true)
    try {
      await api.post('/nf-entrada/confirmar-xml', {
        dados: xmlData,
        criar_fornecedor: !xmlData.fornecedor_encontrado,
        itens: xmlItens,
      })
      alert('NF importada com sucesso!')
      setShowXml(false); setXmlData(null); setXmlText(''); load()
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Erro ao confirmar NF')
    }
    setXmlLoading(false)
  }

  function uploadXML(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setXmlText(ev.target?.result as string || '')
    reader.readAsText(file, 'utf-8')
  }

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"

  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-black text-white">NF de Entrada</h1>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{nfs.length} nota(s) lançada(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowXml(true)}
            className="flex items-center gap-2 text-xs py-1.5 px-3 rounded-xl font-bold"
            style={{ background:'#3B82F622', color:'#3B82F6', border:'1px solid #3B82F633' }}>
            📂 Importar XML
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-xs py-1.5 px-3">
            <Plus size={12} /> Lançar NF
          </button>
        </div>
      </div>

      {/* Tabela NFs */}
      <div className="pg-body">
        <table className="tbl">
          <thead style={{ background: 'var(--card2)' }}>
            <tr>
              {['Número/Série', 'Fornecedor', 'Entrada', 'Itens', 'Total', 'Status', 'Ações'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold"
                  style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--muted)' }}>Carregando...</td></tr>
            ) : nfs.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12" style={{ color: 'var(--muted)' }}>Nenhuma NF lançada</td></tr>
            ) : nfs.map(nf => (
              <tr key={nf.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-white/5">
                <td className="px-4 py-3">
                  <p className="font-mono font-bold text-white">{nf.numero}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Série {nf.serie}</p>
                </td>
                <td className="px-4 py-3 text-white font-semibold">{nf.fornecedor_nome}</td>
                <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{fmtData(nf.data_entrada)}</td>
                <td className="px-4 py-3 text-center text-white">{nf.total_itens}</td>
                <td className="px-4 py-3 font-bold" style={{ color: '#F59E0B' }}>{fmtMoeda(nf.valor_total)}</td>
                <td className="px-4 py-3">
                  <span className="badge" style={{
                    background: nf.status === 'RECEBIDA' ? '#34C75922' : '#FF3B3022',
                    color: nf.status === 'RECEBIDA' ? '#34C759' : '#FF3B30',
                  }}>{nf.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => api.get(`/nf-entrada/${nf.id}`).then(r => setShowDetail(r.data))}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: '#F59E0B22', color: '#F59E0B' }}>
                      <Eye size={12} />
                    </button>
                    {nf.status !== 'CANCELADA' && (
                      <button onClick={() => cancelar(nf.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: '#FF3B3022', color: '#FF3B30' }}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Lançar NF */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-4xl rounded-3xl flex flex-col"
            style={{ background: 'var(--card)', maxHeight: '92vh' }}>
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="font-black text-lg text-white">Lançar Nota Fiscal de Entrada</p>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--muted)' }}><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Dados da NF */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>NÚMERO NF *</label>
                  <input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                    placeholder="000001" className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>SÉRIE</label>
                  <input value={form.serie} onChange={e => setForm(f => ({ ...f, serie: e.target.value }))}
                    className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>EMISSÃO *</label>
                  <input type="date" value={form.data_emissao} onChange={e => setForm(f => ({ ...f, data_emissao: e.target.value }))}
                    className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>ENTRADA</label>
                  <input type="date" value={form.data_entrada} onChange={e => setForm(f => ({ ...f, data_entrada: e.target.value }))}
                    className={inp} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>FORNECEDOR *</label>
                  <select value={form.fornecedor_id} onChange={e => setForm(f => ({ ...f, fornecedor_id: e.target.value }))}
                    className={inp}>
                    <option value="">Selecione...</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.razao_social}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>CONDIÇÃO PGTO</label>
                  <select value={form.condicao_pagamento} onChange={e => setForm(f => ({ ...f, condicao_pagamento: e.target.value }))}
                    className={inp}>
                    <option value="A_VISTA">À Vista</option>
                    <option value="PRAZO">A Prazo</option>
                  </select>
                </div>
              </div>

              {form.condicao_pagamento === 'PRAZO' && (
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>PRAZOS (dias, separados por vírgula)</label>
                  <input value={form.prazo_dias} onChange={e => setForm(f => ({ ...f, prazo_dias: e.target.value }))}
                    placeholder="Ex: 30,60,90" className={inp} />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>FRETE (R$)</label>
                  <input value={form.valor_frete} type="number" step="0.01"
                    onChange={e => setForm(f => ({ ...f, valor_frete: e.target.value }))}
                    placeholder="0,00" className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>OUTROS (R$)</label>
                  <input value={form.valor_outros} type="number" step="0.01"
                    onChange={e => setForm(f => ({ ...f, valor_outros: e.target.value }))}
                    placeholder="0,00" className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>DESCONTO (R$)</label>
                  <input value={form.valor_desconto} type="number" step="0.01"
                    onChange={e => setForm(f => ({ ...f, valor_desconto: e.target.value }))}
                    placeholder="0,00" className={inp} />
                </div>
              </div>

              {/* Itens */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-white">Itens da NF</p>
                  <button onClick={addItem} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
                    style={{ background: '#F59E0B22', color: '#F59E0B' }}>
                    <Plus size={12} /> Adicionar Item
                  </button>
                </div>

                {itens.length === 0 ? (
                  <div className="text-center py-8 rounded-2xl" style={{ background: 'var(--card2)', color: 'var(--muted)' }}>
                    Clique em "Adicionar Item" para inserir produtos
                  </div>
                ) : (
                  <div className="space-y-3">
                    {itens.map((item, idx) => {
                      const venda = calcVenda(item)
                      return (
                        <div key={idx} className="rounded-2xl p-4" style={{ background: 'var(--card2)', border: '1px solid var(--border)' }}>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                            <div className="md:col-span-2">
                              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--muted)' }}>PRODUTO *</label>
                              <select value={item.produto_id} onChange={e => updateItem(idx, 'produto_id', e.target.value)}
                                className={inp}>
                                <option value="">Selecione...</option>
                                {produtos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--muted)' }}>QTDE</label>
                              <input value={item.quantidade} type="number" step="0.001"
                                onChange={e => updateItem(idx, 'quantidade', e.target.value)} className={inp} />
                            </div>
                            <div>
                              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--muted)' }}>CUSTO UNIT (R$)</label>
                              <input value={item.preco_unitario} type="number" step="0.01"
                                onChange={e => updateItem(idx, 'preco_unitario', e.target.value)} className={inp} />
                            </div>
                            <div className="flex items-end">
                              <button onClick={() => setItens(it => it.filter((_, i) => i !== idx))}
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: '#FF3B3022', color: '#FF3B30' }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3 mt-3 items-end">
                            <div>
                              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--muted)' }}>MARGEM (%)</label>
                              <input value={item.margem_aplicada} type="number" step="0.1"
                                onChange={e => updateItem(idx, 'margem_aplicada', e.target.value)} className={inp} />
                            </div>
                            <div>
                              {venda && (
                                <div className="px-3 py-2 rounded-xl" style={{ background: '#F59E0B18' }}>
                                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Preço de Venda Calculado</p>
                                  <p className="font-black" style={{ color: '#F59E0B' }}>{fmtMoeda(venda)}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="checkbox" checked={item.atualizar_preco}
                                onChange={e => updateItem(idx, 'atualizar_preco', e.target.checked)}
                                className="w-4 h-4 accent-amber-400" id={`upd-${idx}`} />
                              <label htmlFor={`upd-${idx}`} className="text-xs font-semibold cursor-pointer"
                                style={{ color: 'var(--muted)' }}>
                                Atualizar preço do produto
                              </label>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={salvar} disabled={saving}
                className="btn-primary w-full py-3.5 text-base">
                {saving ? 'Lançando...' : 'Lançar Nota Fiscal (atualiza estoque + preços + contas)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhe */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-2xl rounded-3xl" style={{ background: 'var(--card)', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="font-black text-lg text-white">NF {showDetail.numero}/{showDetail.serie}</p>
              <button onClick={() => setShowDetail(null)} style={{ color: 'var(--muted)' }}><X size={20} /></button>
            </div>
            <div className="px-6 py-4 overflow-y-auto space-y-4" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Fornecedor', showDetail.fornecedor_nome],
                  ['Entrada', fmtData(showDetail.data_entrada)],
                  ['Valor Total', fmtMoeda(showDetail.valor_total)],
                  ['Condição', showDetail.condicao_pagamento],
                ].map(([k, v]) => (
                  <div key={k} className="p-3 rounded-xl" style={{ background: 'var(--card2)' }}>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>{k}</p>
                    <p className="font-bold text-white mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="font-bold text-white mb-2">Itens</p>
                {showDetail.itens.map((i: any) => (
                  <div key={i.id} className="flex items-center justify-between py-2"
                    style={{ borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <p className="text-sm font-semibold text-white">{i.produto_descricao}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        {i.quantidade} × {fmtMoeda(i.preco_unitario)} · Margem {i.margem_aplicada}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold" style={{ color: '#F59E0B' }}>{fmtMoeda(i.valor_total)}</p>
                      {i.atualizar_preco && (
                        <p className="text-xs" style={{ color: '#34C759' }}>
                          Venda: {fmtMoeda(i.preco_venda_calculado)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importar XML */}
      {showXml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2"
          style={{ background:'rgba(0,0,0,0.85)', backdropFilter:'blur(8px)' }}>
          <div className="w-full max-w-4xl max-h-[95vh] flex flex-col rounded-2xl overflow-hidden"
            style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ background:'var(--card2)', borderBottom:'1px solid var(--border)' }}>
              <div>
                <h2 className="text-sm font-black" style={{ color:'var(--text)' }}>📂 Importar NF-e via XML</h2>
                <p className="text-[10px]" style={{ color:'var(--muted)' }}>Cole o XML ou faça upload do arquivo .xml do fornecedor</p>
              </div>
              <button onClick={() => { setShowXml(false); setXmlData(null); setXmlText('') }}
                style={{ color:'var(--muted)' }}>✕</button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {!xmlData ? (
                /* Passo 1: colar XML */
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <label className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl cursor-pointer text-xs font-bold"
                      style={{ background:'#3B82F622', color:'#3B82F6', border:'2px dashed #3B82F633' }}>
                      📂 Upload de arquivo .xml
                      <input type="file" accept=".xml" onChange={uploadXML} className="hidden" />
                    </label>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>OU COLE O CONTEÚDO XML</label>
                    <textarea value={xmlText} onChange={e => setXmlText(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 text-[10px] font-mono outline-none"
                      style={{ background:'var(--input)', border:'1px solid var(--border)', color:'var(--text)', height:200, resize:'vertical' }}
                      placeholder="Cole aqui o XML da NF-e..." />
                  </div>
                  <button onClick={parseXML} disabled={!xmlText.trim() || xmlLoading}
                    className="w-full py-2 rounded-xl text-xs font-black"
                    style={{ background:'#3B82F6', color:'white', opacity: xmlText.trim() && !xmlLoading ? 1 : 0.4 }}>
                    {xmlLoading ? 'Processando...' : '🔍 Processar XML'}
                  </button>
                </div>
              ) : (
                /* Passo 2: revisar e confirmar */
                <div className="space-y-3">
                  {/* Fornecedor */}
                  <div className="rounded-xl p-3 space-y-1" style={{ background:'var(--card2)', border:`1px solid ${xmlData.fornecedor_encontrado ? '#34C75933' : '#F9731633'}` }}>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-black" style={{ color:'var(--text)' }}>
                        🏭 {xmlData.emitente.razao_social}
                      </p>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: xmlData.fornecedor_encontrado ? '#34C75922' : '#F9731622', color: xmlData.fornecedor_encontrado ? '#34C759' : '#F97316' }}>
                        {xmlData.fornecedor_encontrado ? '✓ Cadastrado' : '⚠ Não cadastrado — será criado'}
                      </span>
                    </div>
                    <p className="text-[9px]" style={{ color:'var(--muted)' }}>
                      CNPJ: {xmlData.emitente.cnpj} · {xmlData.emitente.cidade}/{xmlData.emitente.estado}
                    </p>
                    <p className="text-[9px]" style={{ color:'var(--muted)' }}>
                      NF {xmlData.numero}/{xmlData.serie} · Emissão: {xmlData.data_emissao}
                      {xmlData.prazos_dias?.length > 0 && ` · Pagamento: ${xmlData.prazos_dias.join('/')}d`}
                    </p>
                  </div>

                  {/* Itens */}
                  <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--border)' }}>
                    <div className="px-3 py-2" style={{ background:'var(--card2)' }}>
                      <p className="text-[10px] font-black" style={{ color:'var(--muted)' }}>
                        ITENS DA NF — {xmlData.itens.length} produtos
                      </p>
                    </div>
                    {xmlItens.map((item: any, idx: number) => (
                      <div key={idx} className="px-3 py-2 space-y-1" style={{ borderTop:'1px solid var(--border)' }}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <p className="text-xs font-bold" style={{ color:'var(--text)' }}>{item.descricao}</p>
                            <p className="text-[9px]" style={{ color:'var(--muted)' }}>
                              NCM: {item.ncm} · CFOP: {item.cfop} · {item.quantidade} {item.unidade} × R$ {(+item.preco_unitario).toFixed(2)}
                            </p>
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: item.produto_encontrado ? '#34C75922' : '#EF444422', color: item.produto_encontrado ? '#34C759' : '#EF4444' }}>
                            {item.produto_encontrado ? '✓ Encontrado' : '✕ Não cadastrado'}
                          </span>
                        </div>
                        {!item.produto_encontrado && (
                          <label className="flex items-center gap-2 text-[9px]" style={{ color:'var(--muted)' }}>
                            <input type="checkbox" checked={item.criar_produto}
                              onChange={e => setXmlItens(v => v.map((x,j) => j===idx ? { ...x, criar_produto: e.target.checked } : x))}
                              className="accent-orange-500" />
                            Criar produto automaticamente
                          </label>
                        )}
                        {(item.produto_encontrado || item.criar_produto) && (
                          <div className="flex items-center gap-3 text-[9px]">
                            <label className="flex items-center gap-1" style={{ color:'var(--muted)' }}>
                              Margem %:
                              <input type="number" value={item.margem} min={0} max={99} step={1}
                                onChange={e => setXmlItens(v => v.map((x,j) => j===idx ? { ...x, margem: +e.target.value } : x))}
                                className="w-14 px-1 py-0.5 rounded text-[9px] outline-none ml-1"
                                style={{ background:'var(--input)', border:'1px solid var(--border)', color:'var(--text)' }} />
                            </label>
                            <label className="flex items-center gap-1" style={{ color:'var(--muted)' }}>
                              <input type="checkbox" checked={item.atualizar_preco}
                                onChange={e => setXmlItens(v => v.map((x,j) => j===idx ? { ...x, atualizar_preco: e.target.checked } : x))}
                                className="accent-orange-500" />
                              Atualizar preço venda
                            </label>
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Totais */}
                    <div className="px-3 py-2 grid grid-cols-4 gap-2 text-[9px]" style={{ background:'var(--card2)' }}>
                      <div><span style={{ color:'var(--muted)' }}>Produtos:</span> <strong style={{ color:'var(--text)' }}>R$ {xmlData.valor_produtos?.toFixed(2)}</strong></div>
                      <div><span style={{ color:'var(--muted)' }}>Frete:</span> <strong style={{ color:'var(--text)' }}>R$ {xmlData.valor_frete?.toFixed(2)}</strong></div>
                      <div><span style={{ color:'var(--muted)' }}>Desconto:</span> <strong style={{ color:'var(--text)' }}>R$ {xmlData.valor_desconto?.toFixed(2)}</strong></div>
                      <div><span style={{ color:'var(--muted)' }}>TOTAL:</span> <strong style={{ color:'#F97316' }}>R$ {xmlData.valor_total?.toFixed(2)}</strong></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {xmlData && (
              <div className="flex gap-2 p-3 flex-shrink-0" style={{ borderTop:'1px solid var(--border)' }}>
                <button onClick={() => setXmlData(null)} className="px-4 py-1.5 rounded-lg text-[10px] font-bold"
                  style={{ background:'var(--card2)', color:'var(--muted)', border:'1px solid var(--border)' }}>
                  ← Voltar
                </button>
                <button onClick={confirmarXML} disabled={xmlLoading}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-black"
                  style={{ background:'#34C759', color:'white', opacity: xmlLoading ? 0.5 : 1 }}>
                  {xmlLoading ? 'Importando...' : '✅ Confirmar Importação — Atualizar Estoque + Preços + Contas a Pagar'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
