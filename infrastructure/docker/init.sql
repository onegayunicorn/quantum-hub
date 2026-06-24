-- Quantum Hub Database Schema
-- PostgreSQL initialization script

CREATE TABLE IF NOT EXISTS quantum_jobs (
  id            VARCHAR(64) PRIMARY KEY,
  algorithm     VARCHAR(64) NOT NULL,
  qubits        INTEGER NOT NULL,
  shots         INTEGER NOT NULL DEFAULT 1024,
  status        VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  provider      VARCHAR(64),
  result        JSONB,
  error         TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telemetry_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  node_id         VARCHAR(64) NOT NULL,
  coherence_level FLOAT NOT NULL,
  temperature     FLOAT,
  humidity        FLOAT,
  magnetic_flux   FLOAT,
  cpu_usage       FLOAT,
  memory_usage    FLOAT,
  decoherence_risk FLOAT,
  jobs_processed  INTEGER DEFAULT 0,
  jobs_failed     INTEGER DEFAULT 0,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hardware_devices (
  id              VARCHAR(64) PRIMARY KEY,
  name            VARCHAR(128) NOT NULL,
  device_type     VARCHAR(32) NOT NULL,
  status          VARCHAR(32) NOT NULL DEFAULT 'OFFLINE',
  capabilities    JSONB,
  installed_at    TIMESTAMPTZ,
  last_heartbeat  TIMESTAMPTZ,
  metrics         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id              VARCHAR(64) PRIMARY KEY,
  agent_id        VARCHAR(64) NOT NULL,
  task_type       VARCHAR(64) NOT NULL,
  priority        INTEGER NOT NULL DEFAULT 5,
  status          VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  payload         JSONB,
  result          JSONB,
  error           TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON quantum_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON quantum_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_node ON telemetry_snapshots(node_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
