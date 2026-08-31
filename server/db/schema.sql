-- Lackdesign Auftrags-Portal

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intake_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code VARCHAR(16) UNIQUE NOT NULL,
  provider_company VARCHAR(200) NOT NULL,
  contact_name VARCHAR(120) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(80) NOT NULL,
  batch_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_batches_created ON intake_batches(created_at DESC);

CREATE TABLE IF NOT EXISTS intake_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES intake_batches(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  license_plate VARCHAR(32),
  make_model VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  agreed_work TEXT NOT NULL,
  pickup_required BOOLEAN NOT NULL DEFAULT FALSE,
  pickup_address TEXT,
  deadline DATE,
  urgency VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (urgency IN ('normal', 'kurzfristig', 'eilig')),
  status VARCHAR(32) NOT NULL DEFAULT 'neu'
    CHECK (status IN (
      'neu', 'bestaetigt', 'abholung_geplant', 'in_arbeit',
      'fertig', 'abgeschlossen', 'storniert'
    )),
  internal_notes TEXT,
  agreed_price_eur NUMERIC(10, 2),
  internal_deadline DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_vehicles_batch ON intake_vehicles(batch_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_intake_vehicles_status ON intake_vehicles(status, created_at DESC);

CREATE TABLE IF NOT EXISTS intake_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES intake_vehicles(id) ON DELETE CASCADE,
  stored_path TEXT NOT NULL,
  original_filename VARCHAR(300),
  mime_type VARCHAR(80),
  size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_images_vehicle ON intake_images(vehicle_id);

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(80) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
