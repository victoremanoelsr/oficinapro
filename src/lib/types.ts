export type Client = {
  id: number
  name: string
  phone: string
  city: string
  document: string
  notes: string
  nickname?: string
}

export type Vehicle = {
  id: number
  client_id: number
  plate: string
  model: string
  brand: string
  year: string
  color: string
  vehicle_type?: 'Moto' | 'Carro' | 'Caminhonete' | 'Utilitário' | 'Outro'
  client_name?: string
}

export type Part = {
  id: number
  code: string
  name: string
  brand: string
  quantity: number
  purchase_price: number
  sale_price: number
  minimum_stock: number
}

export type Order = {
  id: number
  number: string
  client_id: number
  vehicle_id: number
  client_name: string
  nickname?: string
  plate: string
  vehicle: string
  mileage: number
  complaint: string
  diagnosis: string
  service_done: string
  labor_value: number
  parts_value: number
  total: number
  status: OrderStatus
  entered_at: string
  finalized_at: string | null
  budget_id?: number | null
}

export type OrderStatus = 'Aberta' | 'Em manutenção' | 'Aguardando peças' | 'Serviço finalizado' | 'Finalizada'

export type CashEntry = {
  id: number
  type: 'Entrada' | 'Saída' | 'Receber' | 'Pagar'
  description: string
  value: number
  due_date: string | null
  paid_at: string | null
  created_at: string
}

export type Bill = {
  id: number
  description: string
  supplier: string
  amount: number
  due_date: string
  category: string
  status: 'Pendente' | 'Pago'
  paid_at: string | null
  barcode?: string
  pix_key?: string
  notes?: string
  created_at?: string
}

export type Settings = {
  id: 1
  workshop_name: string
  address: string
  phone: string
  printer: string
  logo_data: string
  primary_color: string
  sidebar_color: string
  background_color: string
  sidebar_background_color: string
  card_color: string
  theme_mode: 'Claro' | 'Escuro'
  pix_key?: string
  city_default?: string
  google_sheets_url?: string
}

export type BudgetStatus = 'Rascunho' | 'Pendente' | 'Aprovado' | 'Recusado' | 'Convertido em OS' | 'Cancelado'

export type Budget = {
  id: number
  number: string
  client_id: number | null
  vehicle_id: number | null
  client_name?: string
  vehicle?: string
  contact_name: string
  contact_phone: string
  contact_whatsapp: string
  contact_document: string
  contact_address: string
  vehicle_brand: string
  vehicle_model: string
  vehicle_year: string
  vehicle_plate: string
  vehicle_color: string
  vehicle_mileage: number
  vehicle_notes: string
  status: BudgetStatus
  parts_subtotal: number
  services_subtotal: number
  discount: number
  addition: number
  total: number
  notes: string
  issued_at: string
  valid_until: string | null
  approved_at: string | null
  rejected_at: string | null
  reactivated_at: string | null
  cancelled_at: string | null
  rejection_reason: string
  service_order_id: number | null
  service_order_number?: string
}

export type CustomerLedgerEntry = {
  id: number
  client_id: number
  service_order_id?: number | null
  type: 'Debito' | 'Credito'
  amount: number
  description: string
  payment_method?: string
  created_at: string
}

export type Checkin = {
  id: number
  client_id?: number | null
  client_name: string
  client_phone?: string
  vehicle_plate: string
  vehicle_model: string
  vehicle_type?: string
  checked_at: string
  mileage: number
  unit_type?: 'km' | 'horas'
  fuel: string
  spare_tire: number
  jack: number
  spare_key: number
  documents: number
  triangle: number
  sound: number
  notes: string
  photos: string // JSON com array de imagens em base64 compactadas
  service_order_id?: number | null
}
