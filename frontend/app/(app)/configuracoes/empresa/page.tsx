'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Save, Building2, MapPin, Phone, FileText, ChevronDown } from 'lucide-react'

const REGIMES = [
  {
    key: 'SIMPLES_NACIONAL',
    label: 'Simples Nacional',
    desc: 'Microempresas e EPP — tributação unificada no DAS',
    cor: '#34C759',
    impostos: 'PIS/COFINS incluídos no DAS · CSOSN no lugar do CST',
  },
  {
    key: 'LUCRO_PRESUMIDO',
    label: 'Lucro Presumido',
    desc: 'Presunção de lucro sobre faturamento',
    cor: '#F59E0B',
    impostos: 'PIS 0,65% · COFINS 3% · CSLL 9% · IRPJ 15%',
  },
  {
    key: 'LUCRO_REAL',
    label: 'Lucro Real',
    desc: 'Tributação sobre lucro efetivo — PIS/COFINS não-cumulativos',
    cor: '#3B82F6',
    impostos: 'PIS 1,65% · COFINS 7,6% · CSLL 9% · IRPJ 15%',
  },
]

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function EmpresaPage() {
  const [form, setForm]   = useState<any>(null)
  const [saving, setSave] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { api.get('/fiscal/empresa').then(r => setForm(r.data)) }, [])

  async function salvar() {
    setSave(true)
    try {
      await api.put('/fiscal/empresa', form)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSave(false)
  }

  const f = (field: string, value: string) => setForm((p: any) => ({ ...p, [field]: value }))
  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"

  if (!form) return <div className="flex items-center justify-center h-full" style={{ color: 'var(--muted)' }}>Carregando...</div>

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#3B82F622' }}>
            <Building2 size={16} color="#3B82F6" />
          </div>
          <div>
            <h1 className="text-base font-black text-white">Dados da Empresa</h1>
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Regime tributário e informações fiscais</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: '#34C75922', color: '#34C759' }}>✓ Salvo!</span>}
          <button onClick={salvar} disabled={saving} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3">
            <Save size={12} /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Regime Tributário */}
      <div className="card space-y-3">
        <h2 className="font-bold text-white flex items-center gap-2">
          <FileText size={14} color="#F97316" /> Regime Tributário
        </h2>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Define as alíquotas padrão de PIS, COFINS, ICMS e os campos fiscais dos produtos (CST / CSOSN).
        </p>
        <div className="grid grid-cols-3 gap-2">
          {REGIMES.map(r => (
            <div key={r.key}
              onClick={() => f('regime_tributario', r.key)}
              className="p-4 rounded-2xl cursor-pointer transition-all"
              style={{
                background: form.regime_tributario === r.key ? r.cor + '18' : 'var(--card2)',
                border: `2px solid ${form.regime_tributario === r.key ? r.cor : 'var(--border)'}`,
              }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: r.cor }}>
                  {form.regime_tributario === r.key && (
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: r.cor }} />
                  )}
                </div>
                <p className="font-black text-white text-sm">{r.label}</p>
              </div>
              <p className="text-xs ml-5" style={{ color: 'var(--muted)' }}>{r.desc}</p>
              <p className="text-[10px] ml-5 mt-1.5 font-mono font-bold" style={{ color: r.cor }}>{r.impostos}</p>
            </div>
          ))}
        </div>

        {form.regime_tributario === 'SIMPLES_NACIONAL' && (
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--card2)' }}>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--muted)' }}>ALÍQUOTA DO DAS (%)</label>
              <input type="number" step="0.01" min="0" max="100"
                value={form.aliquota_simples}
                onChange={e => f('aliquota_simples', e.target.value)}
                className="w-28 px-3 py-2 text-sm rounded-xl font-bold"
                style={{ background: 'var(--card)', color: '#34C759', border: '1px solid #34C75944' }} />
            </div>
            <p className="text-xs flex-1" style={{ color: 'var(--muted)' }}>
              Alíquota efetiva do Simples Nacional incluindo todos os tributos federais.
              Usado apenas para informação — não influencia o preço de venda.
            </p>
          </div>
        )}
      </div>

      {/* Identificação */}
      <div className="card space-y-3">
        <h2 className="font-bold text-white flex items-center gap-2">
          <Building2 size={14} color="#3B82F6" /> Identificação
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>RAZÃO SOCIAL</label>
            <input value={form.razao_social} onChange={e => f('razao_social', e.target.value)} className={inp} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>NOME FANTASIA</label>
            <input value={form.nome_fantasia} onChange={e => f('nome_fantasia', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>CNPJ</label>
            <input value={form.cnpj} onChange={e => f('cnpj', e.target.value)} className={inp} placeholder="00.000.000/0001-00" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>CNAE</label>
            <input value={form.cnae} onChange={e => f('cnae', e.target.value)} className={inp} placeholder="0000-0/00" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>INSCRIÇÃO ESTADUAL</label>
            <input value={form.ie} onChange={e => f('ie', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>INSCRIÇÃO MUNICIPAL</label>
            <input value={form.im} onChange={e => f('im', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>TELEFONE</label>
            <input value={form.telefone} onChange={e => f('telefone', e.target.value)} className={inp} placeholder="(00) 0000-0000" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>E-MAIL</label>
            <input value={form.email} onChange={e => f('email', e.target.value)} className={inp} />
          </div>
        </div>
      </div>

      {/* Endereço */}
      <div className="card space-y-3">
        <h2 className="font-bold text-white flex items-center gap-2">
          <MapPin size={14} color="#F59E0B" /> Endereço
        </h2>
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-3">
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>LOGRADOURO</label>
            <input value={form.endereco} onChange={e => f('endereco', e.target.value)} className={inp} placeholder="Rua, Av., Al..." />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>NÚMERO</label>
            <input value={form.numero} onChange={e => f('numero', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>COMPLEMENTO</label>
            <input value={form.complemento} onChange={e => f('complemento', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>BAIRRO</label>
            <input value={form.bairro} onChange={e => f('bairro', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>CIDADE</label>
            <input value={form.cidade} onChange={e => f('cidade', e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>CEP</label>
            <input value={form.cep} onChange={e => f('cep', e.target.value)} className={inp} placeholder="00000-000" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>ESTADO</label>
            <select value={form.estado} onChange={e => f('estado', e.target.value)} className={inp}>
              {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
