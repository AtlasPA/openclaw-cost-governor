import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { Storage } from './storage.js';
import { TokenTracker } from './tracker.js';
import { BudgetMonitor } from './monitor.js';
import { CircuitBreaker } from './breaker.js';
import { Alerter } from './alerter.js';
import { X402PaymentHandler } from './x402.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class CostGovernor {
  constructor(options = {}) {
    // Setup paths
    this.dataDir = options.dataDir || join(homedir(), '.openclaw', 'openclaw-cost-governor');
    this.dbPath = join(this.dataDir, 'data.db');
    this.openclawConfigPath = options.openclawConfigPath ||
                              join(homedir(), '.openclaw', 'openclaw.json');

    // Ensure data directory exists
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    // Initialize components
    this.storage = new Storage(this.dbPath);
    this.tracker = new TokenTracker(this.storage);
    this.monitor = new BudgetMonitor(this.storage);
    this.breaker = new CircuitBreaker(this.storage, this.openclawConfigPath);
    this.alerter = new Alerter(this.storage);
    this.x402 = new X402PaymentHandler(this.storage);

    // Alert tracking
    this.lastAlertStatus = {};

    console.log('[Cost Governor] Initialized');
  }

  /**
   * Called before provider API request
   */
  async beforeRequest(requestId, provider, model, agentId, sessionId, requestData) {
    await this.tracker.beforeRequest(requestId, provider, model, agentId, sessionId, requestData);
  }

  /**
   * Called after provider API response
   */
  async afterRequest(requestId, response) {
    // Track the request
    const usage = await this.tracker.afterRequest(requestId, response);

    if (!usage) {
      return;
    }

    // Check budgets
    const status = this.monitor.checkBudgets();

    // Send alerts if needed
    await this.checkAndSendAlerts(status);

    // Check circuit breaker
    if (status.circuit_breaker_enabled) {
      const breakerCheck = this.monitor.shouldTripBreaker();
      if (breakerCheck.should_trip && !this.breaker.tripped) {
        await this.tripCircuitBreaker(breakerCheck);
      }
    }

    return usage;
  }

  /**
   * Check budgets and send alerts
   */
  async checkAndSendAlerts(status) {
    const budgets = [
      { ...status.daily, period: 'daily' },
      { ...status.weekly, period: 'weekly' },
      { ...status.monthly, period: 'monthly' }
    ];

    for (const budget of budgets) {
      if (!budget.shouldAlert) continue;

      const alertKey = `${budget.period}-${budget.status}`;

      // Only alert if status changed
      if (this.lastAlertStatus[alertKey] === budget.status) {
        continue;
      }

      this.lastAlertStatus[alertKey] = budget.status;

      // Get context for alert
      const providers = this.storage.getUsageSummary('1 day');
      const topAgents = this.storage.getTopAgents('1 day', 3);

      // Determine alert type
      let alertType;
      if (budget.status === 'exceeded') {
        alertType = 'budget_exceeded';
      } else if (budget.status === 'critical') {
        alertType = 'budget_critical';
      } else {
        alertType = 'budget_warning';
      }

      await this.alerter.sendAlert(alertType, {
        budget,
        providers,
        topAgents
      });
    }
  }

  /**
   * Trip circuit breaker
   */
  async tripCircuitBreaker(breakerCheck) {
    const result = await this.breaker.trip(
      breakerCheck.reason,
      breakerCheck.budget_type,
      breakerCheck.amount_exceeded
    );

    if (result.success) {
      // Send critical alert
      const recentExpensive = this.storage.getUsage('1 hour')
        .sort((a, b) => b.cost_usd - a.cost_usd)
        .slice(0, 5);

      await this.alerter.sendAlert('circuit_breaker_trip', {
        reason: breakerCheck.reason,
        budgetType: breakerCheck.budget_type,
        amountExceeded: breakerCheck.amount_exceeded,
        recentExpensive: recentExpensive.map(u => ({
          agent_id: u.agent_id || 'unknown',
          timestamp: u.timestamp,
          cost: u.cost_usd.toFixed(2)
        }))
      });
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    const budgetStatus = this.monitor.checkBudgets();
    const breakerStatus = this.breaker.getStatus();
    const summary = this.monitor.getStatusSummary();

    return {
      budgets: budgetStatus,
      breaker: breakerStatus,
      summary,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset circuit breaker
   */
  async resetBreaker() {
    return await this.breaker.reset(true);
  }

  /**
   * Update budget configuration
   */
  updateBudgets(budgets) {
    return this.storage.updateBudgets(budgets);
  }

  /**
   * Get usage report
   */
  getReport(timeframe = '7 days', agentWallet = null) {
    // Check if agent has Pro license for extended history
    if (timeframe !== '7 days' && agentWallet) {
      const license = this.x402.hasValidLicense(agentWallet);
      if (!license.valid) {
        throw new Error('Pro license required for extended history. Visit /api/x402/subscribe');
      }
    }

    return {
      summary: this.storage.getUsageSummary(timeframe),
      total: this.storage.getTotalCost(timeframe),
      topAgents: this.storage.getTopAgents(timeframe, 10),
      timeline: this.storage.getUsage(timeframe)
    };
  }

  /**
   * Check Pro license status (x402)
   */
  checkLicense(agentWallet) {
    return this.x402.hasValidLicense(agentWallet);
  }

  /**
   * Create payment request for Pro subscription (x402)
   */
  async createPaymentRequest(agentWallet) {
    return await this.x402.createPaymentRequest(agentWallet);
  }

  /**
   * Verify payment and grant license (x402)
   */
  async verifyPayment(requestId, txHash, agentWallet) {
    return await this.x402.verifyPayment(requestId, txHash, agentWallet);
  }

  /**
   * Cleanup
   */
  close() {
    this.storage.close();
  }
}

// Export singleton instance
let instance;

export function getCostGovernor(options) {
  if (!instance) {
    instance = new CostGovernor(options);
  }
  return instance;
}

export default getCostGovernor;
