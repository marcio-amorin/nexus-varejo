'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { fmtMoeda } from '@/lib/api'
import {
  Package, Clock, Check, Truck, X, MapPin, Printer,
  ChevronRight, Search, Filter, RefreshCw, ClipboardList, FileText,
} from 'lucide-react'

const PLATS = [
  { key: 'TODOS',        nome: 'Todos',         cor: '#F97316', emoji: '📦' },
  { key: 'MERCADOLIVRE', nome: 'Mercado Livre',  cor: '#FFE600', emoji: '🛒' },
  { key: 'SHOPEE',       nome: 'Shopee',          cor: '#EE4D2D', emoji: '🛍️' },
  { key: 'ZEDELIVERY',   nome: 'Zé Delivery',    cor: '#FFB800', emoji: '🍺' },
  { key: 'IFOOD',        nome: 'iFood Mercado',   cor: '#EA1D2C', emoji: '🍔' },
]

const SC: Record<string, { label: string; bg: string; color: string }> = {
  NOVO:          { label: 'Novo',      bg: '#3B82F622', color: '#3B82F6' },
  EM_PREPARACAO: { label: 'Separação', bg: '#F59E0B22', color: '#F59E0B' },
  PRONTO:        { label: 'Pronto',    bg: '#22C55E22', color: '#22C55E' },
  ENVIADO:       { label: 'Enviado',   bg: '#8B5CF622', color: '#8B5CF6' },
  ENTREGUE:      { label: 'Entregue',  bg: '#22C55E33', color: '#22C55E' },
  CANCELADO:     { label: 'Cancelado', bg: '#EF444422', color: '#EF4444' },
}
const FLOW: Record<string, string> = {
  NOVO: 'EM_PREPARACAO', EM_PREPARACAO: 'PRONTO', PRONTO: 'ENVIADO', ENVIADO: 'ENTREGUE',
}
const FLOW_LABEL: Record<string, string> = {
  NOVO: '→ Iniciar Separação', EM_PREPARACAO: '→ Concluir Separação',
  PRONTO: '→ Marcar Enviado', ENVIADO: '→ Confirmar Entrega',
}

export default function PedidosMarketplacePage() {
  const router = useRouter()
  const [plat,     setPlat]    = useState('TODOS')
  const [busca,    setBusca]   = useState('')
  const [stFiltro, setStFil]   = useState('TODOS')
  const [pedidos,  setPed]     = useState<any[]>([])
  const [loading,  setLoad]    = useState(true)
  const [detalhe,  setDet]     = useState<any>(null)
  const [abaDet,   setAbaDet]  = useState<'pedido'|'etiqueta'>('pedido')
  const [saving,   setSaving]  = useState(false)
  const [savingNF, setSavingNF] = useState(false)

  async function load() {
    setLoad(true)
    try {
      const r = await api.get('/marketplace/pedidos', { params: { limit: 200 } })
      setPed(r.data)
    } catch {}
    setLoad(false)
  }
  useEffect(() => { load() }, [])

  async function gerarNFe(p: any) {
    setSavingNF(true)
    try {
      await api.post(`/nf-saida/from-marketplace/${p.id}`)
      alert('NF-e criada como rascunho! Acesse Notas Fiscais → NF-e de Saída para autorizar.')
      router.push('/fiscal/nf-saida')
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Erro ao gerar NF-e')
    }
    setSavingNF(false)
  }

  function imprimirPreVenda(p: any) {
    const info  = PLATS.find(x => x.key === p.plataforma)
    const itens = (p.itens || []).length
      ? p.itens.map((it: any) => `
          <tr>
            <td>${it.nome || it.descricao || 'Item'}</td>
            <td style="text-align:center">${it.quantidade || 1}</td>
            <td style="text-align:right">R$ ${Number(it.preco || it.valor || 0).toFixed(2)}</td>
            <td style="text-align:right">R$ ${(Number(it.quantidade || 1) * Number(it.preco || it.valor || 0)).toFixed(2)}</td>
          </tr>`).join('')
      : `<tr><td colspan="4" style="color:#888">Itens não detalhados</td></tr>`
    const w = window.open('', '_blank', 'width=800,height=700')
    if (!w) return
    w.document.write(`<html><head><title>Pré-Venda #${p.numero_externo}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111;max-width:780px;margin:auto}
      h2{color:#F97316;margin:0}
      .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #F97316;margin-bottom:16px}
      .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#F97316;color:white}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th{background:#f3f4f6;text-align:left;padding:8px;font-size:12px}
      td{padding:8px;border-bottom:1px solid #e5e7eb;font-size:13px}
      .total{font-size:16px;font-weight:900;color:#F97316}
      .footer{margin-top:16px;padding-top:12px;border-top:1px dashed #ddd;font-size:11px;color:#888}
      @media print{button{display:none}}
    </style></head><body>
    <div class="header">
      <div>
        <h2>PRÉ-VENDA</h2>
        <div style="margin-top:4px;font-size:13px;color:#555">NexusVarejo · ${new Date().toLocaleDateString('pt-BR')}</div>
      </div>
      <div style="text-align:right">
        <div class="badge">${info?.emoji || ''} ${info?.nome || p.plataforma}</div>
        <div style="font-size:14px;font-weight:900;margin-top:4px">#${p.numero_externo}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div><b>Cliente:</b> ${p.cliente_nome || '—'}</div>
      <div><b>Documento:</b> ${p.cliente_doc || '—'}</div>
      <div><b>Telefone:</b> ${p.cliente_telefone || '—'}</div>
      <div><b>Pagamento:</b> ${p.forma_pagamento || '—'}</div>
    </div>
    <table>
      <thead><tr><th>Produto</th><th>Qtd</th><th>Preço</th><th>Total</th></tr></thead>
      <tbody>${itens}</tbody>
    </table>
    <div style="text-align:right;margin-top:12px">
      <span class="total">TOTAL: R$ ${Number(p.total || 0).toFixed(2)}</span>
    </div>
    <div class="footer">
      <div>⚠ Este documento NÃO tem valor fiscal. Solicite a emissão da Nota Fiscal.</div>
      <div style="margin-top:4px">Emitido em: ${new Date().toLocaleString('pt-BR')}</div>
    </div>
    <br>
    <button onclick="window.print()" style="padding:10px 20px;background:#F97316;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">
      🖨️ Imprimir Pré-Venda
    </button>
    </body></html>`)
    w.document.close(); w.focus()
    setTimeout(() => w.print(), 400)
  }

  async function avancar(p: any) {
    const prox = FLOW[p.status]
    if (!prox) return
    setSaving(true)
    await api.put(`/marketplace/pedidos/${p.id}/status`, { status: prox })
    setPed(pp => pp.map(x => x.id === p.id ? { ...x, status: prox } : x))
    if (detalhe?.id === p.id) setDet({ ...detalhe, status: prox })
    setSaving(false)
  }

  // Filtros
  const filtrados = pedidos.filter(p => {
    const matchPlat = plat === 'TODOS' || p.plataforma === plat
    const matchSt   = stFiltro === 'TODOS' || p.status === stFiltro
    const matchBusca = !busca || p.numero_externo?.includes(busca) || p.cliente_nome?.toLowerCase().includes(busca.toLowerCase())
    return matchPlat && matchSt && matchBusca
  })

  // Separação em aberto (EM_PREPARACAO)
  const emSeparacao = pedidos.filter(p => p.status === 'EM_PREPARACAO')

  function imprimirSeparacao(lista: any[]) {
    const w = window.open('', '_blank', 'width=800,height=700')
    if (!w) return
    const linhas = lista.map((p: any) => {
      const itens = (p.itens || []).length
        ? p.itens.map((it: any) => `<li>${it.nome || it.descricao || 'Item'} — Qtd: ${it.quantidade || 1}</li>`).join('')
        : '<li>Itens não detalhados</li>'
      return `
        <div style="border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:12px;page-break-inside:avoid">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong style="font-size:15px;color:#F97316">Pedido #${p.numero_externo}</strong>
            <span style="font-size:12px;color:#888">${p.nome_plataforma || p.plataforma} · ${fmtMoeda(p.total)}</span>
          </div>
          <p style="margin:4px 0;font-size:13px"><strong>Cliente:</strong> ${p.cliente_nome || 'Não informado'}</p>
          ${p.endereco?.logradouro ? `<p style="margin:4px 0;font-size:12px;color:#555">
            📍 ${p.endereco.logradouro}, ${p.endereco.numero} — ${p.endereco.bairro} · ${p.endereco.cidade}/${p.endereco.uf}
          </p>` : ''}
          <ul style="margin:8px 0 0 16px;font-size:13px;line-height:1.8">${itens}</ul>
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #ddd;display:flex;gap:12px">
            <label style="font-size:12px">☐ Itens separados</label>
            <label style="font-size:12px">☐ Embalado</label>
            <label style="font-size:12px">☐ Etiqueta colada</label>
          </div>
        </div>`
    }).join('')
    w.document.write(`<html><head><title>Separação</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111;max-width:780px;margin:auto}
    h2{color:#F97316}@media print{button{display:none}}</style></head><body>
    <h2>📋 Relatório de Separação</h2>
    <p>Emitido em: <strong>${new Date().toLocaleString('pt-BR')}</strong> · ${lista.length} pedido(s)</p>
    ${linhas}
    <button onclick="window.print()" style="margin-top:16px;padding:10px 20px;background:#F97316;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">
      🖨️ Imprimir
    </button></body></html>`)
    w.document.close(); w.focus()
    setTimeout(() => w.print(), 400)
  }

  function imprimirEtiqueta(p: any) {
    const info = PLATS.find(x => x.key === p.plataforma)
    const cor  = info?.cor || '#F97316'
    const w = window.open('', '_blank', 'width=500,height=700')
    if (!w) return
    const end = p.endereco || {}
    w.document.write(`<html><head><title>Etiqueta #${p.numero_externo}</title>
    <style>
      @page { size: 100mm 150mm; margin: 4mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; width: 100mm; min-height: 150mm; padding: 6mm; color: #111; font-size: 10pt; }
      .topo { display: flex; justify-content: space-between; align-items: center; padding-bottom: 4mm; border-bottom: 1.5px solid #ddd; }
      .plat { font-weight: 900; font-size: 13pt; color: ${cor}; }
      .num  { font-weight: 900; font-size: 12pt; color: #333; }
      .sec  { margin-top: 4mm; }
      .sec label { font-size: 7pt; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 1mm; }
      .sec p { font-size: 11pt; font-weight: 700; color: #111; line-height: 1.4; }
      .sec .sub { font-size: 9pt; font-weight: 400; color: #555; }
      .end { background: #f9f9f9; border-radius: 4px; padding: 3mm; margin-top: 3mm; }
      .sep { border-top: 1px dashed #ccc; margin: 3mm 0; }
      .rodape { font-size: 8pt; color: #888; display: flex; justify-content: space-between; margin-top: 3mm; padding-top: 2mm; border-top: 1px solid #eee; }
      .barcode { text-align: center; margin-top: 3mm; font-family: monospace; font-size: 11pt; letter-spacing: 3px; background: #f3f4f6; padding: 2mm; border-radius: 3px; }
      @media print { button { display: none } }
    </style></head><body>
    <div class="topo">
      <div>
        <div class="plat">${info?.emoji || ''} ${info?.nome || p.plataforma}</div>
        <div style="font-size:8pt;color:#888;margin-top:1mm">Etiqueta de Entrega</div>
      </div>
      <div class="num">#${p.numero_externo}</div>
    </div>
    <div class="sec">
      <label>Destinatário</label>
      <p>${p.cliente_nome || 'Não informado'}</p>
      ${p.cliente_doc ? `<div class="sub">Doc: ${p.cliente_doc}</div>` : ''}
    </div>
    <div class="end">
      <label style="font-size:7pt;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:1mm">Endereço de Entrega</label>
      ${end.logradouro
        ? `<p style="font-size:11pt;font-weight:700;color:#111">${end.logradouro}, ${end.numero || 'S/N'}</p>
           <p style="font-size:9pt;color:#555">${end.complemento ? end.complemento + ' — ' : ''}${end.bairro || ''}</p>
           <p style="font-size:10pt;font-weight:700;color:#111;margin-top:1mm">${end.cidade || ''}${end.uf ? '/' + end.uf : ''}</p>
           ${end.cep ? `<p style="font-size:9pt;color:#666;font-family:monospace">CEP: ${end.cep}</p>` : ''}`
        : `<p style="font-size:10pt;color:#F97316">⚠ Endereço não informado</p>`
      }
    </div>
    <div class="sep"></div>
    <div style="display:flex;justify-content:space-between;font-size:9pt">
      <span>Pagamento: <strong>${p.forma_pagamento || '—'}</strong></span>
      <span>Total: <strong style="color:#22a55e">${fmtMoeda(p.total)}</strong></span>
    </div>
    <div class="barcode">${p.numero_externo?.replace(/\D/g,'').padStart(12,'0') || '000000000000'}</div>
    <div class="rodape">
      <span>NexusVarejo</span>
      <span>${new Date().toLocaleDateString('pt-BR')}</span>
    </div>
    <br>
    <button onclick="window.print()" style="width:100%;padding:8px;background:${cor};color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px">
      🖨️ Imprimir Etiqueta
    </button>
    </body></html>`)
    w.document.close(); w.focus()
    setTimeout(() => w.print(), 400)
  }

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-base font-black text-white flex items-center gap-2">
            <Package size={18} color="#F97316" /> Pedidos Marketplace
          </h1>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
            Receba, separe, embale e despache pedidos de todas as plataformas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {emSeparacao.length > 0 && (
            <button onClick={() => imprimirSeparacao(emSeparacao)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
              <ClipboardList size={12} /> Imprimir Separação ({emSeparacao.length})
            </button>
          )}
          <button onClick={load}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Plataformas */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {PLATS.map(p => (
            <button key={p.key} onClick={() => setPlat(p.key)}
              className="px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap"
              style={{ background: plat === p.key ? p.cor + (p.key === 'MERCADOLIVRE' ? '' : '') : 'var(--card)', color: plat === p.key ? (p.key === 'MERCADOLIVRE' ? '#333' : 'white') : 'var(--muted)' }}>
              {p.emoji} {p.key === 'TODOS' ? 'Todos' : p.nome.split(' ')[0]}
            </button>
          ))}
        </div>
        {/* Status */}
        <select value={stFiltro} onChange={e => setStFil(e.target.value)}
          className="px-2.5 py-1.5 text-[11px] rounded-xl"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'white' }}>
          <option value="TODOS">Todos os status</option>
          {Object.entries(SC).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {/* Busca */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl flex-1 min-w-[160px]"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <Search size={11} style={{ color: 'var(--muted)' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar pedido ou cliente..." className="flex-1 text-xs bg-transparent outline-none text-white" />
        </div>
      </div>

      {/* Contadores rápidos */}
      <div className="grid grid-cols-6 gap-1.5">
        {Object.entries(SC).map(([k, v]) => {
          const qt = pedidos.filter(p => p.status === k).length
          return (
            <button key={k} onClick={() => setStFil(stFiltro === k ? 'TODOS' : k)}
              className="rounded-xl p-2.5 text-center transition-all"
              style={{ background: stFiltro === k ? v.color + '22' : 'var(--card)', border: `1px solid ${stFiltro === k ? v.color : 'var(--border)'}` }}>
              <p className="text-lg font-black" style={{ color: v.color }}>{qt}</p>
              <p className="text-[9px] font-bold" style={{ color: 'var(--muted)' }}>{v.label}</p>
            </button>
          )
        })}
      </div>

      {/* Tabela */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Pedido</th><th>Plataforma</th><th>Cliente</th>
              <th>Total</th><th>Status</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--muted)' }}>Carregando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12" style={{ color: 'var(--muted)' }}>
                <span className="text-3xl block mb-2">📦</span>Nenhum pedido encontrado
              </td></tr>
            ) : filtrados.map(p => {
              const sc   = SC[p.status] || SC.NOVO
              const prox = FLOW[p.status]
              const info = PLATS.find(x => x.key === p.plataforma)
              return (
                <tr key={p.id}>
                  <td className="font-mono font-black text-sm" style={{ color: '#F97316' }}>
                    #{p.numero_externo}
                  </td>
                  <td>
                    <span className="text-xs font-bold">
                      {info?.emoji} {info?.nome?.split(' ')[0] || p.plataforma}
                    </span>
                  </td>
                  <td>
                    <p className="font-semibold text-white text-xs">{p.cliente_nome || '—'}</p>
                    {p.cliente_doc && <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{p.cliente_doc}</p>}
                  </td>
                  <td className="font-black text-sm" style={{ color: '#22C55E' }}>{fmtMoeda(p.total)}</td>
                  <td>
                    <span className="badge text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                  </td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => { setDet(p); setAbaDet('pedido') }}
                        className="px-2 py-1 rounded-md text-[10px] font-bold"
                        style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                        Ver
                      </button>
                      {prox && (
                        <button onClick={() => avancar(p)} disabled={saving}
                          className="px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap"
                          style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316' }}>
                          {FLOW_LABEL[p.status]}
                        </button>
                      )}
                      <button onClick={() => imprimirEtiqueta(p)}
                        className="px-2 py-1 rounded-md text-[10px] font-bold"
                        style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}>
                        <Printer size={10} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── MODAL DETALHE ──────────────────────────────────────────────────── */}
      {detalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-lg rounded-2xl flex flex-col" style={{ background: 'var(--card)', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <p className="font-black text-white">
                  {PLATS.find(x => x.key === detalhe.plataforma)?.emoji} Pedido #{detalhe.numero_externo}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{detalhe.nome_plataforma}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: SC[detalhe.status]?.bg, color: SC[detalhe.status]?.color }}>
                  {SC[detalhe.status]?.label}
                </span>
                <button onClick={() => setDet(null)} style={{ color: 'var(--muted)' }}><X size={16} /></button>
              </div>
            </div>

            {/* Sub-abas */}
            <div className="flex gap-1.5 px-5 pt-3 flex-shrink-0">
              {[{ k:'pedido', l:'Pedido', ic: Package }, { k:'etiqueta', l:'Etiqueta', ic: MapPin }].map(t => (
                <button key={t.k} onClick={() => setAbaDet(t.k as any)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold"
                  style={{ background: abaDet===t.k ? '#F97316' : 'var(--card2)', color: abaDet===t.k ? 'white' : 'var(--muted)' }}>
                  <t.ic size={11} /> {t.l}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {abaDet === 'pedido' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['Cliente',     detalhe.cliente_nome],
                      ['Documento',   detalhe.cliente_doc],
                      ['Telefone',    detalhe.cliente_telefone],
                      ['Pagamento',   detalhe.forma_pagamento],
                      ['Total',       fmtMoeda(detalhe.total)],
                      ['Observação',  detalhe.observacoes],
                    ].filter(([,v]) => v).map(([k,v], i) => (
                      <div key={i} className="rounded-xl p-2.5" style={{ background: 'var(--card2)' }}>
                        <p className="text-[9px] font-bold mb-0.5" style={{ color: 'var(--muted)' }}>{k?.toString().toUpperCase()}</p>
                        <p className="text-xs font-semibold text-white">{v as string}</p>
                      </div>
                    ))}
                  </div>

                  {/* Endereço */}
                  {detalhe.endereco && Object.keys(detalhe.endereco).length > 0 && (
                    <div className="rounded-xl p-3" style={{ background: 'var(--card2)' }}>
                      <p className="text-[9px] font-bold mb-1.5" style={{ color: 'var(--muted)' }}>ENDEREÇO DE ENTREGA</p>
                      <p className="text-xs font-bold text-white">
                        {detalhe.endereco.logradouro}, {detalhe.endereco.numero}
                        {detalhe.endereco.complemento ? ` — ${detalhe.endereco.complemento}` : ''}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        {detalhe.endereco.bairro} · {detalhe.endereco.cidade}/{detalhe.endereco.uf}
                      </p>
                      {detalhe.endereco.cep && (
                        <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--muted)' }}>CEP: {detalhe.endereco.cep}</p>
                      )}
                    </div>
                  )}

                  {/* Itens */}
                  {detalhe.itens?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold" style={{ color: 'var(--muted)' }}>ITENS DO PEDIDO</p>
                      {detalhe.itens.map((it: any, i: number) => (
                        <div key={i} className="flex justify-between items-center px-3 py-2 rounded-lg text-xs"
                          style={{ background: 'var(--card2)' }}>
                          <span className="text-white">{it.nome || it.descricao || 'Item'}</span>
                          <div className="flex items-center gap-2">
                            <span style={{ color: 'var(--muted)' }}>Qtd: {it.quantidade || 1}</span>
                            <span className="font-bold" style={{ color: '#F97316' }}>{fmtMoeda(it.preco || it.valor || 0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ações status */}
                  <div className="flex gap-2 flex-wrap">
                    {FLOW[detalhe.status] && (
                      <button onClick={() => avancar(detalhe)} disabled={saving}
                        className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-1">
                        <ChevronRight size={14} /> {FLOW_LABEL[detalhe.status]}
                      </button>
                    )}
                    <button onClick={() => imprimirSeparacao([detalhe])}
                      className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                      <ClipboardList size={12} /> Separação
                    </button>
                    <button onClick={() => setAbaDet('etiqueta')}
                      className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}>
                      <Printer size={12} /> Etiqueta
                    </button>
                  </div>

                  {/* Fiscal */}
                  <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--card2)', border: '1px solid var(--border)' }}>
                    <p className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>DOCUMENTO FISCAL</p>
                    <div className="flex gap-2">
                      <button onClick={() => imprimirPreVenda(detalhe)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold"
                        style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' }}>
                        <ClipboardList size={12} /> Pré-Venda
                      </button>
                      <button onClick={() => gerarNFe(detalhe)} disabled={savingNF}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold"
                        style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)' }}>
                        <FileText size={12} /> {savingNF ? 'Gerando...' : 'Gerar NF-e'}
                      </button>
                    </div>
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                      Pré-Venda: documento sem valor fiscal · NF-e: vai para painel de notas fiscais
                    </p>
                  </div>
                </>
              )}

              {abaDet === 'etiqueta' && (
                <div className="space-y-3">
                  {/* Preview da etiqueta */}
                  <div className="rounded-xl p-4 space-y-2" style={{ background: 'white', color: '#111', fontFamily: 'Arial' }}>
                    <div className="flex justify-between items-center pb-2" style={{ borderBottom: '1.5px solid #ddd' }}>
                      <div>
                        <p className="font-black text-base" style={{ color: PLATS.find(x=>x.key===detalhe.plataforma)?.cor || '#F97316' }}>
                          {PLATS.find(x=>x.key===detalhe.plataforma)?.emoji} {detalhe.nome_plataforma || detalhe.plataforma}
                        </p>
                        <p className="text-[10px] text-gray-400">Etiqueta de Entrega</p>
                      </div>
                      <p className="font-black text-sm text-gray-800">#{detalhe.numero_externo}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-gray-400 tracking-widest">DESTINATÁRIO</p>
                      <p className="font-black text-sm text-gray-900">{detalhe.cliente_nome || 'Não informado'}</p>
                    </div>
                    {detalhe.endereco?.logradouro ? (
                      <div className="p-2 rounded text-xs" style={{ background: '#f9fafb' }}>
                        <p className="text-[8px] font-black text-gray-400 tracking-widest mb-1">ENDEREÇO</p>
                        <p className="font-bold text-gray-800">{detalhe.endereco.logradouro}, {detalhe.endereco.numero}</p>
                        <p className="text-gray-600">{detalhe.endereco.bairro} — {detalhe.endereco.cidade}/{detalhe.endereco.uf}</p>
                        {detalhe.endereco.cep && <p className="font-mono text-gray-400 text-[10px]">CEP: {detalhe.endereco.cep}</p>}
                      </div>
                    ) : (
                      <p className="text-[10px] text-center py-1" style={{ color: '#F97316' }}>⚠ Endereço não informado</p>
                    )}
                    <div className="flex justify-between text-[10px] pt-2" style={{ borderTop: '1px solid #eee' }}>
                      <span className="text-gray-500">{detalhe.forma_pagamento} · {fmtMoeda(detalhe.total)}</span>
                      <span style={{ color: '#F97316' }}>NexusVarejo · {new Date().toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="text-center font-mono text-sm tracking-widest py-1" style={{ background: '#f3f4f6', borderRadius: 4 }}>
                      {(detalhe.numero_externo || '').replace(/\D/g,'').padStart(12,'0')}
                    </div>
                  </div>
                  <button onClick={() => imprimirEtiqueta(detalhe)}
                    className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
                    <Printer size={14} /> Imprimir Etiqueta (100×150mm)
                  </button>
                  <p className="text-[10px] text-center" style={{ color: 'var(--muted)' }}>
                    Configure sua impressora de etiqueta USB como padrão no Windows para imprimir direto no tamanho correto.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
