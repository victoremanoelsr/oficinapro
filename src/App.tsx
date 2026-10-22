import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import {
  ArchiveRestore, BadgeDollarSign, BarChart3, BookOpen, Boxes, CalendarClock, Camera, Car, CheckCircle2, CircleDollarSign, ClipboardCheck,
  ClipboardList, Cloud, FileDown, FileText, LayoutDashboard, Menu, MessageCircle, PackagePlus, Pencil, Plus, Printer, ReceiptText, RefreshCw, Search,
  Settings as SettingsIcon, Trash2, Users, Wallet, Wrench, X
} from 'lucide-react'
import { dateOnly, dateTime, execute, isDesktop, money, nextOrderNumber, openWhatsApp, query } from './lib/db'
import { subscribeSyncState, syncWithGoogleSheets, type SyncState } from './lib/sheets-engine'
import type { CashEntry, Client, Order, OrderStatus, Part, Settings, Vehicle } from './lib/types'
import { Button, Empty, Input, Modal, Select, StatusBadge, Textarea } from './components/ui'
import { MechanicOrderEditor, PendingPartDialog } from './components/order-workshop'
import { BillsPage, FinancePage } from './components/finance-workshop'
import { FinanceReportsPage } from './components/reports-workshop'
import { WorkshopSettingsPage } from './components/settings-workshop'
import { BudgetsPage } from './components/budgets-workshop'
import { CustomerLedgerModal } from './components/customer-ledger-modal'
import { CheckinDialog, CheckinsPage } from './components/checkin-workshop'

type Page = { to: string; label: string; icon: typeof LayoutDashboard }
const pages: Page[] = [
  { to: '/', label: 'Início', icon: LayoutDashboard },
  { to: '/checkin', label: 'Vistoria / Entrada', icon: Camera },
  { to: '/ordens', label: 'Ordens de Serviço', icon: ClipboardList },
  { to: '/orcamentos', label: 'Orçamentos', icon: ReceiptText },
  { to: '/clientes', label: 'Clientes & Fiado', icon: Users },
  { to: '/estoque', label: 'Estoque', icon: Boxes },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet },
  { to: '/boletos', label: 'Boletos', icon: FileText },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/configuracoes', label: 'Configurações', icon: SettingsIcon }
]

const mobileNavItems = [
  { to: '/', label: 'Início', icon: LayoutDashboard },
  { to: '/checkin', label: 'Vistoria', icon: Camera },
  { to: '/ordens', label: 'OS', icon: ClipboardList },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/financeiro', label: 'Caixa', icon: Wallet }
]

async function confirmAction(message: string, title?: string) {
  return window.confirm(message)
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden ${className}`}>{children}</section>
}
function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950">{title}</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-zinc-500">{subtitle}</p>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">{action}</div>}
    </div>
  )
}
function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full overflow-x-auto touch-scroll">
      <table className="w-full min-w-[580px] md:min-w-full text-left text-xs sm:text-sm">{children}</table>
    </div>
  )
}
function Head({ children }: { children?: React.ReactNode }) {
  return <th className="whitespace-nowrap border-b border-zinc-200 bg-zinc-50/90 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide text-zinc-500">{children}</th>
}
function Cell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-zinc-100 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3.5 text-zinc-700 ${className}`}>{children}</td>
}

export function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const cache = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>({
    isConfigured: false,
    isSyncing: false,
    lastSync: null,
    statusText: '',
    error: null
  })

  const { data: branding } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await query<Settings>('SELECT * FROM settings WHERE id=1'))[0]
  })

  useEffect(() => {
    return subscribeSyncState(setSyncState)
  }, [])

  const active = pages.find((page) => page.to === location.pathname)?.label ?? 'Oficina Pro'

  async function handleHeaderSync() {
    const res = await syncWithGoogleSheets()
    cache.invalidateQueries()
    if (!syncState.isConfigured) {
      navigate('/configuracoes')
    } else {
      window.alert(res.message)
    }
  }

  return (
    <div
      className={`app-theme min-h-screen bg-zinc-100 text-zinc-900 ${branding?.theme_mode === 'Escuro' ? 'theme-dark' : ''}`}
      style={{
        '--app-primary': branding?.primary_color || '#b91c1c',
        '--app-sidebar-active': branding?.primary_color || '#b91c1c',
        '--app-sidebar': branding?.sidebar_background_color || '#18181b',
        '--app-background': branding?.background_color || '#f4f4f5',
        '--app-card': branding?.card_color || '#ffffff',
        backgroundColor: branding?.background_color || '#f4f4f5'
      } as React.CSSProperties}
    >
      {/* Sidebar Desktop e Drawer Mobile/Tablet Vertical */}
      <aside
        style={{ backgroundColor: branding?.sidebar_background_color || '#18181b' }}
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-72 sm:w-80 lg:w-64 flex-col text-white transition-transform ${
          menuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex h-16 sm:h-20 items-center justify-between border-b border-white/10 px-5 sm:px-6">
          <div className="flex items-center gap-3">
            {branding?.logo_data ? (
              <img src={branding.logo_data} className="h-10 w-10 rounded-xl bg-white object-contain p-0.5 shadow-lg" alt="Logo" />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-700 shadow-lg shadow-red-900/40">
                <Wrench size={21} />
              </div>
            )}
            <div>
              <p className="font-bold leading-tight">{branding?.workshop_name || 'Oficina Pro'}</p>
              <p className="text-[11px] text-zinc-400 truncate max-w-[150px]">{branding?.city_default || 'São Miguel da Baixa Grande'}</p>
            </div>
          </div>
          <button onClick={() => setMenuOpen(false)} className="rounded-lg p-2 text-zinc-400 hover:text-white hover:bg-white/10 lg:hidden">
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3 touch-scroll">
          {pages.map(({ to, label, icon: Icon }) => (
            <NavLink
              onClick={() => setMenuOpen(false)}
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${
                  isActive ? 'theme-active text-white shadow-sm font-bold' : 'text-zinc-400 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Rodapé da sidebar com status de nuvem */}
        <div className="border-t border-white/10 p-4 text-xs">
          <div className="flex items-center gap-2 text-zinc-300">
            <span className={`h-2.5 w-2.5 rounded-full ${syncState.isConfigured ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <span className="font-medium truncate">{syncState.isConfigured ? 'Google Sheets Conectado' : 'Modo Offline / Local'}</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 truncate">{syncState.lastSync ? `Sinc.: ${syncState.lastSync}` : 'Dados locais seguros'}</p>
        </div>
      </aside>

      {/* Backdrop para mobile/tablet vertical drawer */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 bg-black/60 lg:hidden backdrop-blur-sm" />
      )}

      {/* Conteúdo Principal Adaptado para Tablet Portrait & Landscape */}
      <main className="min-h-screen pb-24 sm:pb-24 lg:pb-8 lg:ml-64 w-full transition-all tablet-landscape-content">
        {/* Header Superior */}
        <header className="no-print sticky top-0 z-30 flex h-14 sm:h-16 lg:h-14 landscape:h-12 items-center justify-between border-b border-zinc-200 bg-white/95 px-3 sm:px-6 md:px-8 backdrop-blur-md tablet-landscape-compact-header">
          <div className="flex items-center gap-2 sm:gap-3.5">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center justify-center rounded-xl p-2 text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 lg:hidden min-h-[40px] min-w-[40px]"
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>
            <span className="text-base sm:text-lg font-bold text-zinc-900 truncate">{active}</span>
          </div>

          {/* Ações e Status Google Sheets no Header */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleHeaderSync}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold transition min-h-[38px] ${
                syncState.isConfigured
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
              }`}
              title={syncState.isConfigured ? 'Sincronizar com a planilha do Google Sheets' : 'Configurar Google Sheets'}
            >
              <RefreshCw size={14} className={syncState.isSyncing ? 'animate-spin text-emerald-600' : ''} />
              <span className="hidden sm:inline">
                {syncState.isSyncing ? 'Sincronizando...' : syncState.isConfigured ? 'Google Sheets' : 'Conectar Planilha'}
              </span>
            </button>
          </div>
        </header>

        <div className="p-3.5 sm:p-5 md:p-6 lg:p-8 tablet-portrait-container max-w-7xl mx-auto w-full">
          <RouterPage />
        </div>
      </main>

      {/* Bottom Navigation para Mobile e Tablet na Vertical */}
      <nav
        className="no-print fixed bottom-0 left-0 right-0 z-40 flex h-16 sm:h-18 landscape:h-13 items-center justify-around border-t border-zinc-200 bg-white/98 backdrop-blur-md px-1.5 sm:px-4 shadow-xl lg:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 4px)' }}
      >
        {mobileNavItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center py-1 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold transition touch-manipulation min-h-[44px] ${
                isActive ? 'text-red-700 font-extrabold bg-red-50/70 sm:bg-transparent' : 'text-zinc-500 hover:text-zinc-900'
              }`
            }
          >
            <Icon size={20} className="sm:w-6 sm:h-6" />
            <span className="mt-0.5 truncate">{label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-1 flex-col items-center justify-center py-1 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold text-zinc-500 hover:text-zinc-900 touch-manipulation min-h-[44px]"
        >
          <Menu size={20} className="sm:w-6 sm:h-6" />
          <span className="mt-0.5">Mais</span>
        </button>
      </nav>
    </div>
  )
}

function RouterPage() {
  const { pathname } = useLocation()
  if (pathname === '/checkin') return <CheckinsPage />
  if (pathname === '/clientes') return <ClientsPage />
  if (pathname === '/ordens') return <OrdersPage />
  if (pathname === '/orcamentos') return <BudgetsPage />
  if (pathname === '/estoque') return <StockPage />
  if (pathname === '/financeiro') return <FinancePage />
  if (pathname === '/boletos') return <BillsPage />
  if (pathname === '/relatorios') return <FinanceReportsPage />
  if (pathname === '/configuracoes') return <WorkshopSettingsPage />
  return <DashboardPage />
}

function DashboardPage() {
  const cache = useQueryClient()
  const [receivingPart, setReceivingPart] = useState<{ id: number; part_id: number | null; description: string; requested_quantity: number; service_order_id: number } | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: async () => {
    const [orders, lowStock, stats] = await Promise.all([
      query<Order>(`SELECT o.*, c.name client_name, v.plate, trim(v.brand || ' ' || v.model) vehicle FROM service_orders o JOIN clients c ON c.id=o.client_id JOIN vehicles v ON v.id=o.vehicle_id WHERE o.status <> 'Finalizada' ORDER BY o.entered_at DESC LIMIT 8`),
      query<Part>('SELECT * FROM parts WHERE archived_at IS NULL AND quantity <= minimum_stock ORDER BY quantity ASC LIMIT 8'),
      query<{ opened: number; maintenance: number; waiting: number; completed: number; daily: number; monthly: number }>(`SELECT
        SUM(CASE WHEN status <> 'Finalizada' THEN 1 ELSE 0 END) opened,
        SUM(CASE WHEN status='Em manutenção' THEN 1 ELSE 0 END) maintenance,
        SUM(CASE WHEN status='Aguardando peças' THEN 1 ELSE 0 END) waiting,
        SUM(CASE WHEN date(finalized_at)=date('now','localtime') THEN 1 ELSE 0 END) completed,
        COALESCE((SELECT SUM(amount) FROM financial_transactions WHERE type='Recebimento' AND status='Pago' AND date(paid_at)=date('now','localtime')),0) daily,
        COALESCE((SELECT SUM(amount) FROM financial_transactions WHERE type='Recebimento' AND status='Pago' AND strftime('%Y-%m',paid_at)=strftime('%Y-%m','now','localtime')),0) monthly
        FROM service_orders`)
    ])
    return { orders, lowStock, stats: stats[0] ?? { opened: 0, maintenance: 0, waiting: 0, completed: 0, daily: 0, monthly: 0 } }
  }})
  const { data: pendingParts = [] } = useQuery({ queryKey: ['part-requests'], queryFn: () => query<{ id: number; part_id: number | null; description: string; requested_quantity: number; priority: string; number: string; client_name: string; service_order_id: number }>(`SELECT r.id,r.part_id,r.description,r.requested_quantity,r.priority,r.service_order_id,o.number,c.name AS client_name FROM part_requests r JOIN service_orders o ON o.id=r.service_order_id JOIN clients c ON c.id=o.client_id WHERE r.status='Pendente' ORDER BY CASE r.priority WHEN 'Urgente' THEN 1 WHEN 'Alta' THEN 2 ELSE 3 END, r.created_at ASC`) })
  const receivePart = useMutation({ mutationFn: async (request: { id: number; part_id: number | null; description: string; requested_quantity: number; service_order_id: number }) => { const quantity = Number(window.prompt(`Quantidade recebida de ${request.description}:`, String(request.requested_quantity)) || 0); if (!quantity || quantity < 0) return; let partId = request.part_id; if (partId) await execute('UPDATE parts SET quantity=quantity+? WHERE id=?', [quantity, partId]); else { const code = `PED-${Date.now()}`; const result = await execute('INSERT INTO parts (code,name,brand,quantity,purchase_price,sale_price,minimum_stock) VALUES (?,?,?,?,?,?,?)', [code, request.description, '', quantity, 0, 0, 0]); partId = Number(result.lastInsertId) } await execute("UPDATE part_requests SET status='Recebida',part_id=? WHERE id=?", [partId, request.id]); await execute("UPDATE service_orders SET status='Em manutenção' WHERE id=? AND status='Aguardando peças'", [request.service_order_id]) }, onSuccess: () => { for (const key of ['part-requests', 'parts', 'orders', 'dashboard', 'order-stock']) cache.invalidateQueries({ queryKey: [key] }) } })
  const { data: readyToContact = [] } = useQuery({ queryKey: ['ready-to-contact'], queryFn: () => query<{ id: number; number: string; client_name: string; phone: string; vehicle: string; plate: string }>(`SELECT o.id,o.number,c.name AS client_name,c.phone,trim(v.brand || ' ' || v.model) vehicle,v.plate FROM service_orders o JOIN clients c ON c.id=o.client_id JOIN vehicles v ON v.id=o.vehicle_id WHERE o.status='Finalizada' AND NOT EXISTS (SELECT 1 FROM financial_transactions t WHERE t.service_order_id=o.id) ORDER BY o.finalized_at ASC`) })
  const { data: duePayments = [] } = useQuery({ queryKey: ['due-account-payments'], queryFn: () => query<{ id: number; amount: number; due_date: string; client_name: string; phone: string; vehicle: string; plate: string; number: string }>(`SELECT t.id,t.amount,t.due_date,c.name AS client_name,c.phone,trim(v.brand || ' ' || v.model) vehicle,v.plate,o.number FROM financial_transactions t JOIN clients c ON c.id=t.client_id LEFT JOIN vehicles v ON v.id=t.vehicle_id LEFT JOIN service_orders o ON o.id=t.service_order_id WHERE t.type='Recebimento' AND t.status='Pendente' AND t.payment_method='Anotado na conta' AND t.due_date IS NOT NULL AND date(t.due_date)<=date('now','localtime') ORDER BY t.due_date ASC`) })
  const { data: billSummary = [] } = useQuery({ queryKey: ['open-bills-month'], queryFn: () => query<{ count: number; total: number }>(`SELECT COUNT(*) count,COALESCE(SUM(amount),0) total FROM bills WHERE status='Pendente' AND strftime('%Y-%m',due_date)=strftime('%Y-%m','now','localtime')`) })
  const statCards = [
    ['OS abertas', data?.stats.opened ?? 0, ClipboardList, 'text-sky-700 bg-sky-50'], ['Em manutenção', data?.stats.maintenance ?? 0, Wrench, 'text-amber-700 bg-amber-50'], ['Aguardando peças', data?.stats.waiting ?? 0, Boxes, 'text-orange-700 bg-orange-50'], ['Finalizadas hoje', data?.stats.completed ?? 0, CheckCircle2, 'text-emerald-700 bg-emerald-50'], ['Agendamentos hoje', 0, CalendarClock, 'text-violet-700 bg-violet-50'], ['Faturamento do dia', money(data?.stats.daily), CircleDollarSign, 'text-red-700 bg-red-50'], ['Faturamento do mês', money(data?.stats.monthly), Wallet, 'text-rose-700 bg-rose-50'], ['Boletos abertos no mês', `${billSummary[0]?.count ?? 0} · ${money(billSummary[0]?.total ?? 0)}`, ReceiptText, 'text-orange-700 bg-orange-50']
  ] as const
  return (
    <>
      <PageHeader title="Bom trabalho!" subtitle="Veja o que está acontecendo na oficina hoje." />
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {statCards.map(([label, value, Icon, color]) => (
          <Panel key={label} className="p-3 sm:p-4">
            <div className="flex items-start justify-between gap-1">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-zinc-500 truncate">{label}</p>
                <strong className="mt-1 sm:mt-2 block text-lg sm:text-2xl text-zinc-950 font-bold">{isLoading ? '—' : value}</strong>
              </div>
              <span className={`shrink-0 rounded-lg p-2 sm:p-2.5 ${color}`}>
                <Icon size={18} className="sm:w-5 sm:h-5" />
              </span>
            </div>
          </Panel>
        ))}
      </div>

      <div className="mt-4 sm:mt-6 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 sm:px-5 py-3 sm:py-4">
            <h2 className="text-sm sm:text-base font-bold text-zinc-900">Ordens de serviço em andamento</h2>
          </div>
          {data?.orders.length ? (
            <TableShell>
              <thead>
                <tr>
                  <Head>Número</Head>
                  <Head>Cliente</Head>
                  <Head>Veículo</Head>
                  <Head>Status</Head>
                  <Head>Entrada</Head>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order.id}>
                    <Cell className="font-semibold">{order.number}</Cell>
                    <Cell>{order.client_name}</Cell>
                    <Cell>{order.vehicle} · {order.plate}</Cell>
                    <Cell><StatusBadge status={order.status} /></Cell>
                    <Cell>{dateOnly(order.entered_at)}</Cell>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          ) : (
            <Empty>Nenhuma ordem em andamento.</Empty>
          )}
        </Panel>

        <Panel>
          <div className="border-b border-zinc-200 px-4 sm:px-5 py-3 sm:py-4">
            <h2 className="flex items-center gap-2 text-sm sm:text-base font-bold text-zinc-900">
              <Boxes size={18} className="text-red-700" />
              Estoque baixo
            </h2>
          </div>
          <div className="divide-y divide-zinc-100 max-h-[380px] overflow-y-auto">
            {data?.lowStock.length ? (
              data.lowStock.map((part) => (
                <div key={part.id} className="flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-zinc-800">{part.name}</p>
                    <p className="text-[11px] sm:text-xs text-zinc-500">{part.code} · mínimo {part.minimum_stock}</p>
                  </div>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{part.quantity} un.</span>
                </div>
              ))
            ) : (
              <Empty>Seu estoque está em dia.</Empty>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 sm:mt-6 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Panel>
          <div className="border-b border-zinc-200 px-4 sm:px-5 py-3 sm:py-4">
            <h2 className="flex items-center gap-2 text-sm sm:text-base font-bold text-zinc-900">
              <CheckCircle2 size={18} className="text-violet-700" />
              Entrar em contato
            </h2>
          </div>
          {readyToContact.length ? (
            <div className="divide-y divide-zinc-100 max-h-[360px] overflow-y-auto">
              {readyToContact.map((order) => (
                <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-2.5 sm:py-3">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-zinc-800">{order.client_name}</p>
                    <p className="text-xs text-zinc-600">{order.phone || 'Sem telefone'}</p>
                    <p className="text-[11px] text-zinc-500">OS {order.number} · {order.vehicle}</p>
                  </div>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-800">Pronto</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>Nenhum serviço finalizado aguardando contato.</Empty>
          )}
        </Panel>

        <Panel>
          <div className="border-b border-zinc-200 px-4 sm:px-5 py-3 sm:py-4">
            <h2 className="flex items-center gap-2 text-sm sm:text-base font-bold text-zinc-900">
              <Wallet size={18} className="text-amber-700" />
              Cobranças de hoje
            </h2>
          </div>
          {duePayments.length ? (
            <div className="divide-y divide-zinc-100 max-h-[360px] overflow-y-auto">
              {duePayments.map((payment) => (
                <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-2.5 sm:py-3">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-zinc-800">{payment.client_name}</p>
                    <p className="text-xs text-zinc-600">{payment.phone || 'Sem telefone'} · {money(payment.amount)}</p>
                    <p className="text-[11px] text-zinc-500">Vence em {dateOnly(payment.due_date)} · OS {payment.number || 'avulso'}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Fiado</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>Nenhuma cobrança anotada vence hoje.</Empty>
          )}
        </Panel>

        <Panel className="md:col-span-2 lg:col-span-1">
          <div className="border-b border-zinc-200 px-4 sm:px-5 py-3 sm:py-4">
            <h2 className="flex items-center gap-2 text-sm sm:text-base font-bold text-zinc-900">
              <PackagePlus size={18} className="text-red-700" />
              Peças para pedir
            </h2>
          </div>
          {pendingParts.length ? (
            <div className="divide-y divide-zinc-100 max-h-[360px] overflow-y-auto">
              {pendingParts.map((part) => (
                <div key={part.id} className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-2.5 sm:py-3">
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-zinc-800">
                      {part.description} <span className="text-[11px] text-zinc-500">· {part.requested_quantity} un.</span>
                    </p>
                    <p className="text-[11px] text-zinc-500">OS {part.number} · {part.client_name}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      part.priority === 'Urgente' ? 'bg-red-100 text-red-700' : part.priority === 'Alta' ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-700'
                    }`}>
                      {part.priority}
                    </span>
                    <Button className="px-2 py-1 text-xs" variant="secondary" onClick={() => setReceivingPart(part)}>
                      <CheckCircle2 size={14} /> Chegou
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty>Nenhuma peça aguardando pedido.</Empty>
          )}
        </Panel>
      </div>

      {receivingPart && <ReceivePartDialog request={receivingPart} onClose={() => setReceivingPart(null)} />}
    </>
  )
}

const internalPartCode = () => `SEM-COD-${Date.now()}-${Math.floor(Math.random() * 1000)}`

function ReceivePartDialog({ request, onClose }: { request: { id: number; part_id: number | null; description: string; requested_quantity: number; service_order_id: number }; onClose: () => void }) {
  const cache = useQueryClient()
  const { data: existingParts = [] } = useQuery({ queryKey: ['requested-part', request.part_id], enabled: Boolean(request.part_id), queryFn: () => query<Part>('SELECT * FROM parts WHERE id=?', [request.part_id]) })
  const existing = existingParts[0]
  const form = useForm({ defaultValues: { code: existing?.code ?? `PED-${Date.now()}`, name: request.description, quantity: String(request.requested_quantity), minimum_stock: String(existing?.minimum_stock ?? 0), purchase_price: String(existing?.purchase_price ?? 0), sale_price: String(existing?.sale_price ?? 0), brand: existing?.brand ?? '' } })
  useEffect(() => { if (existing) form.reset({ code: existing.code, name: existing.name, quantity: String(request.requested_quantity), minimum_stock: String(existing.minimum_stock), purchase_price: String(existing.purchase_price), sale_price: String(existing.sale_price), brand: existing.brand }) }, [existing, form, request.requested_quantity])
  const save = useMutation({ mutationFn: async (value: { code: string; name: string; quantity: string; minimum_stock: string; purchase_price: string; sale_price: string; brand: string }) => { const quantity = Number(value.quantity) || 0; const code = value.code.trim() || internalPartCode(); if (quantity <= 0) throw new Error('Informe uma quantidade maior que zero.'); let partId = request.part_id; if (partId) await execute('UPDATE parts SET code=?,name=?,brand=?,quantity=quantity+?,purchase_price=?,sale_price=?,minimum_stock=? WHERE id=?', [code, value.name, value.brand, quantity, Number(value.purchase_price) || 0, Number(value.sale_price) || 0, Number(value.minimum_stock) || 0, partId]); else { const result = await execute('INSERT INTO parts (code,name,brand,quantity,purchase_price,sale_price,minimum_stock) VALUES (?,?,?,?,?,?,?)', [code, value.name, value.brand, quantity, Number(value.purchase_price) || 0, Number(value.sale_price) || 0, Number(value.minimum_stock) || 0]); partId = Number(result.lastInsertId) } await execute('INSERT INTO stock_movements (part_id,movement_type,item_name,quantity,unit_cost,unit_price,total_cost,notes) VALUES (?,?,?,?,?,?,?,?)', [partId, 'Entrada', value.name, quantity, Number(value.purchase_price) || 0, Number(value.sale_price) || 0, quantity * (Number(value.purchase_price) || 0), 'Peça recebida de pedido']); await execute("UPDATE part_requests SET status='Recebida',part_id=? WHERE id=?", [partId, request.id]); await execute("UPDATE service_orders SET status='Em manutenção' WHERE id=? AND status='Aguardando peças'", [request.service_order_id]) }, onSuccess: () => { for (const key of ['part-requests', 'parts', 'orders', 'dashboard', 'order-stock']) cache.invalidateQueries({ queryKey: [key] }); onClose() } })
  return <Modal title="Registrar peça recebida" onClose={onClose}><form className="space-y-4" onSubmit={form.handleSubmit(value => save.mutate(value))}><p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Nome e quantidade vieram do pedido. Complete os valores para manter essa peça organizada no estoque.</p><div className="grid grid-cols-2 gap-3"><Input label="Código (opcional)" {...form.register('code')}/><Input required label="Quantidade recebida" type="number" min="0.01" step="0.01" {...form.register('quantity')}/></div><Input required label="Nome da peça" {...form.register('name')}/><Input label="Marca" {...form.register('brand')}/><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Input label="Estoque mínimo" type="number" min="0" step="0.01" {...form.register('minimum_stock')}/><Input label="Valor de compra" type="number" min="0" step="0.01" {...form.register('purchase_price')}/><Input label="Valor de venda" type="number" min="0" step="0.01" {...form.register('sale_price')}/></div><div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={save.isPending} type="submit">{save.isPending ? 'Salvando...' : 'Registrar chegada'}</Button></div></form></Modal>
}

const clientSchema = z.object({
  name: z.string().min(2, 'Informe o nome completo.'),
  phone: z.string(),
  city: z.string(),
  nickname: z.string().optional(),
  document: z.string(),
  notes: z.string()
})

type ClientFormData = z.infer<typeof clientSchema>
function ClientForm({ initial, onClose }: { initial?: Client; onClose: () => void }) {
  const cache = useQueryClient()
  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: initial ?? {
      name: '',
      phone: '',
      city: 'São Miguel da Baixa Grande - PI',
      nickname: '',
      document: '',
      notes: ''
    }
  })

  const saveClient = useMutation({
    mutationFn: async (value: ClientFormData) => {
      if (initial) {
        return execute(
          'UPDATE clients SET name=?, phone=?, city=?, document=?, notes=?, nickname=? WHERE id=?',
          [value.name, value.phone, value.city, value.document, value.notes, value.nickname || '', initial.id]
        )
      }
      return execute(
        'INSERT INTO clients (name, phone, city, document, notes, nickname) VALUES (?, ?, ?, ?, ?, ?)',
        [value.name, value.phone, value.city, value.document, value.notes, value.nickname || '']
      )
    },
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['clients'] })
      cache.invalidateQueries({ queryKey: ['order-clients'] })
      onClose()
    }
  })

  return (
    <Modal title={initial ? 'Editar cliente' : 'Novo cliente'} onClose={onClose}>
      <form className="space-y-4" onSubmit={form.handleSubmit(value => saveClient.mutate(value))}>
        <Input label="Nome completo *" error={form.formState.errors.name?.message} {...form.register('name')} />
        
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Apelido / Povoado / Referência" placeholder="Ex.: Zé do Brejo, Chico do Posto, Povoado Santa Rosa" {...form.register('nickname')} />
          <Input label="Telefone / WhatsApp *" placeholder="(86) 90000-0000" {...form.register('phone')} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Cidade / Localidade" placeholder="São Miguel da Baixa Grande - PI" {...form.register('city')} />
          <Input label="CPF ou RG" placeholder="Opcional" {...form.register('document')} />
        </div>

        <Textarea label="Observações adicionais" rows={2} placeholder="Ex.: Paga no dia 10, cliente de confiança, etc." {...form.register('notes')} />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={saveClient.isPending} type="submit">
            {saveClient.isPending ? 'Salvando...' : 'Salvar cliente'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ClientsPage() {
  const [search, setSearch] = useState('')
  const [filterPending, setFilterPending] = useState(false)
  const [form, setForm] = useState<Client | 'new' | null>(null)
  const [selected, setSelected] = useState<Client | null>(null)
  const [ledgerClient, setLedgerClient] = useState<Client | null>(null)
  const cache = useQueryClient()

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients-with-balance', search],
    queryFn: () =>
      query<Client & { balance: number }>(
        `SELECT c.id, c.name, c.phone, c.city, c.document, c.notes, c.nickname,
          COALESCE((
            SELECT SUM(CASE WHEN cl.type = 'Debito' THEN cl.amount ELSE -cl.amount END)
            FROM customer_ledger cl
            WHERE cl.client_id = c.id
          ), 0) AS balance
        FROM clients c 
        WHERE c.name LIKE ? OR c.phone LIKE ? OR c.city LIKE ? OR c.nickname LIKE ? 
        ORDER BY c.name`,
        [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
      )
  })

  const displayedClients = filterPending
    ? clients.filter(c => Number(c.balance || 0) > 0)
    : clients

  const totalEmAberto = clients
    .filter(c => Number(c.balance || 0) > 0)
    .reduce((acc, curr) => acc + Number(curr.balance || 0), 0)

  async function remove(client: Client) {
    if (await confirmAction(`Excluir ${client.name}? Os veículos e dados vinculados também serão removidos.`, 'Excluir cliente')) {
      await execute('DELETE FROM clients WHERE id=?', [client.id])
      cache.invalidateQueries({ queryKey: ['clients-with-balance'] })
    }
  }

  function falarNoWhatsApp(client: Client) {
    if (!client.phone) {
      window.alert('Cliente sem telefone cadastrado.')
      return
    }
    openWhatsApp(client.phone, `Olá ${client.name}! Tudo bem? Aqui é da oficina.`)
  }

  return (
    <>
      <PageHeader
        title="Clientes & Caderninho de Fiado"
        subtitle="Controle de clientes, apelidos, veículos e conta corrente de fiado da oficina."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setForm('new')}>
              <Plus size={18} /> Novo cliente
            </Button>
          </div>
        }
      />

      {/* Resumo Rápido de Fiados na Cidade */}
      {totalEmAberto > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/80 p-3.5 sm:p-4 text-red-950">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white shadow-xs">
              <BadgeDollarSign size={22} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-red-700">Total a Receber no Fiado / Caderninho</p>
              <p className="text-xl sm:text-2xl font-black text-red-700">{money(totalEmAberto)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFilterPending(!filterPending)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition border ${
              filterPending
                ? 'bg-red-600 text-white border-red-700 shadow-xs'
                : 'bg-white text-red-700 border-red-300 hover:bg-red-100'
            }`}
          >
            {filterPending ? '✓ Mostrando só quem deve' : 'Filtrar quem está devendo'}
          </button>
        </div>
      )}

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Pesquisar por apelido, nome, telefone ou povoado..."
              className="w-full rounded-lg border border-zinc-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-red-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterPending(false)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                !filterPending ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              Todos ({clients.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterPending(true)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                filterPending ? 'bg-red-600 text-white' : 'text-red-700 bg-red-50 hover:bg-red-100'
              }`}
            >
              Com Fiado ({clients.filter(c => Number(c.balance || 0) > 0).length})
            </button>
          </div>
        </div>

        {isLoading ? (
          <Empty>Carregando clientes...</Empty>
        ) : displayedClients.length ? (
          <TableShell>
            <thead>
              <tr>
                <Head>Cliente / Apelido</Head>
                <Head>Conta / Fiado</Head>
                <Head>WhatsApp / Telefone</Head>
                <Head>Localidade</Head>
                <Head>Ações</Head>
              </tr>
            </thead>
            <tbody>
              {displayedClients.map(client => {
                const bal = Number(client.balance || 0)
                return (
                  <tr key={client.id} className="transition hover:bg-zinc-50/50">
                    <Cell>
                      <div className="space-y-0.5">
                        {client.nickname ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-block rounded-md bg-amber-500 px-2 py-0.5 text-xs font-black uppercase text-white shadow-2xs">
                              {client.nickname}
                            </span>
                            <span className="text-xs text-zinc-600 font-medium">{client.name}</span>
                          </div>
                        ) : (
                          <p className="font-bold text-zinc-950 text-sm">{client.name}</p>
                        )}
                      </div>
                    </Cell>

                    {/* Coluna do Caderninho / Fiado */}
                    <Cell>
                      {bal > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-black text-red-800">
                            Pendente: {money(bal)}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Conta em dia
                        </span>
                      )}
                    </Cell>

                    <Cell>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-700 font-medium">{client.phone || '—'}</span>
                        {client.phone && (
                          <button
                            type="button"
                            onClick={() => falarNoWhatsApp(client)}
                            className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                            title="Abrir WhatsApp"
                          >
                            <MessageCircle size={16} />
                          </button>
                        )}
                      </div>
                    </Cell>

                    <Cell>{client.city || 'São Miguel da Baixa Grande'}</Cell>

                    <Cell>
                      <div className="flex items-center gap-1.5">
                        {/* Botão de Caderninho / Fiado */}
                        <Button
                          className={`px-2.5 py-1.5 text-xs ${
                            bal > 0 ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-zinc-300'
                          }`}
                          variant={bal > 0 ? 'primary' : 'secondary'}
                          title="Abrir caderninho de fiado e extrato"
                          onClick={() => setLedgerClient(client)}
                        >
                          <BookOpen size={14} />
                          <span>Caderninho</span>
                        </Button>

                        <Button
                          className="px-2.5 py-1.5 text-xs"
                          variant="secondary"
                          title="Ver veículos"
                          onClick={() => setSelected(client)}
                        >
                          <Car size={14} />
                          <span className="hidden sm:inline">Veículos</span>
                        </Button>

                        <Button
                          className="p-1.5"
                          variant="ghost"
                          title="Editar cliente"
                          onClick={() => setForm(client)}
                        >
                          <Pencil size={15} />
                        </Button>

                        <Button
                          className="p-1.5"
                          variant="ghost"
                          title="Excluir cliente"
                          onClick={() => remove(client)}
                        >
                          <Trash2 size={15} className="text-red-700" />
                        </Button>
                      </div>
                    </Cell>
                  </tr>
                )
              })}
            </tbody>
          </TableShell>
        ) : (
          <Empty>
            {filterPending
              ? 'Nenhum cliente com fiado pendente no momento. Todas as contas estão em dia!'
              : 'Nenhum cliente encontrado. Cadastre o primeiro cliente da oficina.'}
          </Empty>
        )}
      </Panel>

      {form && <ClientForm initial={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
      {selected && <VehiclesModal client={selected} onClose={() => setSelected(null)} />}
      {ledgerClient && <CustomerLedgerModal client={ledgerClient} onClose={() => setLedgerClient(null)} />}
    </>
  )
}

function VehiclesModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const navigate = useNavigate()
  const cache = useQueryClient()
  const [vehicleForm, setVehicleForm] = useState<Vehicle | 'new' | null>(null)
  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null)

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles', client.id],
    queryFn: () => query<Vehicle>('SELECT * FROM vehicles WHERE client_id=? ORDER BY model', [client.id])
  })

  async function remove(vehicle: Vehicle) {
    if (await confirmAction(`Excluir o veículo ${vehicle.model}?`, 'Excluir veículo')) {
      await execute('DELETE FROM vehicles WHERE id=?', [vehicle.id])
      cache.invalidateQueries({ queryKey: ['vehicles', client.id] })
    }
  }

  function newOrder(vehicle: Vehicle, budget = false) {
    onClose()
    navigate(`/ordens?client=${client.id}&vehicle=${vehicle.id}&budget=${budget ? '1' : '0'}`)
  }

  return (
    <Modal title={`Veículos — ${client.name} ${client.nickname ? `(${client.nickname})` : ''}`} onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500">Motos, carros ou utilitários vinculados a este cliente.</p>
        <Button onClick={() => setVehicleForm('new')}>
          <Plus size={17} /> Novo veículo
        </Button>
      </div>

      {vehicles.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {vehicles.map(vehicle => (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm" key={vehicle.id}>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-700">
                      {vehicle.vehicle_type || 'Moto'}
                    </span>
                    <h3 className="font-bold text-zinc-950">
                      {vehicle.brand} {vehicle.model}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Placa: <strong className="text-zinc-800">{vehicle.plate}</strong> · {vehicle.year || 'Ano s/ inf.'} · {vehicle.color || 'Cor s/ inf.'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button title="Editar" variant="ghost" className="p-1.5" onClick={() => setVehicleForm(vehicle)}>
                    <Pencil size={15} />
                  </Button>
                  <Button title="Excluir" variant="ghost" className="p-1.5" onClick={() => remove(vehicle)}>
                    <Trash2 size={15} className="text-red-700" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 border-t border-zinc-100 pt-2.5">
                <Button className="py-1.5 px-2.5 text-xs" onClick={() => newOrder(vehicle)}>
                  <ClipboardList size={14} /> Nova OS
                </Button>
                <Button className="py-1.5 px-2.5 text-xs" variant="secondary" onClick={() => newOrder(vehicle, true)}>
                  <FileText size={14} /> Orçamento
                </Button>
                <Button className="py-1.5 px-2.5 text-xs" variant="secondary" onClick={() => setHistoryVehicle(vehicle)}>
                  <CalendarClock size={14} /> Histórico
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty>Este cliente ainda não tem motos ou carros cadastrados.</Empty>
      )}

      {vehicleForm && (
        <VehicleForm
          client={client}
          initial={vehicleForm === 'new' ? undefined : vehicleForm}
          onClose={() => setVehicleForm(null)}
        />
      )}
      {historyVehicle && <VehicleHistoryModal vehicle={historyVehicle} onClose={() => setHistoryVehicle(null)} />}
    </Modal>
  )
}

function VehicleHistoryModal({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const [selected, setSelected] = useState<Order | null>(null)
  const { data: history = [] } = useQuery({ queryKey: ['vehicle-history', vehicle.id], queryFn: () => query<Order>(`SELECT o.*,c.name client_name,v.plate,trim(v.brand || ' ' || v.model) vehicle FROM service_orders o JOIN clients c ON c.id=o.client_id JOIN vehicles v ON v.id=o.vehicle_id WHERE o.vehicle_id=? ORDER BY o.entered_at DESC`, [vehicle.id]) })
  const { data: parts = [] } = useQuery({ queryKey: ['vehicle-history-parts', selected?.id], enabled: Boolean(selected), queryFn: () => query<{ name: string; brand: string; quantity: number; unit_price: number }>(`SELECT COALESCE(NULLIF(sop.item_name,''),p.name) name,COALESCE(NULLIF(sop.item_brand,''),p.brand) brand,sop.quantity,sop.unit_price FROM service_order_parts sop LEFT JOIN parts p ON p.id=sop.part_id WHERE sop.service_order_id=?`, [selected?.id]) })
  return <Modal title={`Histórico — ${vehicle.brand} ${vehicle.model} · ${vehicle.plate}`} onClose={onClose} wide>{selected ? <><Button variant="secondary" className="mb-4" onClick={() => setSelected(null)}>← Voltar ao histórico</Button><div className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><div><p className="text-xs font-bold uppercase text-zinc-500">OS e data</p><p className="font-bold">{selected.number} · {dateOnly(selected.entered_at)}</p></div><div><p className="text-xs font-bold uppercase text-zinc-500">Valor total</p><p className="font-bold text-emerald-700">{money(selected.total)}</p></div></div><div><p className="text-xs font-bold uppercase text-zinc-500">Defeito informado</p><p className="mt-1 whitespace-pre-wrap">{selected.complaint || 'Não informado'}</p></div><div><p className="text-xs font-bold uppercase text-zinc-500">Diagnóstico</p><p className="mt-1 whitespace-pre-wrap">{selected.diagnosis || 'Não informado'}</p></div><div><p className="text-xs font-bold uppercase text-zinc-500">Serviço realizado</p><p className="mt-1 whitespace-pre-wrap">{selected.service_done || 'Não informado'}</p></div><div className="rounded-xl border border-zinc-200"><h3 className="border-b border-zinc-200 px-4 py-3 font-bold">Peças utilizadas</h3>{parts.length ? <TableShell><thead><tr><Head>Peça</Head><Head>Quantidade</Head><Head>Unitário</Head><Head>Subtotal</Head></tr></thead><tbody>{parts.map((part, index) => <tr key={index}><Cell>{part.name} {part.brand && <span className="text-zinc-500">· {part.brand}</span>}</Cell><Cell>{part.quantity}</Cell><Cell>{money(part.unit_price)}</Cell><Cell>{money(part.quantity * part.unit_price)}</Cell></tr>)}</tbody></TableShell> : <Empty>Nenhuma peça registrada nesta OS.</Empty>}</div></div></> : <>{history.length ? <TableShell><thead><tr><Head>Data</Head><Head>Ordem de serviço</Head><Head>Valor</Head><Head></Head></tr></thead><tbody>{history.map(order => <tr key={order.id}><Cell>{dateOnly(order.entered_at)}</Cell><Cell className="font-semibold">{order.number}</Cell><Cell className="font-semibold">{money(order.total)}</Cell><Cell><Button variant="secondary" className="px-2.5 py-1.5" onClick={() => setSelected(order)}><FileText size={16}/>Ver detalhes</Button></Cell></tr>)}</tbody></TableShell> : <Empty>Este veículo ainda não possui serviços registrados.</Empty>}</>}</Modal>
}

function VehicleForm({ client, initial, onClose }: { client: Client; initial?: Vehicle; onClose: () => void }) {
  const cache = useQueryClient()
  const form = useForm<Omit<Vehicle, 'id' | 'client_id' | 'client_name'>>({
    defaultValues: initial ?? {
      plate: '',
      model: '',
      brand: 'Honda',
      year: '',
      color: '',
      vehicle_type: 'Moto'
    }
  })

  const saveVehicle = useMutation({
    mutationFn: async (value: Omit<Vehicle, 'id' | 'client_id' | 'client_name'>) =>
      initial
        ? execute(
            'UPDATE vehicles SET plate=?, model=?, brand=?, year=?, color=?, vehicle_type=? WHERE id=?',
            [value.plate.toUpperCase(), value.model, value.brand, value.year, value.color, value.vehicle_type || 'Moto', initial.id]
          )
        : execute(
            'INSERT INTO vehicles (client_id, plate, model, brand, year, color, vehicle_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [client.id, value.plate.toUpperCase(), value.model, value.brand, value.year, value.color, value.vehicle_type || 'Moto']
          ),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['vehicles', client.id] })
      cache.invalidateQueries({ queryKey: ['order-vehicles'] })
      onClose()
    }
  })

  return (
    <Modal title={initial ? 'Editar veículo' : 'Novo veículo'} onClose={onClose}>
      <form onSubmit={form.handleSubmit(value => saveVehicle.mutate(value))} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select label="Tipo do veículo *" {...form.register('vehicle_type')}>
            <option value="Moto">Moto (Motocicleta)</option>
            <option value="Carro">Carro de passeio</option>
            <option value="Caminhonete">Caminhonete / Picape</option>
            <option value="Utilitário">Utilitário / Van</option>
            <option value="Outro">Outro</option>
          </Select>

          <Input required label="Placa *" placeholder="ABC1D23 ou Mercosul" {...form.register('plate')} />
          <Input required label="Modelo *" placeholder="Ex.: CG 160 Fan, Bros 160, Gol, Strada" {...form.register('model')} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input label="Marca / Fabricante" placeholder="Ex.: Honda, Yamaha, Fiat" {...form.register('brand')} />
          <Input label="Ano de fabricação" inputMode="numeric" placeholder="Ex.: 2022" {...form.register('year')} />
          <Input label="Cor" placeholder="Ex.: Vermelha, Preta" {...form.register('color')} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Salvar veículo</Button>
        </div>
      </form>
    </Modal>
  )
}

function OrdersPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const cache = useQueryClient()
  const [form, setForm] = useState<boolean>(false)
  const [detail, setDetail] = useState<Order | null>(null)
  const [editingInitial, setEditingInitial] = useState<Order | null>(null)
  const [finalizing, setFinalizing] = useState<Order | null>(null)
  const [pendingPart, setPendingPart] = useState<Order | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (new URLSearchParams(location.search).has('vehicle')) setForm(true)
  }, [location.search])

  const { data: branding } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await query<Settings>('SELECT * FROM settings WHERE id=1'))[0]
  })

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', filter],
    queryFn: () =>
      query<Order & { phone?: string }>(
        `SELECT o.*, c.name client_name, c.phone, v.plate, trim(v.brand || ' ' || v.model) vehicle
         FROM service_orders o
         JOIN clients c ON c.id=o.client_id
         JOIN vehicles v ON v.id=o.vehicle_id
         WHERE o.number LIKE ? OR c.name LIKE ? OR v.plate LIKE ?
         ORDER BY o.entered_at DESC`,
        [`%${filter}%`, `%${filter}%`, `%${filter}%`]
      )
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      execute('UPDATE service_orders SET status=? WHERE id=?', [status, id]),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['orders'] })
      cache.invalidateQueries({ queryKey: ['dashboard'] })
      cache.invalidateQueries({ queryKey: ['ready-to-contact'] })
      cache.invalidateQueries({ queryKey: ['payment-orders'] })
    }
  })

  async function removeOrder(order: Order) {
    if (
      !(await confirmAction(
        `Excluir a OS ${order.number}? Os pagamentos vinculados serão removidos e as peças usadas voltarão ao estoque.`,
        'Excluir ordem de serviço'
      ))
    )
      return
    const usedParts = await query<{ part_id: number; quantity: number }>(
      'SELECT part_id,quantity FROM service_order_parts WHERE service_order_id=?',
      [order.id]
    )
    for (const part of usedParts) await execute('UPDATE parts SET quantity=quantity+? WHERE id=?', [part.quantity, part.part_id])
    await execute('DELETE FROM financial_transactions WHERE service_order_id=?', [order.id])
    await execute('DELETE FROM part_requests WHERE service_order_id=?', [order.id])
    await execute('DELETE FROM service_orders WHERE id=?', [order.id])
    for (const key of [
      'orders',
      'dashboard',
      'parts',
      'transactions',
      'finance-summary',
      'report',
      'ready-to-contact',
      'payment-orders',
      'part-requests'
    ])
      cache.invalidateQueries({ queryKey: [key] })
  }

  function avisoWhatsAppPronto(order: Order & { phone?: string }) {
    if (!order.phone) {
      window.alert('Telefone do cliente não cadastrado.')
      return
    }
    const oficina = branding?.workshop_name || 'Oficina Mecânica'
    const pix = branding?.pix_key ? `\nChave Pix: ${branding.pix_key}` : ''
    const msg = `Olá ${order.client_name}! Tudo bem?\nAqui é da *${oficina}*.\n\nSeu veículo *${order.vehicle}* (${order.plate}) referente à *OS ${order.number}* já está *PRONTO* para retirada!\n\nValor total: *${money(order.total)}*${pix}\n\nPode vir retirar quando quiser!`
    openWhatsApp(order.phone, msg)
  }

  return (
    <>
      <PageHeader
        title="Ordens de Serviço"
        subtitle="Abra, acompanhe e finalize os atendimentos da oficina."
        action={
          <Button onClick={() => setForm(true)}>
            <Plus size={18} /> Nova ordem
          </Button>
        }
      />
      <Panel>
        <div className="border-b border-zinc-200 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
            <input
              value={filter}
              onChange={event => setFilter(event.target.value)}
              placeholder="Buscar por OS, cliente ou placa..."
              className="w-full rounded-lg border border-zinc-300 py-2.5 pl-10 pr-3 outline-none focus:border-red-600"
            />
          </div>
        </div>
        {isLoading ? (
          <Empty>Carregando...</Empty>
        ) : orders.length ? (
          <TableShell>
            <thead>
              <tr>
                <Head>Número</Head>
                <Head>Cliente / veículo</Head>
                <Head>Status</Head>
                <Head>Entrada</Head>
                <Head>Total</Head>
                <Head>Ações</Head>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id} className="transition hover:bg-zinc-50/50">
                  <Cell className="font-semibold text-zinc-950">{order.number}</Cell>
                  <Cell>
                    <p className="font-bold text-zinc-900">{order.client_name}</p>
                    <p className="text-xs text-zinc-500">
                      {order.vehicle} · {order.plate}
                    </p>
                  </Cell>
                  <Cell>
                    <StatusBadge status={order.status} />
                  </Cell>
                  <Cell>{dateTime(order.entered_at)}</Cell>
                  <Cell className="font-bold text-zinc-900">{money(order.total)}</Cell>
                  <Cell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        variant="secondary"
                        className="px-2 py-1.5 text-xs"
                        title="Ver detalhes da OS"
                        onClick={() => setDetail(order)}
                      >
                        <FileText size={15} />
                        <span className="hidden xl:inline">Abrir</span>
                      </Button>

                      {order.phone && (order.status === 'Serviço finalizado' || order.status === 'Finalizada') && (
                        <Button
                          className="bg-emerald-600 px-2 py-1.5 text-xs text-white hover:bg-emerald-700"
                          title="Avisar cliente pelo WhatsApp"
                          onClick={() => avisoWhatsAppPronto(order)}
                        >
                          <MessageCircle size={15} />
                          <span className="hidden xl:inline">Avisar</span>
                        </Button>
                      )}

                      {order.status !== 'Finalizada' && (
                        <>
                          <Button
                            variant="secondary"
                            className="px-2 py-1.5 text-xs"
                            title="Em manutenção"
                            onClick={() => updateStatus.mutate({ id: order.id, status: 'Em manutenção' })}
                          >
                            <Wrench size={15} />
                          </Button>
                          <Button
                            variant="secondary"
                            className="px-2 py-1.5 text-xs"
                            title="Aguardando peça"
                            onClick={() => setPendingPart(order)}
                          >
                            <Boxes size={15} />
                          </Button>
                          <Button
                            className="px-2.5 py-1.5 text-xs"
                            title="Finalizar OS"
                            onClick={() => setFinalizing(order)}
                          >
                            <CheckCircle2 size={15} /> Finalizar
                          </Button>
                        </>
                      )}

                      <Button
                        variant="ghost"
                        className="p-1.5"
                        title="Editar abertura"
                        disabled={order.status === 'Finalizada'}
                        onClick={() => setEditingInitial(order)}
                      >
                        <Pencil size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        className="p-1.5"
                        title="Excluir OS"
                        onClick={() => removeOrder(order)}
                      >
                        <Trash2 size={15} className="text-red-700" />
                      </Button>
                    </div>
                  </Cell>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <Empty>Nenhuma ordem encontrada. Abra uma OS a partir de um veículo ou use o botão acima.</Empty>
        )}
      </Panel>
      {form && (
        <OrderForm
          onClose={() => {
            setForm(false)
            navigate('/ordens', { replace: true })
          }}
        />
      )}
      {detail && (
        <OrderDetail
          order={detail}
          onClose={() => setDetail(null)}
          onFinalize={() => {
            setFinalizing(detail)
            setDetail(null)
          }}
        />
      )}
      {editingInitial && <InitialOrderEditor order={editingInitial} onClose={() => setEditingInitial(null)} />}
      {finalizing && <MechanicOrderEditor order={finalizing} onClose={() => setFinalizing(null)} />}
      {pendingPart && <PendingPartDialog order={pendingPart} onClose={() => setPendingPart(null)} />}
    </>
  )
}

type OrderFormData = { clientId: string; vehicleId: string; mileage: string; complaint: string }
function OrderForm({ onClose }: { onClose: () => void }) {
  const params = new URLSearchParams(useLocation().search)
  const initialClient = params.get('client') ?? ''
  const initialVehicle = params.get('vehicle') ?? ''
  const cache = useQueryClient()
  const form = useForm<OrderFormData>({
    defaultValues: { clientId: initialClient, vehicleId: initialVehicle, mileage: '', complaint: '' }
  })
  const clientId = form.watch('clientId')
  const [clientSearch, setClientSearch] = useState('')
  const [showClients, setShowClients] = useState(false)
  const { data: clients = [] } = useQuery({
    queryKey: ['order-clients'],
    queryFn: () => query<Client>('SELECT id,name,phone,city,document,notes,nickname FROM clients ORDER BY name')
  })
  const { data: vehicles = [] } = useQuery({
    queryKey: ['order-vehicles', clientId],
    enabled: Boolean(clientId),
    queryFn: () => query<Vehicle>('SELECT * FROM vehicles WHERE client_id=? ORDER BY model', [Number(clientId)])
  })
  useEffect(() => {
    if (initialVehicle) form.setValue('vehicleId', initialVehicle)
  }, [initialVehicle, form])
  useEffect(() => {
    const selected = clients.find(client => String(client.id) === clientId)
    if (selected && !clientSearch) setClientSearch(selected.name)
  }, [clients, clientId, clientSearch])
  const matchingClients = clients
    .filter(
      client =>
        client.name.toLocaleLowerCase().includes(clientSearch.toLocaleLowerCase()) ||
        client.nickname?.toLocaleLowerCase().includes(clientSearch.toLocaleLowerCase())
    )
    .slice(0, 12)
  const saveOrder = useMutation({
    mutationFn: (value: OrderFormData) =>
      execute(
        `INSERT INTO service_orders (number,client_id,vehicle_id,mileage,complaint,status) VALUES (?,?,?,?,?,?)`,
        [nextOrderNumber(), Number(value.clientId), Number(value.vehicleId), Number(value.mileage) || 0, value.complaint, 'Aberta']
      ),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['orders'] })
      cache.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
    }
  })
  return (
    <Modal title="Nova ordem de serviço" onClose={onClose}>
      <form onSubmit={form.handleSubmit(value => saveOrder.mutate(value))} className="space-y-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-zinc-700">Cliente *</label>
            <Search className="absolute left-3 top-9 text-zinc-400" size={18} />
            <input
              required
              value={clientSearch}
              onFocus={() => setShowClients(true)}
              onKeyDown={event => {
                if (event.key === 'Enter' && matchingClients[0]) {
                  event.preventDefault()
                  const client = matchingClients[0]
                  form.setValue('clientId', String(client.id))
                  form.setValue('vehicleId', '')
                  setClientSearch(client.name)
                  setShowClients(false)
                  window.setTimeout(() => document.getElementById('order-vehicle')?.focus(), 0)
                }
              }}
              onChange={event => {
                setClientSearch(event.target.value)
                setShowClients(true)
                form.setValue('clientId', '')
                form.setValue('vehicleId', '')
              }}
              placeholder="Digite o nome ou apelido..."
              className="w-full rounded-lg border border-zinc-300 py-2.5 pl-10 pr-3 outline-none focus:border-red-600"
            />
            {showClients && (
              <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
                {matchingClients.length ? (
                  matchingClients.map(client => (
                    <button
                      type="button"
                      key={client.id}
                      onMouseDown={() => {
                        form.setValue('clientId', String(client.id))
                        form.setValue('vehicleId', '')
                        setClientSearch(client.nickname ? `${client.nickname} (${client.name})` : client.name)
                        setShowClients(false)
                      }}
                      className="block w-full border-b border-zinc-100 px-3 py-2 text-left text-sm hover:bg-red-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {client.nickname ? (
                            <span className="rounded bg-amber-500 text-white font-black px-1.5 py-0.5 text-[11px] uppercase shadow-2xs">
                              {client.nickname}
                            </span>
                          ) : null}
                          <strong className="text-zinc-900">{client.name}</strong>
                        </div>
                        <span className="text-xs text-zinc-500">{client.phone || ''}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="p-3 text-sm text-zinc-500">Nenhum cliente encontrado.</p>
                )}
              </div>
            )}
          </div>
          <Select id="order-vehicle" required label="Veículo *" disabled={!clientId} {...form.register('vehicleId')}>
            <option value="">Selecione...</option>
            {vehicles.map(vehicle => (
              <option key={vehicle.id} value={vehicle.id}>
                [{vehicle.vehicle_type || 'Moto'}] {vehicle.brand} {vehicle.model} · {vehicle.plate}
              </option>
            ))}
          </Select>
          <Input label="Quilometragem (km)" type="number" {...form.register('mileage')} />
        </div>
        <Textarea label="Defeito informado pelo cliente" rows={4} {...form.register('complaint')} />
        <p className="rounded-lg bg-zinc-100 p-3 text-sm text-zinc-600">
          Diagnóstico, serviços executados, peças e mão de obra serão preenchidos posteriormente pelo mecânico ao finalizar a OS.
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={saveOrder.isPending} type="submit">
            {saveOrder.isPending ? 'Salvando...' : 'Abrir OS'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function InitialOrderEditor({ order, onClose }: { order: Order; onClose: () => void }) {
  const cache = useQueryClient()
  const form = useForm({ defaultValues: { mileage: String(order.mileage), complaint: order.complaint } })
  const save = useMutation({
    mutationFn: (value: { mileage: string; complaint: string }) =>
      execute('UPDATE service_orders SET mileage=?, complaint=? WHERE id=?', [
        Number(value.mileage) || 0,
        value.complaint,
        order.id
      ]),
    onSuccess: () => {
      for (const key of ['orders', 'dashboard', 'order-parts', 'vehicle-history']) cache.invalidateQueries({ queryKey: [key] })
      onClose()
    }
  })
  return (
    <Modal title={`Editar abertura da OS ${order.number}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={form.handleSubmit(value => save.mutate(value))}>
        <p className="rounded-lg bg-zinc-100 p-3 text-sm text-zinc-600">
          Aqui você altera apenas o que foi informado na abertura da OS.
        </p>
        <Input label="Quilometragem" type="number" min="0" {...form.register('mileage')} />
        <Textarea label="Defeito informado pelo cliente" rows={5} {...form.register('complaint')} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={save.isPending} type="submit">
            {save.isPending ? 'Salvando...' : 'Salvar alteração'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function OrderDetail({ order, onClose, onFinalize }: { order: Order; onClose: () => void; onFinalize: () => void }) {
  const { data: branding } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await query<Settings>('SELECT * FROM settings WHERE id=1'))[0]
  })
  const { data: parts = [] } = useQuery({
    queryKey: ['order-parts', order.id],
    queryFn: () =>
      query<{ name: string; brand: string; quantity: number; unit_price: number }>(
        `SELECT COALESCE(NULLIF(sop.item_name,''),p.name) name, COALESCE(NULLIF(sop.item_brand,''),p.brand) brand, sop.quantity, sop.unit_price FROM service_order_parts sop LEFT JOIN parts p ON p.id=sop.part_id WHERE sop.service_order_id=?`,
        [order.id]
      )
  })

  const { data: clientData } = useQuery({
    queryKey: ['client-info', order.client_id],
    queryFn: async () => (await query<Client>('SELECT * FROM clients WHERE id=?', [order.client_id]))[0]
  })

  function avisoWhatsApp() {
    if (!clientData?.phone) {
      window.alert('Telefone do cliente não cadastrado.')
      return
    }
    const oficina = branding?.workshop_name || 'Oficina Mecânica'
    const pix = branding?.pix_key ? `\nChave Pix: ${branding.pix_key}` : ''
    const msg = `Olá ${order.client_name}! Tudo bem?\nAqui é da *${oficina}*.\n\nSeu veículo *${order.vehicle}* (${order.plate}) referente à *OS ${order.number}* está pronto!\n\nValor total: *${money(order.total)}*${pix}\n\nQualquer dúvida estamos à disposição!`
    openWhatsApp(clientData.phone, msg)
  }

  return (
    <Modal title={`Ordem de Serviço ${order.number}`} onClose={onClose} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Cliente</p>
          <p className="mt-1 font-bold text-zinc-950">{order.client_name}</p>
          <p className="text-sm text-zinc-600">
            {order.vehicle} · {order.plate}
          </p>
          {clientData?.phone && <p className="text-xs text-zinc-500">Tel: {clientData.phone}</p>}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Status</p>
          <div className="mt-1">
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            Entrada: {dateTime(order.entered_at)} · {order.mileage} km
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Defeito informado</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{order.complaint || 'Não informado'}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Diagnóstico</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{order.diagnosis || 'Não informado'}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Serviço executado</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{order.service_done || 'Não informado'}</p>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-zinc-200">
        <div className="border-b border-zinc-200 px-4 py-3 font-bold">Peças utilizadas</div>
        {parts.length ? (
          <TableShell>
            <thead>
              <tr>
                <Head>Peça</Head>
                <Head>Qtd.</Head>
                <Head>Unitário</Head>
                <Head>Subtotal</Head>
              </tr>
            </thead>
            <tbody>
              {parts.map((part, index) => (
                <tr key={index}>
                  <Cell>
                    {part.name} <span className="text-zinc-500">{part.brand}</span>
                  </Cell>
                  <Cell>{part.quantity}</Cell>
                  <Cell>{money(part.unit_price)}</Cell>
                  <Cell>{money(part.quantity * part.unit_price)}</Cell>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <div className="p-4 text-sm text-zinc-500">Sem peças nesta ordem.</div>
        )}
      </div>
      <div className="mt-4 ml-auto max-w-sm space-y-1 text-sm">
        <p className="flex justify-between">
          <span>Mão de obra</span>
          <span>{money(order.labor_value)}</span>
        </p>
        <p className="flex justify-between">
          <span>Peças</span>
          <span>{money(order.parts_value)}</span>
        </p>
        <p className="flex justify-between border-t border-zinc-200 pt-2 text-lg font-bold">
          <span>Total</span>
          <span className="text-emerald-700">{money(order.total)}</span>
        </p>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2 sm:gap-3">
        {clientData?.phone && (
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={avisoWhatsApp}
          >
            <MessageCircle size={17} /> Avisar no WhatsApp
          </Button>
        )}
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={17} /> Imprimir
        </Button>
        {order.status !== 'Finalizada' && (
          <Button onClick={onFinalize}>
            <CheckCircle2 size={17} /> Finalizar OS
          </Button>
        )}
      </div>
    </Modal>
  )
}

const partSchema = z.object({ code: z.string(), name: z.string().min(2, 'Informe o nome.'), brand: z.string(), quantity: z.coerce.number().min(0), purchase_price: z.coerce.number().min(0), sale_price: z.coerce.number().min(0), minimum_stock: z.coerce.number().min(0) })
type PartFormData = z.infer<typeof partSchema>
function PartForm({ initial, onClose }: { initial?: Part; onClose: () => void }) { const cache = useQueryClient(); const form = useForm<PartFormData>({ resolver: zodResolver(partSchema), defaultValues: initial ?? { code: '', name: '', brand: '', quantity: 0, purchase_price: 0, sale_price: 0, minimum_stock: 0 } }); const savePart = useMutation({ mutationFn: async (value: PartFormData) => { const code = value.code.trim() || internalPartCode(); if (initial) return execute('UPDATE parts SET code=?,name=?,brand=?,quantity=?,purchase_price=?,sale_price=?,minimum_stock=? WHERE id=?', [code, value.name, value.brand, value.quantity, value.purchase_price, value.sale_price, value.minimum_stock, initial.id]); const result = await execute('INSERT INTO parts (code,name,brand,quantity,purchase_price,sale_price,minimum_stock) VALUES (?,?,?,?,?,?,?)', [code,value.name,value.brand,value.quantity,value.purchase_price,value.sale_price,value.minimum_stock]); if (Number(value.quantity) > 0) await execute('INSERT INTO stock_movements (part_id,movement_type,item_name,quantity,unit_cost,unit_price,total_cost,notes) VALUES (?,?,?,?,?,?,?,?)', [Number(result.lastInsertId), 'Entrada', value.name, Number(value.quantity), Number(value.purchase_price), Number(value.sale_price), Number(value.quantity) * Number(value.purchase_price), 'Cadastro inicial de estoque']); return result }, onSuccess: () => { cache.invalidateQueries({ queryKey: ['parts'] }); cache.invalidateQueries({ queryKey: ['dashboard'] }); onClose() } }); return <Modal title={initial ? 'Editar peça' : 'Nova peça'} onClose={onClose}><form className="space-y-4" onSubmit={form.handleSubmit(value => savePart.mutate(value))}><div className="grid grid-cols-2 gap-3"><Input label="Código (opcional)" error={form.formState.errors.code?.message} {...form.register('code')}/><Input label="Nome *" error={form.formState.errors.name?.message} {...form.register('name')}/></div><Input label="Marca" {...form.register('brand')}/><div className="grid grid-cols-2 gap-3"><Input label="Quantidade" type="number" step="0.01" {...form.register('quantity')}/><Input label="Estoque mínimo" type="number" step="0.01" {...form.register('minimum_stock')}/></div><div className="grid grid-cols-2 gap-3"><Input label="Valor de compra" type="number" min="0" step="0.01" {...form.register('purchase_price')}/><Input label="Valor de venda" type="number" min="0" step="0.01" {...form.register('sale_price')}/></div><div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar peça</Button></div></form></Modal> }

function StockPage() { const [search, setSearch] = useState(''); const [form, setForm] = useState<Part | 'new' | null>(null); const [movementHistory, setMovementHistory] = useState(false); const cache = useQueryClient(); const { data: parts = [] } = useQuery({ queryKey: ['parts', search], queryFn: () => query<Part>('SELECT * FROM parts WHERE archived_at IS NULL AND (code LIKE ? OR name LIKE ? OR brand LIKE ?) ORDER BY name', [`%${search}%`,`%${search}%`,`%${search}%`]) }); async function adjust(part: Part, exit: boolean) { const raw = window.prompt(`${exit ? 'Saída' : 'Entrada'} de estoque para ${part.name}:`, '1'); const quantity = Number(raw); if (!Number.isFinite(quantity) || quantity <= 0) return; if (exit && quantity > part.quantity) { window.alert('Quantidade maior que o estoque disponível.'); return } const unitCost = exit ? Number(part.purchase_price) : Number(window.prompt(`Custo unitário desta entrada de ${part.name}:`, String(part.purchase_price))); if (!Number.isFinite(unitCost) || unitCost < 0) return; if (exit) await execute('UPDATE parts SET quantity=quantity-? WHERE id=?', [quantity, part.id]); else await execute('UPDATE parts SET quantity=quantity+?,purchase_price=? WHERE id=?', [quantity, unitCost, part.id]); await execute('INSERT INTO stock_movements (part_id,movement_type,item_name,quantity,unit_cost,unit_price,total_cost,notes) VALUES (?,?,?,?,?,?,?,?)', [part.id, exit ? 'Saída' : 'Entrada', part.name, quantity, unitCost, Number(part.sale_price), quantity * unitCost, exit ? 'Saída manual de estoque' : 'Entrada manual de estoque']); for (const key of ['parts', 'dashboard', 'stock-movements']) cache.invalidateQueries({ queryKey: [key] }) } async function remove(part: Part) { if (await confirmAction(`Excluir a peça ${part.name}? Ela sairá do estoque atual, mas os valores históricos de OS e entradas serão preservados.`, 'Excluir peça')) { await execute('UPDATE parts SET archived_at=CURRENT_TIMESTAMP,quantity=0 WHERE id=?', [part.id]); for (const key of ['parts', 'dashboard', 'order-stock', 'order-parts', 'part-requests', 'vehicle-history', 'stock-movements']) cache.invalidateQueries({ queryKey: [key] }) } } return <><PageHeader title="Estoque" subtitle="Cadastre peças e receba alertas antes que elas acabem." action={<div className="flex gap-2"><Button variant="secondary" onClick={() => setMovementHistory(true)}>Histórico de entradas</Button><Button onClick={() => setForm('new')}><Plus size={18}/>Nova peça</Button></div>}/><Panel><div className="border-b border-zinc-200 p-4"><div className="relative max-w-md"><Search className="absolute left-3 top-3 text-zinc-400" size={18}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por código, peça ou marca..." className="w-full rounded-lg border border-zinc-300 py-2.5 pl-10 pr-3 outline-none focus:border-red-600"/></div></div>{parts.length ? <TableShell><thead><tr><Head>Código</Head><Head>Peça</Head><Head>Quantidade</Head><Head>Compra</Head><Head>Venda</Head><Head>Ações</Head></tr></thead><tbody>{parts.map(part => <tr key={part.id} className={part.quantity <= part.minimum_stock ? 'bg-red-50/40' : ''}><Cell className="font-mono text-xs">{part.code}</Cell><Cell><p className="font-semibold">{part.name}</p><p className="text-xs text-zinc-500">{part.brand || 'Sem marca'} {part.quantity <= part.minimum_stock && <span className="font-bold text-red-700">· Estoque baixo</span>}</p></Cell><Cell className="font-bold">{part.quantity} <span className="text-xs font-normal text-zinc-500">mín. {part.minimum_stock}</span></Cell><Cell>{money(part.purchase_price)}</Cell><Cell className="font-semibold">{money(part.sale_price)}</Cell><Cell><div className="flex gap-1"><Button variant="secondary" className="px-2 py-1.5" title="Entrada de estoque" onClick={() => adjust(part, false)}>+<span className="hidden md:inline">Entrada</span></Button><Button variant="secondary" className="px-2 py-1.5" title="Saída manual" onClick={() => adjust(part, true)}>−<span className="hidden md:inline">Saída</span></Button><Button variant="ghost" className="px-2 py-1.5" onClick={() => setForm(part)}><Pencil size={16}/></Button><Button variant="ghost" className="px-2 py-1.5" onClick={() => remove(part)}><Trash2 size={16} className="text-red-700"/></Button></div></Cell></tr>)}</tbody></TableShell> : <Empty>Nenhuma peça cadastrada. Adicione as peças mais usadas na sua oficina.</Empty>}</Panel>{form && <PartForm initial={form === 'new' ? undefined : form} onClose={() => setForm(null)}/>} {movementHistory && <StockHistoryModal onClose={() => setMovementHistory(false)}/>}</> }

function StockHistoryModal({ onClose }: { onClose: () => void }) {
  const { data: movements = [] } = useQuery({ queryKey: ['stock-movements'], queryFn: () => query<{ id: number; movement_type: string; item_name: string; quantity: number; unit_cost: number; total_cost: number; occurred_at: string; notes: string }>(`SELECT * FROM stock_movements WHERE movement_type='Entrada' ORDER BY occurred_at DESC`) })
  return <Modal title="Histórico de entradas de estoque" onClose={onClose} wide>{movements.length ? <TableShell><thead><tr><Head>Data</Head><Head>Peça</Head><Head>Quantidade</Head><Head>Custo unitário</Head><Head>Total da entrada</Head></tr></thead><tbody>{movements.map(movement => <tr key={movement.id}><Cell>{dateTime(movement.occurred_at)}</Cell><Cell><strong>{movement.item_name}</strong><span className="block text-xs text-zinc-500">{movement.notes}</span></Cell><Cell>{movement.quantity}</Cell><Cell>{money(movement.unit_cost)}</Cell><Cell className="font-semibold">{money(movement.total_cost)}</Cell></tr>)}</tbody></TableShell> : <Empty>Nenhuma entrada de estoque registrada ainda.</Empty>}</Modal>
}

function LegacyFinancePage() { const [type, setType] = useState<'Entrada' | 'Saída' | 'Receber' | 'Pagar'>('Entrada'); const [formOpen, setFormOpen] = useState(false); const cache = useQueryClient(); const { data: entries = [] } = useQuery({ queryKey: ['cash', type], queryFn: () => query<CashEntry>('SELECT * FROM cash_entries WHERE type=? ORDER BY COALESCE(paid_at,due_date,created_at) DESC', [type]) }); const { data: totals = [] } = useQuery({ queryKey: ['cash-total'], queryFn: () => query<{ input: number; output: number; balance: number }>(`SELECT COALESCE(SUM(CASE WHEN type='Entrada' THEN value ELSE 0 END),0) input, COALESCE(SUM(CASE WHEN type='Saída' THEN value ELSE 0 END),0) output, COALESCE(SUM(CASE WHEN type='Entrada' THEN value WHEN type='Saída' THEN -value ELSE 0 END),0) balance FROM cash_entries WHERE date(COALESCE(paid_at,created_at))=date('now','localtime')`) }); const total = totals[0] ?? { input: 0, output: 0, balance: 0 }; return <><PageHeader title="Financeiro" subtitle="Controle um fluxo simples: entradas, saídas e contas." action={<Button onClick={() => setFormOpen(true)}><Plus size={18}/>Novo lançamento</Button>}/><div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3"><Panel className="p-4"><p className="text-xs font-bold uppercase text-zinc-500">Entradas hoje</p><p className="mt-2 text-2xl font-bold text-emerald-700">{money(total.input)}</p></Panel><Panel className="p-4"><p className="text-xs font-bold uppercase text-zinc-500">Saídas hoje</p><p className="mt-2 text-2xl font-bold text-red-700">{money(total.output)}</p></Panel><Panel className="bg-zinc-950 p-4 text-white"><p className="text-xs font-bold uppercase text-zinc-400">Caixa do dia</p><p className="mt-2 text-2xl font-bold">{money(total.balance)}</p></Panel></div><Panel><div className="flex flex-wrap gap-2 border-b border-zinc-200 p-4">{(['Entrada', 'Saída', 'Receber', 'Pagar'] as const).map(item => <Button key={item} variant={type === item ? 'primary' : 'secondary'} onClick={() => setType(item)}>{item === 'Entrada' ? 'Entradas' : item === 'Saída' ? 'Saídas' : `Contas a ${item === 'Receber' ? 'Receber' : 'Pagar'}`}</Button>)}</div>{entries.length ? <TableShell><thead><tr><Head>Descrição</Head><Head>Vencimento / Data</Head><Head>Status</Head><Head>Valor</Head></tr></thead><tbody>{entries.map(entry => <tr key={entry.id}><Cell className="font-semibold">{entry.description}</Cell><Cell>{dateOnly(entry.paid_at || entry.due_date || entry.created_at)}</Cell><Cell>{entry.paid_at ? <span className="text-emerald-700">Baixado</span> : entry.type === 'Entrada' || entry.type === 'Saída' ? 'Efetivado' : <span className="text-amber-700">Pendente</span>}</Cell><Cell className={entry.type === 'Saída' || entry.type === 'Pagar' ? 'font-bold text-red-700' : 'font-bold text-emerald-700'}>{entry.type === 'Saída' || entry.type === 'Pagar' ? '−' : '+'}{money(entry.value)}</Cell></tr>)}</tbody></TableShell> : <Empty>Sem lançamentos nesta categoria.</Empty>}</Panel>{formOpen && <CashForm defaultType={type} onClose={() => setFormOpen(false)}/>}</> }

type CashFormData = { type: CashEntry['type']; description: string; value: string; due_date: string }
function CashForm({ defaultType, onClose }: { defaultType: CashEntry['type']; onClose: () => void }) { const cache = useQueryClient(); const form = useForm<CashFormData>({ defaultValues: { type: defaultType, description: '', value: '', due_date: '' } }); const saveEntry = useMutation({ mutationFn: (value: CashFormData) => execute('INSERT INTO cash_entries (type,description,value,due_date,paid_at) VALUES (?,?,?,?,?)', [value.type, value.description, Number(value.value), value.due_date || null, value.type === 'Entrada' || value.type === 'Saída' ? new Date().toISOString() : null]), onSuccess: () => { cache.invalidateQueries({ queryKey: ['cash'] }); cache.invalidateQueries({ queryKey: ['cash-total'] }); onClose() } }); return <Modal title="Novo lançamento" onClose={onClose}><form className="space-y-4" onSubmit={form.handleSubmit(value => saveEntry.mutate(value))}><Select label="Tipo" {...form.register('type')}><option>Entrada</option><option>Saída</option><option>Receber</option><option>Pagar</option></Select><Input required label="Descrição" placeholder="Ex.: compra de óleo" {...form.register('description')}/><div className="grid grid-cols-2 gap-3"><Input required label="Valor" type="number" min="0.01" step="0.01" {...form.register('value')}/><Input label="Vencimento" type="date" {...form.register('due_date')}/></div><div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar lançamento</Button></div></form></Modal> }

function ReportsPage() { const [report, setReport] = useState<'os' | 'clients' | 'parts' | 'stock' | 'revenue' | 'profit'>('os'); const { data = [], isFetching } = useQuery({ queryKey: ['report', report], queryFn: async () => { const sources: Record<string, string> = { os: `SELECT number AS item, status AS detail, total AS value, entered_at AS date FROM service_orders ORDER BY entered_at DESC`, clients: `SELECT name AS item, city AS detail, 0 AS value, created_at AS date FROM clients ORDER BY name`, parts: `SELECT p.name AS item, CAST(COALESCE(SUM(s.quantity),0) AS TEXT) || ' unidades vendidas' AS detail, COALESCE(SUM(s.quantity*s.unit_price),0) AS value, '' AS date FROM parts p LEFT JOIN service_order_parts s ON s.part_id=p.id GROUP BY p.id ORDER BY value DESC`, stock: `SELECT name AS item, 'Saldo: ' || quantity || ' · mínimo: ' || minimum_stock AS detail, sale_price AS value, '' AS date FROM parts ORDER BY name`, revenue: `SELECT number AS item, client_name AS detail, total AS value, finalized_at AS date FROM (SELECT o.*,c.name client_name FROM service_orders o JOIN clients c ON c.id=o.client_id) WHERE status='Finalizada' ORDER BY finalized_at DESC`, profit: `SELECT number AS item, 'Mão de obra e peças' AS detail, total - parts_value AS value, finalized_at AS date FROM service_orders WHERE status='Finalizada' ORDER BY finalized_at DESC` }; return query<{ item: string; detail: string; value: number; date: string }>(sources[report]) } }); const options: { key: typeof report; label: string }[] = [{ key: 'os', label: 'Ordens de Serviço' }, { key: 'clients', label: 'Clientes' }, { key: 'parts', label: 'Peças vendidas' }, { key: 'stock', label: 'Estoque' }, { key: 'revenue', label: 'Faturamento' }, { key: 'profit', label: 'Lucro' }]; const title = options.find(option => option.key === report)?.label ?? ''; return <><PageHeader title="Relatórios" subtitle="Consulte e imprima as informações importantes da sua oficina." action={<Button variant="secondary" onClick={() => window.print()}><Printer size={18}/>Imprimir relatório</Button>}/><Panel><div className="no-print flex flex-wrap gap-2 border-b border-zinc-200 p-4">{options.map(option => <Button key={option.key} variant={report === option.key ? 'primary' : 'secondary'} onClick={() => setReport(option.key)}>{option.label}</Button>)}</div><div className="p-5"><h2 className="mb-4 text-lg font-bold">Relatório: {title}</h2>{isFetching ? <Empty>Preparando relatório...</Empty> : data.length ? <TableShell><thead><tr><Head>Item</Head><Head>Informação</Head><Head>Data</Head><Head>Valor</Head></tr></thead><tbody>{data.map((row, index) => <tr key={index}><Cell className="font-semibold">{row.item}</Cell><Cell>{row.detail || '—'}</Cell><Cell>{row.date ? dateOnly(row.date) : '—'}</Cell><Cell>{row.value ? money(row.value) : '—'}</Cell></tr>)}</tbody></TableShell> : <Empty>Não há dados para este relatório ainda.</Empty>}</div></Panel></> }



