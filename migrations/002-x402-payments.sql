-- x402 Payment tracking for agent subscriptions
CREATE TABLE IF NOT EXISTS agent_licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_wallet TEXT UNIQUE NOT NULL,
  agent_id TEXT,
  tier TEXT NOT NULL DEFAULT 'free',
  paid_until DATETIME,
  last_payment_tx TEXT,
  last_payment_amount REAL,
  last_payment_token TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Payment transactions log
CREATE TABLE IF NOT EXISTS payment_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_wallet TEXT NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  token TEXT NOT NULL,
  chain TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  verified BOOLEAN DEFAULT 0,
  tier_granted TEXT,
  duration_months INTEGER DEFAULT 1
);

-- x402 payment requests (for tracking incoming requests)
CREATE TABLE IF NOT EXISTS payment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT UNIQUE NOT NULL,
  agent_wallet TEXT,
  amount_requested REAL NOT NULL,
  token TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  tx_hash TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_licenses_wallet ON agent_licenses(agent_wallet);
CREATE INDEX IF NOT EXISTS idx_agent_licenses_paid_until ON agent_licenses(paid_until);
CREATE INDEX IF NOT EXISTS idx_payment_tx_hash ON payment_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_payment_wallet ON payment_transactions(agent_wallet);
CREATE INDEX IF NOT EXISTS idx_payment_requests_id ON payment_requests(request_id);
