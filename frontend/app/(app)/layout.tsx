'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Package, Users, Truck, FileText,
  Warehouse, ShoppingCart, TrendingUp, TrendingDown,
  BarChart2, LogOut, Menu, X, ChevronRight, ChevronDown,
  ShoppingBag, ClipboardList, Tag, ClipboardMinus,
  RotateCcw, Boxes, Settings, UserCheck, Store,
  Monitor, History, Pencil, CalendarClock, Megaphone, Scale,
  Building2, ReceiptText, Calendar, Wallet, ArrowLeftRight, Receipt,
  CreditCard, Heart, BarChart, Send, FileOutput, Printer, ShoppingBasket, Zap,
  Target, Link2, BookOpen, Image, DollarSign,
} from 'lucide-react'

// Tipo de item de navegação (suporta sub-itens)
type NavChild = { href: string; icon: any; label: string; externo?: boolean }
type NavItem  = {
  label: string; icon: any; group: string
  href?:     string
  externo?:  boolean
  children?: NavChild[]   // se tem filhos → acordeão interno
}

const NAV: NavItem[] = [
  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', group: 'principal' },

  // ── PDV ───────────────────────────────────────────────────────────────────
  { href: '/pdv', icon: ShoppingCart, label: 'PDV Vendas', group: 'pdv', externo: true },

  // ── MARKETPLACE ───────────────────────────────────────────────────────────
  { href: '/marketplace',              icon: Store,         label: 'Painel Marketplace',  group: 'marketplace' },
  { href: '/marketplace/pedidos',      icon: ShoppingBag,   label: 'Pedido Marketplace',  group: 'marketplace' },
  { href: '/marketplace/painel-pv',    icon: BarChart2,     label: 'Painel Pedido Venda', group: 'marketplace' },
  { href: '/marketplace/pedido-venda', icon: ClipboardList, label: 'Pedido Venda',        group: 'marketplace' },
  { href: '/marketplace/integracoes',  icon: RotateCcw,     label: 'Integrações',         group: 'marketplace' },

  // ── MARKETING AFILIADOS + VENDEDOR (tudo junto) ──────────────────────────
  { href: '/marketplace/vendedor',               icon: Store,         label: '🏪 Painel Vendedor',       group: 'corporativos' },
  { href: '/marketplace/vendedor/anuncios',      icon: Package,       label: 'Meus Anúncios',            group: 'corporativos' },
  { href: '/marketplace/vendedor/config',        icon: Settings,      label: 'Config. Vendedor',         group: 'corporativos' },
  { href: '/marketplace/afiliados',              icon: Target,        label: '⚡ Afiliados — Painel',    group: 'corporativos' },
  { href: '/marketplace/afiliados/metas',        icon: TrendingUp,    label: 'Meta Vendas',             group: 'corporativos' },
  { href: '/marketplace/afiliados/catalogo',     icon: BookOpen,      label: 'Catálogo Produtos',       group: 'corporativos' },
  { href: '/marketplace/afiliados/conteudo',     icon: Image,         label: 'Criador de Conteúdo',     group: 'corporativos' },
  { href: '/marketplace/afiliados/financeiro',   icon: DollarSign,    label: 'Financeiro / Comissões',  group: 'corporativos' },
  { href: '/marketplace/afiliados/config',       icon: Settings,      label: 'Config. Afiliados',       group: 'corporativos' },

  // ── COMPRAS ────────────────────────────────────────────────────────────────
  { href: '/compras',              icon: ShoppingBag,    label: 'Dashboard Compras',   group: 'compras' },
  { href: '/compras/pedidos',      icon: ClipboardList,  label: 'Pedidos de Compra',   group: 'compras' },
  { href: '/compras/agenda',       icon: Calendar,       label: 'Agenda Fornecedores', group: 'compras' },
  { href: '/compras/verba',        icon: Wallet,         label: 'Verba de Compras',    group: 'compras' },
  { href: '/compras/solicitacoes', icon: FileText,       label: 'Solicitações',        group: 'compras' },

  // ── NOTAS FISCAIS ─────────────────────────────────────────────────────────
  { href: '/nf-entrada',      icon: FileText,    label: 'NF de Entrada / XML', group: 'notas' },
  { href: '/fiscal/nf-saida', icon: FileOutput,  label: 'NF-e de Saída',       group: 'notas' },

  // ── ESTOQUE ────────────────────────────────────────────────────────────────
  { href: '/estoque',               icon: Warehouse,      label: 'Estoque',             group: 'estoque' },
  { href: '/estoque/inventario',    icon: ClipboardMinus, label: 'Inventário',          group: 'estoque' },
  { href: '/separacao',             icon: ClipboardList,  label: 'Separação de Pedidos',group: 'estoque' },
  { href: '/recebimento',           icon: Package,        label: 'Recebimento / Coletor',group: 'estoque' },
  { href: '/trocas',                icon: ArrowLeftRight, label: 'Trocas e Devoluções', group: 'estoque' },
  { href: '/estoque/centros-custo', icon: Boxes,          label: 'Centros de Custo',    group: 'estoque' },

  // ── GESTÃO PREÇOS ──────────────────────────────────────────────────────────
  { href: '/precos/alteracao',   icon: Pencil,        label: 'Alteração de Preços',   group: 'gestao_precos' },
  { href: '/precos/programacao', icon: CalendarClock, label: 'Programação / Ofertas', group: 'gestao_precos' },
  { href: '/precos/campanhas',   icon: Megaphone,     label: 'Campanha Promocional',  group: 'gestao_precos' },
  { href: '/precos/balancas',    icon: Scale,         label: 'Carga Balanças',        group: 'gestao_precos' },
  { href: '/precos/etiquetas',   icon: Tag,           label: 'Etiquetas de Preço',    group: 'gestao_precos' },

  // ── CADASTROS ─────────────────────────────────────────────────────────────
  { href: '/produtos',                 icon: Package,   label: 'Produtos',     group: 'cadastros' },
  { href: '/clientes',                 icon: Users,     label: 'Clientes',     group: 'cadastros' },
  { href: '/fornecedores',             icon: Truck,     label: 'Fornecedores', group: 'cadastros' },
  { href: '/configuracoes/vendedores', icon: UserCheck,      label: 'Vendedores',   group: 'cadastros' },
  { href: '/compradores',              icon: ShoppingBasket, label: 'Compradores',  group: 'cadastros' },
  { href: '/usuarios',                 icon: UserCheck,      label: 'Usuários',     group: 'cadastros' },

  // ── FINANCEIRO ────────────────────────────────────────────────────────────
  { href: '/caixa',         icon: Wallet,       label: 'Fechamento de Caixa', group: 'financeiro' },
  { href: '/financeiro',    icon: BarChart,     label: 'Fluxo de Caixa / DRE',group: 'financeiro' },
  { href: '/contas-pagar',   icon: TrendingDown, label: 'Contas a Pagar',   group: 'financeiro' },
  { href: '/contas-receber', icon: TrendingUp,   label: 'Contas a Receber', group: 'financeiro' },
  { href: '/convenio',       icon: Heart,        label: 'Convênio Empresas',group: 'financeiro' },

  // ── GESTÃO / RELATÓRIOS ───────────────────────────────────────────────────
  { href: '/vendas',               icon: TrendingUp, label: 'Vendas / Histórico',    group: 'relatorios' },
  { href: '/relatorio-operador',   icon: Users,      label: 'Vendas por Operador',   group: 'relatorios' },
  { href: '/relatorios',           icon: BarChart2,  label: 'Relatórios',            group: 'relatorios' },

  // ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────
  { href: '/pdv/parametros',  icon: Settings,    label: 'Parâmetros PDV',    group: 'configuracoes' },
  { href: '/pdv/operadores', icon: ShoppingCart, label: 'Operadores PDV',    group: 'configuracoes' },
  { href: '/configuracoes/empresa',             icon: Building2,   label: 'Dados da Empresa',       group: 'configuracoes' },
  { href: '/configuracoes/impostos',            icon: ReceiptText, label: 'Config. Impostos',       group: 'configuracoes' },
  { href: '/configuracoes/formas-recebimento',  icon: CreditCard,  label: 'Formas de Recebimento',  group: 'configuracoes' },
  { href: '/configuracoes/impressoras',         icon: Printer,     label: 'Impressoras',            group: 'configuracoes' },
  { href: '/configuracoes/contas-correntes',    icon: Building2,   label: 'Contas Correntes',       group: 'configuracoes' },
  { href: '/configuracoes/apis',                icon: Zap,         label: 'APIs de Produtos (EAN)', group: 'configuracoes' },
]

const GROUPS = [
  { key: 'pdv',           label: 'PDV'           },
  { key: 'corporativos',  label: 'VENDEDOR / PLATAFORMAS & AFILIADOS' },
  { key: 'marketplace',   label: 'MARKETPLACE'   },
  { key: 'compras',       label: 'COMPRAS'       },
  { key: 'notas',         label: 'NOTAS FISCAIS' },
  { key: 'estoque',       label: 'ESTOQUE'       },
  { key: 'gestao_precos', label: 'GESTÃO PREÇOS' },
  { key: 'cadastros',     label: 'CADASTROS'     },
  { key: 'financeiro',    label: 'FINANCEIRO'    },
  { key: 'relatorios',    label: 'GESTÃO / RELATÓRIOS' },
  { key: 'configuracoes', label: 'CONFIGURAÇÕES' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [open, setOpen]   = useState(false)
  const [user, setUser]   = useState<{ nome: string; perfil: string } | null>(null)

  // grupos colapsados: só PRINCIPAL aberto por padrão
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({
    principal: true, pdv: false, marketplace: false,
    compras: false, notas: false, estoque: false,
    gestao_precos: false, cadastros: false, financeiro: false,
    relatorios: false, configuracoes: false, corporativos: false,
  })
  // sub-acordeão (ex: PDV)
  const [subOpen, setSubOpen] = useState<Record<string, boolean>>({ pdv: false })

  useEffect(() => {
    const token = localStorage.getItem('nexus_token')
    if (!token) { router.push('/'); return }
    if (pathname === '/') { router.push('/dashboard'); return }
    const u = localStorage.getItem('nexus_user')
    if (u) setUser(JSON.parse(u))

    // Achar o item mais específico que casa com a rota atual (maior href)
    let bestGroup = ''
    let bestLen = 0
    NAV.forEach(item => {
      if (item.children) {
        const ativo = item.children.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))
        if (ativo) {
          const len = item.children.reduce((max, c) =>
            (pathname.startsWith(c.href) ? Math.max(max, c.href.length) : max), 0)
          if (len > bestLen) { bestLen = len; bestGroup = item.group }
          setSubOpen(s => ({ ...s, [item.label.toLowerCase()]: true }))
        }
      } else if (item.href && (pathname === item.href || pathname.startsWith(item.href + '/'))) {
        if (item.href.length > bestLen) { bestLen = item.href.length; bestGroup = item.group }
      }
    })

    // Abre só o grupo correto, fecha os demais (accordion)
    if (bestGroup) {
      setGroupOpen(g => {
        const allClosed = Object.fromEntries(Object.keys(g).map(k => [k, false]))
        return { ...allClosed, [bestGroup]: true }
      })
    }
  }, [router, pathname])

  function logout() {
    localStorage.removeItem('nexus_token')
    localStorage.removeItem('nexus_user')
    router.push('/')
  }

  // Verifica se um item simples está ativo
  function isActive(href: string, externo?: boolean) {
    if (externo) return false
    return pathname === href || (pathname.startsWith(href + '/') && href !== '/estoque' && href !== '/compras' && href !== '/vendas')
  }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full" style={{
      background: 'linear-gradient(180deg, #F97316 0%, #C2410C 100%)',
    }}>
      {/* Logo */}
      <div className="px-3 py-2.5 flex items-center gap-2 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.18)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.22)' }}>
          <ShoppingCart size={13} color="white" />
        </div>
        <div className="flex-1">
          <p className="font-black text-[13px] text-white leading-tight">NexusVarejo</p>
          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.6)' }}>Gestão Comercial</p>
        </div>
        {mobile && (
          <button onClick={() => setOpen(false)} style={{ color: 'rgba(255,255,255,0.7)' }}>
            <X size={15} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-0.5">
        {/* Dashboard fixo no topo sem grupo */}
        <Link href="/dashboard" onClick={() => mobile && setOpen(false)}
          className="flex items-center px-2.5 py-2 rounded-lg transition-all text-[12px] font-black mb-1"
          style={{
            background: pathname === '/dashboard' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.12)',
            color: pathname === '/dashboard' ? '#C2410C' : 'white',
          }}>
          Dashboard
          {pathname === '/dashboard' && <ChevronRight size={9} className="ml-auto" />}
        </Link>

        {GROUPS.map(group => {
          const items = NAV.filter(n => n.group === group.key)
          const isGrpOpen = groupOpen[group.key]

          return (
            <div key={group.key}>
              {/* Cabeçalho do grupo */}
              <button
                onClick={() => setGroupOpen(g => {
                  const isOpen = g[group.key]
                  const allClosed = Object.fromEntries(Object.keys(g).map(k => [k, false]))
                  return isOpen ? allClosed : { ...allClosed, [group.key]: true }
                })}
                className="flex items-center justify-between w-full px-2 py-1 rounded-md"
                style={{ background: 'rgba(0,0,0,0.08)' }}>
                <span className="text-[9px] font-black tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {group.label}
                </span>
                <ChevronDown size={8} style={{
                  color: 'rgba(255,255,255,0.6)',
                  transform: isGrpOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 0.18s',
                }} />
              </button>

              {/* Itens do grupo */}
              {isGrpOpen && (
                <div className="mt-0.5 space-y-0.5">
                  {items.map((item, idx) => {
                    // ── Item com sub-acordeão (ex: PDV) ──
                    if (item.children) {
                      const key = item.label.toLowerCase()
                      const isSubOpen = subOpen[key]
                      const anyChildActive = item.children.some(c => isActive(c.href))
                      return (
                        <div key={idx}>
                          <button
                            onClick={() => setSubOpen(s => ({ ...s, [key]: !s[key] }))}
                            className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-lg transition-all text-[11px] font-semibold"
                            style={{
                              background: anyChildActive ? 'rgba(255,255,255,0.95)' : isSubOpen ? 'rgba(255,255,255,0.18)' : 'transparent',
                              color: anyChildActive ? '#C2410C' : 'rgba(255,255,255,0.9)',
                            }}>
                            <item.icon size={12} />
                            <span className="flex-1 text-left">{item.label}</span>
                            <ChevronDown size={9} style={{
                              transform: isSubOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                              transition: 'transform 0.18s',
                              opacity: 0.7,
                            }} />
                          </button>
                          {isSubOpen && (
                            <div className="ml-4 mt-0.5 space-y-0.5 border-l pl-2"
                              style={{ borderColor: 'rgba(255,255,255,0.25)' }}>
                              {item.children.map(child => {
                                const childActive = isActive(child.href)
                                if (child.externo) return (
                                  <a key={child.href} href={child.href} target="_blank"
                                    onClick={() => mobile && setOpen(false)}
                                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-bold"
                                    style={{ color: 'white', background: 'rgba(255,255,255,0.18)' }}>
                                    <child.icon size={11} />
                                    <span>{child.label}</span>
                                    <span className="ml-auto text-[9px] opacity-60">↗</span>
                                  </a>
                                )
                                return (
                                  <Link key={child.href} href={child.href}
                                    onClick={() => mobile && setOpen(false)}
                                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] transition-all"
                                    style={{
                                      background: childActive ? 'rgba(255,255,255,0.95)' : 'transparent',
                                      color: childActive ? '#C2410C' : 'rgba(255,255,255,0.85)',
                                      fontWeight: childActive ? 700 : 500,
                                    }}>
                                    <child.icon size={11} />
                                    <span>{child.label}</span>
                                    {childActive && <ChevronRight size={8} className="ml-auto" />}
                                  </Link>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    }

                    // ── Item simples ──
                    const active = item.href ? isActive(item.href) : false
                    if (item.externo) return (
                      <a key={idx} href={item.href} target="_blank"
                        onClick={() => mobile && setOpen(false)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
                        style={{ color: 'white', background: 'rgba(255,255,255,0.18)' }}>
                        <item.icon size={12} />
                        <span>{item.label}</span>
                        <span className="ml-auto text-[9px] opacity-60">↗</span>
                      </a>
                    )
                    return (
                      <Link key={idx} href={item.href!}
                        onClick={() => mobile && setOpen(false)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-[11px]"
                        style={{
                          background: active ? 'rgba(255,255,255,0.95)' : 'transparent',
                          color: active ? '#C2410C' : 'rgba(255,255,255,0.88)',
                          fontWeight: active ? 700 : 500,
                        }}>
                        <item.icon size={12} />
                        <span>{item.label}</span>
                        {active && <ChevronRight size={8} className="ml-auto" />}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Usuário */}
      {user && (
        <div className="px-2.5 py-2 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.18)' }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.25)', color: 'white' }}>
              {user.nome[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-white truncate">{user.nome}</p>
              <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{user.perfil}</p>
            </div>
            <button onClick={logout}
              className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(0,0,0,0.18)', color: 'rgba(255,255,255,0.85)' }}>
              <LogOut size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex w-48 flex-shrink-0 flex-col">
        <Sidebar />
      </div>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-48 z-50">
            <Sidebar mobile />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden flex items-center gap-3 px-3 py-2 flex-shrink-0"
          style={{ background: '#F97316' }}>
          <button onClick={() => setOpen(true)} style={{ color: 'white' }}>
            <Menu size={20} />
          </button>
          <span className="font-black text-white text-sm">NexusVarejo</span>
        </div>
        <main className="flex-1 md:overflow-hidden overflow-y-auto" style={{ background: 'var(--bg)' }}>
          <div className="md:h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
