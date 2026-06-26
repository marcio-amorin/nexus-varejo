'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import { Save, Plus, X, Heart, Settings } from 'lucide-react'

export default function ParametrosPDVPage() {
  const [params, setParams]   = useState<any>(null)
  const [insts, setInsts]     = useState<any[]>([])
  const [saving, setSaving]   = useState(false)
  const [novaInst, setNovaInst] = useState<any>(null)
  const [instSaving, setInstSaving] = useState(false)

  useEffect(() => {
    api.get('/pdv/parametros').then(r => setParams(r.data))
    api.get('/pdv/troco-solidario').then(r => setInsts(r.data))
  }, [])

  async function salvar() {
    setSaving(true)
    try {
      await api.put('/pdv/parametros', params)
      alert('Parâmetros salvos com sucesso!')
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaving(false)
  }

  async function salvarInst() {
    if (!novaInst?.nome) return
    setInstSaving(true)
    try {
      if (novaInst.id) await api.put(`/pdv/troco-solidario/${novaInst.id}`, novaInst)
      else await api.post('/pdv/troco-solidario', novaInst)
      const r = await api.get('/pdv/troco-solidario')
      setInsts(r.data); setNovaInst(null)
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setInstSaving(false)
  }

  async function removerInst(id: number) {
    await api.delete(`/pdv/troco-solidario/${id}`)
    setInsts(ii => ii.filter(i => i.id !== id))
  }

  if (!params) return <div className="flex items-center justify-center h-64" style={{ color: 'var(--muted)' }}>Carregando...</div>

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"

  const Toggle = ({ field, label }: { field: string; label: string }) => (
    <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--card2)' }}>
      <span className="text-sm font-bold text-white">{label}</span>
      <button onClick={() => setParams((p: any) => ({ ...p, [field]: !p[field] }))}
        className="w-12 h-6 rounded-full relative transition-all"
        style={{ background: params[field] ? '#34C759' : '#3C3C3E' }}>
        <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
          style={{ left: params[field] ? '26px' : '2px' }} />
      </button>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Parâmetros do PDV</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Configurações do terminal de vendas</p>
        </div>
        <button onClick={salvar} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
          <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Parâmetros'}
        </button>
      </div>

      <div className="card space-y-4">
        <h2 className="font-bold text-white flex items-center gap-2"><Settings size={16} color="#F59E0B" /> Identificação</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>NOME DO TERMINAL</label>
            <input value={params.terminal} onChange={e => setParams((p: any) => ({ ...p, terminal: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>NOME DA LOJA</label>
            <input value={params.nome_loja} onChange={e => setParams((p: any) => ({ ...p, nome_loja: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>CNPJ</label>
            <input value={params.cnpj_loja || ''} onChange={e => setParams((p: any) => ({ ...p, cnpj_loja: e.target.value }))} className={inp} placeholder="00.000.000/0001-00" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>ENDEREÇO</label>
            <input value={params.endereco_loja || ''} onChange={e => setParams((p: any) => ({ ...p, endereco_loja: e.target.value }))} className={inp} placeholder="Rua, N° — Cidade/UF" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>MENSAGEM NO CUPOM</label>
            <input value={params.mensagem_cupom || ''} onChange={e => setParams((p: any) => ({ ...p, mensagem_cupom: e.target.value }))} className={inp} placeholder="Obrigado pela preferência!" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>URL DO LOGO DA LOJA</label>
            <input value={params.logo_url || ''} onChange={e => setParams((p: any) => ({ ...p, logo_url: e.target.value }))} className={inp} placeholder="https://... ou /static/logo.png" />
            {params.logo_url && (
              <div className="mt-2 p-3 rounded-xl flex items-center gap-3" style={{ background: '#0f172a' }}>
                <img src={params.logo_url} alt="Logo" className="h-10 object-contain rounded" />
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Prévia do logo</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold text-white">Regras de Venda</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>DESCONTO MÁXIMO (%)</label>
            <input type="number" min="0" max="100" value={params.desconto_maximo_pct}
              onChange={e => setParams((p: any) => ({ ...p, desconto_maximo_pct: Number(e.target.value) }))} className={inp} />
          </div>
          <div />
          <Toggle field="operador_obrigatorio" label="Operador Obrigatório" />
          <Toggle field="cliente_cpf_obrigatorio" label="CPF Obrigatório" />
          <Toggle field="permite_venda_sem_estoque" label="Vender sem Estoque" />
          <Toggle field="impressao_cupom" label="Impressão de Cupom" />
          <Toggle field="troco_solidario_ativo" label="Troco Solidário" />
          <Toggle field="solicitar_cpf_inicio" label="Solicitar CPF no Início da Venda" />
        </div>
      </div>

      {/* Troco solidário */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Heart size={16} color="#FF9F0A" /> Instituições — Troco Solidário
          </h2>
          <button onClick={() => setNovaInst({ nome: '', descricao: '', cnpj: '' })}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl"
            style={{ background: '#FF9F0A22', color: '#FF9F0A' }}>
            <Plus size={12} /> Adicionar
          </button>
        </div>
        {insts.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>Nenhuma instituição cadastrada</p>
        ) : insts.map(i => (
          <div key={i.id} className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: 'var(--card2)' }}>
            <Heart size={16} color="#FF9F0A" className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm">{i.nome}</p>
              {i.cnpj && <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{i.cnpj}</p>}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-black" style={{ color: '#FF9F0A' }}>{fmtMoeda(i.total_arrecadado)}</p>
              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>arrecadado</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setNovaInst({ ...i })}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: '#F59E0B22', color: '#F59E0B' }}>
                <Save size={11} />
              </button>
              <button onClick={() => removerInst(i.id)}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: '#FF3B3022', color: '#FF3B30' }}>
                <X size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal nova instituição */}
      {novaInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-sm rounded-3xl p-6 space-y-4"
            style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-lg text-white">Instituição</p>
              <button onClick={() => setNovaInst(null)} style={{ color: 'var(--muted)' }}><X size={20} /></button>
            </div>
            <input value={novaInst.nome} onChange={e => setNovaInst((i: any) => ({ ...i, nome: e.target.value }))} className={inp} placeholder="Nome da instituição *" />
            <input value={novaInst.descricao || ''} onChange={e => setNovaInst((i: any) => ({ ...i, descricao: e.target.value }))} className={inp} placeholder="Descrição" />
            <input value={novaInst.cnpj || ''} onChange={e => setNovaInst((i: any) => ({ ...i, cnpj: e.target.value }))} className={inp} placeholder="CNPJ (opcional)" />
            <button onClick={salvarInst} disabled={instSaving || !novaInst.nome} className="btn-primary w-full py-3">
              {instSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
