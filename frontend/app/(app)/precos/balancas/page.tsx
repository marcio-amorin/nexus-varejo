'use client'
import { useEffect, useState } from 'react'
import api, { fmtMoeda } from '@/lib/api'
import { Scale, Settings, Play, Download, FolderOpen, Check, AlertTriangle, RefreshCw, Package } from 'lucide-react'

const FORMATOS = [
  { key: 'TOLEDO',    label: 'Toledo Prix',  desc: 'PLU|DESCRICAO|PRECO|VALIDADE|TARA|SECAO' },
  { key: 'FILIZOLA',  label: 'Filizola',     desc: 'CODIGO;DESCRICAO;PRECO;VALIDADE' },
  { key: 'CSV',       label: 'CSV Genérico', desc: 'Campos separados pelo delimitador configurado' },
]

export default function BalancasPage() {
  const [aba, setAba]         = useState<'gerar' | 'config'>('gerar')
  const [config, setConfig]   = useState<any>(null)
  const [produtos, setProdutos] = useState<any[]>([])
  const [selProd, setSelProd] = useState<number[]>([])
  const [todosProds, setTodos] = useState(true)
  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [savingCfg, setSaveCfg] = useState(false)
  const [resultado, setResult] = useState<any>(null)
  const [busca, setBusca]     = useState('')
  const [savedMsg, setSaved]  = useState('')

  async function load() {
    setLoading(true)
    const [rc, rp] = await Promise.all([
      api.get('/precos/balanca/config'),
      api.get('/precos/produtos'),
    ])
    setConfig(rc.data); setProdutos(rp.data); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function salvarConfig() {
    setSaveCfg(true)
    try {
      await api.put('/precos/balanca/config', config)
      setSaved('Configurações salvas!'); setTimeout(() => setSaved(''), 3000)
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setSaveCfg(false)
  }

  async function gerarArquivo() {
    setGerando(true); setResult(null)
    try {
      const ids = todosProds ? undefined : selProd
      const r = await api.post('/precos/balanca/gerar', ids && ids.length ? ids : undefined)
      setResult(r.data)
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro') }
    setGerando(false)
  }

  function downloadArquivo() {
    if (!resultado?.conteudo) return
    const blob = new Blob([resultado.conteudo], { type: 'text/plain;charset=latin-1' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = config?.nome_arquivo || 'PLU.TXT'
    a.click(); URL.revokeObjectURL(url)
  }

  function toggleProd(id: number) {
    setSelProd(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  const prodsFiltrados = produtos.filter(p =>
    !busca || p.descricao.toLowerCase().includes(busca.toLowerCase()) || p.codigo.includes(busca)
  )

  const formatoAtual = FORMATOS.find(f => f.key === config?.formato)

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--muted)' }}>
      Carregando...
    </div>
  )

  return (
    <div className="pg">
      <div className="pg-header space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: '#F9731622' }}>
              <Scale size={16} color="#F97316" />
            </div>
            <div>
              <h1 className="text-base font-black text-white">Carga de Balanças</h1>
              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                Geração automática de arquivo PLU para balanças Toledo / Filizola
              </p>
            </div>
          </div>
          {savedMsg && (
            <span className="text-[11px] font-bold px-2 py-1 rounded-lg"
              style={{ background: '#34C75922', color: '#34C759' }}>✓ {savedMsg}</span>
          )}
        </div>

        {/* Abas */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--card2)' }}>
          {([['gerar', Scale, 'Gerar Arquivo'], ['config', Settings, 'Configurações']] as [string, any, string][]).map(([k, Icon, l]) => (
            <button key={k} onClick={() => setAba(k as any)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: aba === k ? '#F97316' : 'transparent', color: aba === k ? 'white' : 'var(--muted)' }}>
              <Icon size={12} />{l}
            </button>
          ))}
        </div>
      </div>

      {/* ── ABA GERAR ─────────────────────────────────────────────────────── */}
      {aba === 'gerar' && (
        <div className="flex-1 overflow-hidden flex flex-col gap-3 min-h-0">

          {/* Config resumida + botão gerar */}
          <div className="flex-shrink-0 grid grid-cols-3 gap-3">
            <div className="card flex items-center gap-3">
              <FolderOpen size={18} color="#F59E0B" className="flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>PASTA DE DESTINO</p>
                <p className="text-xs font-bold text-white truncate">
                  {config?.pasta_destino || <span style={{ color: '#FF9F0A' }}>Não configurada</span>}
                </p>
              </div>
            </div>
            <div className="card flex items-center gap-3">
              <Scale size={18} color="#32ADE6" className="flex-shrink-0" />
              <div>
                <p className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>FORMATO</p>
                <p className="text-xs font-bold text-white">{formatoAtual?.label || '—'}</p>
                <p className="text-[9px]" style={{ color: 'var(--muted)' }}>{config?.nome_arquivo}</p>
              </div>
            </div>
            <div className="card flex items-center gap-3">
              <Package size={18} color="#34C759" className="flex-shrink-0" />
              <div>
                <p className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>PRODUTOS</p>
                <p className="text-xs font-bold text-white">
                  {todosProds ? `Todos (${produtos.length})` : `${selProd.length} selecionado(s)`}
                </p>
              </div>
            </div>
          </div>

          {/* Seleção de produtos */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <div className="flex items-center gap-2 p-1 rounded-xl" style={{ background: 'var(--card2)' }}>
              <button onClick={() => { setTodos(true); setSelProd([]) }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: todosProds ? '#F97316' : 'transparent', color: todosProds ? 'white' : 'var(--muted)' }}>
                Todos os produtos
              </button>
              <button onClick={() => setTodos(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: !todosProds ? '#F97316' : 'transparent', color: !todosProds ? 'white' : 'var(--muted)' }}>
                Selecionar produtos
              </button>
            </div>
            {!todosProds && (
              <input value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar produto..." className="flex-1 px-3 py-1.5 text-xs rounded-xl"
                style={{ background: 'var(--card2)', color: 'white', border: '1px solid var(--border)' }} />
            )}
            <div className="flex gap-2 ml-auto">
              <button onClick={gerarArquivo} disabled={gerando || (!todosProds && selProd.length === 0)}
                className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-4">
                <Play size={12} /> {gerando ? 'Gerando...' : 'Gerar Arquivo'}
              </button>
              {resultado && (
                <button onClick={downloadArquivo}
                  className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-xl font-bold"
                  style={{ background: '#34C75922', color: '#34C759', border: '1px solid #34C75944' }}>
                  <Download size={12} /> Baixar .TXT
                </button>
              )}
            </div>
          </div>

          {/* Lista de seleção ou resultado */}
          <div className="flex-1 overflow-hidden flex gap-3 min-h-0">
            {/* Seleção de produtos (quando não é todos) */}
            {!todosProds && (
              <div className="flex-1 overflow-auto rounded-2xl" style={{ border: '1px solid var(--border)' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}>
                        <input type="checkbox"
                          checked={selProd.length === prodsFiltrados.length && prodsFiltrados.length > 0}
                          onChange={() => setSelProd(selProd.length === prodsFiltrados.length ? [] : prodsFiltrados.map(p => p.id))}
                          className="rounded" />
                      </th>
                      <th>Código</th><th>Produto</th><th>Un</th><th>Preço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prodsFiltrados.map(p => (
                      <tr key={p.id} onClick={() => toggleProd(p.id)}
                        style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                        className={selProd.includes(p.id) ? 'bg-orange-500/5' : 'hover:bg-white/5'}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selProd.includes(p.id)} onChange={() => toggleProd(p.id)} className="rounded" />
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px]" style={{ color: 'var(--muted)' }}>{p.codigo}</td>
                        <td className="px-3 py-2 text-xs font-semibold text-white">{p.descricao}</td>
                        <td className="px-3 py-2 text-xs text-center" style={{ color: 'var(--muted)' }}>{p.unidade}</td>
                        <td className="px-3 py-2 text-xs font-bold" style={{ color: '#F59E0B' }}>{fmtMoeda(p.preco_venda)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Resultado da geração */}
            {resultado && (
              <div className="flex-1 flex flex-col gap-2 min-h-0">
                {/* Status */}
                <div className="flex-shrink-0 p-4 rounded-2xl flex items-start gap-3"
                  style={{
                    background: resultado.erro_disco ? '#FF3B3012' : '#34C75912',
                    border: `1px solid ${resultado.erro_disco ? '#FF3B3040' : '#34C75940'}`,
                  }}>
                  {resultado.erro_disco
                    ? <AlertTriangle size={20} color="#FF3B30" className="flex-shrink-0" />
                    : <Check size={20} color="#34C759" className="flex-shrink-0" />
                  }
                  <div>
                    <p className="font-bold text-white text-sm">
                      {resultado.erro_disco ? 'Erro ao salvar no disco' : 'Arquivo gerado com sucesso!'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {resultado.total_produtos} produto(s) exportado(s)
                      {resultado.caminho_arquivo && ` · Salvo em: ${resultado.caminho_arquivo}`}
                    </p>
                    {resultado.erro_disco && (
                      <p className="text-xs mt-1" style={{ color: '#FF3B30' }}>{resultado.erro_disco}</p>
                    )}
                  </div>
                </div>

                {/* Preview do arquivo */}
                <div className="flex-1 overflow-auto rounded-2xl p-3 font-mono text-xs"
                  style={{ background: '#0D1117', border: '1px solid var(--border)', color: '#E6EDF3', lineHeight: 1.8 }}>
                  <p className="text-[10px] mb-2 font-sans" style={{ color: 'var(--muted)' }}>
                    Preview — {resultado.total_produtos} linhas (mostrando {resultado.preview?.length})
                  </p>
                  {resultado.preview?.map((linha: string, i: number) => (
                    <div key={i} className="hover:bg-white/5 px-1 rounded">{linha}</div>
                  ))}
                  {resultado.total_produtos > 5 && (
                    <p className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
                      ... + {resultado.total_produtos - 5} linha(s)
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Estado inicial sem seleção manual */}
            {todosProds && !resultado && (
              <div className="flex-1 flex flex-col items-center justify-center" style={{ color: 'var(--muted)' }}>
                <Scale size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-bold">Pronto para gerar</p>
                <p className="text-xs mt-1">
                  {config?.pasta_destino
                    ? `O arquivo será salvo em: ${config.pasta_destino}`
                    : 'Configure a pasta de destino ou baixe manualmente após gerar'}
                </p>
                <p className="text-xs mt-0.5">{produtos.length} produto(s) serão incluídos</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ABA CONFIGURAÇÕES ─────────────────────────────────────────────── */}
      {aba === 'config' && config && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Pasta de destino */}
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <FolderOpen size={16} color="#F59E0B" />
              <h2 className="font-bold text-white">Pasta de Destino</h2>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Configure o caminho completo da pasta onde o sistema Toledo irá buscar o arquivo.
              O arquivo será salvo automaticamente nesta pasta ao clicar em "Gerar Arquivo".
            </p>
            <div className="flex gap-2">
              <input
                value={config.pasta_destino || ''}
                onChange={e => setConfig((c: any) => ({ ...c, pasta_destino: e.target.value }))}
                className="flex-1 px-3 py-2.5 text-sm rounded-xl"
                style={{ background: 'var(--card2)', color: 'white', border: '1px solid var(--border)' }}
                placeholder="Ex: C:\Toledo\PLU\ ou \\servidor\balanca\arquivos\" />
            </div>
            <div className="p-3 rounded-xl text-xs" style={{ background: '#F59E0B12', border: '1px solid #F59E0B33' }}>
              <p className="font-bold" style={{ color: '#F59E0B' }}>Toledo Prix 5 Plus / Prix 4 — Configuração típica:</p>
              <p className="mt-1" style={{ color: 'var(--muted)' }}>
                Acesse o software Toledo → Configurações → Arquivo PLU → defina a mesma pasta aqui.<br />
                O sistema Toledo fará polling automático e carregará os produtos ao detectar o arquivo.
              </p>
            </div>
          </div>

          {/* Nome e formato */}
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <Scale size={16} color="#32ADE6" />
              <h2 className="font-bold text-white">Formato do Arquivo</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>NOME DO ARQUIVO</label>
                <input value={config.nome_arquivo}
                  onChange={e => setConfig((c: any) => ({ ...c, nome_arquivo: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm rounded-xl"
                  style={{ background: 'var(--card2)', color: 'white', border: '1px solid var(--border)' }} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>SEPARADOR (CSV)</label>
                <select value={config.separador}
                  onChange={e => setConfig((c: any) => ({ ...c, separador: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm rounded-xl"
                  style={{ background: 'var(--card2)', color: 'white', border: '1px solid var(--border)' }}>
                  <option value="|">| Pipe</option>
                  <option value=";">; Ponto e vírgula</option>
                  <option value=",">, Vírgula</option>
                  <option value={'\t'}>TAB</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {FORMATOS.map(f => (
                <div key={f.key}
                  onClick={() => setConfig((c: any) => ({ ...c, formato: f.key }))}
                  className="p-3 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: config.formato === f.key ? 'rgba(249,115,22,0.12)' : 'var(--card2)',
                    border: `1px solid ${config.formato === f.key ? '#F97316' : 'var(--border)'}`,
                  }}>
                  <p className="font-bold text-white text-xs">{f.label}</p>
                  <p className="text-[9px] mt-1 font-mono" style={{ color: 'var(--muted)' }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Opções adicionais */}
          <div className="card space-y-3">
            <h2 className="font-bold text-white">Opções do Arquivo</h2>
            {[
              { field: 'incluir_codigo_barras', label: 'Incluir código de barras', desc: 'Adiciona o EAN/código de barras ao arquivo' },
              { field: 'incluir_validade',      label: 'Incluir validade',         desc: 'Adiciona prazo de validade (dias) ao produto' },
              { field: 'apenas_ativos',         label: 'Somente produtos ativos',  desc: 'Ignora produtos desativados no cadastro' },
            ].map(({ field, label, desc }) => (
              <div key={field} className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: 'var(--card2)' }}>
                <div>
                  <p className="text-sm font-bold text-white">{label}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{desc}</p>
                </div>
                <button
                  onClick={() => setConfig((c: any) => ({ ...c, [field]: !c[field] }))}
                  className="w-12 h-6 rounded-full relative transition-all flex-shrink-0"
                  style={{ background: config[field] ? '#34C759' : '#3C3C3E' }}>
                  <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                    style={{ left: config[field] ? '26px' : '2px' }} />
                </button>
              </div>
            ))}

            {config.incluir_validade && (
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>
                  VALIDADE PADRÃO (DIAS)
                </label>
                <input type="number" min="1" max="3650"
                  value={config.validade_dias}
                  onChange={e => setConfig((c: any) => ({ ...c, validade_dias: Number(e.target.value) }))}
                  className="w-32 px-3 py-2.5 text-sm rounded-xl"
                  style={{ background: 'var(--card2)', color: 'white', border: '1px solid var(--border)' }} />
              </div>
            )}
          </div>

          <button onClick={salvarConfig} disabled={savingCfg}
            className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2">
            <Settings size={14} /> {savingCfg ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      )}
    </div>
  )
}
