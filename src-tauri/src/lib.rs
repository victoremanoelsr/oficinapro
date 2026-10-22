use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join("oficina.db"))
}

#[tauri::command]
fn backup_database(app: AppHandle, destination: String) -> Result<(), String> {
    let source = database_path(&app)?;
    if !source.exists() {
        return Err("O banco de dados ainda não foi criado.".to_string());
    }
    fs::copy(source, destination).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn restore_database(app: AppHandle, source: String) -> Result<(), String> {
    let source_path = PathBuf::from(source);
    if !source_path.exists() {
        return Err("Arquivo de backup não encontrado.".to_string());
    }
    let destination = database_path(&app)?;
    fs::copy(source_path, destination).map_err(|error| error.to_string())?;
    Ok(())
}

pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "estrutura inicial da oficina",
        sql: r#"
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        workshop_name TEXT NOT NULL DEFAULT 'Oficina Pro',
        address TEXT DEFAULT '', phone TEXT DEFAULT '', printer TEXT DEFAULT '', logo_data TEXT DEFAULT ''
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
        purchase_price REAL NOT NULL DEFAULT 0, sale_price REAL NOT NULL DEFAULT 0, minimum_stock REAL NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS service_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT NOT NULL UNIQUE,
        client_id INTEGER NOT NULL REFERENCES clients(id), vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
        mileage INTEGER DEFAULT 0, complaint TEXT DEFAULT '', diagnosis TEXT DEFAULT '', service_done TEXT DEFAULT '',
        labor_value REAL NOT NULL DEFAULT 0, parts_value REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Aberta', entered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finalized_at TEXT
      );
      CREATE TABLE IF NOT EXISTS service_order_parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
        part_id INTEGER NOT NULL REFERENCES parts(id), quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS checkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id), checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        mileage INTEGER DEFAULT 0, fuel TEXT DEFAULT '', bodywork TEXT DEFAULT '', windshield TEXT DEFAULT '', headlights TEXT DEFAULT '',
        taillights TEXT DEFAULT '', mirrors TEXT DEFAULT '', tires TEXT DEFAULT '', spare_tire INTEGER DEFAULT 0, jack INTEGER DEFAULT 0,
        spare_key INTEGER DEFAULT 0, documents INTEGER DEFAULT 0, notes TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS cash_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('Entrada','Saída','Receber','Pagar')),
        description TEXT NOT NULL, value REAL NOT NULL, due_date TEXT, paid_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
        client_id INTEGER REFERENCES clients(id), vehicle_id INTEGER REFERENCES vehicles(id),
        description TEXT NOT NULL, amount REAL NOT NULL, payment_method TEXT NOT NULL DEFAULT 'Dinheiro',
        installments INTEGER NOT NULL DEFAULT 1, installment_number INTEGER NOT NULL DEFAULT 1,
        due_date TEXT, paid_at TEXT, status TEXT NOT NULL DEFAULT 'Pago' CHECK (status IN ('Pago','Pendente')),
        category TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL, supplier TEXT DEFAULT '', amount REAL NOT NULL,
        due_date TEXT NOT NULL, category TEXT DEFAULT 'Despesa fixa',
        status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente','Pago')),
        paid_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_orders_status ON service_orders(status);
      CREATE INDEX IF NOT EXISTS idx_vehicles_client ON vehicles(client_id);
      CREATE INDEX IF NOT EXISTS idx_part_requests_status ON part_requests(status);
      CREATE INDEX IF NOT EXISTS idx_financial_transactions_status ON financial_transactions(status);
      CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
    "#,
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:oficina.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![backup_database, restore_database])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Oficina Pro");
}
