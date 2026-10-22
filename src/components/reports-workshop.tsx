import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { money, query } from '../lib/db'
import { Button, Empty } from './ui'

type ReportKey = 'orders' | 'revenue' | 'expenses'
type Period = 'Dia' | 'Semana' | 'Mês' | 'Ano'
type Row = { item: string; detail: string; value: number; date: string }

const dateFilter = (column: string, period: Period) => {
  if (period === 'Dia') return `date(${column})=date('now','localtime')`
  if (period === 'Semana') return `date(${column})>=date('now','-6 days','localtime') AND date(${column})<=date('now','localtime')`
  if (period === 'Mês') return `strftime('%Y-%m',${column})=strftime('%Y-%m','now','localtime')`
  return `strftime('%Y',${column})=strftime('%Y','now','localtime')`
}

function reportSql(report: ReportKey, period: Period) {
  if (report === 'orders') return `SELECT number AS item,status AS detail,total AS value,entered_at AS date FROM service_orders WHERE ${dateFilter('entered_at', period)} ORDER BY entered_at DESC`
  if (report === 'revenue') return `SELECT description AS item,payment_method || CASE WHEN installments>1 THEN ' · parcela ' || installment_number || '/' || installments ELSE '' END AS detail,amount AS value,paid_at AS date FROM financial_transactions WHERE type='Recebimento' AND status='Pago' AND ${dateFilter('paid_at', period)} ORDER BY paid_at DESC`
  return `SELECT description AS item,'Saída paga · ' || payment_method AS detail,amount AS value,paid_at AS date FROM financial_transactions WHERE type='Saída' AND status='Pago' AND ${dateFilter('paid_at', period)} UNION ALL SELECT description AS item,'Boleto a pagar' AS detail,amount AS value,due_date AS date FROM bills WHERE status='Pendente' AND ${dateFilter('due_date', period)} ORDER BY date DESC`
}

const reports: { key: ReportKey; label: string; subtitle: string }[] = [
  { key: 'orders', label: 'Ordens de serviço', subtitle: 'OS abertas no período selecionado.' },
  { key: 'revenue', label: 'Faturamento', subtitle: 'Valores efetivamente recebidos no período.' },
  { key: 'expenses', label: 'Despesas', subtitle: 'Saídas pagas e boletos com vencimento no período.' }
]

export function FinanceReportsPage() {
  const [report, setReport] = useState<ReportKey>('orders'); const [period, setPeriod] = useState<Period>('Mês')
  const { data = [], isFetching } = useQuery({ queryKey: ['report', report, period], queryFn: () => query<Row>(reportSql(report, period)) })
  const active = reports.find(item => item.key === report)!
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0)
  return <><div className="mb-6 flex items-start justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight text-zinc-950">Relatórios</h1><p className="mt-1 text-sm text-zinc-500">Consulte a movimentação da oficina por dia, semana, mês ou ano.</p></div><Button variant="secondary" onClick={() => window.print()}><Printer size={18}/>Imprimir</Button></div><section className="rounded-xl border border-zinc-200 bg-white shadow-sm"><div className="no-print border-b border-zinc-200 p-4"><div className="flex flex-wrap gap-2">{reports.map(item => <Button key={item.key} variant={report === item.key ? 'primary' : 'secondary'} onClick={() => setReport(item.key)}>{item.label}</Button>)}</div><div className="mt-3 flex flex-wrap items-center gap-2"><span className="mr-1 text-sm font-semibold text-zinc-600">Período:</span>{(['Dia', 'Semana', 'Mês', 'Ano'] as const).map(item => <Button key={item} className="px-3 py-1.5" variant={period === item ? 'primary' : 'ghost'} onClick={() => setPeriod(item)}>{item}</Button>)}</div></div><div className="p-5"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-bold">{active.label} · {period}</h2><p className="text-sm text-zinc-500">{active.subtitle}</p></div><div className="rounded-lg bg-zinc-100 px-4 py-2 text-right"><p className="text-xs font-bold uppercase text-zinc-500">Total</p><strong className={report === 'expenses' ? 'text-red-700' : 'text-emerald-700'}>{money(total)}</strong></div></div>{isFetching ? <Empty>Preparando relatório...</Empty> : data.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-bold uppercase tracking-wide text-zinc-500"><th className="px-4 py-3">Item</th><th className="px-4 py-3">Informação</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Valor</th></tr></thead><tbody>{data.map((row, index) => <tr className="border-b border-zinc-100" key={index}><td className="px-4 py-3 font-semibold">{row.item}</td><td className="px-4 py-3">{row.detail || '—'}</td><td className="px-4 py-3">{row.date ? new Date(`${row.date}T12:00:00`).toLocaleDateString('pt-BR') : '—'}</td><td className={`px-4 py-3 font-bold ${report === 'expenses' ? 'text-red-700' : 'text-emerald-700'}`}>{money(row.value)}</td></tr>)}</tbody></table></div> : <Empty>Não há dados para este período.</Empty>}</div></section></>
}
