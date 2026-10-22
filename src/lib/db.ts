import { executeWebQuery, executeWebStatement } from './sheets-engine'

export const isDesktop = () => Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)

export async function query<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  return executeWebQuery<T>(sql, values)
}

export async function execute(sql: string, values: unknown[] = []): Promise<{ rowsAffected: number; lastInsertId: number }> {
  return executeWebStatement(sql, values)
}

export const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0))

export const dateTime = (value: string | null | undefined) => {
  if (!value) return '—'
  try {
    const clean = value.replace(' ', 'T')
    const date = new Date(clean.endsWith('Z') ? clean : clean + 'Z')
    if (isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
  } catch {
    return value
  }
}

export const dateOnly = (value: string | null | undefined) => {
  if (!value) return '—'
  try {
    const clean = value.replace(' ', 'T')
    const date = new Date(clean.includes('T') ? (clean.endsWith('Z') ? clean : clean + 'Z') : clean + 'T12:00:00Z')
    if (isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('pt-BR').format(date)
  } catch {
    return value
  }
}

export function nextOrderNumber() {
  const now = new Date()
  return `OS-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`
}

export function sanitizePhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }
  return digits
}

export function openWhatsApp(phone: string, message: string) {
  const sanitized = sanitizePhone(phone)
  if (!sanitized) {
    window.alert('Telefone do cliente não cadastrado ou inválido.')
    return
  }
  const url = `https://api.whatsapp.com/send?phone=${sanitized}&text=${encodeURIComponent(message)}`
  window.open(url, '_blank')
}
