'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import { Plus, Edit2, Trash2, X, Check, Star, RefreshCw, Search } from 'lucide-react'

const REGIMES = [
  { key: 'SIMPLES_NACIONAL', label: 'Simples Nacional', cor: '#34C759' },
  { key: 'LUCRO_PRESUMIDO',  label: 'Lucro Presumido',  cor: '#F59E0B' },
  { key: 'LUCRO_REAL',       label: 'Lucro Real',       cor: '#3B82F6' },
]

const REGIME_DESC: Record<string, string> = {
  SIMPLES_NACIONAL: 'PIS/COFINS incluídos no DAS. CST = CSOSN (400, 500, etc.)',
  LUCRO_PRESUMIDO:  'PIS 0,65% · COFINS 3,00% cumulativos',
  LUCRO_REAL:       'PIS 1,65% · COFINS 7,60% não-cumulativos',
}

const BLANK = {
  regime: 'SIMPLES_NACIONAL', nome: '', icms_aliquota: 0, pis_aliquota: 0,
  cofins_aliquota: 0, csll_aliquota: 0, irpj_aliquota: 0,
  cfop_padrao: '5102', cst_icms: '000', csosn: '400', is_default: false,
}

export default function ImpostosPage() {
  const [lista, setLista]       = useState<any[]>([])
  const [regime, setRegime]     = useState('SIMPLES_NACIONAL')
  const [empresa, setEmpresa]   = useState<any>(null)
  const [showForm, setShow]     = useState(false)
  const [editando, setEdit]     = useState<any>(null)
  const [form, setForm]         = useState<any>(BLANK)
  const [saving, setSaving]     = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [ncmBusca, setNcmBusca]   = useState('')
  const [ncmResult, setNcmResult] = useState<any>(null)
  const [ncmLoading, setNcmLoading] = useState(false)
  const [showNcm, setShowNcm]     = useState(false)

  async function load() {
    const [ri, re] = await Promise.all([api.get('/fiscal/impostos'), api.get('/fiscal/empresa')])
    setLista(ri.data); setEmpresa(re.data)
  }
  useEffect(() => { load() }, [])

  function abrirNovo() {
    setEdit(null); setForm({ ...BLANK, regime })
    setShow(true)
  }
  function abrirEditar(item: any) {
    setEdit(item); setForm({ ...item })
    setShow(true)
  }

  async function salvar() {
    if (!form.nome) return
    setSaving(true)
    try {
      if (editando) await api.put(`/fiscal/impostos/${editando.id}`, form)
      else          await api.post('/fiscal/impostos', form)
      setShow(false); load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }

  async function aplicarRegimeProdutos(apenasVazios = false) {
    const msg = apenasVazios
      ? `Aplicar alíquotas do regime ${REGIMES.find(r=>r.key===regime)?.label} apenas em produtos SEM dados fiscais?`
      : `Aplicar alíquotas do regime ${REGIMES.find(r=>r.key===regime)?.label} em TODOS os produtos ativos?\n\nIsso irá sobrescrever CFOP, CST/CSOSN e alíquotas de todos os produtos.`
    if (!confirm(msg)) return
    setAplicando(true)
    try {
      const r = await api.post('/fiscal/aplicar-regime', { regime, apenas_sem_ncm: apenasVazios })
      alert(`✅ ${r.data.produtos_atualizados} produtos atualizados com as alíquotas do regime ${REGIMES.find(x=>x.key===regime)?.label}.`)
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro ao aplicar') }
    setAplicando(false)
  }

  async function aplicarTabelaProdutos(id: number, nome: string) {
    if (!confirm(`Aplicar a tabela "${nome}" em todos os produtos ativos?`)) return
    setAplicando(true)
    try {
      const r = await api.post(`/fiscal/aplicar-imposto/${id}`)
      alert(`✅ ${r.data.produtos_atualizados} produtos atualizados com a tabela "${nome}".`)
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setAplicando(false)
  }

  async function buscarNCM() {
    if (!ncmBusca.replace(/\D/g,'')) return
    setNcmLoading(true); setNcmResult(null)
    try {
      const r = await api.get(`/fiscal/ncm/${ncmBusca.replace(/\D/g,'')}`)
      setNcmResult(r.data)
    } catch { setNcmResult({ erro: 'Não encontrado' }) }
    setNcmLoading(false)
  }

  async function excluir(id: number) {
    if (!confirm('Excluir configuração?')) return
    await api.delete(`/fiscal/impostos/${id}`)
    load()
  }

  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }))
  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"
  const nInp = "w-full px-2.5 py-2 text-xs rounded-lg text-right"
  const listaFiltrada = lista.filter(i => i.regime === regime)
  const regAtual = REGIMES.find(r => r.key === regime)

  return (
    <div className="pg">
      <div className="pg-header space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-black text-white">Configuração de Impostos</h1>
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
              Alíquotas padrão por regime · usadas no cadastro de produtos
              {empresa && <span> · Regime atual: <strong style={{ color: regAtual?.cor }}>{REGIMES.find(r => r.key === empresa.regime_tributario)?.label}</strong></span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowNcm(v => !v)}
              className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-xl font-bold"
              style={{ background:'#8B5CF622', color:'#8B5CF6', border:'1px solid #8B5CF633' }}>
              <Search size={12} /> Consultar NCM
            </button>
            <button onClick={() => aplicarRegimeProdutos(true)} disabled={aplicando}
              className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-xl font-bold"
              style={{ background:'#34C75922', color:'#34C759', border:'1px solid #34C75933' }}>
              <RefreshCw size={12} /> Preencher Vazios
            </button>
            <button onClick={() => aplicarRegimeProdutos(false)} disabled={aplicando}
              className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-xl font-bold"
              style={{ background:'#F9731622', color:'#F97316', border:'1px solid #F9731633' }}>
              <RefreshCw size={12} /> Aplicar a Todos
            </button>
            <button onClick={abrirNovo} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3">
              <Plus size={12} /> Nova Config
            </button>
          </div>
        </div>

        {/* Tabs regime */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--card2)' }}>
          {REGIMES.map(r => (
            <button key={r.key} onClick={() => setRegime(r.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: regime === r.key ? r.cor + '22' : 'transparent',
                color: regime === r.key ? r.cor : 'var(--muted)',
                border: regime === r.key ? `1px solid ${r.cor}44` : '1px solid transparent',
              }}>
              {r.label}
              {empresa?.regime_tributario === r.key && <span className="ml-1 text-[8px]">●</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="pg-body">
        {/* Painel NCM */}
        {showNcm && (
          <div className="px-4 py-3 flex-shrink-0 space-y-2" style={{ borderBottom: '1px solid var(--border)', background: '#8B5CF60D' }}>
            <p className="text-xs font-black" style={{ color: '#8B5CF6' }}>🔍 Consultar NCM — BrasilAPI</p>
            <div className="flex gap-2">
              <input value={ncmBusca} onChange={e => setNcmBusca(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarNCM()}
                className="flex-1 px-3 py-2 text-sm rounded-xl"
                style={{ background: 'var(--input)', border: '1px solid #8B5CF644', color: 'var(--text)' }}
                placeholder="Ex: 12345678 ou 1234.56.78" maxLength={10} />
              <button onClick={buscarNCM} disabled={ncmLoading}
                className="px-4 py-2 rounded-xl text-xs font-black"
                style={{ background: '#8B5CF6', color: 'white', opacity: ncmLoading ? 0.5 : 1 }}>
                {ncmLoading ? '...' : 'Buscar'}
              </button>
            </div>
            {ncmResult && (
              <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: 'var(--card2)', border: '1px solid var(--border)' }}>
                {ncmResult.erro ? (
                  <p style={{ color: '#EF4444' }}>⚠ {ncmResult.erro}</p>
                ) : (
                  <>
                    <p className="font-black text-white">NCM {ncmResult.ncm} — {ncmResult.descricao}</p>
                    {ncmResult.aliquotas_sugeridas && (
                      <div className="mt-1 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                        <p className="text-[10px] font-bold" style={{ color: '#8B5CF6' }}>ALÍQUOTAS SUGERIDAS ({ncmResult.aliquotas_sugeridas.regime})</p>
                        <div className="flex gap-4 mt-0.5 text-[10px]" style={{ color: 'var(--muted)' }}>
                          <span>CFOP: <strong style={{ color: 'white' }}>{ncmResult.aliquotas_sugeridas.cfop_saida}</strong></span>
                          <span>ICMS: <strong style={{ color: '#F59E0B' }}>{ncmResult.aliquotas_sugeridas.icms_aliquota}%</strong></span>
                          <span>PIS: <strong style={{ color: '#32ADE6' }}>{ncmResult.aliquotas_sugeridas.pis_aliquota}%</strong></span>
                          <span>COFINS: <strong style={{ color: '#32ADE6' }}>{ncmResult.aliquotas_sugeridas.cofins_aliquota}%</strong></span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Info do regime */}
        <div className="px-4 py-2 flex-shrink-0 flex items-center gap-2"
          style={{ background: regAtual?.cor + '0D', borderBottom: `1px solid ${regAtual?.cor}22` }}>
          <span className="text-xs font-bold" style={{ color: regAtual?.cor }}>{regAtual?.label}</span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>— {REGIME_DESC[regime]}</span>
          {aplicando && <span className="text-xs ml-auto" style={{ color: '#F97316' }}>⏳ Aplicando...</span>}
        </div>

        <table className="tbl">
          <thead>
            <tr>
              {['','Nome','CFOP','CST/CSOSN','ICMS %','PIS %','COFINS %','CSLL %','IRPJ %','Aplicar',''].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10" style={{ color: 'var(--muted)' }}>
                Nenhuma configuração — clique em "Nova Config"
              </td></tr>
            ) : listaFiltrada.map(i => (
              <tr key={i.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-white/5">
                <td className="px-3 py-2 w-8">
                  {i.is_default && <Star size={11} color="#F59E0B" fill="#F59E0B" />}
                </td>
                <td className="px-3 py-2">
                  <p className="font-semibold text-white text-xs">{i.nome}</p>
                  {i.is_default && <p className="text-[9px]" style={{ color: '#F59E0B' }}>Padrão do regime</p>}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-white">{i.cfop_padrao}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  <span style={{ color: regime === 'SIMPLES_NACIONAL' ? '#34C759' : '#32ADE6' }}>
                    {regime === 'SIMPLES_NACIONAL' ? i.csosn : i.cst_icms}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-bold" style={{ color: i.icms_aliquota > 0 ? '#F59E0B' : 'var(--muted)' }}>
                  {i.icms_aliquota.toFixed(2)}%
                </td>
                <td className="px-3 py-2 text-right" style={{ color: i.pis_aliquota > 0 ? '#32ADE6' : 'var(--muted)' }}>
                  {i.pis_aliquota.toFixed(2)}%
                </td>
                <td className="px-3 py-2 text-right" style={{ color: i.cofins_aliquota > 0 ? '#32ADE6' : 'var(--muted)' }}>
                  {i.cofins_aliquota.toFixed(2)}%
                </td>
                <td className="px-3 py-2 text-right" style={{ color: 'var(--muted)' }}>{i.csll_aliquota.toFixed(2)}%</td>
                <td className="px-3 py-2 text-right" style={{ color: 'var(--muted)' }}>{i.irpj_aliquota.toFixed(2)}%</td>
                <td className="px-3 py-2">
                  <button onClick={() => aplicarTabelaProdutos(i.id, i.nome)} disabled={aplicando}
                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg"
                    style={{ background: '#F9731622', color: '#F97316', border: '1px solid #F9731633', opacity: aplicando ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                    <RefreshCw size={9} /> Aplicar
                  </button>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => abrirEditar(i)}
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ background: '#32ADE622', color: '#32ADE6' }}>
                      <Edit2 size={10} />
                    </button>
                    <button onClick={() => excluir(i.id)}
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ background: '#FF3B3022', color: '#FF3B30' }}>
                      <Trash2 size={10} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-lg rounded-3xl flex flex-col"
            style={{ background: 'var(--card)', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="font-black text-white">{editando ? 'Editar' : 'Nova'} Configuração de Imposto</p>
              <button onClick={() => setShow(false)} style={{ color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>REGIME</label>
                <div className="flex gap-1">
                  {REGIMES.map(r => (
                    <button key={r.key} onClick={() => f('regime', r.key)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold"
                      style={{ background: form.regime === r.key ? r.cor + '22' : 'var(--card2)', color: form.regime === r.key ? r.cor : 'var(--muted)' }}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>NOME DA CONFIGURAÇÃO *</label>
                <input value={form.nome} onChange={e => f('nome', e.target.value)} className={inp}
                  placeholder="Ex: Tributação padrão, Produtos ST, Isentos..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>CFOP PADRÃO SAÍDA</label>
                  <select value={form.cfop_padrao} onChange={e => f('cfop_padrao', e.target.value)} className={inp}>
                    {[['5102','5102 — Venda merc. 3°s (Estado)'],['5405','5405 — Venda merc. ST (Estado)'],
                      ['6102','6102 — Venda merc. 3°s (Interest.)'],['6404','6404 — Venda merc. ST (Interest.)'],
                      ['5903','5903 — Retorno de mercadoria']].map(([v,l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>
                    {form.regime === 'SIMPLES_NACIONAL' ? 'CSOSN' : 'CST ICMS'}
                  </label>
                  {form.regime === 'SIMPLES_NACIONAL' ? (
                    <select value={form.csosn} onChange={e => f('csosn', e.target.value)} className={inp}>
                      {[['101','101 — Trib. SN com crédito'],['102','102 — Trib. SN sem crédito'],
                        ['300','300 — Imune'],['400','400 — Não tributada'],
                        ['500','500 — ICMS cobra ant. ST'],['900','900 — Outros']].map(([v,l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  ) : (
                    <select value={form.cst_icms} onChange={e => f('cst_icms', e.target.value)} className={inp}>
                      {[['000','000 — Tributada integralmente'],['010','010 — Trib. com cobrança ST'],
                        ['020','020 — Com redução de BC'],['040','040 — Isenta'],
                        ['041','041 — Não tributada'],['060','060 — ICMS cobra ant. ST'],
                        ['070','070 — Com redução BC e ST'],['090','090 — Outras']].map(([v,l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Alíquotas */}
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: 'var(--muted)' }}>ALÍQUOTAS (%)</p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { k: 'icms_aliquota',   l: 'ICMS',   cor: '#F59E0B' },
                    { k: 'pis_aliquota',    l: 'PIS',    cor: '#32ADE6' },
                    { k: 'cofins_aliquota', l: 'COFINS', cor: '#32ADE6' },
                    { k: 'csll_aliquota',   l: 'CSLL',   cor: '#8B5CF6' },
                    { k: 'irpj_aliquota',   l: 'IRPJ',   cor: '#EC4899' },
                  ].map(({ k, l, cor }) => (
                    <div key={k} className="text-center">
                      <label className="block text-[10px] font-black mb-1" style={{ color: cor }}>{l}</label>
                      <input type="number" step="0.01" min="0" max="100"
                        value={form[k]} onChange={e => f(k, parseFloat(e.target.value) || 0)}
                        className={nInp}
                        style={{ background: 'var(--card2)', color: 'white', border: `1px solid ${cor}44` }} />
                    </div>
                  ))}
                </div>
                {form.regime === 'SIMPLES_NACIONAL' && (
                  <p className="text-[10px] mt-2" style={{ color: 'var(--muted)' }}>
                    No Simples Nacional, PIS/COFINS/CSLL/IRPJ são recolhidos via DAS — mantenha como 0.
                  </p>
                )}
              </div>

              {/* Padrão */}
              <div className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
                style={{ background: 'var(--card2)' }}
                onClick={() => f('is_default', !form.is_default)}>
                <div className="w-4 h-4 rounded flex items-center justify-center"
                  style={{ background: form.is_default ? '#F59E0B' : 'var(--card)', border: form.is_default ? 'none' : '1px solid var(--border)' }}>
                  {form.is_default && <Check size={9} color="white" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Definir como padrão do regime</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Usado ao criar novos produtos</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={salvar} disabled={saving || !form.nome} className="btn-primary w-full py-3">
                {saving ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Criar Configuração'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
