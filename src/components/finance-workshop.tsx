import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Filter,
  MessageCircle,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  Wallet,
  Check
} from 'lucide-react'
import { execute, money, openWhatsApp, query, dateOnly } from '../lib/db'
import type { Bill, Order, Settings } from '../lib/types'
import { Button, Empty, Input, Modal, Select, Textarea } from './ui'

type Transaction = {
  id: number
  type: 'Recebimento' | 'Saída'
  service_order_id: number | null
  client_id?: number | null
  vehicle_id?: number | null
  description: string
  amount: number
  payment_method: string
  installments: number
  installment_number: number
  due_date: string | null
  paid_at: string | null
  status: 'Pago' | 'Pendente'
  category: string
  order_number?: string
  client_name?: string
  client_phone?: string
  vehicle?: string
  plate?: string
}

function Card({ label, value, tone = 'text-zinc-950', icon: Icon, badge }: { label: string; value: string; tone?: string; icon?: React.ElementType; badge?: string }) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</p>
        {Icon && <span className="rounded-lg bg-zinc-100 p-2 text-zinc-600"><Icon size={18}/></span>}
      </div>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
      {badge && <span className="mt-1 inline-block text-xs font-semibold text-zinc-500">{badge}</span>}
    </section>
  )
}

function refreshFinance(cache: ReturnType<typeof useQueryClient>) {
  for (const key of ['transactions', 'finance-summary', 'report', 'orders', 'dashboard', 'ready-to-contact', 'payment-orders', 'due-account-payments', 'bills', 'open-bills-month']) {
    cache.invalidateQueries({ queryKey: [key] })
  }
}

function paymentOptions() {
  return (
    <>
      <option value="Dinheiro">Dinheiro</option>
      <option value="Pix">Pix</option>
      <option value="Cartão de débito">Cartão de débito</option>
      <option value="Cartão de crédito">Cartão de crédito</option>
      <option value="Anotado na conta">Anotado na conta (Fiado)</option>
      <option value="Boleto">Boleto bancário</option>
    </>
  )
}

// -------------------------------------------------------------
// PÁGINA DE FINANCEIRO & CAIXA & FIADOS
// -------------------------------------------------------------
export function FinancePage() {
  const cache = useQueryClient()
  const [filter, setFilter] = useState<'Todos' | 'Recebimentos' | 'Anotado na conta' | 'Saídas'>('Todos')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [receiving, setReceiving] = useState<Transaction | null>(null)

  const { data: branding } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await query<Settings>('SELECT * FROM settings WHERE id=1'))[0]
  })

  const { data: rows = [] } = useQuery({
    queryKey: ['transactions', filter],
    queryFn: () =>
      query<Transaction>(
        `SELECT t.*, o.number order_number, c.name client_name, c.phone client_phone, trim(v.brand || ' ' || v.model) vehicle, v.plate
         FROM financial_transactions t
         LEFT JOIN service_orders o ON o.id=t.service_order_id
         LEFT JOIN clients c ON c.id=t.client_id
         LEFT JOIN vehicles v ON v.id=t.vehicle_id
         WHERE (?='Todos'
            OR (?='Recebimentos' AND t.type='Recebimento' AND t.status='Pago')
            OR (?='Anotado na conta' AND t.type='Recebimento' AND t.payment_method='Anotado na conta')
            OR (?='Saídas' AND t.type='Saída'))
         ORDER BY CASE WHEN t.status='Pendente' THEN 0 ELSE 1 END,
                  COALESCE(t.due_date, t.paid_at, t.created_at) DESC`,
        [filter, filter, filter, filter]
      )
  })

  const { data: summaryRows = [] } = useQuery({
    queryKey: ['finance-summary'],
    queryFn: () =>
      query<{ received: number; outgoing: number; receivable: number; bills: number }>(
        `SELECT
          COALESCE(SUM(CASE WHEN type='Recebimento' AND status='Pago' THEN amount ELSE 0 END), 0) received,
          COALESCE(SUM(CASE WHEN type='Saída' AND status='Pago' THEN amount ELSE 0 END), 0) outgoing,
          COALESCE(SUM(CASE WHEN type='Recebimento' AND status='Pendente' THEN amount ELSE 0 END), 0) receivable,
          (SELECT COALESCE(SUM(amount), 0) FROM bills WHERE status='Pendente') bills
         FROM financial_transactions`
      )
  })

  const total = summaryRows[0] ?? { received: 0, outgoing: 0, receivable: 0, bills: 0 }
  const saldoCaixa = total.received - total.outgoing

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const term = search.toLowerCase()
    return rows.filter(
      r =>
        r.description?.toLowerCase().includes(term) ||
        r.client_name?.toLowerCase().includes(term) ||
        r.order_number?.toLowerCase().includes(term) ||
        r.plate?.toLowerCase().includes(term)
    )
  }, [rows, search])

  async function removeTransaction(transaction: Transaction) {
    if (!window.confirm(`Excluir este lançamento de ${transaction.type.toLowerCase()}?`)) return
    await execute('DELETE FROM financial_transactions WHERE id=?', [transaction.id])
    refreshFinance(cache)
  }

  function cobrancaWhatsApp(row: Transaction) {
    if (!row.client_phone) {
      window.alert('Este cliente não possui telefone cadastrado.')
      return
    }
    const oficina = branding?.workshop_name || 'Oficina Mecânica'
    const pix = branding?.pix_key ? `\nChave Pix: ${branding.pix_key}` : ''
    const venc = row.due_date ? ` com vencimento em ${dateOnly(row.due_date)}` : ''
    const msg = `Olá ${row.client_name || 'amigo(a)'}! Tudo bem?\nAqui é da *${oficina}*.\n\nPassando para lembrar que consta em aberto o valor de *${money(row.amount)}* referente ao serviço na *${row.vehicle || 'seu veículo'}* (OS ${row.order_number || ''})${venc}.${pix}\n\nQualquer dúvida estamos à disposição!`
    openWhatsApp(row.client_phone, msg)
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Financeiro & Caixa</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Controle de entradas, saídas, boletos e caderneta (fiado) de clientes.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={18} /> Novo lançamento
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card
          label="Saldo em Caixa"
          value={money(saldoCaixa)}
          tone={saldoCaixa >= 0 ? 'text-emerald-700' : 'text-red-700'}
          icon={Wallet}
          badge="Entradas - Saídas pagas"
        />
        <Card
          label="Recebido (Entradas)"
          value={money(total.received)}
          tone="text-emerald-700"
          badge="Dinheiro e Pix recebidos"
        />
        <Card
          label="Saídas Pagas"
          value={money(total.outgoing)}
          tone="text-red-700"
          badge="Despesas e compras pagas"
        />
        <Card
          label="Fiado / A Receber"
          value={money(total.receivable)}
          tone="text-amber-700"
          badge="Pendentes na caderneta"
        />
        <Card
          label="Boletos a Pagar"
          value={money(total.bills)}
          tone="text-orange-700"
          badge="Contas e fornecedores pendentes"
        />
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(['Todos', 'Recebimentos', 'Anotado na conta', 'Saídas'] as const).map(item => (
              <Button
                key={item}
                variant={filter === item ? 'primary' : 'secondary'}
                onClick={() => setFilter(item)}
              >
                {item === 'Anotado na conta' ? 'Caderneta (Fiados)' : item}
              </Button>
            ))}
          </div>

          <div className="relative w-full max-w-xs">
            <Search size={17} className="absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar lançamento, cliente ou OS..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-red-600"
            />
          </div>
        </div>

        {filteredRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-bold uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3">Descrição / Cliente</th>
                  <th className="px-4 py-3">Forma de Pagamento</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => (
                  <tr className="border-b border-zinc-100 transition hover:bg-zinc-50/50" key={row.id}>
                    <td className="px-4 py-3">
                      <strong className="text-zinc-900">{row.description}</strong>
                      <span className="block text-xs text-zinc-500">
                        {row.order_number ? (
                          <>
                            OS {row.order_number} · {row.client_name} {row.vehicle ? `· ${row.vehicle}` : ''}
                          </>
                        ) : (
                          row.category
                        )}
                        {row.installments > 1 ? ` · parcela ${row.installment_number}/${row.installments}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-800">
                        {row.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {row.due_date ? dateOnly(row.due_date) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          row.status === 'Pago'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 font-bold ${
                        row.type === 'Saída' ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {row.type === 'Saída' ? '− ' : '+ '}
                      {money(row.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {row.status === 'Pendente' && (
                          <Button
                            className="px-2.5 py-1 text-xs"
                            variant="secondary"
                            onClick={() => setReceiving(row)}
                            title="Confirmar pagamento recebido"
                          >
                            <CheckCircle2 size={15} />
                            {row.type === 'Saída' ? 'Pagar' : 'Dar Baixa'}
                          </Button>
                        )}
                        {row.payment_method === 'Anotado na conta' && row.status === 'Pendente' && row.client_phone && (
                          <Button
                            className="bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
                            onClick={() => cobrancaWhatsApp(row)}
                            title="Cobrar pelo WhatsApp"
                          >
                            <MessageCircle size={15} />
                          </Button>
                        )}
                        <Button
                          className="p-1.5"
                          variant="ghost"
                          title="Editar lançamento"
                          onClick={() => setEditing(row)}
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          className="p-1.5"
                          variant="ghost"
                          title="Excluir lançamento"
                          onClick={() => removeTransaction(row)}
                        >
                          <Trash2 size={15} className="text-red-700" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Nenhum lançamento financeiro encontrado.</Empty>
        )}
      </section>

      {open && <TransactionDialog onClose={() => setOpen(false)} />}
      {editing && <TransactionEditDialog transaction={editing} onClose={() => setEditing(null)} />}
      {receiving && <ReceiveDialog transaction={receiving} onClose={() => setReceiving(null)} />}
    </>
  )
}

function TransactionDialog({ onClose }: { onClose: () => void }) {
  const cache = useQueryClient()
  const [kind, setKind] = useState<'Recebimento' | 'Saída'>('Recebimento')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Order | null>(null)

  const form = useForm({
    defaultValues: {
      amount: '',
      payment_method: 'Dinheiro',
      installments: '1',
      due_date: new Date().toISOString().slice(0, 10),
      description: '',
      category: 'Serviço'
    }
  })

  const { data: orders = [] } = useQuery({
    queryKey: ['payment-orders', search],
    enabled: kind === 'Recebimento',
    queryFn: () =>
      query<Order>(
        `SELECT o.*, c.name client_name, v.plate, trim(v.brand || ' ' || v.model) vehicle
         FROM service_orders o
         JOIN clients c ON c.id=o.client_id
         JOIN vehicles v ON v.id=o.vehicle_id
         WHERE o.status='Finalizada'
           AND NOT EXISTS (SELECT 1 FROM financial_transactions t WHERE t.service_order_id=o.id)
           AND (o.number LIKE ? OR c.name LIKE ? OR v.plate LIKE ?)
         ORDER BY o.finalized_at DESC LIMIT 20`,
        [`%${search}%`, `%${search}%`, `%${search}%`]
      )
  })

  const method = form.watch('payment_method')
  const installments = Math.max(1, Number(form.watch('installments')) || 1)

  const save = useMutation({
    mutationFn: async (value: {
      amount: string
      payment_method: string
      installments: string
      due_date: string
      description: string
      category: string
    }) => {
      const amount = Number(value.amount)
      const count = value.payment_method === 'Cartão de crédito' ? Math.max(1, Number(value.installments) || 1) : 1
      const firstDue = value.due_date ? new Date(`${value.due_date}T12:00:00`) : new Date()
      const pending = value.payment_method === 'Cartão de crédito' || value.payment_method === 'Anotado na conta'

      for (let index = 0; index < count; index++) {
        const due = new Date(firstDue)
        due.setMonth(due.getMonth() + index)
        await execute(
          `INSERT INTO financial_transactions
            (type, service_order_id, client_id, vehicle_id, description, amount, payment_method, installments, installment_number, due_date, paid_at, status, category)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            kind,
            selected?.id ?? null,
            selected?.client_id ?? null,
            selected?.vehicle_id ?? null,
            kind === 'Recebimento' ? `OS ${selected?.number ?? ''} — ${selected?.client_name ?? ''}` : value.description,
            amount / count,
            value.payment_method,
            count,
            index + 1,
            due.toISOString().slice(0, 10),
            pending ? null : new Date().toISOString(),
            pending ? 'Pendente' : 'Pago',
            value.category
          ]
        )
      }
    },
    onSuccess: () => {
      refreshFinance(cache)
      onClose()
    }
  })

  return (
    <Modal title={kind === 'Recebimento' ? 'Receber pagamento de OS' : 'Registrar saída de caixa'} onClose={onClose} wide>
      <div className="mb-4 flex gap-2">
        <Button type="button" variant={kind === 'Recebimento' ? 'primary' : 'secondary'} onClick={() => setKind('Recebimento')}>
          Recebimento de OS
        </Button>
        <Button
          type="button"
          variant={kind === 'Saída' ? 'primary' : 'secondary'}
          onClick={() => {
            setKind('Saída')
            setSelected(null)
          }}
        >
          Saída / Despesa
        </Button>
      </div>

      <form className="space-y-4" onSubmit={form.handleSubmit(val => save.mutate(val))}>
        {kind === 'Recebimento' ? (
          <>
            <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
              Selecione a Ordem de Serviço finalizada para lançar o recebimento no caixa ou marcar na caderneta.
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-9 text-zinc-400" size={18} />
              <Input
                label="Localizar OS, cliente ou placa"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Ex.: João, Titan, PI-0001"
                className="pl-10"
              />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200">
              {orders.length ? (
                orders.map(order => (
                  <button
                    type="button"
                    key={order.id}
                    onClick={() => {
                      setSelected(order)
                      form.setValue('amount', String(order.total))
                    }}
                    className={`block w-full border-b border-zinc-100 px-4 py-3 text-left transition hover:bg-zinc-50 ${
                      selected?.id === order.id ? 'bg-red-50 font-bold ring-1 ring-inset ring-red-600' : ''
                    }`}
                  >
                    <strong>{order.number} · {order.client_name}</strong>
                    <span className="block text-sm text-zinc-500">
                      {order.vehicle} · {order.plate} · {money(order.total)}
                    </span>
                  </button>
                ))
              ) : (
                <p className="p-4 text-sm text-zinc-500">Nenhuma OS finalizada aguardando pagamento.</p>
              )}
            </div>
          </>
        ) : (
          <>
            <Input required label="Descrição da saída / despesa" placeholder="Ex.: Compra de estopa, lanche, ferramenta" {...form.register('description')} />
            <Input label="Categoria" placeholder="Ex.: Despesa operacional, Peças, Aluguel" {...form.register('category')} />
          </>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input required label="Valor (R$)" type="number" min="0.01" step="0.01" {...form.register('amount')} />
          <Select label="Forma de pagamento" {...form.register('payment_method')}>
            {paymentOptions()}
          </Select>
        </div>

        {method === 'Cartão de crédito' && (
          <Input label="Quantidade de parcelas" type="number" min="1" max="24" {...form.register('installments')} />
        )}

        <Input
          label={
            method === 'Anotado na conta' || method === 'Cartão de crédito' || method === 'Boleto'
              ? 'Data do vencimento / combinação'
              : 'Data do pagamento'
          }
          type="date"
          {...form.register('due_date')}
        />

        {method === 'Cartão de crédito' && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Serão criadas {installments} parcelas de {money((Number(form.watch('amount')) || 0) / installments)}.
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={save.isPending || (kind === 'Recebimento' && !selected)} type="submit">
            {save.isPending ? 'Salvando...' : 'Confirmar lançamento'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ReceiveDialog({ transaction, onClose }: { transaction: Transaction; onClose: () => void }) {
  const cache = useQueryClient()
  const form = useForm({
    defaultValues: {
      payment_method: transaction.payment_method === 'Anotado na conta' ? 'Dinheiro' : transaction.payment_method
    }
  })

  const save = useMutation({
    mutationFn: (value: { payment_method: string }) =>
      execute(
        "UPDATE financial_transactions SET status='Pago', paid_at=CURRENT_TIMESTAMP, payment_method=? WHERE id=?",
        [value.payment_method, transaction.id]
      ),
    onSuccess: () => {
      refreshFinance(cache)
      onClose()
    }
  })

  return (
    <Modal
      title={transaction.type === 'Saída' ? 'Confirmar pagamento de despesa' : 'Confirmar recebimento de valor'}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(val => save.mutate(val))}>
        <div className="rounded-lg bg-zinc-100 p-3.5 text-sm text-zinc-800">
          <p className="font-semibold text-zinc-900">{transaction.description}</p>
          <p className="mt-1 text-xl font-bold text-emerald-700">{money(transaction.amount)}</p>
          {transaction.due_date && <p className="mt-1 text-xs text-zinc-500">Vencimento combinado: {dateOnly(transaction.due_date)}</p>}
        </div>

        <Select label="Como foi pago hoje?" {...form.register('payment_method')}>
          {paymentOptions()}
        </Select>

        <p className="text-xs text-zinc-500">A data de baixa será registrada automaticamente com o momento atual.</p>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={save.isPending} type="submit">
            {save.isPending ? 'Confirmando...' : 'Confirmar baixa agora'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function TransactionEditDialog({ transaction, onClose }: { transaction: Transaction; onClose: () => void }) {
  const cache = useQueryClient()
  const form = useForm({
    defaultValues: {
      description: transaction.description,
      amount: String(transaction.amount),
      payment_method: transaction.payment_method,
      due_date: transaction.due_date ?? '',
      status: transaction.status,
      category: transaction.category
    }
  })

  const save = useMutation({
    mutationFn: (value: {
      description: string
      amount: string
      payment_method: string
      due_date: string
      status: 'Pago' | 'Pendente'
      category: string
    }) =>
      execute(
        'UPDATE financial_transactions SET description=?, amount=?, payment_method=?, due_date=?, status=?, paid_at=?, category=? WHERE id=?',
        [
          value.description,
          Number(value.amount),
          value.payment_method,
          value.due_date || null,
          value.status,
          value.status === 'Pago' ? transaction.paid_at || new Date().toISOString() : null,
          value.category,
          transaction.id
        ]
      ),
    onSuccess: () => {
      refreshFinance(cache)
      onClose()
    }
  })

  return (
    <Modal title="Editar lançamento financeiro" onClose={onClose}>
      <form className="space-y-4" onSubmit={form.handleSubmit(val => save.mutate(val))}>
        <Input required label="Descrição" {...form.register('description')} />
        <div className="grid grid-cols-2 gap-3">
          <Input required label="Valor (R$)" type="number" min="0.01" step="0.01" {...form.register('amount')} />
          <Select label="Forma de pagamento" {...form.register('payment_method')}>
            {paymentOptions()}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Vencimento" type="date" {...form.register('due_date')} />
          <Select label="Status" {...form.register('status')}>
            <option value="Pago">Pago</option>
            <option value="Pendente">Pendente</option>
          </Select>
        </div>
        <Input label="Categoria" {...form.register('category')} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={save.isPending} type="submit">
            Salvar alterações
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// -------------------------------------------------------------
// PÁGINA REFORMULADA DE BOLETOS & CONTAS A PAGAR
// -------------------------------------------------------------
export function BillsPage() {
  const cache = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [filterStatus, setFilterStatus] = useState<'Todos' | 'Pendentes' | 'Vencidos' | 'Vence Hoje' | 'Próximos 7 dias' | 'Pagos'>('Pendentes')
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const { data: bills = [] } = useQuery({
    queryKey: ['bills'],
    queryFn: () =>
      query<Bill>(
        "SELECT * FROM bills ORDER BY CASE WHEN status='Pendente' THEN 0 ELSE 1 END, due_date ASC"
      )
  })

  const todayStr = new Date().toISOString().slice(0, 10)
  const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Métricas
  const stats = useMemo(() => {
    let overdueCount = 0
    let overdueTotal = 0
    let todayCount = 0
    let todayTotal = 0
    let next7Count = 0
    let next7Total = 0
    let pendingMonthTotal = 0
    let paidMonthTotal = 0

    const currentYearMonth = todayStr.slice(0, 7)

    bills.forEach(bill => {
      const isPending = bill.status === 'Pendente'
      const amount = Number(bill.amount) || 0

      if (isPending) {
        if (bill.due_date < todayStr) {
          overdueCount++
          overdueTotal += amount
        } else if (bill.due_date === todayStr) {
          todayCount++
          todayTotal += amount
        } else if (bill.due_date <= next7Days) {
          next7Count++
          next7Total += amount
        }

        if (bill.due_date.slice(0, 7) === currentYearMonth) {
          pendingMonthTotal += amount
        }
      } else {
        if (bill.due_date.slice(0, 7) === currentYearMonth || bill.paid_at?.slice(0, 7) === currentYearMonth) {
          paidMonthTotal += amount
        }
      }
    })

    return {
      overdueCount,
      overdueTotal,
      todayCount,
      todayTotal,
      next7Count,
      next7Total,
      pendingMonthTotal,
      paidMonthTotal
    }
  }, [bills, todayStr, next7Days])

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      // Filtro de status
      if (filterStatus === 'Pendentes' && bill.status !== 'Pendente') return false
      if (filterStatus === 'Pagos' && bill.status !== 'Pago') return false
      if (filterStatus === 'Vencidos') {
        if (bill.status !== 'Pendente' || bill.due_date >= todayStr) return false
      }
      if (filterStatus === 'Vence Hoje') {
        if (bill.status !== 'Pendente' || bill.due_date !== todayStr) return false
      }
      if (filterStatus === 'Próximos 7 dias') {
        if (bill.status !== 'Pendente' || bill.due_date < todayStr || bill.due_date > next7Days) return false
      }

      // Filtro de busca
      if (search.trim()) {
        const term = search.toLowerCase()
        const match =
          bill.description?.toLowerCase().includes(term) ||
          bill.supplier?.toLowerCase().includes(term) ||
          bill.category?.toLowerCase().includes(term) ||
          bill.barcode?.includes(term)
        if (!match) return false
      }

      return true
    })
  }, [bills, filterStatus, search, todayStr, next7Days])

  const pay = useMutation({
    mutationFn: async (bill: Bill) => {
      if (!window.confirm(`Confirmar o pagamento do boleto "${bill.description}" no valor de ${money(bill.amount)}? O valor será lançado como saída no caixa.`)) {
        return
      }
      await execute("UPDATE bills SET status='Pago', paid_at=CURRENT_TIMESTAMP WHERE id=?", [bill.id])
      await execute(
        "INSERT INTO financial_transactions (type, description, amount, payment_method, due_date, paid_at, status, category) VALUES ('Saída', ?, ?, ?, ?, ?, 'Pago', ?)",
        [
          `Boleto: ${bill.description} (${bill.supplier || 'Fornecedor'})`,
          bill.amount,
          'Boleto bancário',
          bill.due_date,
          new Date().toISOString(),
          bill.category || 'Despesa fixa'
        ]
      )
    },
    onSuccess: () => {
      refreshFinance(cache)
    }
  })

  const removeBill = useMutation({
    mutationFn: async (bill: Bill) => {
      if (!window.confirm(`Deseja excluir o boleto "${bill.description}"?`)) return
      await execute('DELETE FROM bills WHERE id=?', [bill.id])
    },
    onSuccess: () => {
      refreshFinance(cache)
    }
  })

  function copyCode(code: string, id: number) {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  return (
    <>
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950">Boletos & Contas a Pagar</h1>
            {stats.overdueCount > 0 && (
              <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">
                <AlertTriangle size={13} /> {stats.overdueCount} vencido(s)
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs sm:text-sm text-zinc-500">
            Acompanhe prazos com distribuidoras de autopeças e dê baixa instantânea com saída no caixa.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="self-start sm:self-auto">
          <Plus size={18} /> Cadastrar boleto
        </Button>
      </div>

      {/* Cards de Métricas */}
      <div className="mb-4 sm:mb-6 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <section className={`rounded-xl border p-3 sm:p-4 shadow-xs ${stats.overdueCount > 0 ? 'border-red-300 bg-red-50/50' : 'border-zinc-200 bg-white'}`}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-red-700 truncate">Vencidos</p>
            <span className="rounded-lg bg-red-100 p-1.5 sm:p-2 text-red-700"><AlertCircle size={16} /></span>
          </div>
          <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-red-700">{money(stats.overdueTotal)}</p>
          <p className="mt-0.5 text-[11px] sm:text-xs text-red-600 font-medium truncate">{stats.overdueCount} conta(s) em atraso</p>
        </section>

        <section className={`rounded-xl border p-3 sm:p-4 shadow-xs ${stats.todayCount > 0 ? 'border-amber-300 bg-amber-50/50' : 'border-zinc-200 bg-white'}`}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-amber-700 truncate">Vence Hoje</p>
            <span className="rounded-lg bg-amber-100 p-1.5 sm:p-2 text-amber-700"><Clock size={16} /></span>
          </div>
          <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-amber-800">{money(stats.todayTotal)}</p>
          <p className="mt-0.5 text-[11px] sm:text-xs text-amber-700 truncate">{stats.todayCount} boleto(s) hoje</p>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-blue-700 truncate">Próximos 7 Dias</p>
            <span className="rounded-lg bg-blue-50 p-1.5 sm:p-2 text-blue-700"><Calendar size={16} /></span>
          </div>
          <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-blue-800">{money(stats.next7Total)}</p>
          <p className="mt-0.5 text-[11px] sm:text-xs text-blue-600 font-medium truncate">{stats.next7Count} a vencer na semana</p>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-zinc-600 truncate">No Mês</p>
            <span className="rounded-lg bg-zinc-100 p-1.5 sm:p-2 text-zinc-600"><ReceiptText size={16} /></span>
          </div>
          <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-zinc-900">{money(stats.pendingMonthTotal)}</p>
          <p className="mt-0.5 text-[11px] sm:text-xs text-emerald-700 font-medium truncate">Pago: {money(stats.paidMonthTotal)}</p>
        </section>
      </div>

      {/* Tabela e Filtros */}
      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(['Pendentes', 'Vencidos', 'Vence Hoje', 'Próximos 7 dias', 'Pagos', 'Todos'] as const).map(item => (
              <Button
                key={item}
                variant={filterStatus === item ? 'primary' : 'secondary'}
                className="px-3 py-1.5 text-xs"
                onClick={() => setFilterStatus(item)}
              >
                {item}
                {item === 'Vencidos' && stats.overdueCount > 0 && ` (${stats.overdueCount})`}
                {item === 'Vence Hoje' && stats.todayCount > 0 && ` (${stats.todayCount})`}
              </Button>
            ))}
          </div>

          <div className="relative w-full lg:max-w-xs">
            <Search size={16} className="absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar boleto, autopeça ou código..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-red-600"
            />
          </div>
        </div>

        {filteredBills.length ? (
          <>
            {/* Visão Tabela para Desktop e Tablet */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-bold uppercase tracking-wide text-zinc-500">
                    <th className="px-4 py-3">Boleto / Fornecedor</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Vencimento</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.map(bill => {
                    const isPending = bill.status === 'Pendente'
                    const isOverdue = isPending && bill.due_date < todayStr
                    const isToday = isPending && bill.due_date === todayStr

                    return (
                      <tr
                        key={bill.id}
                        className={`border-b border-zinc-100 transition hover:bg-zinc-50/60 ${
                          isOverdue ? 'bg-red-50/30' : isToday ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <strong className="block text-zinc-950">{bill.description}</strong>
                          <span className="text-xs text-zinc-500">
                            {bill.supplier || 'Fornecedor não informado'}
                          </span>
                          {bill.barcode && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="font-mono text-[11px] text-zinc-600 truncate max-w-[220px]">
                                {bill.barcode}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyCode(bill.barcode || '', bill.id)}
                                className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-200"
                                title="Copiar código de barras"
                              >
                                {copiedId === bill.id ? (
                                  <>
                                    <Check size={11} className="text-emerald-600" /> Copiado!
                                  </>
                                ) : (
                                  <>
                                    <Copy size={11} /> Copiar
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                            {bill.category}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <p className="font-medium text-zinc-800">{dateOnly(bill.due_date)}</p>
                          {isOverdue && (
                            <span className="text-[11px] font-bold text-red-600">Atrasado</span>
                          )}
                          {isToday && (
                            <span className="text-[11px] font-bold text-amber-600">Vence hoje!</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 font-bold text-red-700 text-base">
                          {money(bill.amount)}
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              bill.status === 'Pago'
                                ? 'bg-emerald-100 text-emerald-800'
                                : isOverdue
                                ? 'bg-red-100 text-red-800'
                                : isToday
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-zinc-100 text-zinc-700'
                            }`}
                          >
                            {bill.status === 'Pago'
                              ? 'Pago'
                              : isOverdue
                              ? 'Atrasado'
                              : isToday
                              ? 'Vence Hoje'
                              : 'A Vencer'}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {bill.status === 'Pendente' && (
                              <Button
                                className="px-2.5 py-1.5 text-xs"
                                variant="primary"
                                onClick={() => pay.mutate(bill)}
                                disabled={pay.isPending}
                                title="Pagar boleto e dar baixa no caixa"
                              >
                                <ReceiptText size={15} /> Pagar
                              </Button>
                            )}
                            <Button
                              className="p-1.5"
                              variant="ghost"
                              title="Editar boleto"
                              onClick={() => setEditingBill(bill)}
                            >
                              <Pencil size={15} />
                            </Button>
                            <Button
                              className="p-1.5"
                              variant="ghost"
                              title="Excluir boleto"
                              onClick={() => removeBill.mutate(bill)}
                            >
                              <Trash2 size={15} className="text-red-700" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Visão de Cards para Telas Mobile (Celular) */}
            <div className="divide-y divide-zinc-200 md:hidden">
              {filteredBills.map(bill => {
                const isPending = bill.status === 'Pendente'
                const isOverdue = isPending && bill.due_date < todayStr
                const isToday = isPending && bill.due_date === todayStr

                return (
                  <div key={bill.id} className={`p-4 ${isOverdue ? 'bg-red-50/40' : isToday ? 'bg-amber-50/40' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <strong className="text-base text-zinc-950">{bill.description}</strong>
                        <p className="text-xs text-zinc-500">{bill.supplier || 'Fornecedor não informado'}</p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          bill.status === 'Pago'
                            ? 'bg-emerald-100 text-emerald-800'
                            : isOverdue
                            ? 'bg-red-100 text-red-800'
                            : isToday
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {bill.status === 'Pago' ? 'Pago' : isOverdue ? 'Atrasado' : isToday ? 'Vence Hoje' : 'Pendente'}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-zinc-600">
                        Vencimento: <strong>{dateOnly(bill.due_date)}</strong>
                      </span>
                      <strong className="text-lg font-bold text-red-700">{money(bill.amount)}</strong>
                    </div>

                    {bill.barcode && (
                      <div className="mt-2.5 flex items-center justify-between rounded-lg bg-zinc-100 p-2">
                        <span className="font-mono text-xs text-zinc-700 truncate max-w-[200px]">{bill.barcode}</span>
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          onClick={() => copyCode(bill.barcode || '', bill.id)}
                        >
                          {copiedId === bill.id ? 'Copiado!' : 'Copiar'}
                        </Button>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-end gap-2 border-t border-zinc-100 pt-2.5">
                      <Button
                        className="p-1.5"
                        variant="ghost"
                        onClick={() => setEditingBill(bill)}
                      >
                        <Pencil size={15} /> Editar
                      </Button>
                      <Button
                        className="p-1.5"
                        variant="ghost"
                        onClick={() => removeBill.mutate(bill)}
                      >
                        <Trash2 size={15} className="text-red-700" />
                      </Button>
                      {bill.status === 'Pendente' && (
                        <Button
                          className="px-3 py-1.5 text-xs"
                          variant="primary"
                          onClick={() => pay.mutate(bill)}
                          disabled={pay.isPending}
                        >
                          <ReceiptText size={15} /> Pagar Agora
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <Empty>Nenhum boleto encontrado nesta categoria.</Empty>
        )}
      </section>

      {/* Modal de Cadastro / Edição */}
      {(open || editingBill) && (
        <BillFormDialog
          initial={editingBill ?? undefined}
          onClose={() => {
            setOpen(false)
            setEditingBill(null)
          }}
        />
      )}
    </>
  )
}

function BillFormDialog({ initial, onClose }: { initial?: Bill; onClose: () => void }) {
  const cache = useQueryClient()
  const form = useForm({
    defaultValues: {
      description: initial?.description ?? '',
      supplier: initial?.supplier ?? '',
      amount: initial?.amount ? String(initial.amount) : '',
      due_date: initial?.due_date ?? new Date().toISOString().slice(0, 10),
      category: initial?.category ?? 'Autopeças / Estoque',
      barcode: initial?.barcode ?? '',
      pix_key: initial?.pix_key ?? '',
      notes: initial?.notes ?? ''
    }
  })

  const save = useMutation({
    mutationFn: async (value: {
      description: string
      supplier: string
      amount: string
      due_date: string
      category: string
      barcode: string
      pix_key: string
      notes: string
    }) => {
      const amount = Number(value.amount)
      if (initial) {
        await execute(
          'UPDATE bills SET description=?, supplier=?, amount=?, due_date=?, category=?, barcode=?, pix_key=?, notes=? WHERE id=?',
          [value.description, value.supplier, amount, value.due_date, value.category, value.barcode, value.pix_key, value.notes, initial.id]
        )
      } else {
        await execute(
          'INSERT INTO bills (description, supplier, amount, due_date, category, barcode, pix_key, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [value.description, value.supplier, amount, value.due_date, value.category, value.barcode, value.pix_key, value.notes]
        )
      }
    },
    onSuccess: () => {
      refreshFinance(cache)
      onClose()
    }
  })

  function setDueOffset(days: number) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    form.setValue('due_date', d.toISOString().slice(0, 10))
  }

  return (
    <Modal title={initial ? 'Editar Boleto / Conta' : 'Cadastrar Novo Boleto'} onClose={onClose} wide>
      <form className="space-y-4" onSubmit={form.handleSubmit(val => save.mutate(val))}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            required
            label="Nome do boleto / descrição *"
            placeholder="Ex.: Peças Distribuidora Silva, Óleo 20W50, Equatorial Energia"
            {...form.register('description')}
          />
          <Input
            label="Fornecedor / Loja"
            placeholder="Ex.: Distribuidora de Peças Piauí, Posto, Concessionária"
            {...form.register('supplier')}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            required
            label="Valor do boleto (R$) *"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0,00"
            {...form.register('amount')}
          />

          <div>
            <Input required label="Data de vencimento *" type="date" {...form.register('due_date')} />
            <div className="mt-1.5 flex flex-wrap gap-1 text-xs">
              <span className="text-zinc-500 py-0.5">Atalhos:</span>
              <button
                type="button"
                onClick={() => setDueOffset(0)}
                className="rounded bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 hover:bg-zinc-200"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setDueOffset(7)}
                className="rounded bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 hover:bg-zinc-200"
              >
                +7 dias
              </button>
              <button
                type="button"
                onClick={() => setDueOffset(15)}
                className="rounded bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 hover:bg-zinc-200"
              >
                +15 dias
              </button>
              <button
                type="button"
                onClick={() => setDueOffset(30)}
                className="rounded bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 hover:bg-zinc-200"
              >
                +30 dias
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Categoria da despesa" {...form.register('category')}>
            <option value="Autopeças / Estoque">Autopeças / Estoque</option>
            <option value="Óleos e Lubrificantes">Óleos e Lubrificantes</option>
            <option value="Ferramentas e Equipamentos">Ferramentas e Equipamentos</option>
            <option value="Energia Elétrica (Equatorial)">Energia Elétrica (Equatorial)</option>
            <option value="Água e Saneamento">Água e Saneamento</option>
            <option value="Internet / Telefone">Internet / Telefone</option>
            <option value="Aluguel do Ponto">Aluguel do Ponto</option>
            <option value="Impostos e Taxas">Impostos e Taxas</option>
            <option value="Despesas Operacionais">Despesas Operacionais</option>
            <option value="Outros">Outros</option>
          </Select>

          <Input
            label="Chave Pix para pagamento (opcional)"
            placeholder="CNPJ, celular, email ou chave aleatória"
            {...form.register('pix_key')}
          />
        </div>

        <Input
          label="Código de barras / Linha digitável"
          placeholder="Cole aqui a linha digitável do boleto para pagar pelo app do banco"
          {...form.register('barcode')}
        />

        <Textarea
          label="Observações / Nº da Nota Fiscal"
          rows={2}
          placeholder="Ex.: NF 14205, parcelado em 3x pela distribuidora"
          {...form.register('notes')}
        />

        <div className="flex justify-end gap-3 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={save.isPending} type="submit">
            {save.isPending ? 'Salvando...' : initial ? 'Salvar alterações' : 'Cadastrar boleto'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
