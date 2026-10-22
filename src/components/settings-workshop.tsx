import { ChangeEvent, useRef, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Cloud,
  CloudRain,
  Copy,
  Download,
  ExternalLink,
  HelpCircle,
  ImagePlus,
  RefreshCw,
  Trash2,
  Upload,
  Database
} from 'lucide-react'
import { execute, query } from '../lib/db'
import {
  exportBackupJson,
  getSheetsConfig,
  importBackupJson,
  saveSheetsConfig,
  subscribeSyncState,
  syncWithGoogleSheets,
  GOOGLE_APPS_SCRIPT_CODE,
  type SyncState
} from '../lib/sheets-engine'
import type { Settings } from '../lib/types'
import { Button, Input, Modal, Select, Textarea } from './ui'

const defaults: Settings = {
  id: 1,
  workshop_name: 'Oficina Pro',
  address: 'Centro, São Miguel da Baixa Grande - PI',
  phone: '',
  printer: '',
  logo_data: '',
  primary_color: '#b91c1c',
  sidebar_color: '#b91c1c',
  background_color: '#f4f4f5',
  sidebar_background_color: '#18181b',
  card_color: '#ffffff',
  theme_mode: 'Claro',
  pix_key: '',
  city_default: 'São Miguel da Baixa Grande - PI'
}

export function WorkshopSettingsPage() {
  const cache = useQueryClient()
  const restoreInput = useRef<HTMLInputElement>(null)
  const [sheetsModalOpen, setSheetsModalOpen] = useState(false)
  const [copiedScript, setCopiedScript] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>({
    isConfigured: false,
    isSyncing: false,
    lastSync: null,
    statusText: '',
    error: null
  })

  const [sheetsUrl, setSheetsUrl] = useState(() => getSheetsConfig().webAppUrl || '')

  useEffect(() => {
    return subscribeSyncState(setSyncState)
  }, [])

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await query<Settings>('SELECT * FROM settings WHERE id=1'))[0]
  })

  const form = useForm<Settings>({
    values: settings ? { ...defaults, ...settings } : defaults
  })

  const save = useMutation({
    mutationFn: (value: Settings) =>
      execute(
        `UPDATE settings SET
          workshop_name=?, logo_data=?, primary_color=?, sidebar_color=?, background_color=?,
          sidebar_background_color=?, card_color=?, theme_mode=?, address=?, phone=?,
          printer=?, pix_key=?, city_default=?
         WHERE id=1`,
        [
          value.workshop_name,
          value.logo_data,
          value.primary_color,
          value.primary_color,
          value.background_color,
          value.sidebar_background_color,
          value.card_color,
          value.theme_mode,
          value.address,
          value.phone,
          value.printer,
          value.pix_key || '',
          value.city_default || 'São Miguel da Baixa Grande - PI'
        ]
      ),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['settings'] })
      window.alert('Configurações salvas com sucesso!')
    }
  })

  function handleSaveSheetsUrl() {
    const trimmed = sheetsUrl.trim()
    if (!trimmed) {
      window.alert('Por favor, informe a URL do App da Web do Google Sheets.')
      return
    }

    if (trimmed.includes('docs.google.com/spreadsheets')) {
      window.alert(
        'Atenção! Você colou o link da planilha do navegador (docs.google.com/spreadsheets...).\n\n' +
        'O sistema precisa da "URL do Aplicativo da Web" gerada no Apps Script (que começa com https://script.google.com/macros/s/... e termina em /exec).\n\n' +
        'Clique em "Ver Instruções do Google Sheets" para ver o passo a passo com o código pronto.'
      )
      return
    }

    saveSheetsConfig({
      webAppUrl: trimmed,
      autoSync: true
    })
    window.alert('URL do Google Sheets configurada! Testando sincronização...')
    handleManualSync()
  }

  async function handleManualSync(forcePull = false) {
    const res = await syncWithGoogleSheets(forcePull)
    cache.invalidateQueries()
    window.alert(res.message)
  }

  function handleExportBackup() {
    try {
      const json = exportBackupJson()
      const blob = new Blob([json], { type: 'application/json' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `backup-oficina-pro-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch {
      window.alert('Não foi possível gerar o arquivo de backup.')
    }
  }

  async function handleImportBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!window.confirm('Restaurar este arquivo substituirá os dados atuais salvos no dispositivo. Deseja continuar?')) return

    try {
      const text = await file.text()
      await importBackupJson(text)
      cache.invalidateQueries()
      window.alert('Backup importado com sucesso!')
    } catch (err) {
      window.alert('Erro ao importar backup: arquivo corrompido ou formato inválido.')
    }
    e.target.value = ''
  }

  function chooseLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      window.alert('Escolha uma imagem válida.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => form.setValue('logo_data', String(reader.result), { shouldDirty: true })
    reader.readAsDataURL(file)
  }

  function copyScriptCode() {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE)
    setCopiedScript(true)
    setTimeout(() => setCopiedScript(false), 3000)
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Configurações do Sistema</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Dados da oficina, integração com Google Sheets em nuvem e backup.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Formulário Principal */}
        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm xl:col-span-2">
          <form className="space-y-6 p-6" onSubmit={form.handleSubmit(val => save.mutate(val))}>
            {/* Bloco Oficina */}
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Identidade da Oficina</h2>
              <p className="text-xs text-zinc-500">Estas informações aparecem nos cabeçalhos de OS, relatórios e recibos.</p>
              
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Nome da oficina *" placeholder="Ex.: Oficina Mecânica São Miguel" {...form.register('workshop_name')} />
                <Input label="Cidade / Localidade *" placeholder="Ex.: São Miguel da Baixa Grande - PI" {...form.register('city_default')} />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Telefone / WhatsApp da oficina" placeholder="(86) 90000-0000" {...form.register('phone')} />
                <Input label="Chave Pix para cobrança" placeholder="Chave Pix enviada para os clientes" {...form.register('pix_key')} />
              </div>

              <div className="mt-3">
                <Textarea label="Endereço completo da oficina" rows={2} placeholder="Rua, número, bairro..." {...form.register('address')} />
              </div>

              {/* Logo */}
              <div className="mt-4 border-t border-zinc-100 pt-4">
                <h3 className="font-bold text-sm text-zinc-800">Logomarca da Oficina</h3>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  {form.watch('logo_data') ? (
                    <img src={form.watch('logo_data')} className="h-16 w-16 rounded-xl border border-zinc-200 object-contain p-1" alt="Logo" />
                  ) : (
                    <div className="grid h-16 w-16 place-items-center rounded-xl bg-zinc-100 text-zinc-400">
                      <ImagePlus size={24} />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800">
                      <ImagePlus size={15} /> Escolher imagem
                      <input className="hidden" type="file" accept="image/*" onChange={chooseLogo} />
                    </label>
                    {form.watch('logo_data') && (
                      <Button type="button" variant="secondary" className="text-xs" onClick={() => form.setValue('logo_data', '', { shouldDirty: true })}>
                        <Trash2 size={15} /> Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <Button disabled={save.isPending} type="submit">
                {save.isPending ? 'Salvando...' : 'Salvar configurações da oficina'}
              </Button>
            </div>
          </form>
        </section>

        {/* Coluna Direita: Google Sheets & Backup */}
        <div className="space-y-6">
          {/* Card Google Sheets */}
          <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-6 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-900">
              <Cloud size={24} className="text-emerald-700" />
              <h2 className="text-lg font-bold">Banco Google Sheets</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-emerald-800">
              Sincronize todos os dados com uma planilha do Google Sheets. Acesse do celular, tablet ou computador em qualquer lugar!
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700">URL do Web App do Google Sheets</label>
                <input
                  type="text"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={sheetsUrl}
                  onChange={e => setSheetsUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-600"
                />
              </div>

              <Button
                type="button"
                className="w-full bg-emerald-700 text-white hover:bg-emerald-800"
                onClick={handleSaveSheetsUrl}
              >
                Salvar URL e Conectar
              </Button>

              <div className="rounded-lg border border-emerald-200 bg-white p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      syncState.isConfigured ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <strong className="text-zinc-800">
                    {syncState.isConfigured ? 'Google Sheets Conectado' : 'Modo Offline / Local'}
                  </strong>
                </div>
                <p className="mt-1 text-zinc-500">{syncState.statusText}</p>
                {syncState.lastSync && (
                  <p className="mt-0.5 text-[11px] text-zinc-400">Última sincronização: {syncState.lastSync}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full text-xs"
                  onClick={() => handleManualSync(false)}
                  disabled={syncState.isSyncing}
                >
                  <RefreshCw size={14} className={syncState.isSyncing ? 'animate-spin' : ''} />
                  {syncState.isSyncing ? 'Sincronizando...' : 'Enviar Dados para a Planilha Agora'}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full text-xs"
                  onClick={() => handleManualSync(true)}
                  disabled={syncState.isSyncing}
                >
                  <Download size={14} /> Restaurar Dados da Planilha para o Dispositivo
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs text-emerald-800 hover:bg-emerald-100"
                  onClick={() => setSheetsModalOpen(true)}
                >
                  <HelpCircle size={14} /> Como Ativar a Planilha (Passo a Passo)
                </Button>
              </div>
            </div>
          </section>

          {/* Card Backup Local */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Database size={20} className="text-zinc-700" />
              <h2 className="text-lg font-bold text-zinc-900">Backup em Arquivo</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Gere um arquivo de segurança no seu computador ou celular para guardar em pendrive ou WhatsApp.
            </p>

            <div className="mt-4 space-y-2">
              <Button className="w-full text-xs" variant="secondary" onClick={handleExportBackup}>
                <Download size={15} /> Baixar Arquivo de Backup (JSON)
              </Button>

              <Button
                className="w-full text-xs"
                variant="secondary"
                onClick={() => restoreInput.current?.click()}
              >
                <Upload size={15} /> Importar Arquivo de Backup
              </Button>
              <input
                ref={restoreInput}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportBackup}
              />
            </div>
          </section>
        </div>
      </div>

      {/* Modal Passo a Passo do Google Sheets */}
      {sheetsModalOpen && (
        <Modal title="Como Conectar ao Google Sheets em 2 Minutos" onClose={() => setSheetsModalOpen(false)} wide>
          <div className="space-y-4 text-sm text-zinc-700">
            <p className="leading-6">
              O Google Sheets funciona como um banco de dados em nuvem <strong>100% gratuito</strong> e seguro para sua oficina.
              Siga os passos abaixo:
            </p>

            <ol className="list-decimal space-y-3 pl-5">
              <li>
                Acesse o Google Planilhas (
                <a
                  href="https://sheets.new"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-emerald-700 underline inline-flex items-center gap-1"
                >
                  sheets.new <ExternalLink size={13} />
                </a>
                ) na sua conta Google e dê o nome de <strong>Banco Oficina Pro</strong>.
              </li>
              <li>
                No menu superior da planilha, clique em <strong>Extensões → Apps Script</strong>.
              </li>
              <li>
                Apague todo o texto que estiver lá e <strong>cole o código do script</strong> abaixo.
              </li>
              <li>
                Clique no botão <strong>Salvar (ícone de disquete)</strong>.
              </li>
              <li>
                No canto superior direito, clique em <strong>Implantar → Nova implantação</strong>.
              </li>
              <li>
                Ao lado de "Selecione o tipo", clique no ícone de engrenagem e escolha <strong>App da Web</strong>.
              </li>
              <li>
                Configure:
                <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs text-zinc-600">
                  <li><strong>Executar como:</strong> "Eu (seu email)"</li>
                  <li><strong>Quem pode acessar:</strong> "Qualquer pessoa" (ou "Qualquer um")</li>
                </ul>
              </li>
              <li>
                Clique em <strong>Implantar</strong> e autorize as permissões da sua conta Google.
              </li>
              <li>
                Copie o <strong>URL do aplicativo da Web</strong> gerado e cole no campo de URL das Configurações do Oficina Pro!
              </li>
            </ol>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-900 p-4 text-white">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="text-xs font-bold text-zinc-400">Código do Google Apps Script</span>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2.5 py-1 text-xs"
                  onClick={copyScriptCode}
                >
                  {copiedScript ? (
                    <>
                      <Check size={14} className="text-emerald-600" /> Código Copiado!
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copiar Código Completo
                    </>
                  )}
                </Button>
              </div>
              <pre className="mt-3 max-h-48 overflow-y-auto font-mono text-xs text-zinc-300">
                {GOOGLE_APPS_SCRIPT_CODE}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={() => setSheetsModalOpen(false)}>
                Entendi, fechar instruções
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
