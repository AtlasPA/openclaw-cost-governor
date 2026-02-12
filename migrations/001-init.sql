-- Usage tracking
CREATE TABLE IF NOT EXISTS usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  agent_id TEXT,
  session_id TEXT,
  tokens_prompt INTEGER,
  tokens_completion INTEGER,
  tokens_total INTEGER,
  cost_usd REAL,
  task_type TEXT,
  request_data TEXT
);

-- Budget configuration
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  daily_limit_usd REAL DEFAULT 10.0,
  weekly_limit_usd REAL DEFAULT 50.0,
  monthly_limit_usd REAL DEFAULT 200.0,
  alert_threshold_percent INTEGER DEFAULT 75,
  circuit_breaker_enabled BOOLEAN DEFAULT 1
);

-- Insert default budget if not exists
INSERT OR IGNORE INTO budgets (id, daily_limit_usd, weekly_limit_usd, monthly_limit_usd)
VALUES (1, 10.0, 50.0, 200.0);

-- Alert channels
CREATE TABLE IF NOT EXISTS alert_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  config TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1
);

-- Provider pricing (regularly updated)
CREATE TABLE IF NOT EXISTS pricing (
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  cost_per_1k_prompt REAL NOT NULL,
  cost_per_1k_completion REAL NOT NULL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (provider, model)
);

-- Insert current pricing (as of Feb 2026)
INSERT OR REPLACE INTO pricing (provider, model, cost_per_1k_prompt, cost_per_1k_completion) VALUES
  ('openai', 'gpt-5.2', 0.015, 0.030),
  ('anthropic', 'claude-opus-4-5', 0.015, 0.075),
  ('anthropic', 'claude-sonnet-4-5', 0.003, 0.015),
  ('anthropic', 'claude-haiku-4-5', 0.00025, 0.00125),
  ('google', 'gemini-2.5-pro', 0.0025, 0.010);

-- Circuit breaker events
CREATE TABLE IF NOT EXISTS breaker_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  event_type TEXT NOT NULL,
  reason TEXT,
  budget_type TEXT,
  amount_exceeded_usd REAL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_provider ON usage(provider);
CREATE INDEX IF NOT EXISTS idx_usage_agent ON usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_breaker_timestamp ON breaker_events(timestamp);
