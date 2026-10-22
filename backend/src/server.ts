import express from 'express'
import { z } from 'zod'
import { prisma } from './lib/prisma.js'
import { clientController } from './controllers/client.controller.js'

const setupStatements = [
  'PRAGMA foreign_keys = ON',
  `CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), workshop_name TEXT NOT NULL DEFAULT 'Minha Oficina', address TEXT DEFAULT '', phone TEXT DEFAULT '', printer TEXT DEFAULT '')`,
  "INSERT OR IGNORE INTO settings (id, workshop_name) VALUES (1, 'Minha Oficina')",
  `CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT DEFAULT '', city TEXT DEFAULT '', document TEXT DEFAULT '', notes TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS vehicles (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, plate TEXT NOT NULL, model TEXT NOT NULL, brand TEXT DEFAULT '', year TEXT DEFAULT '', color TEXT DEFAULT '', UNIQUE(client_id, plate))`,
  `CREATE TABLE IF NOT EXISTS parts (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, brand TEXT DEFAULT '', quantity REAL NOT NULL DEFAULT 0, purchase_price REAL NOT NULL DEFAULT 0, sale_price REAL NOT NULL DEFAULT 0, minimum_stock REAL NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS service_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT NOT NULL UNIQUE, client_id INTEGER NOT NULL REFERENCES clients(id), vehicle_id INTEGER NOT NULL REFERENCES vehicles(id), mileage INTEGER DEFAULT 0, complaint TEXT DEFAULT '', diagnosis TEXT DEFAULT '', service_done TEXT DEFAULT '', labor_value REAL NOT NULL DEFAULT 0, parts_value REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'Aberta', entered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finalized_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS service_order_parts (id INTEGER PRIMARY KEY AUTOINCREMENT, service_order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE, part_id INTEGER NOT NULL REFERENCES parts(id), quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS checkins (id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER NOT NULL REFERENCES vehicles(id), checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, mileage INTEGER DEFAULT 0, fuel TEXT DEFAULT '', bodywork TEXT DEFAULT '', windshield TEXT DEFAULT '', headlights TEXT DEFAULT '', taillights TEXT DEFAULT '', mirrors TEXT DEFAULT '', tires TEXT DEFAULT '', spare_tire INTEGER DEFAULT 0, jack INTEGER DEFAULT 0, spare_key INTEGER DEFAULT 0, documents INTEGER DEFAULT 0, notes TEXT DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS cash_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL CHECK (type IN ('Entrada','Saída','Receber','Pagar')), description TEXT NOT NULL, value REAL NOT NULL, due_date TEXT, paid_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  'CREATE INDEX IF NOT EXISTS idx_orders_status ON service_orders(status)',
  'CREATE INDEX IF NOT EXISTS idx_vehicles_client ON vehicles(client_id)'
]

const requestSchema = z.object({ sql: z.string().min(1), values: z.array(z.unknown()).default([]) })
const serialize = (value: unknown): unknown => {
  if (typeof value === 'bigint') return Number(value)
  if (Array.isArray(value)) return value.map(serialize)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serialize(item)]))
  return value
}

async function initializeDatabase() {
  for (const statement of setupStatements) await prisma.$executeRawUnsafe(statement)
}

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use((_, response, next) => { response.setHeader('Access-Control-Allow-Origin', 'http://localhost:1420'); response.setHeader('Access-Control-Allow-Headers', 'Content-Type'); next() })
app.get('/health', (_, response) => response.json({ status: 'ok' }))

app.post('/api/db/select', async (request, response, next) => {
  try {
    const { sql, values } = requestSchema.parse(request.body)
    const rows = await prisma.$queryRawUnsafe<unknown[]>(sql, ...values)
    response.json(serialize(rows))
  } catch (error) { next(error) }
})
app.post('/api/db/execute', async (request, response, next) => {
  try {
    const { sql, values } = requestSchema.parse(request.body)
    const rowsAffected = await prisma.$executeRawUnsafe(sql, ...values)
    const lastId = await prisma.$queryRawUnsafe<Array<{ id: number | bigint }>>('SELECT last_insert_rowid() AS id')
    response.json(serialize({ rowsAffected, lastInsertId: lastId[0]?.id ?? 0 }))
  } catch (error) { next(error) }
})

app.get('/api/clients', clientController.list)
app.post('/api/clients', clientController.create)
app.patch('/api/clients/:id', clientController.update)
app.delete('/api/clients/:id', clientController.remove)
app.use((error: unknown, _: express.Request, response: express.Response, __: express.NextFunction) => {
  const message = error instanceof z.ZodError ? 'Dados inválidos.' : error instanceof Error ? error.message : 'Erro inesperado.'
  response.status(error instanceof z.ZodError ? 400 : 500).json({ message })
})

initializeDatabase()
  .then(() => app.listen(3100, '127.0.0.1', () => console.log('Banco local da Oficina Fácil em execução em http://127.0.0.1:3100.')))
  .catch((error) => { console.error('Não foi possível iniciar o banco local:', error); process.exit(1) })
