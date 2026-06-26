'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Plus, Trash2, RefreshCw, CheckCircle, XCircle, Loader2, Eye, EyeOff, Zap } from 'lucide-react'

const TIPOS: Record<string, { label: string; cor: string; descricao: string }> = {
  COSMOS:   { label: 'Cosmos Bluesoft', cor: '#3b82f6', descricao: 'NCM, CEST, marca, preço médio, imagem por EAN' },
  SINTEGRA: { label: 'Sintegra/SEFAZ',  cor: '#f59e0b', descricao: 'Consulta NCM e tributação estadual' },
  CUSTOM:   { label: 'API Customizada', cor: '#8b5cf6', descricao: 'URL e chave personalizadas' },
}

export default function ApisExternasPage() {
  const [lista, setLista]       = useState<any[]>([])
  const [tipos, setTipos]       = useState<any>({})
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState<any>(null)   // null = fechado
  const [saving, setSaving]     = useState(false)
  const [testing, setTesting]   = useState<number|null>(null)
  const [testResult, setTestResult] = useState<Record<number, any>>({})
  const [showKey, setShowKey]   = useState<Record<number, boolean>>({})
  const [editKey, setEditKey]   = useState('')  // api_key no form

  async function load() {
    setLoading(true)
    const [rl, rt] = await Promise.all([api.get('/apis-externas/'), api.get('/apis-externas/tipos')])
    setLista(rl.data); setTipos(rt.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openForm(item?: any) {
    if (item) {
      setForm({ ...item, _editMode: true })
      setEditKey('')  // não exibe chave mascarada no input
    } else {
      setForm({ nome: '', tipo: 'COSMOS', ativo: true, prioridade: 1, _editMode: false })
      setEditKey('')
    }
  }

  async function salvar() {
    setSaving(true)
    try {
      const payload: any = {
        nome: form.nome, tipo: form.tipo,
        url_custom: form.url_custom || null,
        ativo: form.ativo, prioridade: form.prioridade,
      }
      // só envia api_key se o usuário digitou algo
      if (editKey.trim()) payload.api_key = editKey.trim()
      if (form._editMode) await api.put(`/apis-externas/${form.id}`, payload)
      else                await api.post('/apis-externas/', payload)
      setForm(null); setEditKey(''); load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro ao salvar') }
    setSaving(false)
  }

  async function excluir(id: number) {
    if (!confirm('Remover esta configuração de API?')) return
    await api.delete(`/apis-externas/${id}`)
    load()
  }

  async function testar(id: number) {
    setTesting(id)
    try {
      const r = await api.post(`/apis-externas/${id}/testar`)
      setTestResult(p => ({ ...p, [id]: r.data }))
    } catch (e: any) {
      setTestResult(p => ({ ...p, [id]: { ok: false, erro: e.response?.data?.detail || 'Erro' } }))
    }
    setTesting(null)
  }

  const inp = "w-full px-3 py-2 text-xs rounded-xl"

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white flex items-center gap-2">
            <Zap size={18} color="#f59e0b"/> APIs de Consulta de Produtos
          </h1>
          <p className="text-[11px] mt-0.5" style={{ color:'var(--muted)' }}>
            Configure APIs externas para buscar NCM, CEST e dados fiscais automaticamente pelo EAN
          </p>
        </div>
        <button onClick={() => openForm()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black"
          style={{ background:'#1d4ed8', color:'#fff' }}>
          <Plus size={13}/> Nova API
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={22} className="animate-spin" style={{ color:'var(--muted)' }}/>
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          <Zap size={28} className="mx-auto mb-3" style={{ color:'var(--muted)', opacity:0.3 }}/>
          <p className="text-sm font-bold text-white">Nenhuma API configurada</p>
          <p className="text-xs mt-1" style={{ color:'var(--muted)' }}>Adicione a Cosmos Bluesoft para buscar NCM/CEST automaticamente pelo EAN</p>
          <button onClick={() => openForm()}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-black"
            style={{ background:'#1d4ed8', color:'#fff' }}>
            + Configurar Cosmos
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map(item => {
            const t = TIPOS[item.tipo] || { label: item.tipo, cor: '#64748b', descricao: '' }
            const tr = testResult[item.id]
            return (
              <div key={item.id} className="rounded-2xl p-4" style={{ background:'var(--card)', border:`1px solid ${item.ativo ? t.cor + '44' : 'var(--border)'}` }}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs"
                    style={{ background: t.cor + '22', color: t.cor }}>
                    {item.tipo.slice(0,2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-white text-sm">{item.nome}</p>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                        style={{ background: t.cor + '22', color: t.cor }}>
                        {t.label}
                      </span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ml-auto ${item.ativo ? 'text-green-400' : 'text-slate-500'}`}
                        style={{ background: item.ativo ? '#22c55e22' : '#1e293b' }}>
                        {item.ativo ? '● Ativa' : '○ Inativa'}
                      </span>
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color:'var(--muted)' }}>{t.descricao}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-mono" style={{ color:'#475569' }}>
                        Chave: {showKey[item.id] ? (item.api_key_masked || '***') : '••••••' + item.api_key_masked?.slice(-6)}
                      </span>
                      <button onClick={() => setShowKey(p => ({ ...p, [item.id]: !p[item.id] }))}
                        className="text-[9px]" style={{ color:'var(--muted)' }}>
                        {showKey[item.id] ? <EyeOff size={11}/> : <Eye size={11}/>}
                      </button>
                      <span className="text-[9px]" style={{ color:'#2d3f55' }}>|</span>
                      <span className="text-[10px]" style={{ color:'#475569' }}>Prioridade: {item.prioridade}</span>
                    </div>

                    {/* Resultado do teste */}
                    {tr && (
                      <div className={`mt-2 px-2.5 py-1.5 rounded-lg text-[10px] flex items-start gap-1.5`}
                        style={{ background: tr.ok ? '#22c55e18' : '#ef444418', border: `1px solid ${tr.ok ? '#22c55e33' : '#ef444433'}` }}>
                        {tr.ok
                          ? <><CheckCircle size={11} color="#22c55e" className="flex-shrink-0 mt-0.5"/>
                              <span style={{ color:'#22c55e' }}>
                                OK — {tr.dados?.descricao || ''}{tr.dados?.ncm ? ` · NCM: ${tr.dados.ncm}` : ''}
                              </span>
                            </>
                          : <><XCircle size={11} color="#ef4444" className="flex-shrink-0 mt-0.5"/>
                              <span style={{ color:'#ef4444' }}>{tr.erro}</span>
                            </>
                        }
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => testar(item.id)} disabled={testing === item.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black"
                      style={{ background:'#f59e0b22', color:'#f59e0b', border:'1px solid #f59e0b44' }}>
                      {testing === item.id
                        ? <Loader2 size={10} className="animate-spin"/>
                        : <><RefreshCw size={10}/> Testar</>}
                    </button>
                    <button onClick={() => openForm(item)}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-black"
                      style={{ background:'var(--card2)', color:'var(--muted)', border:'1px solid var(--border)' }}>
                      Editar
                    </button>
                    <button onClick={() => excluir(item.id)}
                      className="p-1.5 rounded-lg"
                      style={{ background:'#ef444422', color:'#ef4444' }}>
                      <Trash2 size={12}/>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Dica Cosmos */}
      <div className="rounded-2xl p-4" style={{ background:'#3b82f608', border:'1px solid #3b82f622' }}>
        <p className="text-xs font-black mb-1" style={{ color:'#3b82f6' }}>💡 Cosmos Bluesoft</p>
        <p className="text-[10px]" style={{ color:'var(--muted)' }}>
          A API Cosmos retorna <strong className="text-white">NCM, CEST, marca, preço médio e imagem</strong> ao escanear
          um EAN no cadastro de produto. Crie sua conta em <span style={{ color:'#3b82f6' }}>cosmos.bluesoft.com.br</span> e
          adicione sua chave acima.
        </p>
      </div>

      {/* Modal form */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background:'var(--card)' }}>
            <p className="font-black text-white text-base">{form._editMode ? 'Editar API' : 'Nova API Externa'}</p>

            <div>
              <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>TIPO</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(TIPOS).map(([k, v]) => (
                  <button key={k} onClick={() => setForm((f: any) => ({ ...f, tipo: k }))}
                    className="p-2 rounded-xl text-[10px] font-black text-center"
                    style={{ background: form.tipo === k ? v.cor + '33' : 'var(--card2)',
                      border: `1.5px solid ${form.tipo === k ? v.cor : 'var(--border)'}`,
                      color: form.tipo === k ? v.cor : 'var(--muted)' }}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>NOME / APELIDO *</label>
              <input value={form.nome} onChange={e => setForm((f: any) => ({ ...f, nome: e.target.value }))}
                className={inp} placeholder="ex: Cosmos Principal"/>
            </div>

            <div>
              <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>
                {form._editMode ? 'NOVA CHAVE DE API (deixe vazio para não alterar)' : 'CHAVE DE API (Token)'}
              </label>
              <input value={editKey}
                onChange={e => setEditKey(e.target.value)}
                className={inp} type="text"
                placeholder={form._editMode ? '•••••• (não alterar)' : 'Cole sua chave/token aqui'}/>
            </div>

            {form.tipo === 'CUSTOM' && (
              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>URL BASE CUSTOMIZADA</label>
                <input value={form.url_custom || ''} onChange={e => setForm((f: any) => ({ ...f, url_custom: e.target.value }))}
                  className={inp} placeholder="https://api.exemplo.com"/>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold mb-1" style={{ color:'var(--muted)' }}>PRIORIDADE</label>
                <input type="number" min="1" max="99" value={form.prioridade}
                  onChange={e => setForm((f: any) => ({ ...f, prioridade: Number(e.target.value) }))}
                  className={inp}/>
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <button onClick={() => setForm((f: any) => ({ ...f, ativo: !f.ativo }))}
                    className="w-10 h-5 rounded-full relative transition-all flex-shrink-0"
                    style={{ background: form.ativo ? '#22c55e' : '#3f3f46' }}>
                    <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                      style={{ left: form.ativo ? '22px' : '2px' }}/>
                  </button>
                  <span className="text-xs font-bold" style={{ color: form.ativo ? '#22c55e' : 'var(--muted)' }}>
                    {form.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={salvar} disabled={saving || !form.nome}
                className="flex-1 py-2.5 rounded-xl text-sm font-black"
                style={{ background: '#1d4ed8', color: '#fff' }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => { setForm(null); setEditKey('') }}
                className="px-4 py-2.5 rounded-xl text-sm font-black"
                style={{ background:'var(--card2)', color:'var(--muted)' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
