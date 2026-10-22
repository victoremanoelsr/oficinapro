import { createServer } from 'node:http'
import { copyFileSync, readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const appRoot = dirname(fileURLToPath(import.meta.url))
const staticRoot = join(appRoot, 'dist')
const dataRoot = process.argv[2] || process.env.OFICINA_PRO_DATA_DIR || join(process.env.APPDATA || appRoot, 'Oficina Pro')
const appVersion = '1.9.6'
const schemaVersion = 10900
mkdirSync(dataRoot, { recursive: true })

const databasePath = join(dataRoot, 'oficina-pro.db')
const databaseExisted = existsSync(databasePath)
let database = new DatabaseSync(databasePath)
const currentSchemaVersion = Number(database.prepare('PRAGMA user_version').get().user_version || 0)
if (databaseExisted && currentSchemaVersion < schemaVersion) {
  database.close()
  const backupPath = join(dataRoot, `oficina-pro-backup-antes-migracao-${new Date().toISOString().replace(/[:.]/g, '-')}.db`)
  copyFileSync(databasePath, backupPath)
  database = new DatabaseSync(databasePath)
}
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    workshop_name TEXT NOT NULL DEFAULT 'Oficina Pro',
    address TEXT DEFAULT '', phone TEXT DEFAULT '', printer TEXT DEFAULT '', logo_data TEXT DEFAULT '',
    primary_color TEXT DEFAULT '#b91c1c', sidebar_color TEXT DEFAULT '#b91c1c', background_color TEXT DEFAULT '#f4f4f5',
    sidebar_background_color TEXT DEFAULT '#18181b', card_color TEXT DEFAULT '#ffffff', theme_mode TEXT DEFAULT 'Claro'
  );
  INSERT OR IGNORE INTO settings (id, workshop_name) VALUES (1, 'Oficina Pro');
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, phone TEXT DEFAULT '', city TEXT DEFAULT '',
    document TEXT DEFAULT '', notes TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    plate TEXT NOT NULL, model TEXT NOT NULL, brand TEXT DEFAULT '', year TEXT DEFAULT '', color TEXT DEFAULT '',
    UNIQUE(client_id, plate)
  );
  CREATE TABLE IF NOT EXISTS parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, brand TEXT DEFAULT '', quantity REAL NOT NULL DEFAULT 0,
    purchase_price REAL NOT NULL DEFAULT 0, sale_price REAL NOT NULL DEFAULT 0, minimum_stock REAL NOT NULL DEFAULT 0, archived_at TEXT
  );
  CREATE TABLE IF NOT EXISTS service_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT NOT NULL UNIQUE,
    client_id INTEGER NOT NULL REFERENCES clients(id), vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
    mileage INTEGER DEFAULT 0, complaint TEXT DEFAULT '', diagnosis TEXT DEFAULT '', service_done TEXT DEFAULT '',
    labor_value REAL NOT NULL DEFAULT 0, parts_value REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Aberta', entered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finalized_at TEXT,
    budget_id INTEGER REFERENCES budgets(id)
  );
  CREATE TABLE IF NOT EXISTS service_order_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    part_id INTEGER REFERENCES parts(id), quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0,
    item_name TEXT DEFAULT '', item_brand TEXT DEFAULT '', unit_cost REAL NOT NULL DEFAULT 0, subtotal REAL NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id INTEGER REFERENCES parts(id), movement_type TEXT NOT NULL CHECK (movement_type IN ('Entrada','Saída')),
    item_name TEXT NOT NULL, quantity REAL NOT NULL, unit_cost REAL NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL DEFAULT 0, total_cost REAL NOT NULL DEFAULT 0, occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id), checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mileage INTEGER DEFAULT 0, fuel TEXT DEFAULT '', bodywork TEXT DEFAULT '', windshield TEXT DEFAULT '',
    headlights TEXT DEFAULT '', taillights TEXT DEFAULT '', mirrors TEXT DEFAULT '', tires TEXT DEFAULT '',
    spare_tire INTEGER DEFAULT 0, jack INTEGER DEFAULT 0, spare_key INTEGER DEFAULT 0,
    documents INTEGER DEFAULT 0, notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS cash_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('Entrada','Saída','Receber','Pagar')),
    description TEXT NOT NULL, value REAL NOT NULL, due_date TEXT, paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS part_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    part_id INTEGER REFERENCES parts(id),
    description TEXT NOT NULL,
    requested_quantity REAL NOT NULL DEFAULT 1,
    priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Urgente','Alta','Normal')),
    status TEXT NOT NULL DEFAULT 'Pendente',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS financial_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('Recebimento','Saída')),
    service_order_id INTEGER REFERENCES service_orders(id),
    client_id INTEGER REFERENCES clients(id),
    vehicle_id INTEGER REFERENCES vehicles(id),
    description TEXT NOT NULL, amount REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'Dinheiro',
    installments INTEGER NOT NULL DEFAULT 1, installment_number INTEGER NOT NULL DEFAULT 1,
    due_date TEXT, paid_at TEXT,
    status TEXT NOT NULL DEFAULT 'Pago' CHECK (status IN ('Pago','Pendente')),
    category TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL, supplier TEXT DEFAULT '', amount REAL NOT NULL,
    due_date TEXT NOT NULL, category TEXT DEFAULT 'Despesa fixa',
    status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente','Pago')),
    paid_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT NOT NULL UNIQUE,
    client_id INTEGER REFERENCES clients(id), vehicle_id INTEGER REFERENCES vehicles(id),
    contact_name TEXT NOT NULL DEFAULT '', contact_phone TEXT DEFAULT '', contact_whatsapp TEXT DEFAULT '',
    contact_document TEXT DEFAULT '', contact_address TEXT DEFAULT '',
    vehicle_brand TEXT DEFAULT '', vehicle_model TEXT DEFAULT '', vehicle_year TEXT DEFAULT '',
    vehicle_plate TEXT DEFAULT '', vehicle_color TEXT DEFAULT '', vehicle_mileage INTEGER DEFAULT 0, vehicle_notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Rascunho' CHECK (status IN ('Rascunho','Pendente','Aprovado','Recusado','Convertido em OS','Cancelado')),
    parts_subtotal REAL NOT NULL DEFAULT 0, services_subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0, addition REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '', issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, valid_until TEXT,
    approved_at TEXT, rejected_at TEXT, reactivated_at TEXT, cancelled_at TEXT, rejection_reason TEXT DEFAULT '',
    service_order_id INTEGER UNIQUE REFERENCES service_orders(id)
  );
  CREATE TABLE IF NOT EXISTS budget_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    part_id INTEGER REFERENCES parts(id), item_name TEXT NOT NULL, item_brand TEXT DEFAULT '',
    quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0, unit_cost REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0, subtotal REAL NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS budget_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT, budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0, subtotal REAL NOT NULL DEFAULT 0, notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS budget_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    event TEXT NOT NULL, detail TEXT DEFAULT '', occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_orders_status ON service_orders(status);
  CREATE INDEX IF NOT EXISTS idx_vehicles_client ON vehicles(client_id);
  CREATE INDEX IF NOT EXISTS idx_part_requests_status ON part_requests(status);
  CREATE INDEX IF NOT EXISTS idx_financial_transactions_status ON financial_transactions(status);
  CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
  CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status);
  CREATE INDEX IF NOT EXISTS idx_budgets_client ON budgets(client_id);
`)

const settingsColumns = database.prepare('PRAGMA table_info(settings)').all()
if (!settingsColumns.some((column) => column.name === 'logo_data')) {
  database.exec("ALTER TABLE settings ADD COLUMN logo_data TEXT DEFAULT ''")
}
if (!settingsColumns.some((column) => column.name === 'primary_color')) database.exec("ALTER TABLE settings ADD COLUMN primary_color TEXT DEFAULT '#b91c1c'")
if (!settingsColumns.some((column) => column.name === 'sidebar_color')) database.exec("ALTER TABLE settings ADD COLUMN sidebar_color TEXT DEFAULT '#b91c1c'")
if (!settingsColumns.some((column) => column.name === 'background_color')) database.exec("ALTER TABLE settings ADD COLUMN background_color TEXT DEFAULT '#f4f4f5'")
if (!settingsColumns.some((column) => column.name === 'sidebar_background_color')) database.exec("ALTER TABLE settings ADD COLUMN sidebar_background_color TEXT DEFAULT '#18181b'")
if (!settingsColumns.some((column) => column.name === 'card_color')) database.exec("ALTER TABLE settings ADD COLUMN card_color TEXT DEFAULT '#ffffff'")
if (!settingsColumns.some((column) => column.name === 'theme_mode')) database.exec("ALTER TABLE settings ADD COLUMN theme_mode TEXT DEFAULT 'Claro'")
const requestColumns = database.prepare('PRAGMA table_info(part_requests)').all()
if (!requestColumns.some((column) => column.name === 'part_id')) database.exec('ALTER TABLE part_requests ADD COLUMN part_id INTEGER REFERENCES parts(id)')
if (!requestColumns.some((column) => column.name === 'requested_quantity')) database.exec('ALTER TABLE part_requests ADD COLUMN requested_quantity REAL NOT NULL DEFAULT 1')
const partColumns = database.prepare('PRAGMA table_info(parts)').all()
if (!partColumns.some((column) => column.name === 'archived_at')) database.exec('ALTER TABLE parts ADD COLUMN archived_at TEXT')
const orderPartColumns = database.prepare('PRAGMA table_info(service_order_parts)').all()
if (!orderPartColumns.some((column) => column.name === 'item_name')) database.exec("ALTER TABLE service_order_parts ADD COLUMN item_name TEXT DEFAULT ''")
if (!orderPartColumns.some((column) => column.name === 'item_brand')) database.exec("ALTER TABLE service_order_parts ADD COLUMN item_brand TEXT DEFAULT ''")
if (!orderPartColumns.some((column) => column.name === 'unit_cost')) database.exec('ALTER TABLE service_order_parts ADD COLUMN unit_cost REAL NOT NULL DEFAULT 0')
if (!orderPartColumns.some((column) => column.name === 'subtotal')) database.exec('ALTER TABLE service_order_parts ADD COLUMN subtotal REAL NOT NULL DEFAULT 0')
database.exec(`UPDATE service_order_parts SET item_name=COALESCE(NULLIF(item_name,''),(SELECT name FROM parts WHERE parts.id=service_order_parts.part_id),''), item_brand=COALESCE(NULLIF(item_brand,''),(SELECT brand FROM parts WHERE parts.id=service_order_parts.part_id),''), unit_cost=CASE WHEN unit_cost=0 THEN COALESCE((SELECT purchase_price FROM parts WHERE parts.id=service_order_parts.part_id),0) ELSE unit_cost END, subtotal=CASE WHEN subtotal=0 THEN quantity*unit_price ELSE subtotal END`)
const orderColumns = database.prepare('PRAGMA table_info(service_orders)').all()
if (!orderColumns.some((column) => column.name === 'budget_id')) database.exec('ALTER TABLE service_orders ADD COLUMN budget_id INTEGER REFERENCES budgets(id)')
database.exec(`PRAGMA user_version = ${schemaVersion}`)

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
}

const jsonSafe = (value) => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? Number(item) : item)

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
  response.end(jsonSafe(value))
}

async function requestBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 200 * 1024 * 1024) throw new Error('Arquivo muito grande para restauração.')
  }
  return body ? JSON.parse(body) : {}
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' })
      return response.end()
    }
    if (request.method === 'GET' && request.url === '/health') return sendJson(response, 200, { status: 'ok' })
    if (request.method === 'GET' && request.url === '/api/backup') {
      database.exec('PRAGMA wal_checkpoint(FULL)')
      response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="oficina-pro-backup.db"', 'Access-Control-Allow-Origin': '*' })
      return response.end(readFileSync(databasePath))
    }
    if (request.method === 'POST' && request.url === '/api/backup/restore') {
      const { backup } = await requestBody(request)
      if (typeof backup !== 'string' || !backup) return sendJson(response, 400, { message: 'Arquivo de backup inválido.' })
      const restorePath = `${databasePath}.restore.tmp`
      const content = Buffer.from(backup, 'base64')
      if (content.subarray(0, 16).toString() !== 'SQLite format 3\u0000') return sendJson(response, 400, { message: 'O arquivo selecionado não é um backup do Oficina Pro.' })
      writeFileSync(restorePath, content)
      const validation = new DatabaseSync(restorePath)
      const integrity = validation.prepare('PRAGMA integrity_check').get()
      validation.close()
      if (integrity.integrity_check !== 'ok') { unlinkSync(restorePath); return sendJson(response, 400, { message: 'O backup está corrompido.' }) }
      database.close()
      copyFileSync(restorePath, databasePath)
      unlinkSync(restorePath)
      database = new DatabaseSync(databasePath)
      return sendJson(response, 200, { restored: true })
    }
    if (request.method === 'POST' && (request.url === '/api/db/select' || request.url === '/api/db/execute')) {
      const { sql, values = [] } = await requestBody(request)
      if (typeof sql !== 'string' || !sql.trim()) return sendJson(response, 400, { message: 'Comando inválido.' })
      const statement = database.prepare(sql)
      if (request.url.endsWith('/select')) return sendJson(response, 200, statement.all(...values))
      const result = statement.run(...values)
      return sendJson(response, 200, { rowsAffected: result.changes, lastInsertId: result.lastInsertRowid })
    }

    const requestPath = decodeURIComponent((request.url || '/').split('?')[0])
    const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '')
    const filePath = resolve(staticRoot, normalize(relativePath))
    if (!filePath.startsWith(resolve(staticRoot)) || !existsSync(filePath)) {
      response.writeHead(404)
      return response.end('Arquivo não encontrado.')
    }
    const extension = extname(filePath).toLowerCase()
    response.writeHead(200, { 'Content-Type': mimeTypes[extension] || 'application/octet-stream', 'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000' })
    response.end(readFileSync(filePath))
  } catch (error) {
    sendJson(response, 500, { message: error instanceof Error ? error.message : 'Erro inesperado.' })
  }
})

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') process.exit(0)
  console.error(error)
  process.exit(1)
})
server.listen(3100, '127.0.0.1')
