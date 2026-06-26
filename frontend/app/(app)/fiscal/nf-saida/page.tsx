'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import api from '@/lib/api'
import { RefreshCw, Download, Send, AlertTriangle } from 'lucide-react'

type NF = {
  id: number; numero: number; serie: string; cliente_id?: number; cliente_nome?: string
  cliente_doc?: string; data_emissao: string; cfop: string; valor_produtos: number
  valor_frete: number; valor_desconto: number; valor_total: number; valor_tributos: number
  chave_nfe?: string; protocolo?: string; status: string; observacoes?: string
  itens: NFItem[]
}
type NFItem = {
  id?: number; produto_id?: number; descricao: string; ncm?: string; cfop: string
  cst_icms: string; quantidade: number; preco_unitario: number; desconto: number
  valor_total: number; icms_aliquota: number; pis_aliquota: number; cofins_aliquota: number
}
type Cli  = { id: number; nome: string; documento?: string }
type Prod = { id: number; codigo: string; descricao: string; preco_venda: number; ncm?: string; cfop_saida?: string; cst_icms?: string }

const STATUS_COR: Record<string,string> = { RASCUNHO:'#6B7280', AUTORIZADA:'#34C759', CANCELADA:'#EF4444', REJEITADA:'#F97316' }
const inp = 'w-full rounded-lg px-2.5 py-1.5 text-xs outline-none'
const s   = { background:'var(--input)', border:'1px solid var(--border)', color:'var(--text)' }
const R   = (v: number) => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })

const emptyItem: NFItem = { descricao:'', cfop:'5102', cst_icms:'400', quantidade:1, preco_unitario:0, desconto:0, valor_total:0, icms_aliquota:0, pis_aliquota:0, cofins_aliquota:0 }

function buildDanfeHTML(nf: NF, config: any): string {
  const emp = config?.empresa
  const chave = nf.chave_nfe
    ? nf.chave_nfe.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
    : 'CHAVE NÃO DISPONÍVEL'
  const sc = nf.status==='AUTORIZADA' ? '#16a34a' : nf.status==='CANCELADA' ? '#dc2626' : '#d97706'
  const sb = nf.status==='AUTORIZADA' ? '#dcfce7' : nf.status==='CANCELADA' ? '#fee2e2' : '#fef3c7'
  const rows = nf.itens.map((it,i) => `
    <tr>
      <td style="text-align:center">${String(i+1).padStart(3,'0')}</td>
      <td>${it.descricao}</td>
      <td style="text-align:center">${it.ncm||''}</td>
      <td style="text-align:center">${it.cfop}</td>
      <td style="text-align:center">${it.cst_icms}</td>
      <td style="text-align:right">${it.quantidade.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:3})}</td>
      <td style="text-align:right">${R(it.preco_unitario)}</td>
      <td style="text-align:right">${R(it.desconto)}</td>
      <td style="text-align:right;font-weight:700">${R(it.valor_total)}</td>
    </tr>`).join('')
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>DANFE NF-e ${nf.numero}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;background:#e2e8f0;display:flex;justify-content:center;padding:20px;min-height:100vh}
    .page{background:#fff;width:210mm;padding:8mm;box-shadow:0 4px 32px rgba(0,0,0,.18)}
    .danfe{border:2px solid #111;width:100%}
    /* header */
    .hdr{display:flex}
    .h-emit{flex:2.5;border-right:2px solid #111;padding:7px 8px}
    .h-mid{flex:1;border-right:2px solid #111;padding:6px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
    .h-nf{flex:1;padding:6px;text-align:center}
    .razao{font-size:14px;font-weight:900;line-height:1.2;margin-bottom:4px}
    .emit-info{font-size:8px;color:#444;line-height:1.7}
    .dtitle{border:2px solid #111;font-size:13px;font-weight:900;letter-spacing:3px;padding:3px 12px}
    .dsub{font-size:7.5px;color:#555;line-height:1.5;text-align:center}
    .dio{font-size:8.5px;border:1px solid #999;padding:2px 10px;border-radius:2px;color:#333}
    .nfnum{font-size:20px;font-weight:900;color:#111;letter-spacing:1px}
    .nfserie{font-size:9px;color:#666;margin-top:2px}
    .badge{display:inline-block;font-size:8px;font-weight:900;padding:2px 10px;border-radius:3px;margin-top:8px;border:1.5px solid ${sc};background:${sb};color:${sc};letter-spacing:.5px}
    /* chave */
    .chave{border-top:2px solid #111;border-bottom:1.5px solid #111;padding:5px 8px;background:#f8fafc}
    .lbl{font-size:7px;color:#666;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:2px}
    .chave-v{font-family:'Courier New',monospace;font-size:9.5px;font-weight:700;letter-spacing:2px;color:#111;word-break:break-all}
    .proto{font-size:8px;color:#555;margin-top:3px}
    /* rows */
    .row{display:flex;border-top:1px solid #ccc}
    .cell{flex:1;border-right:1px solid #ccc;padding:4px 7px}
    .cell:last-child{border-right:none}
    .cv{font-size:10px;font-weight:700;color:#111;margin-top:1px}
    /* dest */
    .dest-hdr{background:#1e293b;padding:3px 7px;border-top:1.5px solid #111}
    .dest-hdr-t{font-size:7.5px;font-weight:900;text-transform:uppercase;color:#fff;letter-spacing:.5px}
    /* itens */
    .itens-hdr{background:#1e293b;padding:4px 7px;border-top:1.5px solid #111}
    .itens-hdr-t{font-size:8px;font-weight:900;text-transform:uppercase;color:#fff;letter-spacing:.5px}
    table{width:100%;border-collapse:collapse}
    th{background:#f1f5f9;font-size:7px;font-weight:700;text-align:left;padding:3px 4px;border:1px solid #d1d5db;text-transform:uppercase;color:#555}
    td{font-size:8px;padding:3px 4px;border:1px solid #e5e7eb;color:#111}
    tr:nth-child(even) td{background:#f9fafb}
    /* totals */
    .tots{display:flex;border-top:2px solid #111}
    .tot{flex:1;border-right:1px solid #ccc;padding:5px 7px;text-align:center}
    .tot:last-child{border-right:none}
    .tl{font-size:7px;color:#666;text-transform:uppercase;margin-bottom:2px}
    .tv{font-size:12px;font-weight:900;color:#111}
    .tot-main{background:#fff7ed}.tot-main .tv{font-size:15px;color:#f97316}
    .tot-trib .tv{font-size:9px;color:#888}
    /* obs */
    .obs{border-top:1px solid #ccc;padding:4px 7px}
    @media print{body{background:#fff;padding:0}.page{box-shadow:none;padding:4mm;width:100%}}
  </style></head>
  <body><div class="page"><div class="danfe">
    <div class="hdr">
      <div class="h-emit">
        <div class="razao">${emp?.razao_social||'EMPRESA NÃO CONFIGURADA'}</div>
        <div class="emit-info">
          CNPJ: <strong>${emp?.cnpj||'—'}</strong><br>
          IE: <strong>${emp?.ie||'—'}</strong><br>
          Regime: <strong>${emp?.regime||'—'}</strong>
        </div>
      </div>
      <div class="h-mid">
        <div class="dtitle">DANFE</div>
        <div class="dsub">Documento Auxiliar da<br>Nota Fiscal Eletrônica</div>
        <div class="dio"><b>1 - Saída</b></div>
      </div>
      <div class="h-nf">
        <div class="lbl">NF-e Número</div>
        <div class="nfnum">${String(nf.numero).padStart(9,'0').replace(/(\d{3})(\d{3})(\d{3})/,'$1.$2.$3')}</div>
        <div class="nfserie">Série ${nf.serie}</div>
        <div class="badge">${nf.status}</div>
      </div>
    </div>
    <div class="chave">
      <span class="lbl">Chave de Acesso</span>
      <div class="chave-v">${chave}</div>
      ${nf.protocolo?`<div class="proto">Protocolo de Autorização: <strong>${nf.protocolo}</strong></div>`:''}
    </div>
    <div class="row">
      <div class="cell" style="flex:3"><span class="lbl">Natureza da Operação</span><div class="cv">Venda de Mercadorias — CFOP ${nf.cfop}</div></div>
      <div class="cell"><span class="lbl">Data de Emissão</span><div class="cv">${new Date(nf.data_emissao+'T12:00:00').toLocaleDateString('pt-BR')}</div></div>
    </div>
    <div class="dest-hdr"><span class="dest-hdr-t">Destinatário / Remetente</span></div>
    <div class="row" style="border-top:none">
      <div class="cell" style="flex:2"><span class="lbl">Nome / Razão Social</span><div class="cv">${nf.cliente_nome||'Consumidor Final'}</div></div>
      <div class="cell"><span class="lbl">CPF / CNPJ</span><div class="cv">${nf.cliente_doc||'—'}</div></div>
      <div class="cell"><span class="lbl">Data NF</span><div class="cv">${new Date(nf.data_emissao+'T12:00:00').toLocaleDateString('pt-BR')}</div></div>
    </div>
    <div class="itens-hdr"><span class="itens-hdr-t">📦 Dados dos Produtos / Serviços</span></div>
    <table><thead><tr>
      <th style="width:30px;text-align:center">#</th>
      <th>Descrição do Produto / Serviço</th>
      <th style="width:65px;text-align:center">NCM/SH</th>
      <th style="width:42px;text-align:center">CFOP</th>
      <th style="width:42px;text-align:center">CST</th>
      <th style="width:65px;text-align:right">Qtd</th>
      <th style="width:80px;text-align:right">Vl. Unit.</th>
      <th style="width:70px;text-align:right">Desconto</th>
      <th style="width:80px;text-align:right">Vl. Total</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <div class="tots">
      <div class="tot"><div class="tl">Vl. Produtos</div><div class="tv">${R(nf.valor_produtos)}</div></div>
      ${(nf.valor_frete||0)>0?`<div class="tot"><div class="tl">Frete</div><div class="tv">${R(nf.valor_frete)}</div></div>`:''}
      ${(nf.valor_desconto||0)>0?`<div class="tot"><div class="tl">Desconto</div><div class="tv" style="color:#dc2626">- ${R(nf.valor_desconto)}</div></div>`:''}
      <div class="tot tot-main"><div class="tl">TOTAL NF-e</div><div class="tv">${R(nf.valor_total)}</div></div>
      <div class="tot tot-trib"><div class="tl">Tributos Est. (Lei 12.741/12)</div><div class="tv">${R(nf.valor_tributos)}</div></div>
    </div>
    ${nf.observacoes?`<div class="obs"><span class="lbl">Informações Adicionais / Observações</span><div style="font-size:9px;margin-top:2px;color:#333">${nf.observacoes}</div></div>`:''}
  </div></div></body></html>`
}

export default function NFSaidaPage() {
  const [lista, setLista]   = useState<NF[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca]   = useState('')
  const [statusFilt, setStatusFilt] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState<NF | null>(null)
  const [danfeNF, setDanfeNF] = useState<NF | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [clientes, setClientes] = useState<Cli[]>([])
  const [produtos, setProdutos] = useState<Prod[]>([])
  const [config, setConfig] = useState<any>(null)
  const [transmitindo, setTransmitindo] = useState<number | null>(null)
  const [transmitMsg, setTransmitMsg] = useState<{ ok: boolean; msg: string; nf_id: number } | null>(null)

  // form
  const hoje = new Date().toISOString().slice(0,10)
  const [form, setForm] = useState({ cliente_id:0, cliente_nome:'', cliente_doc:'', data_emissao:hoje, cfop:'5102', valor_frete:0, valor_desconto:0, observacoes:'' })
  const [itens, setItens] = useState<NFItem[]>([{ ...emptyItem }])

  useEffect(() => { load() }, [busca, statusFilt])
  useEffect(() => {
    api.get('/clientes/').then(r => setClientes(r.data)).catch(()=>{})
    api.get('/produtos/').then(r => setProdutos(r.data)).catch(()=>{})
    api.get('/nf-saida/empresa/config').then(r => setConfig(r.data)).catch(()=>{})
  }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await api.get('/nf-saida/', { params: { busca: busca||undefined, status: statusFilt||undefined } })
      setLista(r.data)
    } finally { setLoading(false) }
  }

  function novaForm() {
    setForm({ cliente_id:0, cliente_nome:'', cliente_doc:'', data_emissao:hoje, cfop:'5102', valor_frete:0, valor_desconto:0, observacoes:'' })
    setItens([{ ...emptyItem }])
    setShowForm(true)
  }

  async function salvar() {
    const payload = {
      ...form,
      cliente_id: form.cliente_id || null,
      itens: itens.filter(i => i.descricao && i.quantidade > 0).map(i => ({
        ...i,
        valor_total: i.quantidade * i.preco_unitario - i.desconto,
      }))
    }
    await api.post('/nf-saida/', payload)
    setShowForm(false); load()
  }

  async function mudarStatus(id: number, status: string) {
    await api.put(`/nf-saida/${id}/status`, { status })
    load()
    if (detail?.id === id) {
      const r = await api.get(`/nf-saida/${id}`)
      setDetail(r.data)
    }
  }

  async function excluir(id: number) {
    if (!confirm('Excluir esta NF?')) return
    await api.delete(`/nf-saida/${id}`)
    load()
  }

  async function gerarXml(nf: NF) {
    try {
      const token = localStorage.getItem('nexus_token')
      const resp = await fetch(`http://localhost:8001/nf-saida/${nf.id}/xml`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!resp.ok) throw new Error('Erro ao gerar XML')
      const blob = await resp.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `NF-e_${String(nf.numero).padStart(6,'0')}.xml`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert('Erro ao gerar XML: ' + e.message)
    }
  }

  async function transmitir(nf: NF) {
    setTransmitindo(nf.id)
    setTransmitMsg(null)
    try {
      const r = await api.post(`/nf-saida/${nf.id}/transmitir`, { forcar_demo: true })
      setTransmitMsg({ ok: true, nf_id: nf.id, msg: r.data.aviso || 'NF-e autorizada com sucesso!' })
      load()
      if (detail?.id === nf.id) {
        const rd = await api.get(`/nf-saida/${nf.id}`)
        setDetail(rd.data)
      }
    } catch (e: any) {
      const detail_err = e.response?.data?.detail
      const instrucoes = typeof detail_err === 'object' ? detail_err?.instrucoes?.join('\n') : null
      setTransmitMsg({ ok: false, nf_id: nf.id, msg: instrucoes || detail_err || 'Erro na transmissão' })
    }
    setTransmitindo(null)
  }

  function selecionarCliente(cliId: number) {
    const c = clientes.find(x => x.id === cliId)
    setForm(f => ({ ...f, cliente_id: cliId, cliente_nome: c?.nome || '', cliente_doc: c?.documento || '' }))
  }

  function addItem() { setItens(v => [...v, { ...emptyItem }]) }
  function removeItem(i: number) { setItens(v => v.filter((_,j) => j !== i)) }
  function setItem(i: number, key: keyof NFItem, val: any) {
    setItens(v => v.map((it, j) => {
      if (j !== i) return it
      const upd = { ...it, [key]: val }
      return upd
    }))
  }

  function selecionarProd(idx: number, prodId: number) {
    const p = produtos.find(x => x.id === prodId)
    if (p) setItens(v => v.map((it, j) => j !== idx ? it : {
      ...it,
      produto_id: p.id,
      descricao: p.descricao,
      ncm: p.ncm || '',
      cfop: p.cfop_saida || form.cfop || '5102',
      cst_icms: p.cst_icms || '400',
      preco_unitario: p.preco_venda,
      valor_total: it.quantidade * p.preco_venda,
    }))
  }

  const totalProd = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario - i.desconto, 0)
  const totalNF   = totalProd + form.valor_frete - form.valor_desconto
  const totalTrib = itens.reduce((s, i) => {
    const vt = i.quantidade * i.preco_unitario - i.desconto
    return s + vt * (i.icms_aliquota + i.pis_aliquota + i.cofins_aliquota) / 100
  }, 0)

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background:'var(--bg)' }}>
      {/* Header */}
      <div className="flex-shrink-0 p-3 space-y-2" style={{ borderBottom:'1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-black" style={{ color:'var(--text)' }}>📄 NF-e DE SAÍDA</h1>
            <p className="text-[10px]" style={{ color:'var(--muted)' }}>
              {config ? `Próxima NF nº ${config.proximo_numero} · Série ${config.serie}` : 'Emissão de Notas Fiscais para Clientes'}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} title="Atualizar lista"
              className="px-2 py-1.5 rounded-lg text-[11px]"
              style={{ background:'var(--card2)', border:'1px solid var(--border)', color:'var(--muted)' }}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={novaForm}
              className="px-3 py-1.5 rounded-lg text-[11px] font-black"
              style={{ background:'#F97316', color:'white' }}>
              + Emitir NF-e
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <input value={busca} onChange={e => setBusca(e.target.value)}
            className="px-2.5 py-1 rounded-lg text-[11px] outline-none"
            style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)', flex:1 }}
            placeholder="Buscar por número, cliente, CPF/CNPJ..." />
          <select value={statusFilt} onChange={e => setStatusFilt(e.target.value)}
            className="px-2.5 py-1 rounded-lg text-[11px] outline-none"
            style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)' }}>
            <option value="">Todos status</option>
            {['RASCUNHO','AUTORIZADA','CANCELADA','REJEITADA'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Banner resultado transmissão */}
      {transmitMsg && (
        <div className="flex-shrink-0 mx-3 mt-2 px-3 py-2 rounded-xl flex items-start gap-2"
          style={{ background: transmitMsg.ok ? '#22c55e15' : '#ef444415', border: `1px solid ${transmitMsg.ok ? '#22c55e40' : '#ef444440'}` }}>
          {transmitMsg.ok
            ? <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
            : <AlertTriangle size={14} color="#ef4444" className="flex-shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p className="text-xs font-bold" style={{ color: transmitMsg.ok ? '#22c55e' : '#ef4444' }}>
              {transmitMsg.ok ? 'NF-e Autorizada (Modo Demo)' : 'Não transmitida'}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)', whiteSpace: 'pre-line' }}>{transmitMsg.msg}</p>
          </div>
          <button onClick={() => setTransmitMsg(null)} style={{ color: 'var(--muted)' }} className="flex-shrink-0">✕</button>
        </div>
      )}

      {/* Lista */}
      <div className="flex-1 overflow-auto p-3">
        {loading ? (
          <p className="text-center py-8 text-xs" style={{ color:'var(--muted)' }}>Carregando...</p>
        ) : lista.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <p className="text-2xl mb-2">📄</p>
            <p className="text-xs" style={{ color:'var(--muted)' }}>Nenhuma NF-e emitida</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lista.map(nf => (
              <div key={nf.id} className="rounded-xl overflow-hidden"
                style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
                <div className="px-3 py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black" style={{ color:'var(--text)' }}>NF-e {nf.numero}/{nf.serie}</span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                        style={{ background: STATUS_COR[nf.status]+'22', color: STATUS_COR[nf.status] }}>
                        {nf.status}
                      </span>
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color:'var(--muted)' }}>
                      {nf.cliente_nome || 'Consumidor Final'} · {nf.cliente_doc} · {new Date(nf.data_emissao+'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                    {nf.chave_nfe && <p className="text-[9px] font-mono" style={{ color:'var(--muted)' }}>{nf.chave_nfe}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black" style={{ color:'var(--text)' }}>{R(nf.valor_total)}</p>
                    <p className="text-[9px]" style={{ color:'var(--muted)' }}>Trib: {R(nf.valor_tributos)}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 flex-wrap">
                    <button onClick={() => setDetail(nf)}
                      className="px-2 py-1 rounded text-[9px] font-bold"
                      style={{ background:'var(--card2)', color:'var(--text)', border:'1px solid var(--border)' }}>
                      Ver
                    </button>
                    <button onClick={() => setDanfeNF(nf)}
                      className="px-2 py-1 rounded text-[9px] font-bold"
                      style={{ background:'#3B82F622', color:'#3B82F6', border:'1px solid #3B82F644' }}>
                      🖨️ DANFE
                    </button>
                    <button onClick={() => gerarXml(nf)} title="Baixar XML NF-e"
                      className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold"
                      style={{ background:'#8b5cf622', color:'#8b5cf6', border:'1px solid #8b5cf644' }}>
                      <Download size={9} /> XML
                    </button>
                    {nf.status === 'RASCUNHO' && (
                      <>
                        <button onClick={() => transmitir(nf)} disabled={transmitindo === nf.id}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold"
                          style={{ background:'#f9731622', color:'#f97316', border:'1px solid #f9731644' }}>
                          {transmitindo === nf.id
                            ? <RefreshCw size={9} className="animate-spin" />
                            : <Send size={9} />}
                          SEFAZ
                        </button>
                        <button onClick={() => excluir(nf.id)}
                          className="px-2 py-1 rounded text-[9px] font-bold"
                          style={{ background:'#EF444422', color:'#EF4444' }}>
                          ✕
                        </button>
                      </>
                    )}
                    {nf.status === 'AUTORIZADA' && (
                      <button onClick={() => mudarStatus(nf.id, 'CANCELADA')}
                        className="px-2 py-1 rounded text-[9px] font-bold"
                        style={{ background:'#EF444422', color:'#EF4444' }}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Detalhe */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="px-4 py-3 flex justify-between items-center flex-shrink-0" style={{ background:'var(--card2)', borderBottom:'1px solid var(--border)' }}>
              <h2 className="text-sm font-black" style={{ color:'var(--text)' }}>NF-e {detail.numero}/{detail.serie}</h2>
              <button onClick={() => setDetail(null)} style={{ color:'var(--muted)' }}>✕</button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <div><span style={{ color:'var(--muted)' }}>Cliente:</span> <strong style={{ color:'var(--text)' }}>{detail.cliente_nome || 'Consumidor Final'}</strong></div>
                <div><span style={{ color:'var(--muted)' }}>CPF/CNPJ:</span> <strong style={{ color:'var(--text)' }}>{detail.cliente_doc || '—'}</strong></div>
                <div><span style={{ color:'var(--muted)' }}>Emissão:</span> <strong style={{ color:'var(--text)' }}>{new Date(detail.data_emissao+'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>
                <div><span style={{ color:'var(--muted)' }}>CFOP:</span> <strong style={{ color:'var(--text)' }}>{detail.cfop}</strong></div>
              </div>
              {detail.chave_nfe && <p className="text-[9px] font-mono px-2 py-1 rounded" style={{ background:'var(--card2)', color:'var(--muted)' }}>{detail.chave_nfe}</p>}
              <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--border)' }}>
                <div className="px-3 py-1.5" style={{ background:'var(--card2)' }}>
                  <p className="text-[10px] font-black" style={{ color:'var(--muted)' }}>ITENS</p>
                </div>
                {detail.itens.map((i, idx) => (
                  <div key={idx} className="flex justify-between px-3 py-1.5" style={{ borderTop:'1px solid var(--border)' }}>
                    <div>
                      <p className="text-xs font-bold" style={{ color:'var(--text)' }}>{i.descricao}</p>
                      <p className="text-[9px]" style={{ color:'var(--muted)' }}>
                        {i.quantidade} × {R(i.preco_unitario)} · NCM {i.ncm} · CFOP {i.cfop}
                      </p>
                    </div>
                    <p className="text-xs font-black" style={{ color:'var(--text)' }}>{R(i.valor_total)}</p>
                  </div>
                ))}
                <div className="px-3 py-2 space-y-0.5" style={{ background:'var(--card2)' }}>
                  {detail.valor_frete > 0 && <div className="flex justify-between text-[10px]"><span style={{color:'var(--muted)'}}>Frete</span><span>{R(detail.valor_frete)}</span></div>}
                  {detail.valor_desconto > 0 && <div className="flex justify-between text-[10px]"><span style={{color:'var(--muted)'}}>Desconto</span><span style={{color:'#EF4444'}}>- {R(detail.valor_desconto)}</span></div>}
                  <div className="flex justify-between text-xs font-black"><span>TOTAL NF-e</span><span style={{color:'#F97316'}}>{R(detail.valor_total)}</span></div>
                  <div className="flex justify-between text-[9px]"><span style={{color:'var(--muted)'}}>Tributos estimados</span><span style={{color:'var(--muted)'}}>{R(detail.valor_tributos)}</span></div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-4 py-3 flex-shrink-0 flex-wrap" style={{ borderTop:'1px solid var(--border)', background:'var(--card2)' }}>
              <button onClick={() => setDetail(null)}
                className="py-1.5 px-3 rounded-lg text-[10px] font-bold"
                style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--muted)' }}>
                Fechar
              </button>
              <button onClick={() => detail && gerarXml(detail)}
                className="py-1.5 px-3 rounded-lg text-[10px] font-black flex items-center gap-1.5"
                style={{ background:'#8b5cf620', color:'#8b5cf6', border:'1px solid #8b5cf640' }}>
                <Download size={11} /> Baixar XML
              </button>
              {detail?.status === 'RASCUNHO' && (
                <button onClick={() => detail && transmitir(detail)} disabled={transmitindo === detail?.id}
                  className="py-1.5 px-3 rounded-lg text-[10px] font-black flex items-center gap-1.5"
                  style={{ background:'#f9731620', color:'#f97316', border:'1px solid #f9731640' }}>
                  {transmitindo === detail?.id
                    ? <RefreshCw size={11} className="animate-spin" />
                    : <Send size={11} />}
                  Transmitir SEFAZ
                </button>
              )}
              <button onClick={() => setDanfeNF(detail)}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-black flex items-center justify-center gap-1.5"
                style={{ background:'#3B82F6', color:'white' }}>
                🖨️ Imprimir DANFE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal DANFE Preview */}
      {danfeNF && (
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background:'rgba(0,0,0,0.92)' }}>
          {/* Toolbar */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3"
            style={{ background:'#0f172a', borderBottom:'1px solid #1e293b' }}>
            <div className="flex items-center gap-3">
              <span className="text-base font-black text-white">📄 DANFE</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background:'#1e293b', color:'#94a3b8' }}>
                NF-e {danfeNF.numero}/{danfeNF.serie} · {danfeNF.cliente_nome || 'Consumidor Final'}
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: STATUS_COR[danfeNF.status]+'22', color: STATUS_COR[danfeNF.status] }}>
                {danfeNF.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => iframeRef.current?.contentWindow?.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black"
                style={{ background:'#3B82F6', color:'white' }}>
                🖨️ Imprimir DANFE
              </button>
              <button
                onClick={() => setDanfeNF(null)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-black"
                style={{ background:'#1e293b', color:'#94a3b8' }}>
                ✕
              </button>
            </div>
          </div>
          {/* iframe */}
          <div className="flex-1 overflow-hidden p-4">
            <iframe
              ref={iframeRef}
              srcDoc={buildDanfeHTML(danfeNF, config)}
              className="w-full h-full rounded-xl"
              style={{ border:'none', background:'#e2e8f0' }}
              title="DANFE Preview"
            />
          </div>
        </div>
      )}

      {/* Modal Emissão */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2" style={{ background:'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-3xl max-h-[95vh] flex flex-col rounded-2xl overflow-hidden" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="px-4 py-3 flex justify-between items-center flex-shrink-0" style={{ background:'var(--card2)', borderBottom:'1px solid var(--border)' }}>
              <h2 className="text-sm font-black" style={{ color:'var(--text)' }}>
                📄 Emitir NF-e · Nº {config?.proximo_numero || '—'}/{config?.serie || '1'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ color:'var(--muted)' }}>✕</button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {/* Destinatário */}
              <div className="rounded-xl p-3 space-y-2" style={{ background:'var(--card2)', border:'1px solid var(--border)' }}>
                <p className="text-[10px] font-black" style={{ color:'#F97316' }}>👤 DESTINATÁRIO</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[9px] font-bold mb-0.5" style={{ color:'var(--muted)' }}>CLIENTE</label>
                    <select value={form.cliente_id} onChange={e => selecionarCliente(+e.target.value)} className={inp} style={s}>
                      <option value={0}>Consumidor Final / Avulso</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold mb-0.5" style={{ color:'var(--muted)' }}>CPF / CNPJ</label>
                    <input value={form.cliente_doc} onChange={e => setForm(f => ({ ...f, cliente_doc:e.target.value }))} className={inp} style={s} placeholder="000.000.000-00" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold mb-0.5" style={{ color:'var(--muted)' }}>EMISSÃO</label>
                    <input type="date" value={form.data_emissao} onChange={e => setForm(f => ({ ...f, data_emissao:e.target.value }))} className={inp} style={s} />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold mb-0.5" style={{ color:'var(--muted)' }}>CFOP GERAL</label>
                    <select value={form.cfop} onChange={e => setForm(f => ({ ...f, cfop:e.target.value }))} className={inp} style={s}>
                      <option value="5102">5102 — Venda Merc. Adq./Rec. Terc.</option>
                      <option value="5101">5101 — Venda de Produção do Estabelecimento</option>
                      <option value="5405">5405 — Venda Merc. Subst. Tributária</option>
                      <option value="6102">6102 — Venda Interestadual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold mb-0.5" style={{ color:'var(--muted)' }}>FRETE</label>
                    <input type="number" min={0} step={0.01} value={form.valor_frete} onChange={e => setForm(f => ({ ...f, valor_frete:+e.target.value }))} className={inp} style={s} />
                  </div>
                </div>
              </div>

              {/* Itens */}
              <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--border)' }}>
                <div className="flex items-center justify-between px-3 py-1.5" style={{ background:'var(--card2)' }}>
                  <p className="text-[10px] font-black" style={{ color:'#F97316' }}>📦 ITENS</p>
                  <button onClick={addItem} className="text-[9px] font-black px-2 py-0.5 rounded"
                    style={{ background:'#34C75922', color:'#34C759' }}>+ Item</button>
                </div>
                {itens.map((item, idx) => (
                  <div key={idx} className="px-3 py-2 space-y-1.5" style={{ borderTop:'1px solid var(--border)' }}>
                    <div className="grid grid-cols-12 gap-1.5 items-end">
                      <div className="col-span-4">
                        <label className="block text-[9px] mb-0.5" style={{ color:'var(--muted)' }}>Produto</label>
                        <select value={item.produto_id||''} onChange={e => selecionarProd(idx, +e.target.value)}
                          className={`${inp} text-[10px]`} style={s}>
                          <option value="">Selecionar...</option>
                          {produtos.slice(0,100).map(p => <option key={p.id} value={p.id}>{p.descricao}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <label className="block text-[9px] mb-0.5" style={{ color:'var(--muted)' }}>Descrição</label>
                        <input value={item.descricao} onChange={e => setItem(idx,'descricao',e.target.value)} className={`${inp} text-[10px]`} style={s} />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-[9px] mb-0.5" style={{ color:'var(--muted)' }}>NCM</label>
                        <input value={item.ncm||''} onChange={e => setItem(idx,'ncm',e.target.value)} className={`${inp} text-[10px]`} style={s} maxLength={8} />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-[9px] mb-0.5" style={{ color:'var(--muted)' }}>Qtd</label>
                        <input type="number" min={0.001} step={0.001} value={item.quantidade} onChange={e => setItem(idx,'quantidade',+e.target.value)} className={`${inp} text-[10px]`} style={s} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[9px] mb-0.5" style={{ color:'var(--muted)' }}>Vl. Unitário</label>
                        <input type="number" min={0} step={0.01} value={item.preco_unitario} onChange={e => setItem(idx,'preco_unitario',+e.target.value)} className={`${inp} text-[10px]`} style={s} />
                      </div>
                      <div className="col-span-1 flex items-end justify-center pb-1">
                        <button onClick={() => removeItem(idx)} className="text-[10px]" style={{ color:'#EF4444' }}>✕</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <div>
                        <label className="block text-[9px] mb-0.5" style={{ color:'var(--muted)' }}>CFOP</label>
                        <input value={item.cfop} onChange={e => setItem(idx,'cfop',e.target.value)} className={`${inp} text-[10px]`} style={s} maxLength={5} />
                      </div>
                      <div>
                        <label className="block text-[9px] mb-0.5" style={{ color:'var(--muted)' }}>CST/CSOSN</label>
                        <input value={item.cst_icms} onChange={e => setItem(idx,'cst_icms',e.target.value)} className={`${inp} text-[10px]`} style={s} maxLength={4} />
                      </div>
                      <div>
                        <label className="block text-[9px] mb-0.5" style={{ color:'var(--muted)' }}>% ICMS</label>
                        <input type="number" min={0} step={0.01} value={item.icms_aliquota} onChange={e => setItem(idx,'icms_aliquota',+e.target.value)} className={`${inp} text-[10px]`} style={s} />
                      </div>
                      <div>
                        <label className="block text-[9px] mb-0.5" style={{ color:'var(--muted)' }}>Total Item</label>
                        <p className="px-2.5 py-1.5 text-xs font-black" style={{ color:'var(--text)' }}>
                          {R(item.quantidade * item.preco_unitario - item.desconto)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="px-3 py-2 space-y-0.5" style={{ background:'var(--card2)' }}>
                  <div className="flex justify-between text-[10px]"><span style={{color:'var(--muted)'}}>Subtotal produtos</span><span>{R(totalProd)}</span></div>
                  {form.valor_frete > 0 && <div className="flex justify-between text-[10px]"><span style={{color:'var(--muted)'}}>Frete</span><span>{R(form.valor_frete)}</span></div>}
                  {form.valor_desconto > 0 && <div className="flex justify-between text-[10px]"><span style={{color:'var(--muted)'}}>Desconto</span><span style={{color:'#EF4444'}}>- {R(form.valor_desconto)}</span></div>}
                  <div className="flex justify-between text-xs font-black"><span>TOTAL NF-e</span><span style={{color:'#F97316'}}>{R(totalNF)}</span></div>
                  <div className="flex justify-between text-[9px]"><span style={{color:'var(--muted)'}}>Tributos estimados</span><span style={{color:'var(--muted)'}}>{R(totalTrib)}</span></div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>OBSERVAÇÕES</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes:e.target.value }))} className={inp} style={s} rows={2} />
              </div>
            </div>
            <div className="flex gap-2 p-3 flex-shrink-0" style={{ borderTop:'1px solid var(--border)' }}>
              <button onClick={() => setShowForm(false)} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold"
                style={{ background:'var(--card2)', color:'var(--muted)', border:'1px solid var(--border)' }}>
                Cancelar
              </button>
              <button onClick={salvar} className="flex-1 py-1.5 rounded-lg text-[10px] font-black"
                style={{ background:'#F97316', color:'white' }}>
                Salvar como Rascunho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
