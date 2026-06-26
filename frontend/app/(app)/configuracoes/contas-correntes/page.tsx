'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import { Plus, Edit2, Trash2, RefreshCw, CreditCard, TrendingUp, TrendingDown, Building2, BarChart2 } from 'lucide-react'

const TIPOS = ['CORRENTE','POUPANCA','CAIXA','PIX']
const MODALIDADES = ['DEBITO','CREDITO_1X','CREDITO_2A6','CREDITO_7A12']
const MOD_LABEL: Record<string,string> = {
  DEBITO:'Débito', CREDITO_1X:'Crédito 1x', CREDITO_2A6:'Crédito 2-6x', CREDITO_7A12:'Crédito 7-12x'
}
const ICONES = ['🏦','💰','💳','📱','🏧','💵','🪙','🏪']
const CORES  = ['#6366f1','#34C759','#32ADE6','#FF9F0A','#EF4444','#8B5CF6','#00B37E','#AF52DE']

type Conta = {
  id:number; nome:string; banco:string; agencia:string; conta:string; tipo:string
  saldo_inicial:number; saldo_atual:number; ativo:boolean; cor:string; icone:string; observacoes:string
}
type Mov = {
  id:number; tipo:string; valor:number; saldo_apos:number; descricao:string; data:string; origem:string
}
type Taxa = {
  id:number; nome:string; bandeira:string; modalidade:string; taxa_pct:number
  prazo_liquidacao:number; conta_id:number|null; conta_nome:string|null; ativo:boolean
}

const BLANK_CONTA = { nome:'', banco:'', agencia:'', conta:'', tipo:'CORRENTE', saldo_inicial:0, ativo:true, cor:'#6366f1', icone:'🏦', observacoes:'' }
const BLANK_TAXA  = { nome:'', bandeira:'', modalidade:'DEBITO', taxa_pct:0, prazo_liquidacao:1, conta_id:null as number|null, ativo:true }
const BLANK_MOV   = { conta_id:0, tipo:'ENTRADA', valor:0, descricao:'', data:'', origem:'MANUAL' }

export default function ContasCorrentesPage() {
  const [aba, setAba] = useState<'contas'|'taxas'>('contas')
  const [contas, setContas]   = useState<Conta[]>([])
  const [taxas, setTaxas]     = useState<Taxa[]>([])
  const [movs, setMovs]       = useState<Mov[]>([])
  const [contaSel, setContaSel] = useState<Conta|null>(null)
  const [loading, setLoading] = useState(false)

  // modais
  const [modalConta, setModalConta] = useState(false)
  const [modalTaxa,  setModalTaxa]  = useState(false)
  const [modalMov,   setModalMov]   = useState(false)
  const [editConta,  setEditConta]  = useState<Partial<Conta>>(BLANK_CONTA)
  const [editTaxa,   setEditTaxa]   = useState<Partial<Taxa>>(BLANK_TAXA)
  const [formMov,    setFormMov]    = useState<typeof BLANK_MOV>({...BLANK_MOV, data: new Date().toISOString().slice(0,10)})
  const [saving, setSaving] = useState(false)

  async function loadContas() {
    setLoading(true)
    try { setContas((await api.get('/contas-correntes')).data) } catch {}
    setLoading(false)
  }
  async function loadTaxas() {
    try { setTaxas((await api.get('/contas-correntes/taxas-cartao')).data) } catch {}
  }
  async function loadMovs(cid: number) {
    try { setMovs((await api.get(`/contas-correntes/${cid}/movimentos`)).data) } catch {}
  }

  useEffect(() => { loadContas(); loadTaxas() }, [])

  function abrirNovaConta()  { setEditConta({...BLANK_CONTA}); setModalConta(true) }
  function abrirEditConta(c: Conta) { setEditConta({...c}); setModalConta(true) }
  function abrirNovaTaxa()   { setEditTaxa({...BLANK_TAXA}); setModalTaxa(true) }
  function abrirEditTaxa(t: Taxa) { setEditTaxa({...t}); setModalTaxa(true) }

  async function salvarConta() {
    setSaving(true)
    try {
      const payload = {
        nome: editConta.nome, banco: editConta.banco||'', agencia: editConta.agencia||'',
        conta: editConta.conta||'', tipo: editConta.tipo||'CORRENTE',
        saldo_inicial: Number(editConta.saldo_inicial)||0,
        ativo: editConta.ativo !== false,
        cor: editConta.cor||'#6366f1', icone: editConta.icone||'🏦',
        observacoes: editConta.observacoes||'',
      }
      if (editConta.id) await api.put(`/contas-correntes/${editConta.id}`, payload)
      else              await api.post('/contas-correntes', payload)
      setModalConta(false); loadContas()
    } catch(e:any){ alert(e.response?.data?.detail||'Erro') }
    setSaving(false)
  }

  async function excluirConta(id: number) {
    if (!confirm('Excluir esta conta?')) return
    await api.delete(`/contas-correntes/${id}`); loadContas()
    if (contaSel?.id === id) setContaSel(null)
  }

  async function salvarTaxa() {
    setSaving(true)
    try {
      const payload = {
        nome: editTaxa.nome, bandeira: editTaxa.bandeira||'',
        modalidade: editTaxa.modalidade||'DEBITO',
        taxa_pct: Number(editTaxa.taxa_pct)||0,
        prazo_liquidacao: Number(editTaxa.prazo_liquidacao)||1,
        conta_id: editTaxa.conta_id||null,
        ativo: editTaxa.ativo !== false,
      }
      if (editTaxa.id) await api.put(`/contas-correntes/taxas-cartao/${editTaxa.id}`, payload)
      else             await api.post('/contas-correntes/taxas-cartao', payload)
      setModalTaxa(false); loadTaxas()
    } catch(e:any){ alert(e.response?.data?.detail||'Erro') }
    setSaving(false)
  }

  async function excluirTaxa(id: number) {
    if (!confirm('Excluir esta taxa?')) return
    await api.delete(`/contas-correntes/taxas-cartao/${id}`); loadTaxas()
  }

  async function salvarMov() {
    setSaving(true)
    try {
      await api.post('/contas-correntes/movimentos', {
        conta_id: formMov.conta_id, tipo: formMov.tipo,
        valor: Number(formMov.valor), descricao: formMov.descricao,
        data: formMov.data, origem: 'MANUAL',
      })
      setModalMov(false); loadContas()
      if (contaSel) loadMovs(contaSel.id)
    } catch(e:any){ alert(e.response?.data?.detail||'Erro') }
    setSaving(false)
  }

  function abrirMovimentos(c: Conta) {
    setContaSel(c); loadMovs(c.id)
  }

  const totalSaldo = contas.filter(c => c.ativo).reduce((s,c) => s + (c.saldo_atual||0), 0)

  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between">
        <div>
          <h1 className="text-base font-black text-white">Contas Correntes</h1>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
            Saldo consolidado: <span className="font-black" style={{ color: '#34C759' }}>{fmtMoeda(totalSaldo)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { loadContas(); loadTaxas() }} style={{ color: 'var(--muted)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {aba === 'contas' && (
            <button onClick={abrirNovaConta}
              className="btn-primary text-xs flex items-center gap-1">
              <Plus size={12} /> Nova Conta
            </button>
          )}
          {aba === 'taxas' && (
            <button onClick={abrirNovaTaxa}
              className="btn-primary text-xs flex items-center gap-1">
              <Plus size={12} /> Nova Taxa
            </button>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 px-1">
        {[{k:'contas',l:'Contas'},{k:'taxas',l:'Taxas de Cartão'}].map(t => (
          <button key={t.k} onClick={() => setAba(t.k as any)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: aba===t.k ? '#6366f1' : 'var(--card2)', color: aba===t.k ? 'white' : 'var(--muted)' }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ABA CONTAS */}
      {aba === 'contas' && (
        <div className="pg-body">
          {contaSel ? (
            /* Extrato da conta */
            <div>
              <div className="flex items-center gap-3 mb-3">
                <button onClick={() => setContaSel(null)}
                  className="text-xs px-2 py-1 rounded-lg" style={{ background:'var(--card2)', color:'var(--muted)' }}>
                  ← Voltar
                </button>
                <div>
                  <p className="font-black text-white">{contaSel.icone} {contaSel.nome}</p>
                  <p className="text-xs" style={{ color:'var(--muted)' }}>Saldo atual: <span className="font-black" style={{ color:'#34C759' }}>{fmtMoeda(contaSel.saldo_atual)}</span></p>
                </div>
                <button onClick={() => {
                  setFormMov({...BLANK_MOV, conta_id: contaSel.id, data: new Date().toISOString().slice(0,10)})
                  setModalMov(true)
                }} className="ml-auto btn-primary text-xs flex items-center gap-1">
                  <Plus size={12} /> Lançamento
                </button>
              </div>
              <div className="space-y-1">
                {movs.length === 0 && <p className="text-center py-8 text-xs" style={{ color:'var(--muted)' }}>Nenhum movimento</p>}
                {movs.map(m => (
                  <div key={m.id} className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: m.tipo==='ENTRADA' ? '#34C75922' : '#EF444422' }}>
                      {m.tipo==='ENTRADA' ? <TrendingUp size={12} color="#34C759" /> : <TrendingDown size={12} color="#EF4444" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">{m.descricao}</p>
                      <p className="text-[10px]" style={{ color:'var(--muted)' }}>
                        {m.data} · {m.origem}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-sm" style={{ color: m.tipo==='ENTRADA' ? '#34C759' : '#EF4444' }}>
                        {m.tipo==='ENTRADA' ? '+' : '-'}{fmtMoeda(m.valor)}
                      </p>
                      <p className="text-[10px]" style={{ color:'var(--muted)' }}>Saldo: {fmtMoeda(m.saldo_apos)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Lista de contas */
            <div className="space-y-2">
              {contas.length === 0 && !loading && (
                <div className="text-center py-12" style={{ color:'var(--muted)' }}>
                  <Building2 size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Nenhuma conta cadastrada</p>
                </div>
              )}
              {contas.map(c => (
                <div key={c.id} className="rounded-2xl p-4"
                  style={{ background:'var(--card)', border:`1px solid ${c.ativo ? 'var(--border)' : '#EF444433'}` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: c.cor+'22' }}>
                      {c.icone}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-white">{c.nome}</p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background: c.ativo ? '#34C75922' : '#EF444422', color: c.ativo ? '#34C759' : '#EF4444' }}>
                          {c.tipo}
                        </span>
                      </div>
                      {c.banco && <p className="text-xs" style={{ color:'var(--muted)' }}>{c.banco}{c.agencia ? ` · Ag. ${c.agencia}` : ''}{c.conta ? ` · CC ${c.conta}` : ''}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-black" style={{ color: (c.saldo_atual||0) >= 0 ? '#34C759' : '#EF4444' }}>
                        {fmtMoeda(c.saldo_atual)}
                      </p>
                      <p className="text-[10px]" style={{ color:'var(--muted)' }}>saldo atual</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => abrirMovimentos(c)}
                      className="flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                      style={{ background:'#6366f122', color:'#6366f1' }}>
                      <BarChart2 size={11} /> Extrato
                    </button>
                    <button onClick={() => abrirEditConta(c)}
                      className="px-3 py-1.5 rounded-xl text-xs" style={{ background:'var(--card2)', color:'var(--muted)' }}>
                      <Edit2 size={11} />
                    </button>
                    <button onClick={() => excluirConta(c.id)}
                      className="px-3 py-1.5 rounded-xl text-xs" style={{ background:'#EF444422', color:'#EF4444' }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA TAXAS */}
      {aba === 'taxas' && (
        <div className="pg-body space-y-2">
          {taxas.length === 0 && (
            <div className="text-center py-12" style={{ color:'var(--muted)' }}>
              <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
              <p>Nenhuma taxa cadastrada</p>
            </div>
          )}
          {taxas.map(t => (
            <div key={t.id} className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-black text-white">{t.nome}</p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background:'#32ADE622', color:'#32ADE6' }}>
                    {MOD_LABEL[t.modalidade]||t.modalidade}
                  </span>
                  {!t.ativo && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background:'#EF444422', color:'#EF4444' }}>INATIVA</span>}
                </div>
                <p className="text-xs mt-0.5" style={{ color:'var(--muted)' }}>
                  {t.bandeira && `${t.bandeira} · `}
                  <span className="font-bold text-white">{t.taxa_pct?.toFixed(2)}%</span>
                  {' · '}{t.prazo_liquidacao}d liquidação
                  {t.conta_nome && ` · ${t.conta_nome}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => abrirEditTaxa(t)}
                  className="px-3 py-1.5 rounded-xl text-xs" style={{ background:'var(--card2)', color:'var(--muted)' }}>
                  <Edit2 size={11} />
                </button>
                <button onClick={() => excluirTaxa(t.id)}
                  className="px-3 py-1.5 rounded-xl text-xs" style={{ background:'#EF444422', color:'#EF4444' }}>
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CONTA */}
      {modalConta && (
        <div className="modal-overlay" onClick={() => setModalConta(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editConta.id ? 'Editar Conta' : 'Nova Conta'}</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="field-label">Nome *</label>
                  <input className="field-input" value={editConta.nome||''} onChange={e => setEditConta(f => ({...f, nome:e.target.value}))} />
                </div>
                <div>
                  <label className="field-label">Banco</label>
                  <input className="field-input" value={editConta.banco||''} onChange={e => setEditConta(f => ({...f, banco:e.target.value}))} />
                </div>
                <div>
                  <label className="field-label">Tipo</label>
                  <select className="field-input" value={editConta.tipo||'CORRENTE'} onChange={e => setEditConta(f => ({...f, tipo:e.target.value}))}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Agência</label>
                  <input className="field-input" value={editConta.agencia||''} onChange={e => setEditConta(f => ({...f, agencia:e.target.value}))} />
                </div>
                <div>
                  <label className="field-label">Nº Conta</label>
                  <input className="field-input" value={editConta.conta||''} onChange={e => setEditConta(f => ({...f, conta:e.target.value}))} />
                </div>
                <div>
                  <label className="field-label">Saldo Inicial (R$)</label>
                  <input type="number" step="0.01" className="field-input" value={editConta.saldo_inicial||0} onChange={e => setEditConta(f => ({...f, saldo_inicial:Number(e.target.value)}))} />
                </div>
                <div className="flex items-center gap-2 col-span-2 pt-1">
                  <input type="checkbox" id="cc-ativo" checked={editConta.ativo !== false} onChange={e => setEditConta(f => ({...f, ativo:e.target.checked}))} />
                  <label htmlFor="cc-ativo" className="text-xs" style={{ color:'var(--muted)' }}>Conta ativa</label>
                </div>
              </div>
              {/* Ícone e Cor */}
              <div>
                <label className="field-label">Ícone</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {ICONES.map(i => (
                    <button key={i} onClick={() => setEditConta(f=>({...f,icone:i}))}
                      className="w-8 h-8 rounded-lg text-lg flex items-center justify-center"
                      style={{ background: editConta.icone===i ? '#6366f133' : 'var(--card2)', border: editConta.icone===i ? '1px solid #6366f1' : '1px solid transparent' }}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="field-label">Cor</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {CORES.map(c => (
                    <button key={c} onClick={() => setEditConta(f=>({...f,cor:c}))}
                      className="w-6 h-6 rounded-full"
                      style={{ background:c, outline: editConta.cor===c ? `2px solid ${c}` : 'none', outlineOffset:2 }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setModalConta(false)} className="btn-secondary text-xs">Cancelar</button>
              <button onClick={salvarConta} disabled={saving||!editConta.nome} className="btn-primary text-xs">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAXA */}
      {modalTaxa && (
        <div className="modal-overlay" onClick={() => setModalTaxa(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editTaxa.id ? 'Editar Taxa' : 'Nova Taxa de Cartão'}</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="field-label">Nome *</label>
                  <input className="field-input" placeholder="Ex: Cielo Débito VISA" value={editTaxa.nome||''} onChange={e => setEditTaxa(f => ({...f, nome:e.target.value}))} />
                </div>
                <div>
                  <label className="field-label">Bandeira</label>
                  <input className="field-input" placeholder="VISA / MASTER / ELO..." value={editTaxa.bandeira||''} onChange={e => setEditTaxa(f => ({...f, bandeira:e.target.value}))} />
                </div>
                <div>
                  <label className="field-label">Modalidade</label>
                  <select className="field-input" value={editTaxa.modalidade||'DEBITO'} onChange={e => setEditTaxa(f => ({...f, modalidade:e.target.value}))}>
                    {MODALIDADES.map(m => <option key={m} value={m}>{MOD_LABEL[m]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Taxa (%)</label>
                  <input type="number" step="0.01" className="field-input" value={editTaxa.taxa_pct||0} onChange={e => setEditTaxa(f => ({...f, taxa_pct:Number(e.target.value)}))} />
                </div>
                <div>
                  <label className="field-label">Prazo Liquidação (dias)</label>
                  <input type="number" className="field-input" value={editTaxa.prazo_liquidacao||1} onChange={e => setEditTaxa(f => ({...f, prazo_liquidacao:Number(e.target.value)}))} />
                </div>
                <div className="col-span-2">
                  <label className="field-label">Conta Destino</label>
                  <select className="field-input" value={editTaxa.conta_id||''} onChange={e => setEditTaxa(f => ({...f, conta_id:e.target.value ? Number(e.target.value) : null}))}>
                    <option value="">— Sem conta vinculada —</option>
                    {contas.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <input type="checkbox" id="taxa-ativo" checked={editTaxa.ativo !== false} onChange={e => setEditTaxa(f => ({...f, ativo:e.target.checked}))} />
                  <label htmlFor="taxa-ativo" className="text-xs" style={{ color:'var(--muted)' }}>Taxa ativa</label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setModalTaxa(false)} className="btn-secondary text-xs">Cancelar</button>
              <button onClick={salvarTaxa} disabled={saving||!editTaxa.nome} className="btn-primary text-xs">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LANÇAMENTO */}
      {modalMov && (
        <div className="modal-overlay" onClick={() => setModalMov(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Lançamento Manual</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="field-label">Tipo</label>
                  <select className="field-input" value={formMov.tipo} onChange={e => setFormMov(f => ({...f, tipo:e.target.value}))}>
                    <option value="ENTRADA">Entrada</option>
                    <option value="SAIDA">Saída</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Valor (R$)</label>
                  <input type="number" step="0.01" className="field-input" value={formMov.valor||''} onChange={e => setFormMov(f => ({...f, valor:Number(e.target.value)}))} />
                </div>
                <div className="col-span-2">
                  <label className="field-label">Descrição *</label>
                  <input className="field-input" value={formMov.descricao} onChange={e => setFormMov(f => ({...f, descricao:e.target.value}))} />
                </div>
                <div>
                  <label className="field-label">Data</label>
                  <input type="date" className="field-input" value={formMov.data} onChange={e => setFormMov(f => ({...f, data:e.target.value}))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setModalMov(false)} className="btn-secondary text-xs">Cancelar</button>
              <button onClick={salvarMov} disabled={saving||!formMov.descricao||!formMov.valor} className="btn-primary text-xs">
                {saving ? 'Salvando...' : 'Lançar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
