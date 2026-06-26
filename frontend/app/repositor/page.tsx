'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import {
  AlertTriangle, Search, LogOut, Send, ChevronDown, Check,
  Package, ShoppingCart,
} from 'lucide-react'

const PRIOR_C: Record<string, { bg: string; c: string }> = {
  NORMAL:  { bg: '#8E8E9322', c: '#8E8E93' },
  URGENTE: { bg: '#FF9F0A22', c: '#FF9F0A' },
  CRITICA: { bg: '#FF3B3022', c: '#FF3B30' },
}

export default function RepositorPage() {
  const [token, setToken]       = useState('')
  const [user, setUser]         = useState<any>(null)
  const [loginForm, setLF]      = useState({ email: '', senha: '' })
  const [loginErr, setLoginErr] = useState('')
  const [logging, setLogging]   = useState(false)

  const [produtos, setProdutos] = useState<any[]>([])
  const [busca, setBusca]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [expandido, setExp]     = useState<number | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso]   = useState<number | null>(null)

  const [form, setForm] = useState<Record<number, {
    quantidade: string; prioridade: string; observacao: string
  }>>({})

  async function login() {
    setLogging(true); setLoginErr('')
    try {
      const fd = new FormData()
      fd.append('username', loginForm.email)
      fd.append('password', loginForm.senha)
      const r = await api.post('/auth/token', fd)
      const t = r.data.access_token
      localStorage.setItem('nexus_token', t)
      localStorage.setItem('nexus_user', JSON.stringify(r.data.user))
      setToken(t); setUser(r.data.user)
    } catch { setLoginErr('E-mail ou senha incorretos') }
    setLogging(false)
  }

  function logout() {
    localStorage.removeItem('nexus_token')
    localStorage.removeItem('nexus_user')
    setToken(''); setUser(null); setProdutos([])
  }

  async function carregarProdutos() {
    setLoading(true)
    try {
      const r = await api.get('/compras/criticos')
      setProdutos(r.data)
    } catch { setProdutos([]) }
    setLoading(false)
  }

  useEffect(() => {
    const t = localStorage.getItem('nexus_token')
    const u = localStorage.getItem('nexus_user')
    if (t) { setToken(t); if (u) setUser(JSON.parse(u)) }
  }, [])

  useEffect(() => { if (token) carregarProdutos() }, [token])

  function getForm(id: number) {
    return form[id] || { quantidade: '', prioridade: 'NORMAL', observacao: '' }
  }

  async function enviar(produto: any) {
    const f = getForm(produto.id)
    if (!f.quantidade || Number(f.quantidade) <= 0) return
    setEnviando(true)
    try {
      await api.post('/compras/solicitacoes', {
        produto_id: produto.id,
        quantidade_sugerida: Number(f.quantidade),
        estoque_momento: produto.estoque_atual,
        prioridade: f.prioridade,
        observacao: f.observacao || null,
        criado_por: user?.nome || 'repositor',
      })
      setSucesso(produto.id)
      setForm(fm => ({ ...fm, [produto.id]: { quantidade: '', prioridade: 'NORMAL', observacao: '' } }))
      setExp(null)
      setTimeout(() => setSucesso(null), 3000)
      carregarProdutos()
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro ao enviar') }
    setEnviando(false)
  }

  const filtrados = produtos.filter(p =>
    !busca || p.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
    p.codigo?.toLowerCase().includes(busca.toLowerCase())
  )

  // ── Tela de login ─────────────────────────────────────────
  if (!token) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg,#120600 0%,#3a1c00 50%,#1C1C1E 100%)' }}>
      <div className="w-full max-w-xs">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg,#F59E0B,#EA580C)' }}>
            <ShoppingCart size={32} color="white" />
          </div>
          <h1 className="text-2xl font-black text-white">NexusVarejo</h1>
          <p className="text-sm mt-1" style={{ color: '#8E8E93' }}>App do Repositor</p>
        </div>

        <div className="rounded-3xl p-6 space-y-4" style={{ background: '#2C2C2E' }}>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: '#8E8E93' }}>E-MAIL</label>
            <input
              type="email" autoCapitalize="none" autoComplete="email"
              value={loginForm.email}
              onChange={e => setLF(f => ({ ...f, email: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && login()}
              className="w-full px-4 py-3 rounded-2xl text-white text-base"
              style={{ background: '#3C3C3E', border: '1px solid #48484A' }}
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: '#8E8E93' }}>SENHA</label>
            <input
              type="password"
              value={loginForm.senha}
              onChange={e => setLF(f => ({ ...f, senha: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && login()}
              className="w-full px-4 py-3 rounded-2xl text-white text-base"
              style={{ background: '#3C3C3E', border: '1px solid #48484A' }}
              placeholder="••••••••"
            />
          </div>
          {loginErr && <p className="text-xs text-center" style={{ color: '#FF3B30' }}>{loginErr}</p>}
          <button
            onClick={login} disabled={logging || !loginForm.email || !loginForm.senha}
            className="w-full py-4 rounded-2xl font-black text-base"
            style={{
              background: logging ? '#8E8E93' : 'linear-gradient(135deg,#F59E0B,#EA580C)',
              color: 'white',
            }}>
            {logging ? 'Entrando...' : 'ENTRAR'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── App principal ─────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#1C1C1E' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 py-3 flex items-center gap-3"
        style={{ background: '#2C2C2E', borderBottom: '1px solid #3C3C3E' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#F59E0B,#EA580C)' }}>
          <ShoppingCart size={16} color="white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black text-white leading-tight">App Repositor</p>
          <p className="text-[10px]" style={{ color: '#8E8E93' }}>{user?.nome}</p>
        </div>
        <button onClick={logout}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: '#FF3B3018', color: '#FF3B30' }}>
          <LogOut size={14} />
        </button>
      </div>

      <div className="p-4 space-y-3 max-w-lg mx-auto">
        {/* Busca */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: '#8E8E93' }} />
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm text-white"
            style={{ background: '#2C2C2E', border: '1px solid #3C3C3E' }}
          />
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { l: 'Sem estoque', v: produtos.filter(p => p.status === 'CRITICO').length, c: '#FF3B30' },
            { l: 'Estoque baixo', v: produtos.filter(p => p.status === 'BAIXO').length, c: '#FF9F0A' },
          ].map(s => (
            <div key={s.l} className="rounded-2xl p-3 text-center"
              style={{ background: '#2C2C2E', border: `1px solid ${s.c}33` }}>
              <p className="text-2xl font-black" style={{ color: s.c }}>{s.v}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: '#8E8E93' }}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="text-center py-12" style={{ color: '#8E8E93' }}>
            <Package size={32} className="mx-auto mb-2 opacity-40" />
            Carregando produtos...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12" style={{ color: '#8E8E93' }}>
            <Package size={32} className="mx-auto mb-2 opacity-40" />
            {busca ? 'Nenhum produto encontrado' : 'Todos os produtos estão OK!'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map(prod => {
              const isCrit = prod.status === 'CRITICO'
              const cor = isCrit ? '#FF3B30' : '#FF9F0A'
              const aberto = expandido === prod.id
              const f = getForm(prod.id)
              const ok = sucesso === prod.id

              return (
                <div key={prod.id} className="rounded-2xl overflow-hidden"
                  style={{ background: '#2C2C2E', border: `1px solid ${cor}33` }}>
                  {/* Card produto */}
                  <button
                    onClick={() => setExp(aberto ? null : prod.id)}
                    className="w-full flex items-center gap-3 p-4 text-left">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: cor + '22' }}>
                      {ok
                        ? <Check size={18} color="#34C759" />
                        : <AlertTriangle size={18} color={cor} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">{prod.descricao}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs" style={{ color: '#8E8E93' }}>{prod.codigo}</p>
                        <span className="text-xs font-bold" style={{ color: cor }}>
                          {isCrit ? 'SEM ESTOQUE' : `BAIXO: ${prod.estoque_atual} ${prod.unidade}`}
                        </span>
                      </div>
                    </div>
                    <ChevronDown size={16}
                      style={{
                        color: '#8E8E93', flexShrink: 0,
                        transform: aberto ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                      }} />
                  </button>

                  {/* Formulário de solicitação */}
                  {aberto && (
                    <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${cor}22` }}>
                      <div className="pt-3">
                        <p className="text-xs font-bold mb-2" style={{ color: '#8E8E93' }}>
                          ESTOQUE MÍNIMO: {prod.estoque_minimo} {prod.unidade}
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold mb-1.5" style={{ color: '#8E8E93' }}>
                          QUANTIDADE A PEDIR *
                        </label>
                        <input
                          type="number" inputMode="decimal" step="0.001" min="0"
                          value={f.quantidade}
                          onChange={e => setForm(fm => ({
                            ...fm,
                            [prod.id]: { ...getForm(prod.id), quantidade: e.target.value },
                          }))}
                          className="w-full px-4 py-3 rounded-xl text-white text-base font-bold"
                          style={{ background: '#3C3C3E', border: `1px solid ${cor}55` }}
                          placeholder={`Ex: ${Math.max(10, (prod.estoque_minimo || 10) * 2)}`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold mb-1.5" style={{ color: '#8E8E93' }}>
                          PRIORIDADE
                        </label>
                        <div className="flex gap-2">
                          {['NORMAL', 'URGENTE', 'CRITICA'].map(p => {
                            const pc = PRIOR_C[p]
                            return (
                              <button key={p}
                                onClick={() => setForm(fm => ({
                                  ...fm,
                                  [prod.id]: { ...getForm(prod.id), prioridade: p },
                                }))}
                                className="flex-1 py-2.5 rounded-xl text-xs font-black"
                                style={{
                                  background: f.prioridade === p ? pc.bg : '#3C3C3E',
                                  color: f.prioridade === p ? pc.c : '#8E8E93',
                                  border: f.prioridade === p ? `1px solid ${pc.c}66` : '1px solid transparent',
                                }}>
                                {p}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold mb-1.5" style={{ color: '#8E8E93' }}>
                          OBSERVAÇÃO (opcional)
                        </label>
                        <input
                          value={f.observacao}
                          onChange={e => setForm(fm => ({
                            ...fm,
                            [prod.id]: { ...getForm(prod.id), observacao: e.target.value },
                          }))}
                          className="w-full px-4 py-3 rounded-xl text-white text-sm"
                          style={{ background: '#3C3C3E', border: '1px solid #48484A' }}
                          placeholder="Ex: Está acabando no corredor 3"
                        />
                      </div>

                      <button
                        onClick={() => enviar(prod)}
                        disabled={enviando || !f.quantidade || Number(f.quantidade) <= 0}
                        className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2"
                        style={{
                          background: (!f.quantidade || enviando) ? '#3C3C3E' : `linear-gradient(135deg,${cor},${isCrit ? '#EA580C' : '#F59E0B'})`,
                          color: (!f.quantidade || enviando) ? '#8E8E93' : 'white',
                        }}>
                        {enviando ? 'Enviando...' : <><Send size={16} /> Solicitar Reposição</>}
                      </button>
                    </div>
                  )}

                  {ok && (
                    <div className="px-4 pb-4">
                      <div className="flex items-center gap-2 p-3 rounded-xl"
                        style={{ background: '#34C75922' }}>
                        <Check size={14} color="#34C759" />
                        <p className="text-xs font-bold" style={{ color: '#34C759' }}>
                          Solicitação enviada com sucesso!
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Botão atualizar */}
        <button onClick={carregarProdutos}
          className="w-full py-3 rounded-2xl text-sm font-bold"
          style={{ background: '#2C2C2E', color: '#8E8E93', border: '1px solid #3C3C3E' }}>
          Atualizar Lista
        </button>
      </div>
    </div>
  )
}
