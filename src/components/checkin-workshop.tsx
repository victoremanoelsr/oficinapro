import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Camera,
  Car,
  CheckCircle2,
  ClipboardList,
  Fuel,
  Gauge,
  Image as ImageIcon,
  MessageCircle,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  User,
  Wrench,
  X
} from 'lucide-react'
import { Button, Input, Modal, Select, Textarea } from './ui'
import { dateTime, openWhatsApp, query, execute } from '../lib/db'
import type { Checkin, Client, Vehicle } from '../lib/types'

// Função auxiliar para comprimir imagens em Canvas antes de salvar
async function compressImageFile(file: File, maxWidth = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = event => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(img.src)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(compressedDataUrl)
      }
      img.onerror = err => reject(err)
    }
    reader.onerror = err => reject(err)
  })
}

type CheckinDialogProps = {
  initial?: Checkin | null
  onClose: () => void
  onOpenOrder?: (checkin: Checkin) => void
}

export function CheckinDialog({ initial, onClose, onOpenOrder }: CheckinDialogProps) {
  const cache = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Modo: cliente cadastrado ou avulso
  const [isAvulso, setIsAvulso] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientVehicles, setClientVehicles] = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('')

  // Campos do Check-in
  const [clientName, setClientName] = useState(initial?.client_name || '')
  const [clientPhone, setClientPhone] = useState(initial?.client_phone || '')
  const [vehiclePlate, setVehiclePlate] = useState(initial?.vehicle_plate || '')
  const [vehicleModel, setVehicleModel] = useState(initial?.vehicle_model || '')
  const [vehicleType, setVehicleType] = useState<string>(initial?.vehicle_type || 'Moto')
  const [unitType, setUnitType] = useState<'km' | 'horas'>(initial?.unit_type || 'km')
  const [mileage, setMileage] = useState(String(initial?.mileage || '0'))
  const [fuel, setFuel] = useState(initial?.fuel || '1/2')

  // Itens de checklist
  const [spareTire, setSpareTire] = useState(Boolean(initial?.spare_tire))
  const [jack, setJack] = useState(Boolean(initial?.jack))
  const [spareKey, setSpareKey] = useState(Boolean(initial?.spare_key))
  const [documents, setDocuments] = useState(Boolean(initial?.documents))
  const [triangle, setTriangle] = useState(Boolean(initial?.triangle))
  const [sound, setSound] = useState(Boolean(initial?.sound))

  const [notes, setNotes] = useState(initial?.notes || '')
  const [photos, setPhotos] = useState<string[]>(() => {
    try {
      return initial?.photos ? JSON.parse(initial.photos) : []
    } catch {
      return []
    }
  })

  const [compressing, setCompressing] = useState(false)
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null)

  // Buscar clientes pelo nome ou apelido
  const { data: matchingClients = [] } = useQuery({
    queryKey: ['checkin-client-search', clientSearch],
    enabled: Boolean(clientSearch.trim()) && !isAvulso && !selectedClient,
    queryFn: () =>
      query<Client>(
        'SELECT id, name, phone, city, document, notes, nickname FROM clients WHERE name LIKE ? OR nickname LIKE ? OR phone LIKE ? ORDER BY name LIMIT 6',
        [`%${clientSearch}%`, `%${clientSearch}%`, `%${clientSearch}%`]
      )
  })

  // Selecionar cliente cadastrado
  async function selectClient(c: Client) {
    setSelectedClient(c)
    setClientName(c.name)
    setClientPhone(c.phone || '')
    setClientSearch(c.nickname ? `${c.nickname} (${c.name})` : c.name)

    // Buscar veículos do cliente
    const vList = await query<Vehicle>('SELECT * FROM vehicles WHERE client_id = ? ORDER BY id DESC', [c.id])
    setClientVehicles(vList)
    if (vList.length > 0) {
      setSelectedVehicleId(String(vList[0].id))
      setVehiclePlate(vList[0].plate)
      setVehicleModel(`${vList[0].brand} ${vList[0].model}`)
      if (vList[0].vehicle_type) setVehicleType(vList[0].vehicle_type)
    }
  }

  // Ao trocar o veículo do cliente
  function handleSelectVehicle(vId: string) {
    setSelectedVehicleId(vId)
    const v = clientVehicles.find(item => String(item.id) === vId)
    if (v) {
      setVehiclePlate(v.plate)
      setVehicleModel(`${v.brand} ${v.model}`)
      if (v.vehicle_type) setVehicleType(v.vehicle_type)
    }
  }

  // Upload e compressão de fotos da vistoria
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setCompressing(true)
    try {
      const newCompressedPhotos: string[] = []
      for (let i = 0; i < files.length; i++) {
        if (photos.length + newCompressedPhotos.length >= 6) {
          window.alert('Limite máximo de 6 fotos por vistoria atingido.')
          break
        }
        const file = files[i]
        const compressed = await compressImageFile(file)
        newCompressedPhotos.push(compressed)
      }
      setPhotos(prev => [...prev, ...newCompressedPhotos])
    } catch (err) {
      console.error('Erro ao comprimir foto:', err)
      window.alert('Não foi possível processar a imagem.')
    } finally {
      setCompressing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  // Salvar vistoria
  const saveMutation = useMutation({
    mutationFn: async (openOrderImmediately: boolean = false) => {
      const finalClientName = clientName.trim() || 'Cliente Avulso'
      const finalPlate = vehiclePlate.trim().toUpperCase()
      const finalModel = vehicleModel.trim() || 'Não informado'
      const numMileage = parseInt(mileage, 10) || 0
      const photosJson = JSON.stringify(photos)

      let checkinId = initial?.id

      if (initial?.id) {
        await execute(
          `UPDATE checkins SET 
            client_id = ?, client_name = ?, client_phone = ?, vehicle_plate = ?, vehicle_model = ?, vehicle_type = ?, 
            unit_type = ?, mileage = ?, fuel = ?, spare_tire = ?, jack = ?, spare_key = ?, documents = ?, 
            triangle = ?, sound = ?, photos = ?, notes = ? 
           WHERE id = ?`,
          [
            selectedClient?.id || initial.client_id || null,
            finalClientName,
            clientPhone,
            finalPlate,
            finalModel,
            vehicleType,
            unitType,
            numMileage,
            fuel,
            spareTire ? 1 : 0,
            jack ? 1 : 0,
            spareKey ? 1 : 0,
            documents ? 1 : 0,
            triangle ? 1 : 0,
            sound ? 1 : 0,
            photosJson,
            notes,
            initial.id
          ]
        )
      } else {
        const res = await execute(
          `INSERT INTO checkins (
            client_id, client_name, client_phone, vehicle_id, vehicle_plate, vehicle_model, vehicle_type, 
            unit_type, mileage, fuel, spare_tire, jack, spare_key, documents, triangle, sound, photos, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            selectedClient?.id || null,
            finalClientName,
            clientPhone,
            selectedVehicleId ? parseInt(selectedVehicleId, 10) : null,
            finalPlate,
            finalModel,
            vehicleType,
            unitType,
            numMileage,
            fuel,
            spareTire ? 1 : 0,
            jack ? 1 : 0,
            spareKey ? 1 : 0,
            documents ? 1 : 0,
            triangle ? 1 : 0,
            sound ? 1 : 0,
            photosJson,
            notes
          ]
        )
        checkinId = res.lastInsertId
      }

      return {
        checkinId,
        openOrderImmediately,
        data: {
          id: checkinId,
          client_id: selectedClient?.id || null,
          client_name: finalClientName,
          client_phone: clientPhone,
          vehicle_plate: finalPlate,
          vehicle_model: finalModel,
          vehicle_type: vehicleType,
          unit_type: unitType,
          mileage: numMileage,
          fuel,
          spare_tire: spareTire ? 1 : 0,
          jack: jack ? 1 : 0,
          spare_key: spareKey ? 1 : 0,
          documents: documents ? 1 : 0,
          triangle: triangle ? 1 : 0,
          sound: sound ? 1 : 0,
          photos: photosJson,
          notes,
          checked_at: new Date().toISOString()
        } as Checkin
      }
    },
    onSuccess: result => {
      cache.invalidateQueries({ queryKey: ['checkins'] })
      if (result.openOrderImmediately && onOpenOrder) {
        onOpenOrder(result.data)
      }
      onClose()
    }
  })

  // Enviar comprovante de vistoria no WhatsApp
  function enviarWhatsApp() {
    if (!clientPhone) {
      window.alert('Informe o telefone/WhatsApp do cliente para enviar o comprovante.')
      return
    }

    const mensagem =
      `*COMPROVANTE DE ENTRADA / VISTORIA — MOTO*\n\n` +
      `🏍️ Moto: *${vehicleModel || 'Motocicleta'}* (Placa: *${vehiclePlate.toUpperCase()}*)\n` +
      `👤 Cliente: *${clientName}*\n` +
      `⏱️ ${unitType === 'horas' ? 'Horímetro' : 'Quilometragem'}: *${mileage} ${unitType}*\n` +
      `⛽ Nível do Tanque: *${fuel}*\n` +
      `🔍 Itens conferidos: ${[
        spareTire ? 'Capacete' : null,
        jack ? 'Retrovisores' : null,
        spareKey ? 'Chave Ignição' : null,
        documents ? 'Doc' : null,
        triangle ? 'Ferramentas' : null,
        sound ? 'Baú/Bagageiro' : null
      ]
        .filter(Boolean)
        .join(', ') || 'Nenhum'}\n` +
      (notes ? `📝 Obs/Avarias de entrada: ${notes}\n` : '') +
      `\nMotocicleta recebida na oficina. Cuidaremos com todo zelo!`

    openWhatsApp(clientPhone, mensagem)
  }

  const fuelLevels = ['Reserva', '1/4', '1/2', '3/4', 'Cheio']

  return (
    <Modal
      title={initial?.id ? `Vistoria / Check-in #${initial.id}` : 'Nova Vistoria / Check-in de Entrada'}
      onClose={onClose}
      wide
    >
      <div className="space-y-5">
        {/* Alternador Cliente Cadastrado vs Avulso */}
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-2 sm:p-3">
          <span className="text-xs sm:text-sm font-bold text-zinc-800">Tipo de Atendimento:</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                setIsAvulso(false)
                setSelectedClient(null)
                setClientSearch('')
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                !isAvulso ? 'bg-red-600 text-white shadow-xs' : 'text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Cliente Cadastrado
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAvulso(true)
                setSelectedClient(null)
                setClientSearch('')
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                isAvulso ? 'bg-red-600 text-white shadow-xs' : 'text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Serviço Rápido / Avulso
            </button>
          </div>
        </div>

        {/* Identificação do Cliente e Veículo */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {!isAvulso ? (
            <div className="relative sm:col-span-2">
              <Input
                label="Buscar Cliente (Nome ou Apelido) *"
                placeholder="Digite o nome ou apelido (ex: Chico, Zé...)"
                value={clientSearch}
                onChange={e => {
                  setClientSearch(e.target.value)
                  setSelectedClient(null)
                }}
              />
              {/* Dropdown de Clientes */}
              {clientSearch && !selectedClient && matchingClients.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
                  {matchingClients.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectClient(c)}
                      className="flex w-full items-center justify-between border-b border-zinc-100 px-3 py-2 text-left text-xs sm:text-sm hover:bg-zinc-50"
                    >
                      <div>
                        {c.nickname ? (
                          <span className="font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded mr-1.5">
                            {c.nickname}
                          </span>
                        ) : null}
                        <strong className="text-zinc-900">{c.name}</strong>
                      </div>
                      <span className="text-xs text-zinc-500">{c.phone || c.city}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <Input
                label="Nome ou Apelido do Cliente *"
                placeholder="Ex: Seu Zé da Patrola"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
              />
              <Input
                label="Telefone / WhatsApp (Opcional)"
                placeholder="(00) 00000-0000"
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value)}
              />
            </>
          )}

          {/* Se selecionou cliente cadastrado e ele tem veículos */}
          {!isAvulso && clientVehicles.length > 0 && (
            <Select
              label="Veículo Cadastrado do Cliente"
              value={selectedVehicleId}
              onChange={e => handleSelectVehicle(e.target.value)}
            >
              {clientVehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.plate} — {v.brand} {v.model} ({v.color})
                </option>
              ))}
            </Select>
          )}

          {/* Dados do Veículo */}
          <Input
            label="Placa *"
            placeholder="ABC-1234 ou MERCOSUL"
            value={vehiclePlate}
            onChange={e => setVehiclePlate(e.target.value)}
            className="uppercase"
          />

          <Input
            label="Modelo da Moto *"
            placeholder="Ex: CG 160 Titan/Fan, Bros 160, Biz 125, XRE 300, Fazer 250, Factor 150..."
            value={vehicleModel}
            onChange={e => setVehicleModel(e.target.value)}
          />

          <Select
            label="Tipo de Veículo"
            value={vehicleType}
            onChange={e => setVehicleType(e.target.value)}
          >
            <option value="Moto">Moto (Motocicleta)</option>
            <option value="Scooter">Scooter / CUB (Biz, Pop, PCX...)</option>
            <option value="Triciclo">Triciclo / Quadriciclo</option>
            <option value="Outro">Outro</option>
          </Select>
        </div>

        {/* Quilometragem / Horímetro e Combustível */}
        <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs sm:text-sm font-medium text-zinc-700 flex items-center gap-1.5">
                <Gauge size={16} className="text-zinc-500" />
                Medição de Uso:
              </label>
              <div className="flex rounded border border-zinc-300 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setUnitType('km')}
                  className={`px-2 py-0.5 rounded font-semibold ${
                    unitType === 'km' ? 'bg-red-600 text-white' : 'text-zinc-600'
                  }`}
                >
                  KM
                </button>
                <button
                  type="button"
                  onClick={() => setUnitType('horas')}
                  className={`px-2 py-0.5 rounded font-semibold ${
                    unitType === 'horas' ? 'bg-red-600 text-white' : 'text-zinc-600'
                  }`}
                >
                  Horas (Horímetro)
                </button>
              </div>
            </div>
            <Input
              type="number"
              placeholder={unitType === 'km' ? 'Quilometragem atual' : 'Horas de motor'}
              value={mileage}
              onChange={e => setMileage(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium text-zinc-700 flex items-center gap-1.5 mb-2">
              <Fuel size={16} className="text-zinc-500" />
              Nível do Tanque:
            </label>
            <div className="grid grid-cols-5 gap-1">
              {fuelLevels.map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setFuel(lvl)}
                  className={`rounded-lg py-2 text-xs font-bold transition border ${
                    fuel === lvl
                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Checklist Rápido de Itens Presentes na Moto */}
        <div>
          <label className="text-xs sm:text-sm font-bold text-zinc-800 block mb-2">
            Acessórios e Itens Conferidos na Moto:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { label: 'Capacete', state: spareTire, set: setSpareTire },
              { label: 'Retrovisores', state: jack, set: setJack },
              { label: 'Chave Ignição', state: spareKey, set: setSpareKey },
              { label: 'Documento', state: documents, set: setDocuments },
              { label: 'Ferramentas', state: triangle, set: setTriangle },
              { label: 'Baú / Bagageiro', state: sound, set: setSound }
            ].map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => item.set(!item.state)}
                className={`flex items-center justify-between rounded-lg border p-2 text-xs font-semibold transition ${
                  item.state
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                <span>{item.label}</span>
                {item.state ? (
                  <CheckCircle2 size={16} className="text-emerald-600" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-zinc-300" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Fotos da Vistoria com Câmera e Compressão Automática */}
        <div className="rounded-xl border border-zinc-200 p-4 bg-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="font-bold text-sm text-zinc-900 flex items-center gap-1.5">
                <Camera size={18} className="text-red-600" />
                Fotos da Vistoria / Riscos na Carenagem e Tanque ({photos.length}/6)
              </h4>
              <p className="text-xs text-zinc-500">
                Fotos comprimidas automaticamente para carregar rápido e não encher a memória.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment" // Permite abrir direto na câmera traseira do tablet/celular
                onChange={handlePhotoUpload}
                className="hidden"
                id="checkin-camera-input"
              />
              <Button
                variant="secondary"
                className="text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressing || photos.length >= 6}
              >
                {compressing ? (
                  'Otimizando foto...'
                ) : (
                  <>
                    <Camera size={16} />
                    <span>Tirar Foto / Anexar</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Grade de Miniaturas */}
          {photos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-xs text-zinc-400">
              Nenhuma foto anexada. Use a câmera do celular/tablet para registrar riscos no tanque, carenagens, amassados ou avarias antes de iniciar o serviço.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {photos.map((src, index) => (
                <div
                  key={index}
                  className="group relative aspect-square rounded-lg border border-zinc-200 overflow-hidden bg-zinc-100"
                >
                  <img
                    src={src}
                    alt={`Foto ${index + 1}`}
                    className="h-full w-full object-cover cursor-pointer hover:scale-105 transition"
                    onClick={() => setPreviewPhoto(src)}
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 rounded-full bg-red-600/90 text-white p-1 hover:bg-red-700 shadow"
                    title="Excluir foto"
                  >
                    <X size={13} />
                  </button>
                  <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">
                    Foto {index + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal de Zoom da Foto */}
        {previewPhoto && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPreviewPhoto(null)}
          >
            <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl bg-black">
              <img src={previewPhoto} alt="Foto ampliada" className="max-h-[85vh] w-auto object-contain" />
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="absolute top-2 right-2 rounded-full bg-white/20 text-white p-2 hover:bg-white/40"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Observações / Avarias Prévias */}
        <Textarea
          label="Observações da Entrada / Relato do Cliente / Avarias Visuais"
          rows={2}
          placeholder="Ex: Risco na porta traseira direita, lâmpada de farol queimada, barulho ao frear..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        {/* Rodapé com Botões de Ação */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-200">
          <div className="flex gap-2 w-full sm:w-auto">
            {clientPhone && (
              <Button
                variant="secondary"
                className="text-xs sm:text-sm text-green-700 border-green-300 hover:bg-green-50"
                onClick={enviarWhatsApp}
                title="Mandar resumo da entrada no WhatsApp do cliente"
              >
                <MessageCircle size={16} />
                <span>WhatsApp</span>
              </Button>
            )}
            <Button variant="ghost" className="text-xs sm:text-sm" onClick={() => window.print()}>
              <Printer size={16} />
              <span>Imprimir</span>
            </Button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>

            <Button
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate(false)}
              className="bg-zinc-800 hover:bg-zinc-900 text-white"
            >
              Salvar Vistoria
            </Button>

            {onOpenOrder && (
              <Button
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate(true)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Wrench size={16} />
                <span>Salvar e Abrir OS</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// Lista de Vistorias para o menu
export function CheckinsPage() {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCheckin, setSelectedCheckin] = useState<Checkin | null>(null)
  const cache = useQueryClient()

  const { data: checkins = [], isLoading } = useQuery({
    queryKey: ['checkins', search],
    queryFn: () =>
      query<Checkin>(
        `SELECT * FROM checkins 
         WHERE vehicle_plate LIKE ? OR client_name LIKE ? OR vehicle_model LIKE ? 
         ORDER BY checked_at DESC LIMIT 50`,
        [`%${search}%`, `%${search}%`, `%${search}%`]
      )
  })

  async function removeCheckin(id: number) {
    if (window.confirm('Deseja realmente excluir este registro de vistoria?')) {
      await execute('DELETE FROM checkins WHERE id = ?', [id])
      cache.invalidateQueries({ queryKey: ['checkins'] })
    }
  }

  return (
    <>
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 flex items-center gap-2">
            <Camera className="text-red-600" />
            Check-in & Vistoria de Entrada
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-zinc-500">
            Fotografe e registre o estado do veículo na chegada para proteção da oficina e agilidade no balcão.
          </p>
        </div>
        <Button onClick={() => { setSelectedCheckin(null); setDialogOpen(true); }}>
          <Plus size={18} /> Nova Vistoria
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por placa, cliente ou veículo..."
              className="w-full rounded-lg border border-zinc-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-red-600"
            />
          </div>
          <span className="text-xs font-semibold text-zinc-500">{checkins.length} vistoria(s) registrada(s)</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-zinc-500">Carregando vistorias...</div>
        ) : checkins.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400">
            Nenhuma vistoria registrada ainda. Clique em "Nova Vistoria" para registrar a entrada de um veículo com fotos e
            checklist.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs sm:text-sm">
              <thead className="bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-500 font-bold border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-3">Data / Hora</th>
                  <th className="px-4 py-3">Placa / Veículo</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Uso / Tanque</th>
                  <th className="px-4 py-3">Fotos</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {checkins.map(item => {
                  let photosCount = 0
                  try {
                    photosCount = JSON.parse(item.photos || '[]').length
                  } catch {
                    photosCount = 0
                  }

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/60 transition">
                      <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{dateTime(item.checked_at)}</td>
                      <td className="px-4 py-3">
                        <strong className="text-zinc-950 font-bold">{item.vehicle_plate}</strong>
                        <p className="text-xs text-zinc-500">{item.vehicle_model}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-zinc-900">{item.client_name || 'Avulso'}</span>
                        {item.client_phone && <p className="text-xs text-zinc-500">{item.client_phone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-zinc-800 font-medium">
                          {item.mileage} {item.unit_type || 'km'}
                        </span>
                        <p className="text-xs text-amber-700 font-semibold">Tanque: {item.fuel || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold ${
                            photosCount > 0 ? 'bg-sky-100 text-sky-800' : 'bg-zinc-100 text-zinc-500'
                          }`}
                        >
                          <ImageIcon size={13} />
                          {photosCount} foto(s)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            className="px-2.5 py-1 text-xs"
                            onClick={() => {
                              setSelectedCheckin(item)
                              setDialogOpen(true)
                            }}
                          >
                            Ver / Editar
                          </Button>
                          <button
                            type="button"
                            onClick={() => removeCheckin(item.id)}
                            className="rounded p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50"
                            title="Excluir vistoria"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialogOpen && (
        <CheckinDialog
          initial={selectedCheckin}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  )
}
