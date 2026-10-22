import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { X } from 'lucide-react'

export function Button({ children, className = '', variant = 'primary', ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const styles = {
    primary: 'bg-[var(--app-primary)] text-white hover:opacity-90 shadow-sm active:scale-[0.98]',
    secondary: 'bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100 shadow-2xs',
    danger: 'bg-red-100 text-red-800 hover:bg-red-200 active:bg-red-300',
    ghost: 'text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200'
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 sm:px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation min-h-[38px] ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Input({ label, error, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className={`block text-xs sm:text-sm font-medium text-zinc-700 ${className}`}>
      {label && <span className="mb-1 sm:mb-1.5 block">{label}</span>}
      <input
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 sm:py-2.5 text-base sm:text-sm outline-none transition placeholder:text-zinc-400 focus:border-red-600 focus:ring-2 focus:ring-red-100"
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  )
}

export function Select({ label, children, className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; children: ReactNode }) {
  return (
    <label className={`block text-xs sm:text-sm font-medium text-zinc-700 ${className}`}>
      {label && <span className="mb-1 sm:mb-1.5 block">{label}</span>}
      <select
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 sm:py-2.5 text-base sm:text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

export function Textarea({ label, className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className={`block text-xs sm:text-sm font-medium text-zinc-700 ${className}`}>
      {label && <span className="mb-1 sm:mb-1.5 block">{label}</span>}
      <textarea
        className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 sm:py-2.5 text-base sm:text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
        {...props}
      />
    </label>
  )
}

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-1.5 sm:p-4 md:p-6 overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      <section
        className={`flex max-h-[96vh] landscape:max-h-[96vh] w-full flex-col rounded-xl sm:rounded-2xl bg-white shadow-2xl transition-all ${
          wide ? 'max-w-5xl' : 'max-w-2xl'
        }`}
      >
        <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white/98 px-3.5 py-2.5 sm:px-6 sm:py-3.5 landscape:py-2.5">
          <h2 className="text-sm sm:text-lg font-bold text-zinc-900 pr-2 truncate">{title}</h2>
          <button
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 active:bg-zinc-200"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 landscape:p-4 touch-scroll">{children}</div>
      </section>
    </div>
  )
}

export function Empty({ children }: PropsWithChildren) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 sm:px-6 sm:py-12 text-center text-xs sm:text-sm text-zinc-500">
      {children}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'Aberta': 'bg-sky-100 text-sky-800',
    'Em manutenção': 'bg-amber-100 text-amber-800',
    'Aguardando peças': 'bg-orange-100 text-orange-800',
    'Serviço finalizado': 'bg-violet-100 text-violet-800',
    'Finalizada': 'bg-emerald-100 text-emerald-800'
  }
  return (
    <span className={`inline-flex rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-bold ${colors[status] ?? 'bg-zinc-100 text-zinc-700'}`}>
      {status}
    </span>
  )
}
