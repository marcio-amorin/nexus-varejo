'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import api, { fmtMoeda } from '@/lib/api'
import { Plus, Search, Tag, Edit3, Trash2, X, AlertTriangle, RefreshCw, Loader2, Zap, Image, Upload, ImageOff, ArrowLeft } from 'lucide-react'

export default function ProdutosPage() {
  const router = useRouter()
  const [produtos, setProdutos]     = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [stats, setStats]           = useState<any>(null)
  const [busca, setBusca]           = useState('')
  const [catFiltro, setCatFiltro]   = useState('')
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'produtos'|'categorias'>('produtos')
  const [showForm, setShowForm]     = useState(false)
  const [editando, setEditando]     = useState<any>(null)
  const [saving, setSaving]         = useState(false)
  const [isActive, setIsActive]     = useState(true)
  const [showCatForm, setShowCatForm] = useState(false)
  const [editCat, setEditCat]       = useState<any>(null)
  const [modalTab, setModalTab]     = useState<'geral'|'precos'|'fiscal'|'nutricional'|'receita'|'fracionamento'|'imposto'|'producao'>('geral')
  const [regimePadrao, setRegimePadrao] = useState<any>(null)
  const [eanLoading, setEanLoading] = useState(false)
  const [eanInfo, setEanInfo]       = useState<{found:boolean; source:string; descricao:string; produto_id?:number|null} | null>(null)
  const [pesavel, setPesavel]           = useState(false)
  const [enviarBalanca, setEnviarBalanca] = useState(false)
  const [pluInfo, setPluInfo]           = useState<{plu:number; ean_balanca:string} | null>(null)
  const [embalagem, setEmbalagem]       = useState({ codigo: '', qtd: '', tipo: 'CX', desc: '' })
  const [showCaixaRow, setShowCaixaRow] = useState(false)
  const [atacarejo, setAtacarejo]           = useState(false)
  const [atacarejoQtd, setAtacarejoQtd]     = useState('3')
  const [atacarejoPreco, setAtacarejoPreco] = useState('')
  const [controlaValidade, setControlaValidade] = useState(false)
  const [diasValidadeAlerta, setDiasValidadeAlerta] = useState('30')
  const [insumoProducao, setInsumoProducao] = useState(false)
  const [buscaIngred, setBuscaIngred] = useState('')
  const [showIngredDrop, setShowIngredDrop] = useState(false)
  const [fornsProduto, setFornsProduto] = useState<{fornecedor_id:number; nome:string; principal:boolean}[]>([])
  const [fornsLista, setFornsLista]     = useState<any[]>([])
  const [addFornId, setAddFornId]       = useState('')
  const [imagemUrl, setImagemUrl]       = useState('')
  const [imgLoading, setImgLoading]     = useState(false)
  const [imgErr, setImgErr]             = useState('')
  const [imgPollingId, setImgPollingId] = useState<number|null>(null) // produto_id sendo monitorado
  const pollingTimerRef                 = useRef<ReturnType<typeof setInterval>|null>(null)
  const [buscaSidebar, setBuscaSidebar] = useState('')
  const [ingredientes, setIngredientes] = useState<{nome:string; qtde:string; un:string; custo:string}[]>([])
  const [showAddIngred, setShowAddIngred] = useState(false)
  const [formIngred, setFormIngred] = useState({ nome:'', qtde:'', un:'UN', custo:'' })
  const [producaoRendimento, setProducaoRendimento] = useState('1')
  const [producaoMaoObra, setProducaoMaoObra] = useState('')
  const [producaoEmbalagem, setProducaoEmbalagem] = useState('')

  const [form, setForm] = useState({
    codigo:'', descricao:'', unidade:'UN', categoria_id:'', ncm:'',
    codigo_barras:'', preco_custo:'', preco_venda:'', margem:'30',
    estoque_atual:'0', estoque_minimo:'0', localizacao:'',
  })
  const [fiscal, setFiscal] = useState({
    cest:'', cfop_saida:'5102', cst_icms:'000', csosn:'400',
    icms_aliquota:0, pis_aliquota:0, cofins_aliquota:0,
  })
  const [formCat, setFormCat] = useState({ nome:'', icone:'📦', cor:'#F59E0B', margem_padrao:'30' })

  async function gerarCodigo(isPesavel: boolean) {
    setEanLoading(true)
    try {
      const r = await api.get(`/produtos/proximo-codigo?pesavel=${isPesavel}`)
      const d = r.data
      setForm((f: any) => ({ ...f, codigo: d.codigo }))
      if (isPesavel && d.plu) {
        setPluInfo({ plu: d.plu, ean_balanca: d.ean_balanca })
      } else {
        setPluInfo(null)
      }
      setEanInfo(null)
      // Auto-preenche código de barras da embalagem com o código gerado
      setEmbalagem(v => ({ ...v, codigo: v.codigo || d.codigo }))
      setShowCaixaRow(true)
    } catch { }
    setEanLoading(false)
  }

  async function buscarEAN(codigo: string) {
    const isEAN = /^\d{8}$|^\d{12}$|^\d{13}$/.test(codigo)
    if (!isEAN) { setEanInfo(null); return }
    setEanLoading(true)
    try {
      const r = await api.get(`/produtos/ean/${codigo}`)
      const d = r.data
      setEanInfo(d)
      if (d.found) {
        // Preenche campos básicos se estiverem vazios
        setForm((f: any) => ({
          ...f,
          descricao:    f.descricao    || d.descricao || '',
          codigo_barras: f.codigo_barras || codigo,
          ncm:          f.ncm          || d.ncm  || '',
        }))
        // Preenche imagem
        if (d.imagem_url && !imagemUrl) setImagemUrl(d.imagem_url)
        // Cosmos: preenche NCM/CEST e dados fiscais automaticamente
        if (d.source === 'cosmos') {
          if (d.ncm) setForm((f: any) => ({ ...f, ncm: d.ncm }))
          if (d.cest) setFiscal((f: any) => ({ ...f, cest: d.cest }))
        }
        // Aplica padrão fiscal do regime
        if (regimePadrao) {
          setFiscal(f => ({ ...f,
            cfop_saida:      regimePadrao.cfop_padrao || '5102',
            cst_icms:        regimePadrao.cst_icms    || '000',
            csosn:           regimePadrao.csosn       || '400',
            icms_aliquota:   regimePadrao.icms_aliquota   || 0,
            pis_aliquota:    regimePadrao.pis_aliquota    || 0,
            cofins_aliquota: regimePadrao.cofins_aliquota || 0,
          }))
        }
      }
    } catch { setEanInfo(null) }
    setEanLoading(false)
  }

  async function loadRegimePadrao() {
    try { const r = await api.get('/fiscal/regime-padrao'); setRegimePadrao(r.data) } catch {}
  }

  async function load() {
    setLoading(true)
    const [rp, rc, rs] = await Promise.all([
      api.get('/produtos/', { params: { busca: busca||undefined, categoria_id: catFiltro||undefined } }),
      api.get('/produtos/categorias'),
      api.get('/produtos/stats'),
    ])
    setProdutos(rp.data); setCategorias(rc.data); setStats(rs.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [busca, catFiltro])
  useEffect(() => { loadRegimePadrao() }, [])

  async function openForm(p?: any) {
    setModalTab('geral'); setEanInfo(null); setPluInfo(null); setImgErr('')
    setImagemUrl(p?.imagem_url || '')
    setPesavel(p ? (p.pesavel || false) : false)
    setEnviarBalanca(p ? (p.enviar_balanca || false) : false)
    setEmbalagem({ codigo: p?.embalagem_codigo||'', qtd: p?.embalagem_qtd ? String(p.embalagem_qtd) : '', tipo: p?.embalagem_tipo||'CX', desc: p?.embalagem_desc||'' })
    setShowCaixaRow(!!(p?.embalagem_codigo))
    setAtacarejo(p ? (p.atacarejo || false) : false)
    setAtacarejoQtd(p?.atacarejo_qtd_min ? String(p.atacarejo_qtd_min) : '3')
    setAtacarejoPreco(p?.atacarejo_preco ? String(p.atacarejo_preco) : '')
    setControlaValidade(p ? (p.controla_validade || false) : false)
    setDiasValidadeAlerta(p?.dias_validade_alerta ? String(p.dias_validade_alerta) : '30')
    setInsumoProducao(p ? (p.insumo_producao || false) : false)
    setIsActive(p ? (p.is_active ?? true) : true)
    setFornsProduto([])
    setAddFornId('')
    // Carrega lista de fornecedores e vínculos do produto
    try { const rf = await api.get('/fornecedores/'); setFornsLista(rf.data) } catch { setFornsLista([]) }
    if (p) {
      try { const rf = await api.get(`/produtos/${p.id}/fornecedores`); setFornsProduto(rf.data) } catch {}
    }
    if (p) {
      setEditando(p)
      // Se codigo_barras vazio mas codigo é EAN (8/12/13 dígitos), usa o codigo como barras da unidade
      const cbUnit = p.codigo_barras || (/^\d{8}$|^\d{12,13}$/.test(p.codigo||'') ? p.codigo : '')
      setForm({ codigo:p.codigo, descricao:p.descricao, unidade:p.unidade, categoria_id:p.categoria_id||'',
        ncm:p.ncm||'', codigo_barras:cbUnit, preco_custo:String(p.preco_custo),
        preco_venda:String(p.preco_venda), margem:String(p.margem), estoque_atual:String(p.estoque_atual),
        estoque_minimo:String(p.estoque_minimo), localizacao:p.localizacao||'' })
      // Carrega dados fiscais do produto
      try {
        const rf = await api.get(`/fiscal/produto/${p.id}`)
        setFiscal({ cest:rf.data.cest||'', cfop_saida:rf.data.cfop_saida||'5102',
          cst_icms:rf.data.cst_icms||'000', csosn:rf.data.csosn||'400',
          icms_aliquota:rf.data.icms_aliquota||0, pis_aliquota:rf.data.pis_aliquota||0, cofins_aliquota:rf.data.cofins_aliquota||0 })
      } catch { setFiscal({ cest:'', cfop_saida:'5102', cst_icms:'000', csosn:'400', icms_aliquota:0, pis_aliquota:0, cofins_aliquota:0 }) }
    } else {
      setEditando(null)
      setForm({ codigo:'', descricao:'', unidade:'UN', categoria_id:'', ncm:'', codigo_barras:'',
        preco_custo:'', preco_venda:'', margem:'30', estoque_atual:'0', estoque_minimo:'0', localizacao:'' })
      // Preenche fiscal com padrão do regime
      if (regimePadrao) {
        setFiscal({ cest:'', cfop_saida:regimePadrao.cfop_padrao||'5102',
          cst_icms:regimePadrao.cst_icms||'000', csosn:regimePadrao.csosn||'400',
          icms_aliquota:regimePadrao.icms_aliquota||0, pis_aliquota:regimePadrao.pis_aliquota||0,
          cofins_aliquota:regimePadrao.cofins_aliquota||0 })
      } else {
        setFiscal({ cest:'', cfop_saida:'5102', cst_icms:'000', csosn:'400', icms_aliquota:0, pis_aliquota:0, cofins_aliquota:0 })
      }
    }
    setBuscaSidebar('')
    setShowForm(true)
    // Produto existente sem imagem → busca automaticamente por nome
    if (p && !p.imagem_url && p.descricao) {
      setTimeout(() => buscarImagemPorNome(p.descricao), 300)
    }
  }

  function aplicarPadrao() {
    if (!regimePadrao) return
    setFiscal(f => ({ ...f, cfop_saida:regimePadrao.cfop_padrao||'5102',
      cst_icms:regimePadrao.cst_icms||'000', csosn:regimePadrao.csosn||'400',
      icms_aliquota:regimePadrao.icms_aliquota||0, pis_aliquota:regimePadrao.pis_aliquota||0,
      cofins_aliquota:regimePadrao.cofins_aliquota||0 }))
  }

  function handleCustoMargem(field: 'preco_custo'|'margem', value: string) {
    const nf = { ...form, [field]: value }
    const custo = parseFloat(nf.preco_custo)||0, margem = parseFloat(nf.margem)||0
    if (custo>0 && margem>0 && margem<100) nf.preco_venda = (custo/(1-margem/100)).toFixed(2)
    setForm(nf)
  }
  function handleVenda(value: string) {
    const nf = { ...form, preco_venda: value }
    const custo = parseFloat(nf.preco_custo)||0, venda = parseFloat(value)||0
    if (venda>0 && custo>0) nf.margem = (((venda-custo)/venda)*100).toFixed(2)
    setForm(nf)
  }

  async function salvar(abrirNovo = false) {
    setSaving(true)
    try {
      const payload = { ...form, categoria_id: form.categoria_id ? Number(form.categoria_id):null,
        preco_custo:Number(form.preco_custo)||0, preco_venda:Number(form.preco_venda)||0,
        margem:Number(form.margem)||0, estoque_atual:Number(form.estoque_atual)||0, estoque_minimo:Number(form.estoque_minimo)||0,
        pesavel, enviar_balanca: enviarBalanca,
        unidade: pesavel ? 'KG' : form.unidade,
        plu_codigo: pluInfo ? pluInfo.plu : (editando?.plu_codigo || null),
        embalagem_codigo: embalagem.codigo || null,
        embalagem_qtd: parseInt(embalagem.qtd as string) || 1,
        embalagem_tipo: embalagem.tipo || 'CX',
        embalagem_desc: embalagem.desc || null,
        atacarejo,
        atacarejo_qtd_min: parseInt(atacarejoQtd) || 3,
        atacarejo_preco: parseFloat(atacarejoPreco) || 0,
        controla_validade: controlaValidade,
        dias_validade_alerta: parseInt(diasValidadeAlerta) || 30,
        insumo_producao: insumoProducao,
        imagem_url: imagemUrl || null,
        is_active: isActive,
      }
      let pid: number
      if (editando) { await api.put(`/produtos/${editando.id}`, payload); pid = editando.id }
      else          { const r = await api.post('/produtos/', payload); pid = r.data.id }
      try { await api.put(`/fiscal/produto/${pid}`, { ...fiscal, ncm: form.ncm||null }) } catch {}
      try { await api.post(`/produtos/${pid}/fornecedores/sync`, { fornecedores: fornsProduto }) } catch {}
      load()
      if (abrirNovo) {
        // Salva e abre formulário em branco para próximo produto
        openForm()
      } else {
        const prodAtualizado = await api.get(`/produtos/${pid}`).catch(()=>null)
        if (prodAtualizado?.data) setEditando(prodAtualizado.data)
        const barcode = payload.codigo_barras || payload.codigo || ''
        if (!imagemUrl && /^\d{8}$|^\d{12}$|^\d{13}$/.test(barcode)) {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current)
          setImgPollingId(pid)
          let tries = 0
          const interval = setInterval(async () => {
            tries++
            const r = await api.get(`/produtos/${pid}`).catch(()=>null)
            if (r?.data?.imagem_url || tries >= 8) {
              clearInterval(interval)
              pollingTimerRef.current = null
              setImgPollingId(null)
              load()
            }
          }, 2000)
          pollingTimerRef.current = interval
        }
      }
    } catch (e: any) { alert(e.response?.data?.detail||'Erro ao salvar') }
    setSaving(false)
  }

  async function salvarCat() {
    if (!formCat.nome.trim()) return
    try {
      const payload = { ...formCat, nome: formCat.nome.trim(), margem_padrao: Number(formCat.margem_padrao) }
      if (editCat) {
        await api.put(`/produtos/categorias/${editCat.id}`, payload)
      } else {
        await api.post('/produtos/categorias', payload)
      }
      // Mantém modal aberto, reseta form e atualiza lista
      setFormCat({ nome:'', icone:'📦', cor:'#F97316', margem_padrao:'30' })
      setEditCat(null)
      const rc = await api.get('/produtos/categorias')
      setCategorias(rc.data)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Erro ao salvar categoria')
    }
  }

  async function buscarImagemAutomatica() {
    setImgLoading(true); setImgErr('')
    try {
      // Produto já salvo → backend baixa e armazena localmente
      if (editando?.id) {
        const r = await api.post(`/produtos/${editando.id}/buscar-imagem`)
        setImagemUrl(r.data.imagem_url)
      } else {
        // Produto novo → busca direto no Open Food Facts pela URL pública
        const ean = form.codigo_barras || form.codigo
        const isEAN = /^\d{8}$|\d{12}$|\d{13}$/.test(ean)
        if (!isEAN) { setImgErr('Digite um código EAN válido (8, 12 ou 13 dígitos)'); setImgLoading(false); return }
        const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${ean}?fields=image_front_url,image_url,product_name`)
        const d = await r.json()
        const url = d?.product?.image_front_url || d?.product?.image_url
        if (url) { setImagemUrl(url); setImgErr('') }
        else setImgErr('Imagem não encontrada no Open Food Facts para este EAN')
      }
    } catch (e: any) {
      setImgErr(e.response?.data?.detail || 'Imagem não encontrada')
    }
    setImgLoading(false)
  }

  async function uploadImagem(file: File) {
    if (!editando?.id) { setImgErr('Salve o produto antes de fazer upload.'); return }
    setImgLoading(true); setImgErr('')
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await api.post(`/produtos/${editando.id}/upload-imagem`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setImagemUrl(r.data.imagem_url)
    } catch (e: any) { setImgErr(e.response?.data?.detail || 'Erro no upload') }
    setImgLoading(false)
  }

  async function buscarImagemPorNome(descOverride?: string) {
    const desc = (descOverride || editando?.descricao || form.descricao || '').trim()
    if (!desc) { if (!descOverride) setImgErr('Preencha a descrição do produto'); return }
    setImgLoading(true); setImgErr('')

    const palavras = desc.toLowerCase().split(/\s+/).filter(p => p.length > 1)
    const candidatos: string[] = []
    candidatos.push(palavras.join(' '))
    if (palavras.length > 1) candidatos.push(palavras.slice(1).join(' '))
    for (let i = palavras.length - 1; i >= 0; i--) candidatos.push(palavras[i])
    const unicos = [...new Set(candidatos)]

    async function tentarBusca(termo: string, lang: string): Promise<string|null> {
      try {
        // 1ª tentativa: título direto
        const r1 = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(termo)}`)
        if (r1.ok) {
          const d1 = await r1.json()
          const url = d1?.thumbnail?.source || d1?.originalimage?.source
          if (url) return url
        }
        // 2ª tentativa: opensearch para corrigir acentos/ortografia
        const r2 = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(termo)}&limit=1&format=json&origin=*`)
        if (r2.ok) {
          const d2 = await r2.json()
          const titulo = d2?.[1]?.[0]
          if (titulo) {
            const r3 = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo)}`)
            if (r3.ok) {
              const d3 = await r3.json()
              const url = d3?.thumbnail?.source || d3?.originalimage?.source
              if (url) return url
            }
          }
        }
      } catch {}
      return null
    }

    for (const termo of unicos) {
      for (const lang of ['pt', 'en']) {
        const url = await tentarBusca(termo, lang)
        if (url) { setImagemUrl(url); setImgErr(''); setImgLoading(false); return }
      }
    }

    if (!descOverride) setImgErr('Não encontrado na Wikipedia. Tente upload manual.')
    setImgLoading(false)
  }

  async function removerImagem() {
    if (editando?.id) {
      try { await api.delete(`/produtos/${editando.id}/imagem`) } catch {}
    }
    setImagemUrl('')
  }

  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

  const inp = "w-full px-2.5 py-1.5 text-xs rounded-lg"

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg-header flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={()=>router.push('/dashboard')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black flex-shrink-0"
            style={{ background:'#1a2232', color:'#64748b', border:'1px solid #1e2d40' }}>
            <ArrowLeft size={12}/> Voltar
          </button>
          <div>
            <h1 className="text-base font-black text-white">Produtos</h1>
            {stats && <p className="text-[10px]" style={{ color:'var(--muted)' }}>{stats.total} produtos · {fmtMoeda(stats.valor_estoque)} em estoque</p>}
          </div>
          {/* Tabs */}
          <div className="flex gap-1">
            {(['produtos','categorias'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
                style={{ background: tab===t ? '#F97316':'var(--card2)', color: tab===t ? 'white':'var(--muted)' }}>
                {t==='produtos' ? `Produtos (${produtos.length})` : `Categorias (${categorias.length})`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tab==='produtos' && (
            <>
              <div className="relative">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color:'var(--muted)' }} />
                <input value={busca} onChange={e=>setBusca(e.target.value)}
                  placeholder="Buscar produto..." className="pl-7 pr-3 py-1.5 text-xs rounded-lg w-44"
                  style={{ background:'var(--card2)', border:'1px solid var(--border)', color:'white' }} />
              </div>
              <select value={catFiltro} onChange={e=>setCatFiltro(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-lg"
                style={{ background:'var(--card2)', border:'1px solid var(--border)', color:'white' }}>
                <option value="">Todas categorias</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
              </select>
            </>
          )}
          <button onClick={() => { setShowCatForm(true); setEditCat(null); setFormCat({ nome:'', icone:'📦', cor:'#F59E0B', margem_padrao:'30' }) }}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1"
            style={{ background:'var(--card2)', border:'1px solid var(--border)', color:'var(--muted)' }}>
            <Tag size={11}/> Categoria
          </button>
          <button onClick={() => openForm()} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
            <Plus size={11}/> Produto
          </button>
        </div>
      </div>

      {/* Lista */}
      {tab === 'produtos' ? (
        <div className="pg-body">
          <table className="tbl">
            <thead><tr>
              {['Código','Produto','Categoria','Custo','Venda','Margem','Estoque',''].map(h=><th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8" style={{ color:'var(--muted)' }}>Carregando...</td></tr>
              ) : produtos.length===0 ? (
                <tr><td colSpan={8} className="text-center py-10" style={{ color:'var(--muted)' }}>Nenhum produto</td></tr>
              ) : produtos.map(p => (
                <tr key={p.id}>
                  <td className="font-mono" style={{ color:'#F97316' }}>{p.codigo}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      {p.imagem_url ? (
                        <img
                          src={p.imagem_url.startsWith('/static') ? `${BASE_URL}${p.imagem_url}` : p.imagem_url}
                          alt={p.descricao}
                          className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                          style={{border:'1px solid var(--border)'}}
                          onError={e => (e.currentTarget.style.display='none')}
                        />
                      ) : imgPollingId === p.id ? (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{background:'#2563eb18',border:'1px solid #2563eb44'}}>
                          <Loader2 size={12} className="animate-spin" style={{color:'#2563eb'}}/>
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{background:'var(--card2)',border:'1px solid var(--border)'}}>
                          <ImageOff size={12} style={{color:'var(--muted)',opacity:0.5}}/>
                        </div>
                      )}
                    <div>
                    <p className="font-semibold text-white flex items-center gap-1 flex-wrap" style={{ textTransform:'uppercase' }}>
                      {p.descricao}
                      {p.pesavel && <span className="text-[9px] px-1 py-0.5 rounded font-black" style={{ background:'#F5A62322', color:'#F5A623' }}>⚖ KG</span>}
                      {p.enviar_balanca && <span className="text-[9px] px-1 py-0.5 rounded font-black" style={{ background:'#32ADE622', color:'#32ADE6' }}>⚖ Balança</span>}
                    </p>
                    <p className="text-[10px]" style={{ color:'var(--muted)' }}>
                      {p.unidade}{p.plu_codigo ? ` · PLU ${p.plu_codigo}` : ''}
                    </p>
                    </div></div>
                  </td>
                  <td>
                    {p.categoria_nome && (
                      <span className="badge" style={{ background:(p.categoria_cor||'#6B7280')+'22', color:p.categoria_cor||'#6B7280' }}>
                        {p.categoria_nome}
                      </span>
                    )}
                  </td>
                  <td style={{ color:'var(--muted)' }}>{fmtMoeda(p.preco_custo)}</td>
                  <td>
                    <p className="font-bold text-xs" style={{ color:'#F97316' }}>{fmtMoeda(p.preco_venda)}</p>
                    {p.atacarejo && p.atacarejo_preco > 0 && (
                      <p className="text-[9px] font-bold mt-0.5" style={{ color:'#FF9F0A' }}>
                        🏪 ≥{p.atacarejo_qtd_min}un → {fmtMoeda(p.atacarejo_preco)}
                      </p>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <span className="badge" style={{ background:'#22C55E22', color:'#22C55E' }}>{p.margem?.toFixed(1)}%</span>
                      {p.atacarejo && p.atacarejo_preco > 0 && p.preco_custo > 0 && (() => {
                        const mAtk = ((p.atacarejo_preco - p.preco_custo) / p.atacarejo_preco * 100)
                        return (
                          <span className="text-[9px] font-black px-1 py-0.5 rounded"
                            style={{ background:'#FF9F0A22', color:'#FF9F0A' }}>
                            🏪 {mAtk.toFixed(1)}%
                          </span>
                        )
                      })()}
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: p.estoque_atual<=0 ? '#EF444422' : p.estoque_baixo ? '#F59E0B22' : '#22C55E22',
                      color:      p.estoque_atual<=0 ? '#EF4444'   : p.estoque_baixo ? '#F59E0B'   : '#22C55E',
                    }}>
                      {p.estoque_baixo && p.estoque_atual>0 && <AlertTriangle size={8} />}
                      {p.estoque_atual} {p.unidade}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openForm(p)} className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ background:'#F97316'+'22', color:'#F97316' }}><Edit3 size={11}/></button>
                      <button onClick={async () => { if(confirm('Remover?')) { await api.delete(`/produtos/${p.id}`); load() } }}
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ background:'#EF444422', color:'#EF4444' }}><Trash2 size={11}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Header com botão Nova Categoria */}
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-xs font-black" style={{ color:'#64748b' }}>CATEGORIAS ({categorias.length})</p>
            <button onClick={() => { setShowCatForm(true); setEditCat(null); setFormCat({ nome:'', icone:'🏷️', cor:'#F97316', margem_padrao:'30' }) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black"
              style={{ background:'#f9731622', color:'#f97316', border:'1px solid #f9731644' }}>
              <Tag size={11}/> + Nova Categoria
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 p-1">
            {categorias.map(c => (
              <div key={c.id} className="flex items-center gap-2 p-2.5 rounded-xl"
                style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background:c.cor+'22' }}>{c.icone}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-xs truncate">{c.nome}</p>
                  <p className="text-[10px]" style={{ color:'var(--muted)' }}>{c.total_produtos} prod · {c.margem_padrao}% margem</p>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ background:'#f9731622', color:'#f97316' }}
                    onClick={() => { setEditCat(c); setFormCat({ nome:c.nome, icone:c.icone, cor:c.cor, margem_padrao:String(c.margem_padrao) }); setShowCatForm(true) }}
                    title="Editar">
                    <Edit3 size={11}/>
                  </button>
                  <button
                    className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ background:'#ef444422', color:'#ef4444' }}
                    onClick={async () => { if(confirm(`Excluir categoria "${c.nome}"?`)) { await api.delete(`/produtos/categorias/${c.id}`); load() } }}
                    title="Excluir">
                    <Trash2 size={11}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Produto — full screen */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background:'#0d1117' }}>

          {/* ── TOP BAR ── */}
          <div className="flex items-center gap-4 px-5 py-3 flex-shrink-0"
            style={{ background:'#0a0f1a', borderBottom:'2px solid #1e2d40' }}>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background:'#f97316', color:'white' }}>
                <span className="text-lg font-black">{editando ? '✏' : '+'}</span>
              </div>
              <div>
                <p className="font-black text-white leading-none" style={{ fontSize: 18, textTransform:'uppercase' }}>
                  {editando ? editando.descricao || 'EDITAR PRODUTO' : 'NOVO PRODUTO'}
                </p>
                {editando && <p className="text-xs font-mono mt-1 font-bold" style={{ color:'#64748b' }}>ID #{editando.id} · {editando.codigo}</p>}
              </div>
            </div>
            {/* Tabs */}
            <div className="flex gap-1 ml-4 flex-wrap">
              {([
                {id:'geral',       label:'📋 Dados Gerais'},
                {id:'precos',      label:'💰 Preços'},
                {id:'producao',    label:'🔧 Produção'},
                {id:'nutricional', label:'🥗 Nutricional'},
                {id:'receita',     label:'📄 Receita'},
                {id:'fracionamento', label:'⚖ Fracionamento'},
                {id:'imposto',     label:'🧾 Imposto'},
              ] as const).map(t => (
                <button key={t.id} onClick={()=>setModalTab(t.id as any)}
                  className="px-3 py-1.5 rounded-lg text-xs font-black"
                  style={{ background:modalTab===t.id?'#f97316':'#1a2232', color:modalTab===t.id?'white':'#64748b',
                    border:modalTab===t.id?'none':'1px solid #1e2d40' }}>
                  {t.label}
                </button>
              ))}
            </div>
            {/* EAN smart status */}
            {!pesavel && eanInfo && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold ml-2"
                style={{ background: eanInfo.found?'#22c55e18':'#ef444418',
                  border:`1px solid ${eanInfo.found?'#22c55e33':'#ef444433'}`,
                  color: eanInfo.source==='interno'?'#f59e0b':eanInfo.source==='cosmos'?'#3b82f6':eanInfo.found?'#22c55e':'#ef4444' }}>
                {eanLoading && <Loader2 size={11} className="animate-spin"/>}
                {!eanLoading && (eanInfo.source==='interno'
                  ? `⚠ Já cadastrado: ${eanInfo.descricao}`
                  : eanInfo.source==='cosmos'
                  ? `✓ Cosmos: ${eanInfo.descricao}`
                  : eanInfo.found ? `✓ ${eanInfo.descricao}` : '✕ EAN não encontrado')}
              </div>
            )}
            {eanLoading && !eanInfo && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]"
                style={{ background:'#f9731618', border:'1px solid #f9731633', color:'#f97316' }}>
                <Loader2 size={11} className="animate-spin"/> Consultando EAN...
              </div>
            )}
            <div className="flex-1"/>
            <button
              onClick={()=>{ setShowCatForm(true); setEditCat(null); setFormCat({ nome:'', icone:'🏷️', cor:'#F97316', margem_padrao:'30' }) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black flex-shrink-0"
              style={{ background:'#f9731622', color:'#f97316', border:'1px solid #f9731644' }}>
              <Tag size={11}/> Categoria
            </button>
            <button onClick={()=>setShowForm(false)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black flex-shrink-0 ml-1"
              style={{ background:'#f97316', color:'white', boxShadow:'0 4px 12px rgba(249,115,22,0.35)' }}>
              <ArrowLeft size={13}/> Voltar
            </button>
          </div>

          {/* ── BODY ── */}
          <div className="flex flex-1 overflow-hidden">

            {/* LEFT SIDEBAR */}
            <div className="flex flex-col gap-3 p-4 flex-shrink-0" style={{ width:300, background:'#060a12', borderRight:'2px solid #1e2d40', overflowY:'auto', height:'100%' }}>

              {/* Pesquisar produto existente */}
              <div>
                <p className="text-[9px] font-black tracking-widest mb-1.5" style={{ color:'#475569' }}>PESQUISAR PRODUTO</p>
                <div className="relative">
                  <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color:'#64748b' }}/>
                  <input value={buscaSidebar} onChange={e=>setBuscaSidebar(e.target.value.toUpperCase())}
                    placeholder="NOME OU CÓDIGO..."
                    className="w-full pl-7 pr-2 py-2 text-xs rounded-lg"
                    style={{ background:'#1a2232', border:'1px solid #2d3f55', color:'white', outline:'none', textTransform:'uppercase' }}
                    onKeyDown={e => {
                      if (e.key !== 'Enter' || !buscaSidebar.trim()) return
                      const termo = buscaSidebar.toLowerCase()
                      const lista = produtos.filter(p =>
                        p.descricao.toLowerCase().includes(termo) ||
                        (p.codigo||'').toLowerCase().includes(termo)
                      )
                      const exato = lista.find(p =>
                        (p.codigo||'').toLowerCase() === termo ||
                        (p.codigo_barras||'').toLowerCase() === termo
                      )
                      const alvo = exato || lista[0]
                      if (alvo) { setBuscaSidebar(''); openForm(alvo) }
                    }}/>
                </div>
                {buscaSidebar.trim().length > 0 && (
                  <div className="mt-1 rounded-lg" style={{ border:'1px solid #1e2d40', maxHeight:160, overflowY:'auto' }}>
                    {produtos.filter(p =>
                      p.descricao.toLowerCase().includes(buscaSidebar.toLowerCase()) ||
                      (p.codigo||'').toLowerCase().includes(buscaSidebar.toLowerCase())
                    ).slice(0,8).map((p:any) => (
                      <button key={p.id} onClick={()=>openForm(p)}
                        className="w-full px-3 py-2 text-left transition-colors"
                        style={{ background:'#0d1625', display:'block', borderBottom:'1px solid #1e2d4033', color:'white' }}>
                        <p className="text-xs font-bold leading-tight truncate" style={{ textTransform:'uppercase' }}>{p.descricao}</p>
                        <p className="text-[9px] font-mono" style={{ color:'#64748b' }}>{p.codigo}</p>
                      </button>
                    ))}
                    {produtos.filter(p =>
                      p.descricao.toLowerCase().includes(buscaSidebar.toLowerCase()) ||
                      (p.codigo||'').toLowerCase().includes(buscaSidebar.toLowerCase())
                    ).length === 0 && (
                      <div className="px-3 py-2 text-xs" style={{ color:'#64748b' }}>Nenhum encontrado</div>
                    )}
                  </div>
                )}
              </div>

              {/* Imagem do produto */}
              <div className="rounded-xl overflow-hidden" style={{ border:'1px solid #2d3f55' }}>
                {/* Preview */}
                <div className="relative w-full flex items-center justify-center"
                  style={{ height:180, background: imagemUrl ? '#ffffff' : '#0e1520' }}>
                  {imgLoading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={28} className="animate-spin" style={{ color:'#f97316' }}/>
                      <p className="text-[10px] font-bold" style={{ color:'#64748b' }}>Buscando imagem...</p>
                    </div>
                  ) : imagemUrl ? (
                    <>
                      <img
                        src={imagemUrl.startsWith('/static') ? `${BASE_URL}${imagemUrl}` : imagemUrl}
                        alt="produto"
                        className="w-full h-full object-contain"
                        style={{ padding:'8px' }}
                        onError={()=>setImagemUrl('')}/>
                      <button onClick={removerImagem}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
                        style={{ background:'#ef4444', border:'2px solid white' }}>
                        <X size={11} style={{ color:'white' }}/>
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <ImageOff size={36} style={{ color:'#475569' }}/>
                      <p className="text-xs font-bold" style={{ color:'#475569' }}>SEM IMAGEM</p>
                    </div>
                  )}
                </div>

                {/* Botões */}
                <div className="flex border-t" style={{ borderColor:'#2d3f55' }}>
                  <button type="button" onClick={buscarImagemAutomatica} disabled={imgLoading}
                    className="flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-black"
                    style={{ background:'#1a2232', color:'#3b82f6', borderRight:'1px solid #2d3f55' }}>
                    {imgLoading ? <Loader2 size={10} className="animate-spin"/> : <Search size={10}/>} EAN
                  </button>
                  <button type="button" onClick={buscarImagemPorNome} disabled={imgLoading}
                    className="flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-black"
                    style={{ background:'#1a2232', color:'#a855f7', borderRight:'1px solid #2d3f55' }}>
                    {imgLoading ? <Loader2 size={10} className="animate-spin"/> : <Search size={10}/>} Nome
                  </button>
                  <label className="flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-black cursor-pointer"
                    style={{ background:'#1a2232', color:'#22c55e' }}>
                    <Upload size={10}/> Upload
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e=>{ const f=e.target.files?.[0]; if(f) uploadImagem(f) }}/>
                  </label>
                </div>

                {/* URL manual */}
                <div style={{ borderTop:'1px solid #2d3f55' }}>
                  <input
                    value={imagemUrl.startsWith('/static') ? '' : (imagemUrl || '')}
                    onChange={e=>setImagemUrl(e.target.value)}
                    placeholder="Cole a URL da imagem..."
                    className="w-full px-3 py-2 text-xs"
                    style={{ background:'#0e1520', color:'#94a3b8', outline:'none', border:'none' }}/>
                </div>

                {/* Info automático */}
                {!editando?.id && (form.codigo_barras || form.codigo) && (
                  <div className="mt-1 px-2 py-1.5 rounded-lg" style={{ background:'#f9731610', border:'1px solid #f9731630' }}>
                    <p className="text-[9px]" style={{ color:'#f97316' }}>
                      💡 Ao salvar, o sistema busca a imagem automaticamente pelo EAN no Open Food Facts e Cosmos
                    </p>
                  </div>
                )}
                {imgErr && <p className="text-[10px] mt-1" style={{ color:'#ef4444' }}>{imgErr}</p>}
              </div>

              {/* Código + EAN */}
              <div style={{ borderTop:'1px solid #1e2d40', paddingTop:12 }}>
                <p className="text-[9px] font-black tracking-widest mb-1.5" style={{ color:'#475569' }}>
                  {pesavel ? 'PLU' : 'CÓDIGO / EAN'}
                </p>
                <div className="flex gap-1.5">
                  <input value={form.codigo}
                    onChange={e=>{ const v=e.target.value; setForm((f:any)=>({...f,codigo:v})); if(!editando&&!pesavel) buscarEAN(v); if(!editando&&pesavel) setPluInfo(null) }}
                    onKeyDown={e=>{ if(e.key==='Enter'&&!editando&&form.codigo===''){e.preventDefault();gerarCodigo(pesavel)} }}
                    disabled={!!editando}
                    placeholder={pesavel?'PLU':'EAN ou código'}
                    className="flex-1 px-2.5 py-2 text-sm font-mono font-black rounded-lg"
                    style={{ background:'#1a2232', border:`1px solid ${eanInfo?.source==='interno'?'#f59e0b33':eanInfo&&!eanInfo.found?'#ef444433':'#2d3f55'}`, color:'#f59e0b', outline:'none' }}/>
                  {!editando && (
                    <button onClick={()=>gerarCodigo(pesavel)}
                      className="px-2.5 rounded-lg text-[10px] font-black flex items-center gap-0.5 flex-shrink-0"
                      style={{ background:'#f9731622', color:'#f97316', border:'1px solid #f9731644' }}>
                      <Zap size={9}/> Gerar
                    </button>
                  )}
                </div>
                {pesavel && pluInfo && (
                  <div className="mt-1.5 px-2 py-1.5 rounded-lg" style={{ background:'#f5a62312', border:'1px solid #f5a62333' }}>
                    <p className="text-[9px]" style={{ color:'#64748b' }}>PLU #{pluInfo.plu}</p>
                    <p className="text-[10px] font-mono font-bold" style={{ color:'#f5a623' }}>{pluInfo.ean_balanca}</p>
                  </div>
                )}
              </div>

              {/* Status Ativo/Inativo */}
              <button onClick={()=>setIsActive(v=>!v)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
                style={{ background: isActive?'#22c55e18':'#ef444418', border:`1.5px solid ${isActive?'#22c55e55':'#ef444455'}` }}>
                <div className="w-8 h-4 rounded-full relative flex-shrink-0 transition-all"
                  style={{ background: isActive?'#22c55e':'#475569' }}>
                  <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                    style={{ left: isActive ? '17px' : '2px' }}/>
                </div>
                <span className="text-xs font-black flex-1 text-left" style={{ color: isActive?'#22c55e':'#ef4444' }}>
                  {isActive ? 'Ativo' : 'Inativo'}
                </span>
                {editando && <span className="text-[9px] font-mono" style={{ color:'#2d3f55' }}>#{editando.id}</span>}
              </button>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 mt-auto" style={{ paddingTop:12, borderTop:'1px solid #1e2d40' }}>
                <button onClick={()=>salvar(true)} disabled={saving||!form.codigo||!form.descricao||!form.categoria_id}
                  className="w-full py-3 rounded-xl text-sm font-black"
                  style={{ background:(!form.codigo||!form.descricao||!form.categoria_id)?'#1a2232':'#16a34a',
                    color:(!form.codigo||!form.descricao||!form.categoria_id)?'#475569':'white' }}>
                  {saving?'Salvando...':'💾 Salvar e Próximo →'}
                </button>
                <button onClick={()=>salvar(false)} disabled={saving||!form.codigo||!form.descricao||!form.categoria_id}
                  className="w-full py-2 rounded-xl text-xs font-black"
                  style={{ background:(!form.codigo||!form.descricao||!form.categoria_id)?'#1a2232':'#1d4ed8',
                    color:(!form.codigo||!form.descricao||!form.categoria_id)?'#475569':'white' }}>
                  {saving?'...':editando?'💾 Salvar':'💾 Cadastrar'}
                </button>
                <button onClick={()=>openForm()}
                  className="w-full py-2 rounded-xl text-xs font-black"
                  style={{ background:'#0d2b1d', color:'#34c759', border:'1px solid #34c75933' }}>
                  + Novo Produto
                </button>
                <button onClick={()=>setShowForm(false)}
                  className="w-full py-2 rounded-xl text-xs font-black"
                  style={{ background:'#1a2232', color:'#64748b', border:'1px solid #1e2d40' }}>
                  Cancelar
                </button>
                {editando && (
                  <button onClick={async()=>{
                    if(!confirm(`Remover "${editando.descricao}"?`)) return
                    try { await api.delete(`/produtos/${editando.id}`); setShowForm(false); load() }
                    catch(e:any){ alert(e.response?.data?.detail||'Erro ao excluir') }
                  }}
                  className="w-full py-2 rounded-xl text-xs font-black"
                  style={{ background:'#2d0d0d', color:'#ef4444', border:'1px solid #ef444433' }}>
                    🗑 Excluir Produto
                  </button>
                )}
              </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 overflow-y-auto p-4" style={{ height:'100%' }}>

            {/* ── TAB: DADOS GERAIS ── */}
            {modalTab === 'geral' && (
              <div className="flex flex-col gap-3">

                {/* Descrição */}
                <div className="flex-shrink-0">
                  <label className="block text-xs font-black mb-1" style={{ color: form.descricao?'#64748b':'#f97316' }}>DESCRIÇÃO *</label>
                  <input value={form.descricao} onChange={e=>setForm((f:any)=>({...f,descricao:e.target.value.toUpperCase()}))}
                    className="w-full px-4 py-2.5 text-base font-bold rounded-lg"
                    style={{ background:'#1a2232', border:`1.5px solid ${form.descricao?'#2d3f55':'#f97316'}`, color:'white', outline:'none', textTransform:'uppercase' }}
                    placeholder="NOME COMPLETO DO PRODUTO"/>
                </div>

                {/* Categoria + Unidade + Localização */}
                <div className="grid grid-cols-3 gap-3 flex-shrink-0">
                  <div>
                    <label className="block text-xs font-black mb-1" style={{ color: form.categoria_id?'#64748b':'#f97316' }}>CATEGORIA *</label>
                    <select value={form.categoria_id} onChange={e=>setForm((f:any)=>({...f,categoria_id:e.target.value}))}
                      className="w-full px-3 py-2 text-sm rounded-lg"
                      style={{ background:'#1a2232', border:`1.5px solid ${form.categoria_id?'#2d3f55':'#f97316'}`, color:'white', outline:'none' }}>
                      <option value="">— Selecione —</option>
                      {categorias.map(c=><option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black mb-1" style={{ color:'#64748b' }}>UNIDADE</label>
                    {pesavel
                      ? <div className="px-3 py-2 rounded-lg text-sm font-black text-center" style={{ background:'#f5a62322', color:'#f5a623', border:'1px solid #f5a62333' }}>KG — Pesável</div>
                      : <select value={form.unidade} onChange={e=>setForm((f:any)=>({...f,unidade:e.target.value}))}
                          className="w-full px-3 py-2 text-sm rounded-lg"
                          style={{ background:'#1a2232', border:'1.5px solid #2d3f55', color:'white', outline:'none' }}>
                          {['UN','KG','CX','PC','LT','MT','SC','BD','DZ'].map(u=><option key={u}>{u}</option>)}
                        </select>
                    }
                  </div>
                  <div>
                    <label className="block text-xs font-black mb-1" style={{ color:'#64748b' }}>LOCALIZAÇÃO</label>
                    <input value={form.localizacao} onChange={e=>setForm((f:any)=>({...f,localizacao:e.target.value}))}
                      className="w-full px-3 py-2 text-sm rounded-lg"
                      style={{ background:'#1a2232', border:'1.5px solid #2d3f55', color:'white', outline:'none' }}
                      placeholder="Ex: A1-01"/>
                  </div>
                </div>

                {/* Código de barras */}
                <div className="flex-shrink-0">
                  <p className="text-xs font-black mb-1" style={{ color:'#64748b' }}>CÓDIGO DE BARRAS</p>
                  <div className="rounded-lg overflow-hidden" style={{ border:'1px solid #2d3f55' }}>
                    <div className="flex items-center gap-2 px-3 py-2" style={{ background:'#1a2232' }}>
                      {pesavel
                        ? <span className="text-xs font-black px-2 py-1 rounded flex-shrink-0" style={{ background:'#f5a62322', color:'#f5a623' }}>KG</span>
                        : <span className="text-xs font-black px-2 py-1 rounded flex-shrink-0" style={{ background:'#3b82f622', color:'#3b82f6' }}>{form.unidade}</span>
                      }
                      <input value={form.codigo_barras} onChange={e=>{
                          const v = e.target.value
                          setForm((f:any)=>({...f,codigo_barras:v}))
                          // Auto-busca imagem se EAN válido e sem imagem ainda
                          if (/^\d{8}$|^\d{12}$|^\d{13}$/.test(v) && !imagemUrl && !pesavel) buscarEAN(v)
                          // EAN-13 digitado → replica para código de barras da embalagem
                          if (/^\d{13}$/.test(v)) {
                            setEmbalagem(em => ({ ...em, codigo: em.codigo || v }))
                            setShowCaixaRow(true)
                          }
                        }}
                        className="flex-1 bg-transparent text-sm text-white outline-none"
                        placeholder="Código de barras da unidade"/>
                      {!showCaixaRow && (
                        <button onClick={()=>setShowCaixaRow(true)}
                          className="flex-shrink-0 text-xs font-black px-3 py-1.5 rounded-lg"
                          style={{ background:'#34c75922', color:'#34c759', border:'1px solid #34c75933' }}>
                          + Caixa/Fardo
                        </button>
                      )}
                    </div>
                    {showCaixaRow && (
                      <div className="flex items-center gap-2 px-3 py-2" style={{ borderTop:'1px solid #1e2d40', background:'#060a12' }}>
                        <select value={embalagem.tipo} onChange={e=>setEmbalagem(v=>({...v,tipo:e.target.value}))}
                          className="text-xs font-black rounded px-2 py-1.5 flex-shrink-0"
                          style={{ background:'#34c75922', color:'#34c759', border:'1px solid #34c75933', outline:'none' }}>
                          {[{v:'CX',l:'Caixa'},{v:'FD',l:'Fardo'},{v:'BD',l:'Bandeja'},{v:'SC',l:'Saco'},{v:'PC',l:'Pacote'},{v:'DZ',l:'Dúzia'},{v:'KT',l:'Kit'}]
                            .map(o=><option key={o.v} value={o.v} style={{ background:'#0d1117' }}>{o.v} — {o.l}</option>)}
                        </select>
                        <input type="text" inputMode="numeric" value={embalagem.qtd}
                          onFocus={e=>e.currentTarget.select()}
                          onChange={e=>setEmbalagem(v=>({...v,qtd:e.target.value.replace(/\D/g,'')}))}
                          className="w-14 text-center text-sm font-black rounded px-2 py-1.5 flex-shrink-0"
                          style={{ background:'#34c75922', color:'#34c759', border:'1px solid #34c75933', outline:'none' }}
                          placeholder="qtd"/>
                        <span className="text-xs flex-shrink-0" style={{ color:'#475569' }}>{pesavel?'KG':form.unidade}</span>
                        <input value={embalagem.codigo} onChange={e=>setEmbalagem(v=>({...v,codigo:e.target.value}))}
                          className="flex-1 bg-transparent text-sm text-white outline-none"
                          placeholder="Cód. barras embalagem"/>
                        <button onClick={()=>{setShowCaixaRow(false);setEmbalagem(v=>({...v,codigo:'',qtd:'',tipo:'CX'}))}}
                          className="flex-shrink-0 text-sm" style={{ color:'#475569' }}>✕</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Características — grid 2x2 */}
                <div className="flex-shrink-0">
                  <p className="text-xs font-black mb-1.5" style={{ color:'#64748b' }}>CARACTERÍSTICAS</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer select-none"
                      style={{ background:'#1a2232', border:`1.5px solid ${pesavel?'#f5a62355':'#2d3f55'}` }}
                      onClick={()=>{ if(!editando){ const v=!pesavel; setPesavel(v); setPluInfo(null); setEanInfo(null); if(v) setForm((f:any)=>({...f,unidade:'KG'})) } }}>
                      <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                        style={{ background:pesavel?'#f5a623':'#0a0f1a', border:pesavel?'none':'1.5px solid #2d3f55' }}>
                        {pesavel&&<span className="text-white text-[9px] font-black">✓</span>}
                      </div>
                      <span className="text-sm font-bold" style={{ color:pesavel?'#f5a623':'#94a3b8' }}>⚖ Pesável (KG)</span>
                    </label>
                    <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer select-none"
                      style={{ background:'#1a2232', border:`1.5px solid ${enviarBalanca?'#32ade655':'#2d3f55'}` }}
                      onClick={()=>setEnviarBalanca(v=>!v)}>
                      <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                        style={{ background:enviarBalanca?'#32ade6':'#0a0f1a', border:enviarBalanca?'none':'1.5px solid #2d3f55' }}>
                        {enviarBalanca&&<span className="text-white text-[9px] font-black">✓</span>}
                      </div>
                      <span className="text-sm font-bold" style={{ color:enviarBalanca?'#32ade6':'#94a3b8' }}>📡 Enviar Balança</span>
                    </label>
                    <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer select-none"
                      style={{ background: atacarejo?'#ff9f0a08':'#1a2232', border:`1.5px solid ${atacarejo?'#ff9f0a55':'#2d3f55'}` }}
                      onClick={()=>setAtacarejo(v=>!v)}>
                      <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                        style={{ background:atacarejo?'#ff9f0a':'#0a0f1a', border:atacarejo?'none':'1.5px solid #2d3f55' }}>
                        {atacarejo&&<span className="text-white text-[9px] font-black">✓</span>}
                      </div>
                      <span className="text-sm font-bold flex-1" style={{ color:atacarejo?'#ff9f0a':'#94a3b8' }}>🏪 Atacarejo</span>
                      {atacarejo && atacarejoPreco && (
                        <span className="text-xs font-bold" style={{ color:'#ff9f0a' }}>{atacarejoQtd}+→R${parseFloat(atacarejoPreco).toFixed(2)}</span>
                      )}
                      {atacarejo && !atacarejoPreco && (
                        <button onClick={e=>{ e.preventDefault(); setModalTab('precos') }}
                          className="text-xs px-2 py-0.5 rounded font-black"
                          style={{ background:'#ff9f0a22', color:'#ff9f0a' }}>Preços →</button>
                      )}
                    </label>
                    <div className="rounded-lg overflow-hidden" style={{ border:`1.5px solid ${controlaValidade?'#3b82f655':'#2d3f55'}` }}>
                      <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none"
                        style={{ background: controlaValidade?'#3b82f608':'#1a2232' }}
                        onClick={()=>setControlaValidade(v=>!v)}>
                        <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                          style={{ background:controlaValidade?'#3b82f6':'#0a0f1a', border:controlaValidade?'none':'1.5px solid #2d3f55' }}>
                          {controlaValidade&&<span className="text-white text-[9px] font-black">✓</span>}
                        </div>
                        <span className="text-sm font-bold flex-1" style={{ color:controlaValidade?'#3b82f6':'#94a3b8' }}>📅 Controla Validade</span>
                      </label>
                      {controlaValidade && (
                        <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderTop:'1px solid #2d3f55' }}>
                          <input type="number" min="1" value={diasValidadeAlerta}
                            onChange={e=>setDiasValidadeAlerta(e.target.value)}
                            className="w-16 px-2 py-1 text-sm rounded text-center font-black"
                            style={{ background:'#1a2232', color:'#3b82f6', border:'1px solid #3b82f633', outline:'none' }}/>
                          <span className="text-xs" style={{ color:'#475569' }}>dias de alerta</span>
                        </div>
                      )}
                    </div>
                    {/* Checkbox Insumo/Produção — linha inteira */}
                    <label className="col-span-2 flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer select-none"
                      style={{ background: insumoProducao?'#a855f708':'#1a2232', border:`1.5px solid ${insumoProducao?'#a855f755':'#2d3f55'}` }}
                      onClick={()=>setInsumoProducao(v=>!v)}>
                      <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                        style={{ background:insumoProducao?'#a855f7':'#0a0f1a', border:insumoProducao?'none':'1.5px solid #2d3f55' }}>
                        {insumoProducao&&<span className="text-white text-[9px] font-black">✓</span>}
                      </div>
                      <span className="text-sm font-bold flex-1" style={{ color:insumoProducao?'#a855f7':'#94a3b8' }}>
                        🧪 Produto Insumo / Produção
                      </span>
                      {insumoProducao && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded" style={{ background:'#a855f722', color:'#a855f7' }}>
                          Aparece na Pesquisa de Receita
                        </span>
                      )}
                    </label>
                  </div>
                </div>

                {/* Fornecedores */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black" style={{ color:'#64748b' }}>🏭 FORNECEDORES VINCULADOS</p>
                    <select value={addFornId}
                      onChange={e => {
                        const id = Number(e.target.value); if (!id) return
                        if (fornsProduto.find(f=>f.fornecedor_id===id)) { setAddFornId(''); return }
                        const forn = fornsLista.find((f:any)=>f.id===id)
                        const isPrincipal = fornsProduto.length === 0
                        setFornsProduto(prev=>[...prev,{fornecedor_id:id,nome:forn?.fantasia||forn?.razao_social||'',principal:isPrincipal}])
                        setAddFornId('')
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ background:'#34c75922', color:'#34c759', border:'1px solid #34c75933', outline:'none' }}>
                      <option value="">+ Vincular fornecedor</option>
                      {fornsLista.filter((f:any)=>!fornsProduto.find(p=>p.fornecedor_id===f.id)).map((f:any)=>
                        <option key={f.id} value={f.id} style={{ background:'#0d1117', color:'white' }}>{f.fantasia||f.razao_social}</option>
                      )}
                    </select>
                  </div>
                  <div className="rounded-lg overflow-hidden" style={{ border:'1px solid #2d3f55' }}>
                    {fornsProduto.length === 0
                      ? <div className="px-3 py-3 text-sm text-center" style={{ background:'#1a2232', color:'#475569' }}>
                          Nenhum fornecedor vinculado
                        </div>
                      : fornsProduto.map((f, i) => (
                          <div key={f.fornecedor_id} className="flex items-center gap-3 px-3 py-2.5"
                            style={{ background:'#1a2232', borderTop: i>0?'1px solid #1e2d40':undefined }}>
                            <span className="text-base">🏭</span>
                            <span className="text-sm flex-1 text-white font-bold truncate">{f.nome}</span>
                            {f.principal
                              ? <span className="text-xs font-black px-2 py-1 rounded" style={{ background:'#f9731622', color:'#f97316' }}>⭐ Principal</span>
                              : <button type="button" onClick={()=>setFornsProduto(prev=>prev.map(x=>({...x,principal:x.fornecedor_id===f.fornecedor_id})))}
                                  className="text-xs px-2 py-1 rounded" style={{ color:'#64748b', background:'#0a0f1a' }}>⭐ principal</button>
                            }
                            <button type="button" onClick={()=>setFornsProduto(prev=>{
                              const filtered = prev.filter(x=>x.fornecedor_id!==f.fornecedor_id)
                              if (f.principal && filtered.length>0) filtered[0] = {...filtered[0],principal:true}
                              return filtered
                            })} className="w-6 h-6 rounded flex items-center justify-center text-xs"
                              style={{ background:'#ef444422', color:'#ef4444' }}>✕</button>
                          </div>
                        ))
                    }
                  </div>
                </div>

              </div>
            )}

            {/* ── TAB: FISCAL ── */}
            {modalTab === 'fiscal' && (
              <div className="space-y-5 max-w-2xl">
                {/* Regime padrão */}
                <div className="flex items-center justify-between p-4 rounded-xl" style={{ background:'#1a2232', border:'1px solid #2d3f55' }}>
                  <div>
                    <p className="text-sm font-bold text-white">Regime tributário padrão</p>
                    <p className="text-xs mt-0.5" style={{ color:'#64748b' }}>
                      {regimePadrao ? `${regimePadrao.regime?.replace(/_/g,' ')} — ${regimePadrao.nome||''}` : 'Não configurado em Configurações → Empresa'}
                    </p>
                  </div>
                  <button onClick={aplicarPadrao} disabled={!regimePadrao}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
                    style={{ background:'#f9731622', color:'#f97316', border:'1px solid #f9731644' }}>
                    <RefreshCw size={13}/> Aplicar Padrão
                  </button>
                </div>
                {/* NCM + CEST */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black mb-2" style={{ color:'#64748b' }}>NCM</label>
                    <input value={form.ncm} onChange={e=>setForm((f:any)=>({...f,ncm:e.target.value}))}
                      className="w-full px-3 py-2.5 text-sm rounded-xl"
                      style={{ background:'#1a2232', border:'1.5px solid #2d3f55', color:'white', outline:'none' }}
                      placeholder="0000.00.00"/>
                    <p className="text-[10px] mt-1" style={{ color:'#475569' }}>Nomenclatura Comum do Mercosul</p>
                  </div>
                  <div>
                    <label className="block text-xs font-black mb-2" style={{ color:'#64748b' }}>CEST</label>
                    <input value={fiscal.cest} onChange={e=>setFiscal(f=>({...f,cest:e.target.value}))}
                      className="w-full px-3 py-2.5 text-sm rounded-xl"
                      style={{ background:'#1a2232', border:'1.5px solid #2d3f55', color:'white', outline:'none' }}
                      placeholder="00.000.00"/>
                    <p className="text-[10px] mt-1" style={{ color:'#475569' }}>Código Especificador da Substituição Tributária</p>
                  </div>
                </div>
                {/* CFOP + CST/CSOSN */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black mb-2" style={{ color:'#64748b' }}>CFOP DE SAÍDA</label>
                    <select value={fiscal.cfop_saida} onChange={e=>setFiscal(f=>({...f,cfop_saida:e.target.value}))}
                      className="w-full px-3 py-2.5 text-sm rounded-xl"
                      style={{ background:'#1a2232', border:'1.5px solid #2d3f55', color:'white', outline:'none' }}>
                      {[['5102','5102 — Venda no Estado'],['5405','5405 — Venda ST no Estado'],
                        ['6102','6102 — Venda Interestadual'],['6404','6404 — Venda ST Interestadual'],
                        ['5903','5903 — Retorno de mercadoria']].map(([v,l])=><option key={v} value={v} style={{ background:'#0d1117' }}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black mb-2" style={{ color:'#64748b' }}>
                      {regimePadrao?.regime==='SIMPLES_NACIONAL' ? 'CSOSN' : 'CST ICMS'}
                    </label>
                    {regimePadrao?.regime==='SIMPLES_NACIONAL' ? (
                      <select value={fiscal.csosn} onChange={e=>setFiscal(f=>({...f,csosn:e.target.value}))}
                        className="w-full px-3 py-2.5 text-sm rounded-xl"
                        style={{ background:'#1a2232', border:'1.5px solid #2d3f55', color:'white', outline:'none' }}>
                        {[['101','101 — Tributada SN c/ crédito'],['102','102 — Tributada SN s/ crédito'],
                          ['300','300 — Imune'],['400','400 — Não tributada SN'],
                          ['500','500 — ICMS anterior por ST'],['900','900 — Outras']].map(([v,l])=><option key={v} value={v} style={{ background:'#0d1117' }}>{l}</option>)}
                      </select>
                    ) : (
                      <select value={fiscal.cst_icms} onChange={e=>setFiscal(f=>({...f,cst_icms:e.target.value}))}
                        className="w-full px-3 py-2.5 text-sm rounded-xl"
                        style={{ background:'#1a2232', border:'1.5px solid #2d3f55', color:'white', outline:'none' }}>
                        {[['000','000 — Tributada integralmente'],['010','010 — Tributada c/ ST'],
                          ['020','020 — Com redução de BC'],['040','040 — Isenta'],
                          ['041','041 — Não tributada'],['060','060 — ICMS anterior por ST'],
                          ['070','070 — Redução BC + ST'],['090','090 — Outras']].map(([v,l])=><option key={v} value={v} style={{ background:'#0d1117' }}>{l}</option>)}
                      </select>
                    )}
                  </div>
                </div>
                {/* Alíquotas */}
                <div>
                  <p className="text-xs font-black mb-3" style={{ color:'#64748b' }}>ALÍQUOTAS DE SAÍDA (%)</p>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { k:'icms_aliquota', l:'ICMS', cor:'#f59e0b', desc:'Imposto sobre Circulação' },
                      { k:'pis_aliquota',  l:'PIS',  cor:'#3b82f6', desc:'Prog. Integração Social' },
                      { k:'cofins_aliquota', l:'COFINS', cor:'#8b5cf6', desc:'Contribuição Social' },
                    ].map(({k,l,cor,desc}) => (
                      <div key={k} className="p-4 rounded-xl text-center" style={{ background:'#1a2232', border:`1.5px solid ${cor}33` }}>
                        <label className="block text-xs font-black mb-2" style={{ color:cor }}>{l}</label>
                        <input type="number" step="0.01" min="0" max="100"
                          value={(fiscal as any)[k]}
                          onChange={e=>setFiscal(f=>({...f,[k]:parseFloat(e.target.value)||0}))}
                          onFocus={e=>e.currentTarget.select()}
                          className="w-full px-2 py-2 text-xl rounded-lg text-center font-black"
                          style={{ background:'#060a12', color:'white', border:`1px solid ${cor}44`, outline:'none' }}/>
                        <p className="text-[9px] mt-1.5" style={{ color:'#475569' }}>{desc}</p>
                      </div>
                    ))}
                  </div>
                  {regimePadrao?.regime==='SIMPLES_NACIONAL' && (
                    <div className="mt-3 px-4 py-3 rounded-xl" style={{ background:'#3b82f610', border:'1px solid #3b82f622' }}>
                      <p className="text-xs" style={{ color:'#64748b' }}>
                        💡 No <strong className="text-white">Simples Nacional</strong>, PIS e COFINS são recolhidos via DAS — os campos podem ficar em 0.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB: PREÇOS ── */}
            {modalTab === 'precos' && (
              <div className="space-y-2">
                {/* Calculadora — linha única compacta */}
                <div className="p-3 rounded-xl" style={{ background:'#1a2232', border:'1.5px solid #2d3f55' }}>
                  <p className="text-[9px] font-black mb-2" style={{ color:'#64748b' }}>CALCULADORA DE PREÇO</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold mb-1" style={{ color:'#64748b' }}>CUSTO (R$)</label>
                      <input value={form.preco_custo} type="number" onFocus={e=>e.currentTarget.select()}
                        onChange={e=>handleCustoMargem('preco_custo',e.target.value)}
                        className="w-full px-3 py-2 text-lg font-black rounded-lg text-right"
                        style={{ background:'#060a12', border:'1.5px solid #2d3f55', color:'#94a3b8', outline:'none' }}
                        placeholder="0,00"/>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold mb-1" style={{ color:'#64748b' }}>MARGEM (%)</label>
                      <input value={form.margem} type="number" onFocus={e=>e.currentTarget.select()}
                        onChange={e=>handleCustoMargem('margem',e.target.value)}
                        className="w-full px-3 py-2 text-lg font-black rounded-lg text-right"
                        style={{ background:'#060a12', border:'1.5px solid #f9731644', color:'#f97316', outline:'none' }}/>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold mb-1" style={{ color:'#f97316' }}>PREÇO VENDA (R$) ▶</label>
                      <input value={form.preco_venda} type="number" onFocus={e=>e.currentTarget.select()}
                        onChange={e=>handleVenda(e.target.value)}
                        className="w-full px-3 py-2 text-lg font-black rounded-lg text-right"
                        style={{ background:'#060a12', border:'1.5px solid #f9731688', color:'white', outline:'none' }}
                        placeholder="0,00"/>
                    </div>
                  </div>
                  {form.preco_custo && form.preco_venda && parseFloat(form.preco_custo)>0 && parseFloat(form.preco_venda)>0 && (() => {
                    const custo = parseFloat(form.preco_custo), venda = parseFloat(form.preco_venda)
                    const margem = ((venda-custo)/venda*100), markup = ((venda-custo)/custo*100), lucro = venda-custo
                    return (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {[
                          { label:'MARGEM', val:`${margem.toFixed(1)}%`, cor: margem>=30?'#22c55e':margem>=15?'#f59e0b':'#ef4444' },
                          { label:'MARKUP', val:`${markup.toFixed(1)}%`, cor:'#3b82f6' },
                          { label:'LUCRO UN.', val:`R$ ${lucro.toFixed(2).replace('.',',')}`, cor:'#22c55e' },
                        ].map(x=>(
                          <div key={x.label} className="text-center py-2 rounded-lg" style={{ background:'#060a12' }}>
                            <p className="text-[9px] font-bold" style={{ color:'#475569' }}>{x.label}</p>
                            <p className="text-xl font-black" style={{ color:x.cor }}>{x.val}</p>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>

                {/* Estoque + Atacarejo na mesma linha */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl" style={{ background:'#1a2232', border:'1.5px solid #2d3f55' }}>
                    <label className="block text-[9px] font-black mb-1" style={{ color:'#64748b' }}>ESTOQUE ATUAL</label>
                    <input value={form.estoque_atual} type="number" onFocus={e=>e.currentTarget.select()}
                      onChange={e=>setForm((f:any)=>({...f,estoque_atual:e.target.value}))}
                      className="w-full px-3 py-2 text-xl font-black rounded-lg text-right"
                      style={{ background:'#060a12', border:'1.5px solid #2d3f55', color:'white', outline:'none' }}/>
                    <p className="text-[9px] mt-1" style={{ color:'#475569' }}>Unidades em estoque</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background:'#1a2232', border:'1.5px solid #ef444433' }}>
                    <label className="block text-[9px] font-black mb-1" style={{ color:'#64748b' }}>ESTOQUE MÍNIMO</label>
                    <input value={form.estoque_minimo} type="number" onFocus={e=>e.currentTarget.select()}
                      onChange={e=>setForm((f:any)=>({...f,estoque_minimo:e.target.value}))}
                      className="w-full px-3 py-2 text-xl font-black rounded-lg text-right"
                      style={{ background:'#060a12', border:'1.5px solid #ef444433', color:'#ef4444', outline:'none' }}/>
                    <p className="text-[9px] mt-1" style={{ color:'#475569' }}>Alerta quando atingir</p>
                  </div>
                </div>

                {/* Atacarejo compacto */}
                <div className="rounded-xl overflow-hidden" style={{ border:`1.5px solid ${atacarejo?'#ff9f0a55':'#2d3f55'}` }}>
                  <div className="flex items-center gap-3 px-3 py-2" style={{ background: atacarejo?'#ff9f0a12':'#1a2232' }}>
                    <span>🏪</span>
                    <div className="flex-1">
                      <p className="text-xs font-bold" style={{ color:atacarejo?'#ff9f0a':'#94a3b8' }}>Atacarejo</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer" onClick={()=>setAtacarejo(v=>!v)}>
                      <span className="text-[9px] font-black" style={{ color: atacarejo?'#ff9f0a':'#475569' }}>{atacarejo?'Ativo':'Inativo'}</span>
                      <div className="w-8 h-4 rounded-full relative" style={{ background: atacarejo?'#ff9f0a':'#475569' }}>
                        <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" style={{ left: atacarejo?'17px':'2px' }}/>
                      </div>
                    </label>
                  </div>
                  {atacarejo && (
                    <div className="flex items-center gap-3 px-3 py-2" style={{ borderTop:'1px solid #ff9f0a33', background:'#ff9f0a08' }}>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <input type="text" inputMode="numeric" value={atacarejoQtd}
                          onFocus={e=>e.currentTarget.select()}
                          onChange={e=>setAtacarejoQtd(e.target.value.replace(/\D/g,''))}
                          className="w-14 text-center text-base font-black rounded-lg px-2 py-1.5"
                          style={{ background:'#ff9f0a22', color:'#ff9f0a', border:'1px solid #ff9f0a44', outline:'none' }}/>
                        <span className="text-[10px]" style={{ color:'#475569' }}>un →</span>
                      </div>
                      <input type="number" value={atacarejoPreco} onFocus={e=>e.currentTarget.select()}
                        onChange={e=>setAtacarejoPreco(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-base font-black rounded-lg"
                        style={{ background:'#ff9f0a12', border:'1.5px solid #ff9f0a44', color:'white', outline:'none' }}
                        placeholder="Preço atacarejo R$"/>
                      {atacarejoPreco && parseFloat(atacarejoPreco)>0 && form.preco_custo && parseFloat(form.preco_custo)>0 && (() => {
                        const mAtk = ((parseFloat(atacarejoPreco)-parseFloat(form.preco_custo))/parseFloat(atacarejoPreco)*100)
                        return <p className="text-xl font-black flex-shrink-0" style={{ color: mAtk>=15?'#34c759':mAtk>=5?'#ff9f0a':'#ef4444', minWidth:70, textAlign:'right' }}>{mAtk.toFixed(1)}%</p>
                      })()}
                    </div>
                  )}
                </div>

                {/* Dica — compacta */}
                <div className="px-3 py-2 rounded-lg" style={{ background:'#3b82f608', border:'1px solid #3b82f622' }}>
                  <p className="text-[10px]" style={{ color:'#64748b' }}>
                    💡 Para alterar preços em massa, acesse o módulo <strong className="text-white">Gestão de Preços</strong> no menu principal.
                  </p>
                </div>
              </div>
            )}

            {/* ── TAB: NUTRICIONAL ── */}
            {modalTab === 'nutricional' && (
              <div className="space-y-4 max-w-2xl">
                <p className="text-xs font-black" style={{ color:'#64748b' }}>INFORMAÇÕES NUTRICIONAIS</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {label:'Porção (g/ml)', key:'porcao'},
                    {label:'Valor Energético (kcal)', key:'energia'},
                    {label:'Carboidratos (g)', key:'carboidratos'},
                    {label:'Proteínas (g)', key:'proteinas'},
                    {label:'Gorduras Totais (g)', key:'gorduras_totais'},
                    {label:'Gorduras Saturadas (g)', key:'gorduras_saturadas'},
                    {label:'Fibra Alimentar (g)', key:'fibras'},
                    {label:'Sódio (mg)', key:'sodio'},
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-[10px] font-black mb-1" style={{ color:'#64748b' }}>{f.label}</label>
                      <input type="number" placeholder="0"
                        className="w-full px-3 py-2 text-sm rounded-lg"
                        style={{ background:'#1a2232', border:'1px solid #2d3f55', color:'white', outline:'none' }}/>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB: RECEITA ── */}
            {modalTab === 'receita' && (
              <div className="space-y-4 max-w-2xl">
                <p className="text-xs font-black" style={{ color:'#64748b' }}>RECEITA / COMPOSIÇÃO</p>
                <div className="rounded-xl p-4" style={{ background:'#1a2232', border:'1px solid #2d3f55' }}>
                  <p className="text-xs mb-2" style={{ color:'#64748b' }}>Modo de preparo / ingredientes</p>
                  <textarea rows={8} placeholder="Descreva a receita ou composição do produto..."
                    className="w-full px-3 py-2 text-sm rounded-lg resize-none"
                    style={{ background:'#0d1117', border:'1px solid #2d3f55', color:'white', outline:'none' }}/>
                </div>
              </div>
            )}

            {/* ── TAB: FRACIONAMENTO ── */}
            {modalTab === 'fracionamento' && (
              <div className="space-y-4 max-w-2xl">
                <p className="text-xs font-black" style={{ color:'#64748b' }}>FRACIONAMENTO</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black mb-1" style={{ color:'#64748b' }}>UNIDADE DE VENDA</label>
                    <select className="w-full px-3 py-2 text-sm rounded-lg"
                      style={{ background:'#1a2232', border:'1px solid #2d3f55', color:'white', outline:'none' }}>
                      {['UN','KG','G','LT','ML','MT','CM'].map(u=><option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black mb-1" style={{ color:'#64748b' }}>QUANTIDADE POR EMBALAGEM</label>
                    <input type="number" placeholder="1" className="w-full px-3 py-2 text-sm rounded-lg"
                      style={{ background:'#1a2232', border:'1px solid #2d3f55', color:'white', outline:'none' }}/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black mb-1" style={{ color:'#64748b' }}>PESO LÍQUIDO (g)</label>
                    <input type="number" placeholder="0" className="w-full px-3 py-2 text-sm rounded-lg"
                      style={{ background:'#1a2232', border:'1px solid #2d3f55', color:'white', outline:'none' }}/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black mb-1" style={{ color:'#64748b' }}>PESO BRUTO (g)</label>
                    <input type="number" placeholder="0" className="w-full px-3 py-2 text-sm rounded-lg"
                      style={{ background:'#1a2232', border:'1px solid #2d3f55', color:'white', outline:'none' }}/>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: PRODUÇÃO ── */}
            {modalTab === 'producao' && (() => {
              const custoInsumos = ingredientes.reduce((acc, ing) => {
                const q = parseFloat(ing.qtde) || 0
                const c = parseFloat(ing.custo) || 0
                return acc + q * c
              }, 0)
              const maoObra  = parseFloat(producaoMaoObra)  || 0
              const embal    = parseFloat(producaoEmbalagem) || 0
              const rend     = parseFloat(producaoRendimento) || 1
              const custoTotal  = custoInsumos + maoObra + embal
              const custoUnit   = custoTotal / rend
              return (
              <div className="space-y-3 max-w-2xl">
                {/* Parâmetros */}
                <div className="p-3 rounded-xl" style={{ background:'#1a2232', border:'1.5px solid #2d3f55' }}>
                  <p className="text-xs font-black mb-2" style={{ color:'#f97316' }}>🔧 PARÂMETROS DA RECEITA</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] font-black mb-1" style={{ color:'#64748b' }}>RENDIMENTO (UN)</label>
                      <input type="number" value={producaoRendimento} onFocus={e=>e.currentTarget.select()}
                        onChange={e=>setProducaoRendimento(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-black rounded-lg text-center"
                        style={{ background:'#060a12', border:'1.5px solid #f9731644', color:'#f97316', outline:'none' }}/>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black mb-1" style={{ color:'#64748b' }}>MÃO DE OBRA (R$)</label>
                      <input type="number" value={producaoMaoObra} placeholder="0,00" onFocus={e=>e.currentTarget.select()}
                        onChange={e=>setProducaoMaoObra(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg text-right"
                        style={{ background:'#060a12', border:'1px solid #2d3f55', color:'white', outline:'none' }}/>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black mb-1" style={{ color:'#64748b' }}>EMBALAGEM (R$)</label>
                      <input type="number" value={producaoEmbalagem} placeholder="0,00" onFocus={e=>e.currentTarget.select()}
                        onChange={e=>setProducaoEmbalagem(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg text-right"
                        style={{ background:'#060a12', border:'1px solid #2d3f55', color:'white', outline:'none' }}/>
                    </div>
                  </div>
                </div>

                {/* Ficha técnica */}
                <div className="p-3 rounded-xl" style={{ background:'#1a2232', border:'1.5px solid #2d3f55' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-black" style={{ color:'#64748b' }}>📋 FICHA TÉCNICA / INGREDIENTES</p>
                    <button onClick={()=>{ setFormIngred({nome:'',qtde:'',un:'UN',custo:''}); setShowAddIngred(true) }}
                      className="text-xs font-black px-3 py-1.5 rounded-lg"
                      style={{ background:'#f9731622', color:'#f97316', border:'1px solid #f9731644' }}>
                      + Adicionar
                    </button>
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ border:'1px solid #2d3f55' }}>
                    <div className="flex items-center gap-1 px-3 py-2" style={{ background:'#060a12', borderBottom:'1px solid #2d3f55' }}>
                      <span className="text-[9px] font-black flex-1" style={{ color:'#475569' }}>INGREDIENTE / MATÉRIA PRIMA</span>
                      <span className="text-[9px] font-black w-16 text-center" style={{ color:'#475569' }}>QTDE</span>
                      <span className="text-[9px] font-black w-12 text-center" style={{ color:'#475569' }}>UN</span>
                      <span className="text-[9px] font-black w-24 text-right" style={{ color:'#475569' }}>CUSTO UN (R$)</span>
                      <span className="text-[9px] font-black w-24 text-right" style={{ color:'#475569' }}>TOTAL</span>
                      <span className="w-6"/>
                    </div>
                    {showAddIngred && (() => {
                      const insumos = produtos.filter((p:any) => p.insumo_producao)
                      const termo = buscaIngred.toLowerCase()
                      const filtrados = insumos.filter((p:any) =>
                        !termo || p.descricao.toLowerCase().includes(termo) || (p.codigo||'').toLowerCase().includes(termo) || (p.codigo_barras||'').includes(termo)
                      )
                      return (
                      <div style={{ background:'#0d1624', borderBottom:'1px solid #2d3f55' }}>
                        {/* Linha de busca */}
                        <div className="flex items-center gap-1 px-2 py-1.5 relative">
                          <div className="flex-1 relative">
                            <input autoFocus value={buscaIngred}
                              onChange={e=>{ setBuscaIngred(e.target.value.toUpperCase()); setShowIngredDrop(true) }}
                              onFocus={()=>setShowIngredDrop(true)}
                              placeholder="🔍 CÓDIGO OU NOME DO INSUMO..."
                              className="w-full bg-transparent text-xs text-white outline-none px-2 py-1.5 rounded"
                              style={{ border:'1px solid #a855f744', textTransform:'uppercase' }}
                              onKeyDown={e=>{ if(e.key==='Escape'){ setShowAddIngred(false); setBuscaIngred('') } }}/>
                            {showIngredDrop && (
                              <div className="absolute left-0 right-0 top-full z-50 rounded-lg overflow-hidden shadow-xl"
                                style={{ background:'#0d1117', border:'1px solid #a855f744', maxHeight:200, overflowY:'auto' }}>
                                {filtrados.length === 0
                                  ? <div className="px-3 py-3 text-xs text-center" style={{ color:'#475569' }}>
                                      {insumos.length === 0 ? '⚠ Nenhum produto marcado como Insumo/Produção' : 'Nenhum resultado'}
                                    </div>
                                  : filtrados.map((p:any) => (
                                      <div key={p.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#a855f714]"
                                        style={{ borderBottom:'1px solid #1e2d40' }}
                                        onMouseDown={e=>{ e.preventDefault()
                                          setFormIngred(v=>({ ...v, nome:p.descricao, un:p.unidade||'UN', custo: p.preco_custo ? String(p.preco_custo) : v.custo }))
                                          setBuscaIngred(p.descricao); setShowIngredDrop(false)
                                        }}>
                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded flex-shrink-0" style={{ background:'#a855f722', color:'#a855f7' }}>{p.codigo||'—'}</span>
                                        <span className="flex-1 text-xs text-white truncate" style={{ textTransform:'uppercase' }}>{p.descricao}</span>
                                        {p.preco_custo && <span className="text-[10px]" style={{ color:'#64748b' }}>R$ {parseFloat(p.preco_custo).toFixed(2).replace('.',',')}</span>}
                                      </div>
                                    ))
                                }
                              </div>
                            )}
                          </div>
                          <input value={formIngred.qtde} onChange={e=>setFormIngred(v=>({...v,qtde:e.target.value}))}
                            onFocus={e=>{ e.currentTarget.select(); setShowIngredDrop(false) }} placeholder="Qtde" type="number"
                            className="w-16 text-center text-xs font-black outline-none px-1 py-1.5 rounded"
                            style={{ background:'#1a2232', border:'1px solid #2d3f55', color:'white' }}/>
                          <select value={formIngred.un} onChange={e=>setFormIngred(v=>({...v,un:e.target.value}))}
                            className="w-12 text-xs font-black rounded px-1 py-1.5 outline-none"
                            style={{ background:'#1a2232', border:'1px solid #2d3f55', color:'white' }}>
                            {['UN','KG','G','LT','ML','CX','SC','PC'].map(u=><option key={u}>{u}</option>)}
                          </select>
                          <input value={formIngred.custo} onChange={e=>setFormIngred(v=>({...v,custo:e.target.value}))}
                            onFocus={e=>{ e.currentTarget.select(); setShowIngredDrop(false) }} placeholder="0,00" type="number"
                            className="w-24 text-right text-xs font-black outline-none px-2 py-1.5 rounded"
                            style={{ background:'#1a2232', border:'1px solid #f9731644', color:'#f97316' }}/>
                          <div className="w-24 text-right text-xs font-black px-2" style={{ color:'#22c55e' }}>
                            {formIngred.qtde && formIngred.custo ? `R$ ${(parseFloat(formIngred.qtde)*parseFloat(formIngred.custo)).toFixed(2).replace('.',',')}` : '—'}
                          </div>
                          <button onClick={()=>{ if(formIngred.nome.trim()) setIngredientes(v=>[...v,{...formIngred}]); setShowAddIngred(false); setBuscaIngred('') }}
                            className="w-6 h-6 rounded flex items-center justify-center text-xs font-black"
                            style={{ background:'#34c75922', color:'#34c759', border:'1px solid #34c75933' }}>✓</button>
                          <button onClick={()=>{ setShowAddIngred(false); setBuscaIngred('') }}
                            className="w-6 h-6 rounded flex items-center justify-center text-xs"
                            style={{ background:'#ef444422', color:'#ef4444' }}>✕</button>
                        </div>
                      </div>
                      )
                    })()}
                    {ingredientes.length === 0 && !showAddIngred
                      ? <div className="px-4 py-4 text-center text-xs" style={{ color:'#475569' }}>Nenhum ingrediente cadastrado</div>
                      : ingredientes.map((ing, i) => {
                          const tot = (parseFloat(ing.qtde)||0) * (parseFloat(ing.custo)||0)
                          return (
                            <div key={i} className="flex items-center gap-1 px-3 py-2"
                              style={{ background: i%2===0?'#1a2232':'#141c2b', borderTop: i>0||showAddIngred?'1px solid #1e2d40':undefined }}>
                              <span className="flex-1 text-xs text-white truncate">{ing.nome}</span>
                              <span className="w-16 text-center text-xs font-bold" style={{ color:'#94a3b8' }}>{ing.qtde}</span>
                              <span className="w-12 text-center text-xs font-black" style={{ color:'#64748b' }}>{ing.un}</span>
                              <span className="w-24 text-right text-xs" style={{ color:'#f97316' }}>
                                {ing.custo ? `R$ ${parseFloat(ing.custo).toFixed(2).replace('.',',')}` : '—'}
                              </span>
                              <span className="w-24 text-right text-xs font-bold" style={{ color:'#22c55e' }}>
                                {tot > 0 ? `R$ ${tot.toFixed(2).replace('.',',')}` : '—'}
                              </span>
                              <button onClick={()=>setIngredientes(v=>v.filter((_,j)=>j!==i))}
                                className="w-6 h-6 rounded flex items-center justify-center text-[10px]"
                                style={{ background:'#ef444422', color:'#ef4444' }}>✕</button>
                            </div>
                          )
                        })
                    }
                    {/* Totalizador */}
                    {ingredientes.length > 0 && (
                      <div className="flex items-center gap-1 px-3 py-2" style={{ background:'#060a12', borderTop:'1.5px solid #2d3f55' }}>
                        <span className="flex-1 text-xs font-black" style={{ color:'#475569' }}>TOTAL INSUMOS</span>
                        <span className="w-16"/><span className="w-12"/><span className="w-24"/>
                        <span className="w-24 text-right text-sm font-black" style={{ color:'#22c55e' }}>
                          R$ {custoInsumos.toFixed(2).replace('.',',')}
                        </span>
                        <span className="w-6"/>
                      </div>
                    )}
                  </div>
                </div>

                {/* Resumo de custo */}
                {(ingredientes.length > 0 || maoObra > 0 || embal > 0) && (
                  <div className="p-3 rounded-xl" style={{ background:'#060a12', border:'1.5px solid #22c55e44' }}>
                    <p className="text-xs font-black mb-2" style={{ color:'#22c55e' }}>💰 CUSTO DA RECEITA</p>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center p-2 rounded-lg" style={{ background:'#1a2232' }}>
                        <p className="text-[9px] font-bold mb-1" style={{ color:'#475569' }}>INSUMOS</p>
                        <p className="text-base font-black" style={{ color:'#94a3b8' }}>R$ {custoInsumos.toFixed(2).replace('.',',')}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg" style={{ background:'#1a2232' }}>
                        <p className="text-[9px] font-bold mb-1" style={{ color:'#475569' }}>MÃO DE OBRA</p>
                        <p className="text-base font-black" style={{ color:'#94a3b8' }}>R$ {maoObra.toFixed(2).replace('.',',')}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg" style={{ background:'#1a2232' }}>
                        <p className="text-[9px] font-bold mb-1" style={{ color:'#475569' }}>EMBALAGEM</p>
                        <p className="text-base font-black" style={{ color:'#94a3b8' }}>R$ {embal.toFixed(2).replace('.',',')}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg" style={{ background:'#22c55e18', border:'1px solid #22c55e44' }}>
                        <p className="text-[9px] font-bold mb-1" style={{ color:'#22c55e' }}>CUSTO / UNIDADE</p>
                        <p className="text-xl font-black" style={{ color:'#22c55e' }}>R$ {custoUnit.toFixed(2).replace('.',',')}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <p className="text-xs" style={{ color:'#475569' }}>
                        Total receita: <strong className="text-white">R$ {custoTotal.toFixed(2).replace('.',',')}</strong>
                        &nbsp;÷&nbsp;{rend} un =&nbsp;
                        <strong className="text-white">R$ {custoUnit.toFixed(2).replace('.',',')} / un</strong>
                      </p>
                      <button onClick={()=>setForm((f:any)=>({...f, preco_custo: custoUnit.toFixed(2), margem: f.preco_venda && parseFloat(f.preco_venda)>0 ? (((parseFloat(f.preco_venda)-custoUnit)/parseFloat(f.preco_venda))*100).toFixed(1) : f.margem }))}
                        className="ml-auto text-xs font-black px-3 py-1.5 rounded-lg"
                        style={{ background:'#f9731622', color:'#f97316', border:'1px solid #f9731644' }}>
                        → Aplicar como Custo do Produto
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )
            })()}

            {/* ── TAB: IMPOSTO ── */}
            {modalTab === 'imposto' && (
              <div className="space-y-4 max-w-2xl">
                <p className="text-xs font-black" style={{ color:'#64748b' }}>CONFIGURAÇÃO DE IMPOSTOS</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {label:'NCM', key:'ncm', placeholder:'0000.00.00'},
                    {label:'CEST', key:'cest', placeholder:'00.000.00'},
                    {label:'CFOP', key:'cfop', placeholder:'5102'},
                    {label:'CST/CSOSN', key:'cst', placeholder:'400'},
                    {label:'Alíquota ICMS (%)', key:'icms', placeholder:'12'},
                    {label:'Alíquota PIS (%)', key:'pis', placeholder:'0.65'},
                    {label:'Alíquota COFINS (%)', key:'cofins', placeholder:'3'},
                    {label:'IPI (%)', key:'ipi', placeholder:'0'},
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-[10px] font-black mb-1" style={{ color:'#64748b' }}>{f.label}</label>
                      <input placeholder={f.placeholder}
                        className="w-full px-3 py-2 text-sm rounded-lg font-mono"
                        style={{ background:'#1a2232', border:'1px solid #2d3f55', color:'white', outline:'none' }}/>
                    </div>
                  ))}
                </div>
              </div>
            )}

            </div>
          </div>
        </div>
      )}


      {/* Modal Categoria — Gerenciador Completo */}
      {showCatForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.88)' }}>
          <div className="w-full rounded-2xl overflow-hidden flex flex-col" style={{ maxWidth:620, maxHeight:'80vh', background:'#0d1117', border:'1px solid #1e2d40' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ background:'#0a0f1a', borderBottom:'1px solid #1e2d40' }}>
              <p className="font-black text-white text-sm">🏷️ Gerenciar Categorias</p>
              <button onClick={()=>setShowCatForm(false)} style={{ color:'#64748b' }}><X size={16}/></button>
            </div>

            {/* Body: lista + formulário */}
            <div className="flex flex-1 overflow-hidden">

              {/* Lista de categorias */}
              <div className="flex-1 flex flex-col overflow-hidden" style={{ borderRight:'1px solid #1e2d40' }}>
                <div className="px-3 pt-3 pb-2 flex-shrink-0">
                  <button
                    onClick={()=>{ setEditCat(null); setFormCat({nome:'',icone:'📦',cor:'#F97316',margem_padrao:'30'}) }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black"
                    style={{ background:'#f9731622', color:'#f97316', border:'1px solid #f9731644' }}>
                    <Plus size={11}/> Nova Categoria
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
                  {categorias.length === 0 && (
                    <p className="text-xs text-center py-6" style={{ color:'#475569' }}>Nenhuma categoria cadastrada</p>
                  )}
                  {categorias.map(c => (
                    <div key={c.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all"
                      style={{
                        background: editCat?.id===c.id ? '#1a2232' : '#060a12',
                        border:`1.5px solid ${editCat?.id===c.id ? (c.cor+'88') : '#1e2d40'}`
                      }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                        style={{ background:c.cor+'22' }}>{c.icone}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{c.nome}</p>
                        <p className="text-[9px]" style={{ color:'#475569' }}>
                          {c.total_produtos} produto{c.total_produtos!==1?'s':''} · {c.margem_padrao}% margem
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={()=>{ setEditCat(c); setFormCat({nome:c.nome,icone:c.icone,cor:c.cor,margem_padrao:String(c.margem_padrao)}) }}
                          className="w-6 h-6 rounded flex items-center justify-center"
                          style={{ background:'#f9731622', color:'#f97316' }}
                          title="Editar">
                          <Edit3 size={10}/>
                        </button>
                        <button
                          onClick={async()=>{ if(confirm(`Excluir "${c.nome}"?`)) { await api.delete(`/produtos/categorias/${c.id}`); load() } }}
                          className="w-6 h-6 rounded flex items-center justify-center"
                          style={{ background:'#ef444422', color:'#ef4444' }}
                          title="Excluir">
                          <Trash2 size={10}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formulário — botões fixos no topo, campos roláveis */}
              <div className="flex flex-col flex-shrink-0" style={{ width:240 }}>

                {/* Cabeçalho + botões SEMPRE VISÍVEIS */}
                <div className="px-4 pt-4 pb-3 flex-shrink-0" style={{ borderBottom:'1px solid #1e2d40' }}>
                  <p className="text-[10px] font-black tracking-widest mb-3" style={{ color: editCat?'#f97316':'#64748b' }}>
                    {editCat ? '✏️ EDITAR CATEGORIA' : '+ NOVA CATEGORIA'}
                  </p>
                  <button onClick={salvarCat} disabled={!formCat.nome}
                    className="w-full py-2.5 rounded-xl text-sm font-black mb-2"
                    style={{ background:formCat.nome?'#f97316':'#1a2232', color:formCat.nome?'white':'#475569',
                      boxShadow: formCat.nome ? '0 4px 12px rgba(249,115,22,0.35)' : 'none' }}>
                    {editCat ? '💾 Salvar Categoria' : '+ Criar Categoria'}
                  </button>
                  {editCat && (
                    <button onClick={()=>{ setEditCat(null); setFormCat({nome:'',icone:'📦',cor:'#F97316',margem_padrao:'30'}) }}
                      className="w-full py-1.5 rounded-xl text-xs font-black"
                      style={{ background:'#1a2232', color:'#64748b', border:'1px solid #1e2d40' }}>
                      ✕ Cancelar Edição
                    </button>
                  )}
                </div>

                {/* Campos roláveis */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold mb-1" style={{ color:'#64748b' }}>NOME *</label>
                    <input value={formCat.nome} onChange={e=>setFormCat(f=>({...f,nome:e.target.value}))}
                      className="w-full px-3 py-2 text-sm font-bold rounded-lg"
                      style={{ background:'#1a2232', border:`1.5px solid ${formCat.nome?'#2d3f55':'#f97316'}`, color:'white', outline:'none' }}
                      placeholder="Ex: Alimentos"/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold mb-1" style={{ color:'#64748b' }}>ÍCONE</label>
                    <input value={formCat.icone} onChange={e=>setFormCat(f=>({...f,icone:e.target.value}))}
                      className="w-full px-3 py-2 text-xl text-center rounded-lg mb-1.5"
                      style={{ background:'#1a2232', border:'1px solid #2d3f55', color:'white', outline:'none' }}/>
                    <div className="grid grid-cols-8 gap-0.5 p-1.5 rounded-lg" style={{ background:'#060a12', border:'1px solid #1e2d40' }}>
                      {[
                      // Alimentos
                      '🍎','🥩','🥛','🍞','🧃','🍫','☕','🥤','🐟','🥚','🧀','🍕','🍔','🥗','🍪','🧁','🍷','🍺','🌽','🥕','🧄','🥦','🍋','🫙','🥫',
                      // Eletro / Tecnologia
                      '📺','🖥️','💻','📱','🎮','🖨️','⌨️','🖱️','📷','📸','📹','🎙️','🎧','📻','📡','🔋','🔌','💡','⚡','🔦','📠','🕹️',
                      // Limpeza / Higiene / Saúde
                      '🧴','🧹','🧺','🧼','💊','💉','🩺',
                      // Vestuário / Bazar
                      '👕','👟','👜','🧢','💄','🪞','🛁',
                      // Casa / Ferramentas
                      '🏠','🔧','🔨','🪛','🔑','🧲',
                      // Pet / Outros
                      '🐾','🧸','🐶','🐱',
                      // Esporte / Lazer
                      '⚽','🏋️','🎯','🎵','🎲','🎪',
                      // Geral
                      '📦','🛒','🌿',
                    ].map(e=>(
                        <button key={e} type="button"
                          onClick={()=>setFormCat(f=>({...f,icone:e}))}
                          className="w-6 h-6 rounded flex items-center justify-center text-sm"
                          style={{ background: formCat.icone===e ? '#f9731644':'transparent',
                            border: formCat.icone===e ? '1px solid #f97316':'1px solid transparent' }}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold mb-1" style={{ color:'#64748b' }}>COR</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={formCat.cor} onChange={e=>setFormCat(f=>({...f,cor:e.target.value}))}
                        className="w-10 h-9 rounded-lg cursor-pointer flex-shrink-0"
                        style={{ background:'#1a2232', border:'1px solid #2d3f55', padding:3 }}/>
                      <div className="flex-1 px-3 py-2 rounded-lg text-xs font-mono font-bold"
                        style={{ background:formCat.cor+'22', border:`1.5px solid ${formCat.cor}55`, color:formCat.cor }}>
                        {formCat.cor}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold mb-1" style={{ color:'#64748b' }}>MARGEM PADRÃO (%)</label>
                    <input value={formCat.margem_padrao} type="number" onChange={e=>setFormCat(f=>({...f,margem_padrao:e.target.value}))}
                      className="w-full px-3 py-2 text-sm font-black rounded-lg text-right"
                      style={{ background:'#1a2232', border:'1px solid #2d3f55', color:'#f97316', outline:'none' }}/>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
