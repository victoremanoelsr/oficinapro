import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgeDollarSign,
  CheckCircle2,
  FileText,
  MessageCircle,
  MinusCircle,
  PlusCircle,
  Printer,
  Trash2,
  Wallet
} from 'lucide-react'
import { Button, Input, Modal, Select, Textarea } from './ui'
import { dateTime, money, openWhatsApp, query, execute } from '../lib/db'
import type { Client, CustomerLedgerEntry, Settings } from '../lib/types'

type CustomerLedgerModalProps = {
  client: Client
  onClose: () => void
}

export function CustomerLedgerModal({ client, onClose }: CustomerLedgerModalProps) {
  const cache = useQueryClient()
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [showAddDebt, setShowAddDebt] = useState(false)

  // Formulário de pagamento/abatimento
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro')
  const [paymentDesc, setPaymentDesc] = useState('Abatimento de conta no balcão')

  // Formulário de débito avulso
  const [debtAmount, setDebtAmount] = useState('')
  const [debtDesc, setDebtDesc] = useState('')

  // Buscar configurações da oficina (para pegar a chave PIX e nome)
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await query<Settings>('SELECT * FROM settings WHERE id=1'))[0]
  })

  // Buscar lançamentos do cliente
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['customer-ledger', client.id],
    queryFn: () =>
      query<CustomerLedgerEntry>(
        'SELECT * FROM customer_ledger WHERE client_id = ? ORDER BY created_at DESC',
        [client.id]
      )
  })

  // Calcular saldo
  const totalDebitos = entries
    .filter(e => e.type === 'Debito')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0)

  const totalCreditos = entries
    .filter(e => e.type === 'Credito')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0)

  const saldoDevedor = totalDebitos - totalCreditos

  // Mutação para lançar pagamento (crédito)
  const addPayment = useMutation({
    mutationFn: async () => {
      const valor = parseFloat(paymentAmount.replace(',', '.'))
      if (!valor || valor <= 0) {
        window.alert('Informe um valor válido para o pagamento.')
        return
      }

      await execute(
        'INSERT INTO customer_ledger (client_id, type, amount, description, payment_method) VALUES (?, ?, ?, ?, ?)',
        [client.id, 'Credito', valor, paymentDesc.trim() || 'Abatimento de conta', paymentMethod]
      )

      // Também registra uma entrada no caixa da oficina
      await execute(
        'INSERT INTO cash_entries (type, description, value, paid_at, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [
          'Entrada',
          `Recebimento fiado: ${client.nickname ? `${client.nickname} (${client.name})` : client.name} - ${paymentDesc}`,
          valor
        ]
      )
    },
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['customer-ledger', client.id] })
      cache.invalidateQueries({ queryKey: ['cash-entries'] })
      cache.invalidateQueries({ queryKey: ['clients-debtors'] })
      setPaymentAmount('')
      setPaymentDesc('Abatimento de conta no balcão')
      setShowAddPayment(false)
    }
  })

  // Mutação para lançar débito avulso (peça, óleo, serviço avulso no fiado)
  const addDebt = useMutation({
    mutationFn: async () => {
      const valor = parseFloat(debtAmount.replace(',', '.'))
      if (!valor || valor <= 0) {
        window.alert('Informe um valor válido para o débito.')
        return
      }
      if (!debtDesc.trim()) {
        window.alert('Informe a descrição do que o cliente está levando (ex.: 1 litro de óleo 15w40).')
        return
      }

      await execute(
        'INSERT INTO customer_ledger (client_id, type, amount, description, payment_method) VALUES (?, ?, ?, ?, ?)',
        [client.id, 'Debito', valor, debtDesc.trim(), 'A prazo']
      )
    },
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['customer-ledger', client.id] })
      cache.invalidateQueries({ queryKey: ['clients-debtors'] })
      setDebtAmount('')
      setDebtDesc('')
      setShowAddDebt(false)
    }
  })

  // Excluir lançamento
  const deleteEntry = useMutation({
    mutationFn: async (id: number) => {
      if (window.confirm('Deseja realmente remover este lançamento da conta?')) {
        await execute('DELETE FROM customer_ledger WHERE id = ?', [id])
      }
    },
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['customer-ledger', client.id] })
      cache.invalidateQueries({ queryKey: ['clients-debtors'] })
    }
  })

  // Cobrança amigável no WhatsApp
  function cobrarWhatsApp() {
    if (!client.phone) {
      window.alert('Este cliente não tem telefone/WhatsApp cadastrado.')
      return
    }

    const workshopName = settings?.workshop_name || 'Oficina Mecânica'
    const pixKey = settings?.pix_key ? `\n\nChave PIX: *${settings.pix_key}*` : ''

    const saudacao = client.nickname ? `Olá ${client.nickname}!` : `Olá ${client.name}!`
    const mensagem =
      `${saudacao} Tudo bem?\n\n` +
      `Aqui é da *${workshopName}*.\n` +
      `Passando para enviar o resumo da sua conta com a gente:\n\n` +
      `💰 *Saldo total em aberto: ${money(saldoDevedor)}*\n` +
      pixKey +
      `\n\nQualquer dúvida estamos à disposição. Um abraço!`

    openWhatsApp(client.phone, mensagem)
  }

  // Imprimir extrato / comprovante térmico ou A4
  function imprimirExtrato() {
    window.print()
  }

  return (
    <Modal
      title={`Caderninho / Conta: ${client.nickname ? `"${client.nickname}" — ` : ''}${client.name}`}
      onClose={onClose}
      wide
    >
      <div className="space-y-5">
        {/* Card de Saldo Devedor */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                saldoDevedor > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {saldoDevedor > 0 ? <BadgeDollarSign size={28} /> : <CheckCircle2 size={28} />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Saldo da Conta (Fiado)</p>
              <p
                className={`text-2xl sm:text-3xl font-extrabold ${
                  saldoDevedor > 0 ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {money(saldoDevedor)}
              </p>
              <p className="text-xs text-zinc-500">
                {saldoDevedor > 0 ? 'Valor pendente a receber' : 'Conta em dia, sem pendências'}
              </p>
            </div>
          </div>

          {/* Botões de Ação Direta */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="secondary"
              className="text-xs sm:text-sm text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              onClick={() => {
                setShowAddPayment(true)
                setShowAddDebt(false)
              }}
            >
              <PlusCircle size={16} />
              <span>Receber / Abater</span>
            </Button>

            <Button
              variant="secondary"
              className="text-xs sm:text-sm text-red-700 border-red-200 hover:bg-red-50"
              onClick={() => {
                setShowAddDebt(true)
                setShowAddPayment(false)
              }}
            >
              <MinusCircle size={16} />
              <span>Lançar Fiado</span>
            </Button>

            {client.phone && (
              <Button
                variant="secondary"
                className="text-xs sm:text-sm text-green-700 border-green-200 hover:bg-green-50"
                onClick={cobrarWhatsApp}
                title="Cobrar via WhatsApp"
              >
                <MessageCircle size={16} />
                <span>Cobrar WhatsApp</span>
              </Button>
            )}

            <Button variant="ghost" className="text-xs sm:text-sm" onClick={imprimirExtrato} title="Imprimir extrato">
              <Printer size={16} />
              <span>Imprimir</span>
            </Button>
          </div>
        </div>

        {/* Formulário Retrátil: Receber / Abater Pagamento */}
        {showAddPayment && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-emerald-950 flex items-center gap-1.5">
                <Wallet size={16} className="text-emerald-700" />
                Registrar Pagamento / Abatimento de Conta
              </h4>
              <button
                type="button"
                onClick={() => setShowAddPayment(false)}
                className="text-xs text-zinc-500 hover:text-zinc-800"
              >
                Cancelar
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Valor Pago (R$) *"
                placeholder="Ex: 100,00"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                autoFocus
              />
              <Select
                label="Forma de Pagamento"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
              >
                <option value="Dinheiro">Dinheiro</option>
                <option value="PIX">PIX</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Transferência">Transferência Bancária</option>
              </Select>
              <Input
                label="Descrição / Referência"
                value={paymentDesc}
                onChange={e => setPaymentDesc(e.target.value)}
                placeholder="Ex: Abatimento de conta"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setShowAddPayment(false)}>
                Fechar
              </Button>
              <Button
                disabled={addPayment.isPending}
                onClick={() => addPayment.mutate()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {addPayment.isPending ? 'Salvando...' : 'Confirmar Abatimento e Entrar no Caixa'}
              </Button>
            </div>
          </div>
        )}

        {/* Formulário Retrátil: Lançar Débito no Fiado */}
        {showAddDebt && (
          <div className="rounded-xl border border-red-300 bg-red-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-red-950 flex items-center gap-1.5">
                <MinusCircle size={16} className="text-red-700" />
                Lançar Débito Avulso no Fiado
              </h4>
              <button
                type="button"
                onClick={() => setShowAddDebt(false)}
                className="text-xs text-zinc-500 hover:text-zinc-800"
              >
                Cancelar
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Valor do Débito (R$) *"
                placeholder="Ex: 45,00"
                value={debtAmount}
                onChange={e => setDebtAmount(e.target.value)}
                autoFocus
              />
              <div className="sm:col-span-2">
                <Input
                  label="Descrição do Produto/Serviço *"
                  value={debtDesc}
                  onChange={e => setDebtDesc(e.target.value)}
                  placeholder="Ex: 1 Litro de Óleo 15w40 + 1 Filtro de Combustível"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setShowAddDebt(false)}>
                Fechar
              </Button>
              <Button
                disabled={addDebt.isPending}
                onClick={() => addDebt.mutate()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {addDebt.isPending ? 'Salvando...' : 'Lançar Débito na Conta'}
              </Button>
            </div>
          </div>
        )}

        {/* Histórico / Extrato do Caderninho */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
              <FileText size={16} className="text-zinc-500" />
              Histórico de Lançamentos ({entries.length})
            </h3>
            <span className="text-xs text-zinc-500">
              Total fiado: {money(totalDebitos)} | Total pago: {money(totalCreditos)}
            </span>
          </div>

          {isLoading ? (
            <p className="p-4 text-center text-xs text-zinc-500">Carregando histórico da conta...</p>
          ) : entries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-xs text-zinc-500">
              Nenhum lançamento no caderninho deste cliente ainda. Você pode registrar compras fiado ou pagamentos nos
              botões acima.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full min-w-[500px] text-left text-xs sm:text-sm">
                <thead className="bg-zinc-100 text-[11px] uppercase tracking-wider text-zinc-600 font-bold border-b border-zinc-200">
                  <tr>
                    <th className="px-3 py-2.5">Data / Hora</th>
                    <th className="px-3 py-2.5">Tipo</th>
                    <th className="px-3 py-2.5">Descrição</th>
                    <th className="px-3 py-2.5">Forma</th>
                    <th className="px-3 py-2.5 text-right">Valor</th>
                    <th className="px-3 py-2.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {entries.map(entry => (
                    <tr key={entry.id} className="hover:bg-zinc-50/60">
                      <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600">{dateTime(entry.created_at)}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            entry.type === 'Debito'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {entry.type === 'Debito' ? 'Fiado (Débito)' : 'Pagamento (Crédito)'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-zinc-900">{entry.description}</td>
                      <td className="px-3 py-2.5 text-zinc-600">{entry.payment_method || '—'}</td>
                      <td
                        className={`px-3 py-2.5 text-right font-bold whitespace-nowrap ${
                          entry.type === 'Debito' ? 'text-red-600' : 'text-emerald-600'
                        }`}
                      >
                        {entry.type === 'Debito' ? `+ ${money(entry.amount)}` : `− ${money(entry.amount)}`}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => deleteEntry.mutate(entry.id)}
                          className="rounded p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50"
                          title="Remover lançamento"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-zinc-200">
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
