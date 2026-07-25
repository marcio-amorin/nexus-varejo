'use client'
import { useEffect, useRef, useState } from 'react'
import api, { fmtMoeda, fmtData } from '@/lib/api'
import {
  RefreshCw, Upload, Eye, CheckCircle2, AlertTriangle, XCircle,
  Package, Truck, FileText, ChevronDown, ChevronUp, ArrowRight,
} from 'lucide-react'

type XmlReg = {
  id: number; created_at: string; chave_nfe?: string
  numero_nf?: string; serie?: string; data_emissao?: string
  fornecedor_nome?: string; fornecedor_doc?: string; fornecedor_found: boolean
  valor_total: number; total_itens: number; itens_ok: number; itens_novos: number
  status: string; obs?: string; dados?: any
}

const STATUS_LABEL: Record<string, { label: string; cor: string; icon: any }> = {
  OK:          { label: 'OK',        cor: '#34C759', icon: CheckCircle2 },
  DIVERGENCIA: { label: 'Divergência', cor: '#F59E0B', icon: AlertTriangle },
  IMPORTADO:   { label: 'Importado', cor: '#32ADE6', icon: ArrowRight },
  REJEITADO:   { label: 'Rejeitado', cor: '#EF4444', icon: XCircle },
  PENDENTE:    { label: 'Pendente',  cor: '#6B7280', icon: RefreshCw },
}

export default function MonitorXmlPage() {
  const [lista,      setLista]      = useState<XmlReg[]>([])
  const [loading,    setLoading]    = useState(true)
  const [uploading,  setUploading]  = useState(false)
  const [expandido,  setExpandido]  = useState<number | null>(null)
  const [detalhe,    setDetalhe]    = useState<Record<number, any>>({})
  const [importando, setImportando] = useState<number | null>(null)
  const [msg,        setMsg]        = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try { const r = await api.get('/monitor-xml/'); setLista(r.data) } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function uploadXml(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    let ok = 0, dup = 0, err = 0
    for (const file of files) {
      const xml = await file.text()
      try {
        await api.post('/monitor-xml/upload', { xml })
        ok++
      } catch (ex: any) {
        if (ex.response?.status === 409) dup++
        else err++
      }
    }
    e.target.value = ''
    setMsg({
      ok: ok > 0,
      text: `${ok} importado(s)${dup ? `, ${dup} duplicado(s)` : ''}${err ? `, ${err} erro(s)` : ''}`,
    })
    setTimeout(() => setMsg(null), 4000)
    setUploading(false)
    load()
  }

  async function expandir(reg: XmlReg) {
    if (expandido === reg.id) { setExpandido(null); return }
    setExpandido(reg.id)
    if (!detalhe[reg.id]) {
      try {
        const r = await api.get(`/monitor-xml/${reg.id}`)
        setDetalhe(d => ({ ...d, [reg.id]: r.data }))
      } catch {}
    }
  }

  async function importar(reg: XmlReg) {
    setImportando(reg.id)
    try {
      const det = detalhe[reg.id] || (await api.get(`/monitor-xml/${reg.id}`)).data
      const dados = det.dados
      // Prepara itens com flags padrão para importação
      const itens = (dados?.itens || []).map((it: any) => ({
        ...it,
        criar_produto:   !it.produto_encontrado,
        margem:          30,
        atualizar_preco: true,
      }))
      // Chama confirmar-xml do nf-entrada diretamente
      await api.post('/nf-entrada/confirmar-xml', {
        dados,
        criar_fornecedor: !dados.fornecedor_encontrado,
        itens,
      })
      // Marca como importado no monitor
      await api.post(`/monitor-xml/${reg.id}/importar`, {})
      setMsg({ ok: true, text: `NF ${reg.numero_nf} importada para Lançamento!` })
      setTimeout(() => setMsg(null), 4000)
      load()
    } catch (ex: any) {
      setMsg({ ok: false, text: ex.response?.data?.detail || 'Erro ao importar' })
      setTimeout(() => setMsg(null), 4000)
    }
    setImportando(null)
  }

  async function rejeitar(id: number) {
    await api.post(`/monitor-xml/${id}/rejeitar`, { motivo: 'Rejeitado pelo usuário' })
    load()
  }

  const pendentes   = lista.filter(r => r.status === 'PENDENTE' || r.status === 'OK' || r.status === 'DIVERGENCIA')
  const processados = lista.filter(r => r.status === 'IMPORTADO' || r.status === 'REJEITADO')

  return (
    <div className="pg" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="pg-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-2">
              <FileText size={15} color="#F97316" /> Monitor XML
            </h1>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
              {pendentes.length} pendente(s) · {lista.length} no total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} style={{ color: 'var(--muted)' }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black"
              style={{ background: '#F97316', color: 'white' }}>
              {uploading ? <RefreshCw size={11} className="animate-spin" /> : <Upload size={11} />}
              Receber XML
            </button>
            <input ref={fileRef} type="file" accept=".xml" multiple className="hidden"
              onChange={uploadXml} />
          </div>
        </div>

        {msg && (
          <div className="mt-2 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
            style={{
              background: msg.ok ? '#34C75922' : '#EF444422',
              color: msg.ok ? '#34C759' : '#EF4444',
            }}>
            {msg.ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
            {msg.text}
          </div>
        )}
      </div>

      <div className="pg-body space-y-2">
        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
            <RefreshCw size={24} className="mx-auto mb-2 animate-spin opacity-30" />
          </div>
        ) : lista.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
            <Upload size={44} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-bold">Nenhum XML recebido</p>
            <p className="text-xs mt-1 opacity-60">Clique em "Receber XML" para adicionar arquivos</p>
          </div>
        ) : (
          <>
            {/* Pendentes */}
            {pendentes.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wide px-1"
                  style={{ color: 'var(--muted)' }}>Aguardando ação</p>
                {pendentes.map(reg => <CardXml key={reg.id} reg={reg}
                  expandido={expandido === reg.id}
                  detalhe={detalhe[reg.id]}
                  importando={importando === reg.id}
                  onExpandir={() => expandir(reg)}
                  onImportar={() => importar(reg)}
                  onRejeitar={() => rejeitar(reg.id)}
                />)}
              </div>
            )}

            {/* Processados */}
            {processados.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-[10px] font-black uppercase tracking-wide px-1"
                  style={{ color: 'var(--muted)' }}>Processados</p>
                {processados.map(reg => <CardXml key={reg.id} reg={reg}
                  expandido={expandido === reg.id}
                  detalhe={detalhe[reg.id]}
                  importando={false}
                  onExpandir={() => expandir(reg)}
                  onImportar={() => {}}
                  onRejeitar={() => {}}
                />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CardXml({ reg, expandido, detalhe, importando, onExpandir, onImportar, onRejeitar }: {
  reg: XmlReg; expandido: boolean; detalhe: any; importando: boolean
  onExpandir: () => void; onImportar: () => void; onRejeitar: () => void
}) {
  const st = STATUS_LABEL[reg.status] || STATUS_LABEL.PENDENTE
  const StIcon = st.icon
  const podeImportar = reg.status === 'OK'
  const temDiv       = reg.status === 'DIVERGENCIA'

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--card)', border: `1px solid ${temDiv ? '#F59E0B33' : reg.status === 'OK' ? '#34C75933' : 'var(--border)'}` }}>

      {/* Linha principal */}
      <button onClick={onExpandir} className="w-full p-3 text-left">
        <div className="flex items-center gap-3">
          {/* Ícone status */}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: st.cor + '22' }}>
            <StIcon size={14} color={st.cor} />
          </div>

          {/* Info principal */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-white">
                {reg.fornecedor_nome || 'Fornecedor desconhecido'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: st.cor + '22', color: st.cor }}>
                {st.label}
              </span>
              {!reg.fornecedor_found && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: '#EF444422', color: '#EF4444' }}>
                  Fornecedor novo
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                NF {reg.numero_nf}-{reg.serie}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                {reg.data_emissao}
              </span>
              <span className="text-[10px] font-bold text-white">
                {fmtMoeda(reg.valor_total)}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                {reg.total_itens} item(s)
              </span>
              {reg.itens_novos > 0 && (
                <span className="text-[10px] font-bold" style={{ color: '#F59E0B' }}>
                  ⚠ {reg.itens_novos} produto(s) novo(s)
                </span>
              )}
            </div>
          </div>

          {expandido ? <ChevronUp size={14} color="var(--muted)" /> : <ChevronDown size={14} color="var(--muted)" />}
        </div>
      </button>

      {/* Detalhe expandido */}
      {expandido && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {/* Produtos */}
          <div className="p-3 space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-wide mb-2"
              style={{ color: 'var(--muted)' }}>Produtos no XML</p>

            {detalhe?.dados?.itens ? detalhe.dados.itens.map((it: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-xl"
                style={{ background: 'var(--card2)', border: `1px solid ${it.produto_encontrado ? '#34C75922' : '#F59E0B33'}` }}>
                <div className="flex-shrink-0">
                  {it.produto_encontrado
                    ? <CheckCircle2 size={12} color="#34C759" />
                    : <AlertTriangle size={12} color="#F59E0B" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{it.descricao}</p>
                  <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                    {it.quantidade} {it.unidade} × {fmtMoeda(it.preco_unitario)}
                    {!it.produto_encontrado && <span style={{ color: '#F59E0B' }}> — Produto não cadastrado</span>}
                  </p>
                </div>
                <span className="text-xs font-black text-white flex-shrink-0">
                  {fmtMoeda(it.valor_total)}
                </span>
              </div>
            )) : (
              <div className="text-center py-4" style={{ color: 'var(--muted)' }}>
                <RefreshCw size={16} className="mx-auto animate-spin" />
              </div>
            )}
          </div>

          {/* Ações */}
          {(podeImportar || temDiv || reg.status === 'PENDENTE') && (
            <div className="px-3 pb-3 flex gap-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              {temDiv && (
                <div className="flex-1 px-3 py-2 rounded-xl text-xs"
                  style={{ background: '#F59E0B11', border: '1px solid #F59E0B33', color: '#F59E0B' }}>
                  ⚠ Resolva as divergências antes de importar: cadastre os produtos/fornecedor novo e importe novamente.
                </div>
              )}
              {podeImportar && (
                <>
                  <button onClick={onRejeitar}
                    className="px-3 py-2 rounded-xl text-xs font-bold"
                    style={{ background: '#EF444422', color: '#EF4444' }}>
                    Rejeitar
                  </button>
                  <button onClick={onImportar} disabled={importando}
                    className="flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5"
                    style={{ background: 'linear-gradient(135deg,#34C759,#16a34a)', color: 'white' }}>
                    {importando
                      ? <RefreshCw size={11} className="animate-spin" />
                      : <ArrowRight size={11} />}
                    Importar para Lançamento NF
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
