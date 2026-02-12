import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class Storage {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  initialize() {
    // Run initial migration
    const migration1 = readFileSync(
      join(__dirname, '../migrations/001-init.sql'),
      'utf-8'
    );
    this.db.exec(migration1);

    // Run x402 payments migration
    const migration2 = readFileSync(
      join(__dirname, '../migrations/002-x402-payments.sql'),
      'utf-8'
    );
    this.db.exec(migration2);
  }

  // Usage tracking
  recordUsage(data) {
    const stmt = this.db.prepare(`
      INSERT INTO usage (
        timestamp, provider, model, agent_id, session_id,
        tokens_prompt, tokens_completion, tokens_total,
        cost_usd, task_type, request_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      data.timestamp || new Date().toISOString(),
      data.provider,
      data.model,
      data.agent_id || null,
      data.session_id || null,
      data.tokens_prompt || 0,
      data.tokens_completion || 0,
      data.tokens_total || 0,
      data.cost_usd || 0,
      data.task_type || null,
      data.request_data ? JSON.stringify(data.request_data) : null
    );
  }

  getUsage(timeframe = '1 day') {
    const stmt = this.db.prepare(`
      SELECT * FROM usage
      WHERE timestamp >= datetime('now', '-' || ?)
      ORDER BY timestamp DESC
    `);
    return stmt.all(timeframe);
  }

  getUsageSummary(timeframe = '1 day') {
    const stmt = this.db.prepare(`
      SELECT
        provider,
        model,
        COUNT(*) as request_count,
        SUM(tokens_total) as total_tokens,
        SUM(cost_usd) as total_cost
      FROM usage
      WHERE timestamp >= datetime('now', '-' || ?)
      GROUP BY provider, model
      ORDER BY total_cost DESC
    `);
    return stmt.all(timeframe);
  }

  getTotalCost(timeframe = '1 day') {
    const stmt = this.db.prepare(`
      SELECT
        COALESCE(SUM(cost_usd), 0) as total_cost,
        COUNT(*) as request_count
      FROM usage
      WHERE timestamp >= datetime('now', '-' || ?)
    `);
    return stmt.get(timeframe);
  }

  getTopAgents(timeframe = '1 day', limit = 10) {
    const stmt = this.db.prepare(`
      SELECT
        agent_id,
        COUNT(*) as request_count,
        SUM(cost_usd) as total_cost
      FROM usage
      WHERE timestamp >= datetime('now', '-' || ?)
        AND agent_id IS NOT NULL
      GROUP BY agent_id
      ORDER BY total_cost DESC
      LIMIT ?
    `);
    return stmt.all(timeframe, limit);
  }

  // Budget management
  getBudgets() {
    const stmt = this.db.prepare('SELECT * FROM budgets WHERE id = 1');
    return stmt.get();
  }

  updateBudgets(budgets) {
    const stmt = this.db.prepare(`
      UPDATE budgets SET
        daily_limit_usd = ?,
        weekly_limit_usd = ?,
        monthly_limit_usd = ?,
        alert_threshold_percent = ?,
        circuit_breaker_enabled = ?
      WHERE id = 1
    `);

    return stmt.run(
      budgets.daily_limit_usd,
      budgets.weekly_limit_usd,
      budgets.monthly_limit_usd,
      budgets.alert_threshold_percent,
      budgets.circuit_breaker_enabled ? 1 : 0
    );
  }

  // Pricing
  getPricing(provider, model) {
    const stmt = this.db.prepare(`
      SELECT * FROM pricing
      WHERE provider = ? AND model = ?
    `);
    return stmt.get(provider, model);
  }

  getAllPricing() {
    const stmt = this.db.prepare('SELECT * FROM pricing');
    return stmt.all();
  }

  updatePricing(provider, model, costPrompt, costCompletion) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO pricing
      (provider, model, cost_per_1k_prompt, cost_per_1k_completion, last_updated)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);
    return stmt.run(provider, model, costPrompt, costCompletion);
  }

  // Circuit breaker events
  recordBreakerEvent(eventType, reason, budgetType, amountExceeded) {
    const stmt = this.db.prepare(`
      INSERT INTO breaker_events (event_type, reason, budget_type, amount_exceeded_usd)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(eventType, reason, budgetType, amountExceeded);
  }

  getLastBreakerEvent() {
    const stmt = this.db.prepare(`
      SELECT * FROM breaker_events
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    return stmt.get();
  }

  getBreakerEvents(timeframe = '7 days') {
    const stmt = this.db.prepare(`
      SELECT * FROM breaker_events
      WHERE timestamp >= datetime('now', '-' || ?)
      ORDER BY timestamp DESC
    `);
    return stmt.all(timeframe);
  }

  // Alert channels
  addAlertChannel(type, config) {
    const stmt = this.db.prepare(`
      INSERT INTO alert_channels (type, config, enabled)
      VALUES (?, ?, 1)
    `);
    return stmt.run(type, JSON.stringify(config));
  }

  getAlertChannels() {
    const stmt = this.db.prepare('SELECT * FROM alert_channels WHERE enabled = 1');
    const channels = stmt.all();
    return channels.map(c => ({
      ...c,
      config: JSON.parse(c.config)
    }));
  }

  close() {
    this.db.close();
  }
}
