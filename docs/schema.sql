-- PrintSys ERP/PDV para Grafica
-- Banco recomendado: PostgreSQL 15+

CREATE TABLE roles (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE permissions (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(120) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE role_permissions (
  role_id BIGINT NOT NULL REFERENCES roles(id),
  permission_id BIGINT NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  role_id BIGINT REFERENCES roles(id),
  name VARCHAR(160) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  document VARCHAR(32),
  phone VARCHAR(40),
  email VARCHAR(180),
  customer_type VARCHAR(40) NOT NULL DEFAULT 'empresa',
  credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customer_addresses (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label VARCHAR(80),
  street VARCHAR(180),
  number VARCHAR(30),
  district VARCHAR(120),
  city VARCHAR(120),
  state VARCHAR(2),
  zipcode VARCHAR(16)
);

CREATE TABLE suppliers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  document VARCHAR(32),
  phone VARCHAR(40),
  email VARCHAR(180)
);

CREATE TABLE materials (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT REFERENCES suppliers(id),
  name VARCHAR(180) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
  stock_qty NUMERIC(14,4) NOT NULL DEFAULT 0,
  min_stock_qty NUMERIC(14,4) NOT NULL DEFAULT 0
);

CREATE TABLE equipment (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  hourly_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE production_sectors (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  category VARCHAR(120),
  description TEXT,
  calculation_unit VARCHAR(30) NOT NULL,
  default_width NUMERIC(12,4),
  default_height NUMERIC(12,4),
  default_thickness NUMERIC(12,4),
  default_margin_percent NUMERIC(8,4) NOT NULL DEFAULT 45,
  max_discount_percent NUMERIC(8,4) NOT NULL DEFAULT 10,
  min_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  internal_notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE product_materials (
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  material_id BIGINT NOT NULL REFERENCES materials(id),
  qty_per_unit NUMERIC(14,4) NOT NULL DEFAULT 1,
  waste_percent NUMERIC(8,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, material_id)
);

CREATE TABLE product_equipment (
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  equipment_id BIGINT NOT NULL REFERENCES equipment(id),
  minutes_per_unit NUMERIC(12,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, equipment_id)
);

CREATE TABLE product_sector_flow (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sector_id BIGINT NOT NULL REFERENCES production_sectors(id),
  sort_order INT NOT NULL,
  estimated_minutes NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE product_technical_sheets (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  standard_materials JSONB NOT NULL DEFAULT '[]'::JSONB,
  equipment JSONB NOT NULL DEFAULT '[]'::JSONB,
  average_production_minutes NUMERIC(12,2) NOT NULL DEFAULT 0,
  required_sectors JSONB NOT NULL DEFAULT '[]'::JSONB,
  finishes JSONB NOT NULL DEFAULT '[]'::JSONB,
  default_waste_percent NUMERIC(8,4) NOT NULL DEFAULT 0,
  production_notes TEXT
);

CREATE TABLE product_questions (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_type VARCHAR(40) NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE question_options (
  id BIGSERIAL PRIMARY KEY,
  question_id BIGINT NOT NULL REFERENCES product_questions(id) ON DELETE CASCADE,
  label VARCHAR(160) NOT NULL,
  value VARCHAR(160) NOT NULL,
  price_rule JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE quotes (
  id BIGSERIAL PRIMARY KEY,
  quote_number VARCHAR(40) NOT NULL UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  seller_id BIGINT REFERENCES users(id),
  attendant_id BIGINT REFERENCES users(id),
  delivery_address_id BIGINT REFERENCES customer_addresses(id),
  job_name VARCHAR(220) NOT NULL,
  logistics TEXT,
  delivery_deadline DATE,
  valid_until DATE,
  payment_method VARCHAR(80),
  payment_terms TEXT,
  billing_type VARCHAR(80),
  status VARCHAR(40) NOT NULL DEFAULT 'rascunho',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  gross_profit NUMERIC(14,2) NOT NULL DEFAULT 0,
  estimated_margin_percent NUMERIC(8,4) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quote_items (
  id BIGSERIAL PRIMARY KEY,
  quote_id BIGINT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  description TEXT,
  width NUMERIC(12,4),
  height NUMERIC(12,4),
  thickness NUMERIC(12,4),
  quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
  answers JSONB NOT NULL DEFAULT '{}'::JSONB,
  cost_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  sale_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  margin_percent NUMERIC(8,4) NOT NULL DEFAULT 0
);

CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  os_number VARCHAR(40) NOT NULL UNIQUE,
  quote_id BIGINT REFERENCES quotes(id),
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  priority VARCHAR(30) NOT NULL DEFAULT 'normal',
  production_status VARCHAR(60) NOT NULL DEFAULT 'aguardando_arquivo',
  financial_status VARCHAR(60) NOT NULL DEFAULT 'pendente',
  approval_status VARCHAR(60) NOT NULL DEFAULT 'aguardando_aprovacao',
  due_date DATE,
  description TEXT,
  production_notes TEXT,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  predicted_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  real_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  predicted_minutes NUMERIC(12,2) NOT NULL DEFAULT 0,
  real_minutes NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  quote_item_id BIGINT REFERENCES quote_items(id),
  product_id BIGINT REFERENCES products(id),
  description TEXT,
  quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
  width NUMERIC(12,4),
  height NUMERIC(12,4)
);

CREATE TABLE order_attachments (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  uploaded_by BIGINT REFERENCES users(id),
  attachment_type VARCHAR(60) NOT NULL,
  file_name VARCHAR(220) NOT NULL,
  file_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_approval_files (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(60) NOT NULL,
  file_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stock_movements (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  material_id BIGINT NOT NULL REFERENCES materials(id),
  movement_type VARCHAR(40) NOT NULL,
  quantity NUMERIC(14,4) NOT NULL,
  unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE automatic_alerts (
  id BIGSERIAL PRIMARY KEY,
  alert_type VARCHAR(80) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  entity_type VARCHAR(80),
  entity_id VARCHAR(80),
  message TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE production_steps (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sector_id BIGINT NOT NULL REFERENCES production_sectors(id),
  status VARCHAR(40) NOT NULL DEFAULT 'aguardando',
  assigned_to BIGINT REFERENCES users(id),
  received_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  problem_notes TEXT,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE production_step_events (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  production_step_id BIGINT REFERENCES production_steps(id) ON DELETE SET NULL,
  sector_name VARCHAR(120),
  received_by VARCHAR(160),
  acknowledged_by VARCHAR(160),
  started_by VARCHAR(160),
  paused_by VARCHAR(160),
  pause_reason TEXT,
  finished_by VARCHAR(160),
  next_sector VARCHAR(120),
  problem TEXT,
  files JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE installation_teams (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  responsible VARCHAR(160),
  members TEXT,
  vehicle VARCHAR(120),
  departure_date DATE,
  departure_time TIME,
  return_time TIME,
  installation_status VARCHAR(60) NOT NULL DEFAULT 'agendada',
  notes TEXT,
  photos JSONB NOT NULL DEFAULT '[]'::JSONB,
  confirmation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_methods (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE receivables (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  order_id BIGINT REFERENCES orders(id),
  quote_id BIGINT REFERENCES quotes(id),
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'aberto'
);

CREATE TABLE payables (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT REFERENCES suppliers(id),
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'aberto'
);

CREATE TABLE cash_sessions (
  id BIGSERIAL PRIMARY KEY,
  operator_id BIGINT REFERENCES users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'aberto'
);

CREATE TABLE cash_movements (
  id BIGSERIAL PRIMARY KEY,
  cash_session_id BIGINT NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  movement_type VARCHAR(40) NOT NULL,
  payment_method_id BIGINT REFERENCES payment_methods(id),
  order_id BIGINT REFERENCES orders(id),
  receivable_id BIGINT REFERENCES receivables(id),
  amount NUMERIC(14,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quick_sales (
  id BIGSERIAL PRIMARY KEY,
  product_code VARCHAR(40),
  customer_id BIGINT REFERENCES customers(id),
  description TEXT NOT NULL,
  quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method_id BIGINT REFERENCES payment_methods(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE blind_cash_closings (
  id BIGSERIAL PRIMARY KEY,
  cash_session_id BIGINT NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  informed_values JSONB NOT NULL,
  expected_values JSONB NOT NULL,
  difference_values JSONB NOT NULL,
  operator_notes TEXT,
  manager_reviewed_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE production_sectors (
  id VARCHAR(80) PRIMARY KEY,
  company_id VARCHAR(80),
  name VARCHAR(120) NOT NULL,
  icon VARCHAR(80),
  color VARCHAR(20),
  order_index INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE product_production_configs (
  product_id VARCHAR(80) PRIMARY KEY,
  pricing_mode VARCHAR(40) NOT NULL,
  default_production_days INTEGER NOT NULL DEFAULT 3,
  technical_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  production_route JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_production_snapshots (
  order_id VARCHAR(80) PRIMARY KEY,
  product_config JSONB NOT NULL,
  technical_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  question_costs JSONB NOT NULL DEFAULT '[]'::jsonb,
  production_route JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NOT NULL,
  action VARCHAR(80) NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
