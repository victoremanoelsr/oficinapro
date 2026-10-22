import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PackagePlus, X } from 'lucide-react'
import { execute, money, query } from '../lib/db'
import type { Order, Part } from '../lib/types'
import { Button, Input, Modal, Select, Textarea } from './ui'

type DraftPart = Part & { useQuantity: number }

export function MechanicOrderEditor({ order, onClose }: { order: Order; onClose: () => void }) {
  const cache = useQueryClient()
  const [parts, setParts] = useState<DraftPart[]>([])
  const [partId, setPartId] = useState('')
  const form = useForm({ defaultValues: { diagnosis: order.diagnosis, service_done: order.service_done, labor_value: String(order.labor_value) } })
  const { data: stock = [] } = useQuery({ queryKey: ['order-stock'], queryFn: () => query<Part>('SELECT * FROM parts WHERE archived_at IS NULL ORDER BY name') })
  const { data: currentParts = [] } = useQuery({
    queryKey: ['order-edit-parts', order.id],
    queryFn: () => query<Part & { use_quantity: number; saved_price: number }>(`SELECT p.*, sop.quantity AS use_quantity, sop.unit_price AS saved_price FROM service_order_parts sop JOIN parts p ON p.id=sop.part_id WHERE sop.service_order_id=?`, [order.id])
  })
  const { data: budgetParts = [] } = useQuery({
    queryKey: ['order-budget-parts', order.id], enabled: Boolean(order.budget_id),
    queryFn: () => query<Part & { use_quantity: number; saved_price: number; item_name: string; item_brand: string }>(`SELECT p.*, bp.quantity AS use_quantity, bp.unit_price AS saved_price, bp.item_name, bp.item_brand FROM budget_parts bp JOIN parts p ON p.id=bp.part_id WHERE bp.budget_id=?`, [order.budget_id])
  })

  useEffect(() => {
    if (currentParts.length) setParts(currentParts.map(part => ({ ...part, useQuantity: Number(part.use_quantity), sale_price: Number(part.saved_price) })))
  }, [currentParts])
  useEffect(() => {
    if (!currentParts.length && budgetParts.length) setParts(budgetParts.map(part => ({ ...part, name: part.item_name || part.name, brand: part.item_brand || part.brand, useQuantity: Number(part.use_quantity), sale_price: Number(part.saved_price) })))
  }, [budgetParts, currentParts.length])

  const total = parts.reduce((sum, part) => sum + Number(part.sale_price) * part.useQuantity, 0) + Number(form.watch('labor_value') || 0)
  function addPart() {
    const part = stock.find(item => item.id === Number(partId))
    if (!part) return
    const available = part.quantity + (currentParts.find(item => item.id === part.id)?.use_quantity ?? 0)
    if (parts.some(item => item.id === part.id)) {
      setParts(items => items.map(item => item.id === part.id ? { ...item, useQuantity: Math.min(available, item.useQuantity + 1), quantity: available } : item))
    } else {
      setParts(items => [...items, { ...part, quantity: available, useQuantity: 1 }])
    }
    setPartId('')
  }

  const save = useMutation({
    mutationFn: async (value: { diagnosis: string; service_done: string; labor_value: string }) => {
      const labor = Number(value.labor_value) || 0
      const partsValue = parts.reduce((sum, part) => sum + Number(part.sale_price) * part.useQuantity, 0)
      const oldParts = await query<{ part_id: number; quantity: number }>('SELECT part_id, quantity FROM service_order_parts WHERE service_order_id=?', [order.id])
      for (const item of oldParts) await execute('UPDATE parts SET quantity=quantity+? WHERE id=?', [item.quantity, item.part_id])
      await execute('DELETE FROM service_order_parts WHERE service_order_id=?', [order.id])
      for (const part of parts) {
        await execute('INSERT INTO service_order_parts (service_order_id,part_id,quantity,unit_price,item_name,item_brand,unit_cost,subtotal) VALUES (?,?,?,?,?,?,?,?)', [order.id, part.id, part.useQuantity, part.sale_price, part.name, part.brand, part.purchase_price, part.useQuantity * part.sale_price])
        await execute('UPDATE parts SET quantity=quantity-? WHERE id=?', [part.useQuantity, part.id])
      }
      await execute("UPDATE service_orders SET diagnosis=?, service_done=?, labor_value=?, parts_value=?, total=?, status='Finalizada', finalized_at=CURRENT_TIMESTAMP WHERE id=?", [value.diagnosis, value.service_done, labor, partsValue, labor + partsValue, order.id])
    },
    onSuccess: () => {
      for (const key of ['orders', 'dashboard', 'parts', 'order-stock', 'order-parts', 'vehicle-history', 'ready-to-contact', 'payment-orders']) cache.invalidateQueries({ queryKey: [key] })
      onClose()
    }
  })

  return <Modal title={`Finalizar OS ${order.number}`} onClose={onClose} wide>
    <p className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">Preencha o trabalho do mecânico. Ao confirmar, a OS será finalizada e ficará disponível no Financeiro.</p>
    <form onSubmit={form.handleSubmit(value => save.mutate(value))} className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2"><Textarea label="Diagnóstico" rows={4} {...form.register('diagnosis')} /><Textarea label="Serviço executado" rows={4} {...form.register('service_done')} /></div>
      <div className="rounded-xl border border-zinc-200">
        <div className="flex flex-wrap items-end gap-3 border-b border-zinc-200 bg-zinc-50 p-4"><Select className="min-w-64 flex-1" label="Peças utilizadas (estoque)" value={partId} onChange={event => setPartId(event.target.value)}><option value="">Selecionar peça...</option>{stock.map(part => <option disabled={part.quantity <= 0 && !currentParts.some(item => item.id === part.id)} key={part.id} value={part.id}>{part.name} · {part.brand} ({part.quantity} un.)</option>)}</Select><Button type="button" variant="secondary" onClick={addPart} disabled={!partId}><PackagePlus size={17} />Adicionar</Button></div>
        {parts.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500"><th className="px-4 py-3">Peça</th><th className="px-4 py-3">Qtd.</th><th className="px-4 py-3">Unitário</th><th className="px-4 py-3">Subtotal</th><th /></tr></thead><tbody>{parts.map(part => <tr className="border-b border-zinc-100" key={part.id}><td className="px-4 py-3"><strong>{part.name}</strong><span className="block text-xs text-zinc-500">{part.code} · {part.brand}</span></td><td className="px-4 py-3"><input type="number" min="1" max={part.quantity} value={part.useQuantity} onChange={event => setParts(items => items.map(item => item.id === part.id ? { ...item, useQuantity: Math.max(1, Math.min(item.quantity, Number(event.target.value) || 1)) } : item))} className="w-20 rounded border border-zinc-300 px-2 py-1.5" /></td><td className="px-4 py-3">{money(part.sale_price)}</td><td className="px-4 py-3 font-semibold">{money(part.sale_price * part.useQuantity)}</td><td className="px-4 py-3"><Button type="button" variant="ghost" className="px-2 py-1.5" onClick={() => setParts(items => items.filter(item => item.id !== part.id))}><X size={16} /></Button></td></tr>)}</tbody></table></div> : <div className="p-4 text-sm text-zinc-500">Nenhuma peça adicionada.</div>}
      </div>
      <div className="ml-auto max-w-xs"><Input label="Valor da mão de obra" type="number" min="0" step="0.01" {...form.register('labor_value')} /></div>
      <div className="flex items-center justify-between rounded-xl bg-zinc-950 px-5 py-4 text-white"><span className="font-semibold">Total automático</span><strong className="text-xl">{money(total)}</strong></div>
      <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={save.isPending} type="submit">{save.isPending ? 'Finalizando...' : 'Finalizar OS'}</Button></div>
    </form>
  </Modal>
}

export function PendingPartDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const cache = useQueryClient()
  const form = useForm({ defaultValues: { part_id: '', description: '', quantity: '1', priority: 'Normal' } })
  const { data: stockParts = [] } = useQuery({ queryKey: ['parts'], queryFn: () => query<Part>('SELECT * FROM parts WHERE archived_at IS NULL ORDER BY name') })
  const selectedPart = form.watch('part_id')
  const save = useMutation({
    mutationFn: async (value: { part_id: string; description: string; quantity: string; priority: string }) => {
      const part = stockParts.find(item => item.id === Number(value.part_id)); const description = part?.name || value.description
      await execute('INSERT INTO part_requests (service_order_id, part_id, description, requested_quantity, priority) VALUES (?, ?, ?, ?, ?)', [order.id, part?.id ?? null, description, Number(value.quantity) || 1, value.priority])
      await execute(`UPDATE service_orders SET status='Aguardando peças' WHERE id=?`, [order.id])
    },
    onSuccess: () => { cache.invalidateQueries({ queryKey: ['orders'] }); cache.invalidateQueries({ queryKey: ['dashboard'] }); cache.invalidateQueries({ queryKey: ['part-requests'] }); onClose() }
  })
  return <Modal title={`Peça aguardada — ${order.number}`} onClose={onClose}><form className="space-y-4" onSubmit={form.handleSubmit(value => save.mutate(value))}><Select label="Peça já cadastrada no estoque" {...form.register('part_id')}><option value="">Não cadastrada — informar nova peça abaixo</option>{stockParts.map(part => <option key={part.id} value={part.id}>{part.name} · saldo {part.quantity}</option>)}</Select>{!selectedPart && <Textarea required label="Nome da nova peça" placeholder="Ex.: Pastilha de freio dianteira" rows={3} {...form.register('description')} />}<Input required label="Quantidade para pedir" type="number" min="1" step="1" {...form.register('quantity')} /><Select label="Prioridade" {...form.register('priority')}><option>Urgente</option><option>Alta</option><option>Normal</option></Select><p className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-900">Se a peça já existe, ela será vinculada ao estoque. Se for nova, ela será criada no estoque quando chegar.</p><div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={save.isPending} type="submit">Registrar peça pendente</Button></div></form></Modal>
}
