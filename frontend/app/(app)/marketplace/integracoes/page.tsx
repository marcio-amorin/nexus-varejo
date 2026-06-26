'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Settings, RefreshCw, Check, X, AlertCircle, Wifi, WifiOff } from 'lucide-react'

const PLATS = [
  { key: 'MERCADOLIVRE', nome: 'Mercado Livre', cor: '#FFE600', ct: '#333', emoji: '🛒',
    dica: 'Acesse developer.mercadolivre.com.br → Crie um App → copie Client ID e gere Access Token' },
  { key: 'SHOPEE',       nome: 'Shopee',         cor: '#EE4D2D', ct: '#FFF', emoji: '🛍️',
    dica: 'Acesse open.shopee.com → Crie um App → copie Partner ID (Client ID) e Partner Key (Secret)' },
  { key: 'ZEDELIVERY',   nome: 'Zé Delivery',    cor: '#FFB800', ct: '#333', emoji: '🍺',
    dica: 'Entre em contato com o parceiro Zé Delivery para obter as credenciais de API' },
  { key: 'IFOOD',        nome: 'iFood Mercado',   cor: '#EA1D2C', ct: '#FFF', emoji: '🍔',
    dica: 'Acesse developer.ifood.com.br → Portal do Parceiro → gere Client ID e Secret' },
]

export default function IntegracoesPage() {
  const [intgs,  setIntgs]  = useState<any[]>([])
  const [config, setConfig] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [sync,   setSync]   = useState<string|null>(null)

  async function load() {
    try { const r = await api.get('/marketplace/integracoes'); setIntgs(r.data) } catch {}
  }
  useEffect(() => { load() }, [])

  async function salvar() {
    if (!config) return
    setSaving(true)
    try {
      await api.put(`/marketplace/integracoes/${config.plataforma}`, {
        ativo:         config.ativo,
        client_id:     config.client_id,
        client_secret: config.client_secret,
        access_token:  config.access_token,
        store_id:      config.store_id,
      })
      setConfig(null); load()
    } catch {}
    setSaving(false)
  }

  async function syncPlat(plat: string) {
    setSync(plat)
    try { await api.post(`/marketplace/sync/${plat}`); load() } catch {}
    setSync(null)
  }

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"

  return (
    <div className="pg">
      <div className="pg-header">
        <h1 className="text-base font-black text-white flex items-center gap-2">
          <Settings size={18} color="#F97316" /> Integrações Marketplace
        </h1>
        <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
          Configure as credenciais de API de cada plataforma
        </p>
      </div>

      <div className="pg-body grid grid-cols-1 gap-3 max-w-2xl">
        {PLATS.map(pl => {
          const intg = intgs.find(i => i.plataforma === pl.key)
          const on   = intg?.ativo
          const con  = intg?.status_conexao === 'CONECTADO'
          return (
            <div key={pl.key} className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--card)', border: `1.5px solid ${on ? pl.cor + '44' : 'var(--border)'}` }}>
              <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'var(--card2)' }}>
                <span className="text-2xl">{pl.emoji}</span>
                <div className="flex-1">
                  <p className="font-black text-white">{pl.nome}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {con ? <Wifi size={10} color="#22C55E" /> : <WifiOff size={10} color="#EF4444" />}
                    <p className="text-[10px]" style={{ color: con ? '#22C55E' : '#EF4444' }}>
                      {intg?.status_conexao || 'DESCONECTADO'}
                    </p>
                    {intg?.ultima_sync && (
                      <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                        · Sync: {new Date(intg.ultima_sync).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: on ? '#22C55E22' : '#EF444422', color: on ? '#22C55E' : '#EF4444' }}>
                    {on ? 'ATIVO' : 'INATIVO'}
                  </span>
                  {on && (
                    <button onClick={() => syncPlat(pl.key)} disabled={sync === pl.key}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
                      style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                      <RefreshCw size={10} className={sync===pl.key ? 'animate-spin' : ''} />
                      {sync===pl.key ? 'Sync...' : 'Sync'}
                    </button>
                  )}
                  <button onClick={() => setConfig({ ...intg, plataforma: pl.key, ativo: intg?.ativo || false })}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
                    style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316' }}>
                    <Settings size={10} /> Configurar
                  </button>
                </div>
              </div>
              {/* Stats */}
              {intg && (
                <div className="px-4 py-2 flex gap-4 text-xs" style={{ borderTop: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--muted)' }}>
                    Total: <strong className="text-white">{intg.total_pedidos || 0}</strong>
                  </span>
                  <span style={{ color: 'var(--muted)' }}>
                    Novos: <strong style={{ color: '#3B82F6' }}>{intg.pedidos_novos || 0}</strong>
                  </span>
                  {intg.client_id && (
                    <span style={{ color: 'var(--muted)' }}>
                      App: <strong className="font-mono text-white">{intg.client_id?.slice(0,8)}…</strong>
                    </span>
                  )}
                </div>
              )}
              {/* Dica configuração */}
              {!on && (
                <div className="px-4 py-2.5 flex items-start gap-2" style={{ borderTop: '1px solid var(--border)', background: 'rgba(249,115,22,0.04)' }}>
                  <AlertCircle size={12} color="#F97316" className="flex-shrink-0 mt-0.5" />
                  <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{pl.dica}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── MODAL CONFIG ─────────────────────────────────────── */}
      {config && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-sm rounded-3xl flex flex-col" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="font-black text-white">
                {PLATS.find(p=>p.key===config.plataforma)?.emoji} {PLATS.find(p=>p.key===config.plataforma)?.nome}
              </p>
              <button onClick={() => setConfig(null)} style={{ color: 'var(--muted)' }}><X size={16} /></button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {/* Toggle ativo */}
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--card2)' }}>
                <span className="text-sm font-bold text-white">Integração Ativa</span>
                <button onClick={() => setConfig((c: any) => ({ ...c, ativo: !c.ativo }))}
                  className="w-11 h-6 rounded-full relative transition-all"
                  style={{ background: config.ativo ? '#22C55E' : 'var(--border)' }}>
                  <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: config.ativo ? 24 : 4 }} />
                </button>
              </div>
              <input value={config.client_id || ''} onChange={e => setConfig((c:any)=>({...c,client_id:e.target.value}))}
                className={inp} placeholder="Client ID / App ID / Partner ID" />
              <input value={config.client_secret || ''} onChange={e => setConfig((c:any)=>({...c,client_secret:e.target.value}))}
                className={inp} placeholder="Client Secret / Partner Key" type="password" />
              <input value={config.access_token || ''} onChange={e => setConfig((c:any)=>({...c,access_token:e.target.value}))}
                className={inp} placeholder="Access Token" type="password" />
              <input value={config.store_id || ''} onChange={e => setConfig((c:any)=>({...c,store_id:e.target.value}))}
                className={inp} placeholder="Store ID / Seller ID" />
            </div>

            <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={salvar} disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                <Check size={14} /> {saving ? 'Salvando...' : 'Salvar Configuração'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
