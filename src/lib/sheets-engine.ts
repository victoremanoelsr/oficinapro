import initSqlJs, { Database as SqlDatabase } from 'sql.js'

export type SyncState = {
  isConfigured: boolean
  isSyncing: boolean
  lastSync: string | null
  statusText: string
  error: string | null
}

const STORAGE_KEY_DB = 'oficina_facil_sqlite_binary'
const STORAGE_KEY_CONFIG = 'oficina_facil_sheets_config'

type SheetsConfig = {
  webAppUrl: string
  autoSync: boolean
  workshopName?: string
  pixKey?: string
}

let dbInstance: SqlDatabase | null = null
let dbInitPromise: Promise<SqlDatabase> | null = null

const syncListeners = new Set<(state: SyncState) => void>()
let currentSyncState: SyncState = {
  isConfigured: false,
  isSyncing: false,
  lastSync: null,
  statusText: 'Iniciando banco de dados local...',
  error: null
}

export function subscribeSyncState(listener: (state: SyncState) => void) {
  syncListeners.add(listener)
  listener(currentSyncState)
  return () => {
    syncListeners.delete(listener)
  }
}

function updateSyncState(patch: Partial<SyncState>) {
  currentSyncState = { ...currentSyncState, ...patch }
  syncListeners.forEach(fn => fn(currentSyncState))
}

export function getSheetsConfig(): SheetsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG)
    if (raw) return JSON.parse(raw)
  } catch {
    // fallback
  }
  return { webAppUrl: '', autoSync: true }
}

export function saveSheetsConfig(config: SheetsConfig) {
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config))
  updateSyncState({
    isConfigured: Boolean(config.webAppUrl?.trim())
  })
}

const CREATE_TABLES_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  workshop_name TEXT NOT NULL DEFAULT 'Oficina Pro',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  printer TEXT DEFAULT '',
  logo_data TEXT DEFAULT '',
  primary_color TEXT DEFAULT '#b91c1c',
  sidebar_color TEXT DEFAULT '#b91c1c',
  background_color TEXT DEFAULT '#f4f4f5',
  sidebar_background_color TEXT DEFAULT '#18181b',
  card_color TEXT DEFAULT '#ffffff',
  theme_mode TEXT DEFAULT 'Claro',
  pix_key TEXT DEFAULT '',
  city_default TEXT DEFAULT 'São Miguel da Baixa Grande - PI'
);
INSERT OR IGNORE INTO settings (id, workshop_name) VALUES (1, 'Oficina Pro');

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  city TEXT DEFAULT '',
  document TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  nickname TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  model TEXT NOT NULL,
  brand TEXT DEFAULT '',
  year TEXT DEFAULT '',
  color TEXT DEFAULT '',
  vehicle_type TEXT DEFAULT 'Moto'
);

CREATE TABLE IF NOT EXISTS parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT DEFAULT '',
  quantity REAL NOT NULL DEFAULT 0,
  purchase_price REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  minimum_stock REAL NOT NULL DEFAULT 0,
  archived_at TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS service_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  mileage INTEGER DEFAULT 0,
  complaint TEXT DEFAULT '',
  diagnosis TEXT DEFAULT '',
  service_done TEXT DEFAULT '',
  labor_value REAL NOT NULL DEFAULT 0,
  parts_value REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Aberta',
  entered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finalized_at TEXT,
  budget_id INTEGER DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS service_order_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  part_id INTEGER REFERENCES parts(id),
  item_name TEXT DEFAULT '',
  item_brand TEXT DEFAULT '',
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES clients(id),
  client_name TEXT DEFAULT '',
  client_phone TEXT DEFAULT '',
  vehicle_id INTEGER REFERENCES vehicles(id),
  vehicle_plate TEXT DEFAULT '',
  vehicle_model TEXT DEFAULT '',
  vehicle_type TEXT DEFAULT 'Carro',
  unit_type TEXT DEFAULT 'km',
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  mileage INTEGER DEFAULT 0,
  fuel TEXT DEFAULT '',
  bodywork TEXT DEFAULT '',
  windshield TEXT DEFAULT '',
  headlights TEXT DEFAULT '',
  taillights TEXT DEFAULT '',
  mirrors TEXT DEFAULT '',
  tires TEXT DEFAULT '',
  spare_tire INTEGER DEFAULT 0,
  jack INTEGER DEFAULT 0,
  spare_key INTEGER DEFAULT 0,
  documents INTEGER DEFAULT 0,
  triangle INTEGER DEFAULT 0,
  sound INTEGER DEFAULT 0,
  photos TEXT DEFAULT '[]',
  notes TEXT DEFAULT '',
  service_order_id INTEGER REFERENCES service_orders(id)
);

CREATE TABLE IF NOT EXISTS customer_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  service_order_id INTEGER REFERENCES service_orders(id),
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT NOT NULL,
  payment_method TEXT DEFAULT 'Dinheiro',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  service_order_id INTEGER REFERENCES service_orders(id),
  client_id INTEGER REFERENCES clients(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT DEFAULT 'Dinheiro',
  installments INTEGER DEFAULT 1,
  installment_number INTEGER DEFAULT 1,
  due_date TEXT,
  paid_at TEXT,
  status TEXT NOT NULL DEFAULT 'Pago',
  category TEXT DEFAULT 'Serviço',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  supplier TEXT DEFAULT '',
  amount REAL NOT NULL,
  due_date TEXT NOT NULL,
  category TEXT DEFAULT 'Despesa fixa',
  status TEXT NOT NULL DEFAULT 'Pendente',
  paid_at TEXT DEFAULT NULL,
  barcode TEXT DEFAULT '',
  pix_key TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  client_id INTEGER REFERENCES clients(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  contact_name TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  contact_whatsapp TEXT DEFAULT '',
  contact_document TEXT DEFAULT '',
  contact_address TEXT DEFAULT '',
  vehicle_brand TEXT DEFAULT '',
  vehicle_model TEXT DEFAULT '',
  vehicle_year TEXT DEFAULT '',
  vehicle_plate TEXT DEFAULT '',
  vehicle_color TEXT DEFAULT '',
  vehicle_mileage INTEGER DEFAULT 0,
  vehicle_notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Rascunho',
  parts_subtotal REAL DEFAULT 0,
  services_subtotal REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  addition REAL DEFAULT 0,
  total REAL DEFAULT 0,
  notes TEXT DEFAULT '',
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valid_until TEXT,
  approved_at TEXT,
  rejected_at TEXT,
  reactivated_at TEXT,
  cancelled_at TEXT,
  rejection_reason TEXT DEFAULT '',
  service_order_id INTEGER REFERENCES service_orders(id)
);

CREATE TABLE IF NOT EXISTS budget_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  part_id INTEGER REFERENCES parts(id),
  item_name TEXT NOT NULL,
  item_brand TEXT DEFAULT '',
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS budget_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS budget_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  detail TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS part_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  part_id INTEGER REFERENCES parts(id),
  description TEXT NOT NULL,
  requested_quantity REAL NOT NULL DEFAULT 1,
  priority TEXT NOT NULL DEFAULT 'Normal',
  status TEXT NOT NULL DEFAULT 'Pendente',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id INTEGER REFERENCES parts(id),
  movement_type TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL DEFAULT 0,
  unit_price REAL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_client ON vehicles(client_id);
CREATE INDEX IF NOT EXISTS idx_bills_due ON bills(due_date);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON financial_transactions(status);
`

function saveDatabaseToStorage(db: SqlDatabase) {
  try {
    const binary = db.export()
    const str = uint8ArrayToBase64(binary)
    localStorage.setItem(STORAGE_KEY_DB, str)
  } catch (err) {
    console.error('Falha ao salvar banco local no storage:', err)
  }
}

function loadDatabaseFromStorage(): Uint8Array | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DB)
    if (raw) return base64ToUint8Array(raw)
  } catch (err) {
    console.error('Falha ao carregar banco local do storage:', err)
  }
  return null
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

export async function getWebDatabase(): Promise<SqlDatabase> {
  if (dbInstance) return dbInstance
  if (dbInitPromise) return dbInitPromise

  dbInitPromise = (async () => {
    try {
      const SQL = await initSqlJs({
        locateFile: () => '/sql-wasm.wasm'
      })

      const existingData = loadDatabaseFromStorage()
      const db = existingData ? new SQL.Database(existingData) : new SQL.Database()

      db.run(CREATE_TABLES_SQL)

      // Migração suave de colunas adicionadas
      const migrations = [
        "ALTER TABLE clients ADD COLUMN nickname TEXT DEFAULT ''",
        "ALTER TABLE vehicles ADD COLUMN vehicle_type TEXT DEFAULT 'Moto'",
        "ALTER TABLE bills ADD COLUMN barcode TEXT DEFAULT ''",
        "ALTER TABLE bills ADD COLUMN pix_key TEXT DEFAULT ''",
        "ALTER TABLE bills ADD COLUMN notes TEXT DEFAULT ''",
        "ALTER TABLE settings ADD COLUMN pix_key TEXT DEFAULT ''",
        "ALTER TABLE settings ADD COLUMN city_default TEXT DEFAULT 'São Miguel da Baixa Grande - PI'",
        "CREATE TABLE IF NOT EXISTS customer_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL REFERENCES clients(id), service_order_id INTEGER, type TEXT NOT NULL, amount REAL NOT NULL, description TEXT NOT NULL, payment_method TEXT DEFAULT 'Dinheiro', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        "ALTER TABLE checkins ADD COLUMN client_id INTEGER DEFAULT NULL",
        "ALTER TABLE checkins ADD COLUMN client_name TEXT DEFAULT ''",
        "ALTER TABLE checkins ADD COLUMN client_phone TEXT DEFAULT ''",
        "ALTER TABLE checkins ADD COLUMN vehicle_plate TEXT DEFAULT ''",
        "ALTER TABLE checkins ADD COLUMN vehicle_model TEXT DEFAULT ''",
        "ALTER TABLE checkins ADD COLUMN vehicle_type TEXT DEFAULT 'Carro'",
        "ALTER TABLE checkins ADD COLUMN unit_type TEXT DEFAULT 'km'",
        "ALTER TABLE checkins ADD COLUMN triangle INTEGER DEFAULT 0",
        "ALTER TABLE checkins ADD COLUMN sound INTEGER DEFAULT 0",
        "ALTER TABLE checkins ADD COLUMN photos TEXT DEFAULT '[]'",
        "ALTER TABLE checkins ADD COLUMN service_order_id INTEGER DEFAULT NULL"
      ]
      for (const m of migrations) {
        try { db.run(m) } catch { /* coluna ou tabela já existe */ }
      }

      dbInstance = db
      saveDatabaseToStorage(db)

      const config = getSheetsConfig()
      const isConfigured = Boolean(config.webAppUrl?.trim())
      updateSyncState({
        isConfigured,
        statusText: isConfigured ? 'Pronto (Google Sheets configurado)' : 'Modo local pronto (salvando no dispositivo)'
      })

      // Sincroniza em background se configurado
      if (isConfigured && config.autoSync) {
        setTimeout(() => syncWithGoogleSheets().catch(console.error), 1200)
      }

      return db
    } catch (error) {
      console.error('Erro ao inicializar SQL.js:', error)
      updateSyncState({ error: String(error), statusText: 'Erro ao carregar banco local' })
      throw error
    }
  })()

  return dbInitPromise
}

function toSqlValues(values: unknown[]): (string | number | null | Uint8Array)[] {
  return values.map(v => {
    if (v === undefined || v === null) return null
    if (typeof v === 'number' || typeof v === 'string') return v
    if (typeof v === 'boolean') return v ? 1 : 0
    if (v instanceof Uint8Array) return v
    return String(v)
  })
}

export async function executeWebQuery<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  const db = await getWebDatabase()
  try {
    const stmt = db.prepare(sql)
    stmt.bind(toSqlValues(values))
    const results: T[] = []
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T)
    }
    stmt.free()
    return results
  } catch (error) {
    console.error(`Erro ao executar query SQL: ${sql}`, values, error)
    throw error
  }
}

export async function executeWebStatement(sql: string, values: unknown[] = []): Promise<{ rowsAffected: number; lastInsertId: number }> {
  const db = await getWebDatabase()
  try {
    db.run(sql, toSqlValues(values))
    const lastIdRes = db.exec('SELECT last_insert_rowid() AS id')
    const lastInsertId = Number(lastIdRes[0]?.values[0]?.[0] ?? 0)
    const changesRes = db.exec('SELECT changes() AS affected')
    const rowsAffected = Number(changesRes[0]?.values[0]?.[0] ?? 1)

    saveDatabaseToStorage(db)
    triggerDebouncedSheetsSync()

    return { rowsAffected, lastInsertId }
  } catch (error) {
    console.error(`Erro ao executar instrução SQL: ${sql}`, values, error)
    throw error
  }
}

let syncTimeout: ReturnType<typeof setTimeout> | null = null
function triggerDebouncedSheetsSync() {
  const config = getSheetsConfig()
  if (!config.webAppUrl?.trim() || !config.autoSync) return

  if (syncTimeout) clearTimeout(syncTimeout)
  syncTimeout = setTimeout(() => {
    syncWithGoogleSheets().catch(err => console.warn('Sync em segundo plano falhou:', err))
  }, 3500)
}

const TABLES_TO_SYNC = [
  'settings',
  'clients',
  'vehicles',
  'parts',
  'service_orders',
  'service_order_parts',
  'checkins',
  'financial_transactions',
  'bills',
  'budgets',
  'budget_parts',
  'budget_services',
  'part_requests',
  'stock_movements',
  'customer_ledger'
]

export async function syncWithGoogleSheets(forcePull = false): Promise<{ success: boolean; message: string }> {
  const config = getSheetsConfig()
  if (!config.webAppUrl?.trim()) {
    updateSyncState({
      isConfigured: false,
      statusText: 'Google Sheets não configurado (dados salvos localmente)'
    })
    return { success: false, message: 'URL do Google Sheets não configurada.' }
  }

  updateSyncState({ isSyncing: true, statusText: 'Sincronizando com o Google Sheets...' })

  try {
    const db = await getWebDatabase()

    if (forcePull) {
      const response = await fetch(`${config.webAppUrl}?action=get_all`, {
        method: 'GET'
      })
      if (!response.ok) throw new Error(`Servidor do Google Sheets respondeu com erro ${response.status}`)
      const json = await response.json()
      if (json.status === 'ok' && json.data) {
        importAllTablesToSql(db, json.data)
        saveDatabaseToStorage(db)
        const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        updateSyncState({
          isSyncing: false,
          lastSync: now,
          statusText: `Sincronizado com o Google Sheets às ${now}`,
          error: null
        })
        return { success: true, message: `Dados atualizados da planilha com sucesso às ${now}!` }
      }
    }

    // Exporta todas as tabelas locais em JSON
    const payload: Record<string, unknown[]> = {}
    for (const table of TABLES_TO_SYNC) {
      try {
        const stmt = db.prepare(`SELECT * FROM ${table}`)
        const rows: unknown[] = []
        while (stmt.step()) {
          rows.push(stmt.getAsObject())
        }
        stmt.free()
        payload[table] = rows
      } catch {
        payload[table] = []
      }
    }

    const response = await fetch(config.webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'sync_all',
        timestamp: new Date().toISOString(),
        tables: payload
      })
    })

    if (!response.ok) {
      throw new Error(`Erro na conexão com o Google Sheets (${response.status})`)
    }

    const resJson = await response.json().catch(() => ({ status: 'ok' }))
    if (resJson.status === 'error') {
      throw new Error(resJson.message || 'Erro no script do Google Sheets')
    }

    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    updateSyncState({
      isSyncing: false,
      lastSync: now,
      statusText: `Salvo no Google Sheets às ${now}`,
      error: null
    })

    return { success: true, message: `Planilha atualizada com sucesso às ${now}!` }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Falha ao sincronizar'
    console.error('Erro de sincronização com Google Sheets:', error)
    updateSyncState({
      isSyncing: false,
      statusText: 'Aviso: Trabalhando offline (salvo neste dispositivo)',
      error: errMsg
    })
    return { success: false, message: `Não foi possível salvar na nuvem: ${errMsg}. Seus dados estão preservados com segurança neste dispositivo!` }
  }
}

function importAllTablesToSql(db: SqlDatabase, data: Record<string, Record<string, unknown>[]>) {
  for (const [table, rows] of Object.entries(data)) {
    if (!TABLES_TO_SYNC.includes(table) || !Array.isArray(rows)) continue
    try {
      db.run(`DELETE FROM ${table}`)
      if (rows.length === 0) continue
      const sample = rows[0]
      const keys = Object.keys(sample)
      const placeholders = keys.map(() => '?').join(',')
      const insertSql = `INSERT OR REPLACE INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`
      for (const row of rows) {
        const values = keys.map(k => row[k] ?? null)
        try {
          db.run(insertSql, toSqlValues(values))
        } catch (rowErr) {
          console.warn(`Erro ao importar linha na tabela ${table}:`, rowErr)
        }
      }
    } catch (tableErr) {
      console.warn(`Erro ao importar tabela ${table}:`, tableErr)
    }
  }
}

export function exportBackupJson(): string {
  if (!dbInstance) return '{}'
  const payload: Record<string, unknown[]> = {}
  for (const table of TABLES_TO_SYNC) {
    try {
      const stmt = dbInstance.prepare(`SELECT * FROM ${table}`)
      const rows: unknown[] = []
      while (stmt.step()) {
        rows.push(stmt.getAsObject())
      }
      stmt.free()
      payload[table] = rows
    } catch {
      payload[table] = []
    }
  }
  return JSON.stringify({
    app: 'Oficina Pro',
    exported_at: new Date().toISOString(),
    tables: payload
  }, null, 2)
}

export async function importBackupJson(jsonString: string): Promise<void> {
  const parsed = JSON.parse(jsonString)
  if (!parsed.tables) throw new Error('Arquivo de backup inválido.')
  const db = await getWebDatabase()
  importAllTablesToSql(db, parsed.tables)
  saveDatabaseToStorage(db)
  triggerDebouncedSheetsSync()
}

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * OFICINA PRO - BACKEND GOOGLE SHEETS
 * Sistema Web para Oficina Mecânica
 * 
 * COMO USAR:
 * 1. Abra o Google Sheets (planilhas.google.com) e crie uma planilha nova chamada "Oficina Pro".
 * 2. Clique em "Extensões" > "Apps Script".
 * 3. Apague tudo que estiver lá e cole este código completo.
 * 4. Clique em "Implantar" (canto superior direito) > "Nova implantação".
 * 5. Clique no ícone de engrenagem ao lado de "Tipo" e selecione "App da Web".
 * 6. Em "Executar como": deixe "Eu (seu email)".
 * 7. Em "Quem tem acesso": selecione "Qualquer pessoa" (ou "Qualquer um").
 * 8. Clique em "Implantar" e autorize as permissões da sua conta Google.
 * 9. Copie o "URL do aplicativo da Web" gerado e cole nas Configurações do seu Oficina Pro!
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'ping';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'ping') {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Oficina Pro Sheets Backend funcionando perfeitamente!',
      time: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'get_all') {
    var data = {};
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      var name = sheet.getName();
      data[name] = readSheetRows(sheet);
    }
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      data: data
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'unknown_action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var contents = e.postData.contents;
    var payload = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (payload.action === 'sync_all' && payload.tables) {
      var tables = payload.tables;
      for (var tableName in tables) {
        if (tables.hasOwnProperty(tableName)) {
          var rows = tables[tableName];
          writeSheetRows(ss, tableName, rows);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        message: 'Todas as tabelas sincronizadas com sucesso!',
        synced_at: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function readSheetRows(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var rows = [];
  
  for (var r = 0; r < values.length; r++) {
    var rowObj = {};
    var hasData = false;
    for (var c = 0; c < headers.length; c++) {
      var val = values[r][c];
      if (val !== '' && val !== null) hasData = true;
      rowObj[headers[c]] = val;
    }
    if (hasData) rows.push(rowObj);
  }
  return rows;
}

function writeSheetRows(ss, tableName, rows) {
  var sheet = ss.getSheetByName(tableName);
  if (!sheet) {
    sheet = ss.insertSheet(tableName);
  }
  
  sheet.clearContents();
  if (!rows || rows.length === 0) return;
  
  // Extrai cabeçalhos de forma consistente
  var headers = [];
  for (var i = 0; i < rows.length; i++) {
    var keys = Object.keys(rows[i]);
    for (var k = 0; k < keys.length; k++) {
      if (headers.indexOf(keys[k]) === -1) {
        headers.push(keys[k]);
      }
    }
  }
  if (headers.length === 0) return;
  
  // Escreve cabeçalhos com formatação bonita
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1f2937')
    .setFontColor('#ffffff');
  
  // Monta matriz de dados
  var data = [];
  for (var r = 0; r < rows.length; r++) {
    var rowArr = [];
    for (var c = 0; c < headers.length; c++) {
      var item = rows[r][headers[c]];
      if (item === undefined || item === null) {
        rowArr.push('');
      } else if (typeof item === 'object') {
        rowArr.push(JSON.stringify(item));
      } else {
        rowArr.push(item);
      }
    }
    data.push(rowArr);
  }
  
  if (data.length > 0) {
    sheet.getRange(2, 1, data.length, headers.length).setValues(data);
  }
  
  // Ajusta largura básica das colunas
  try {
    sheet.autoResizeColumns(1, headers.length);
  } catch(e) {}
}
`
