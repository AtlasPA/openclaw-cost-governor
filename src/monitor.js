export class BudgetMonitor {
  constructor(storage) {
    this.storage = storage;
  }

  /**
   * Check all budgets and return status
   * @returns {Object} { daily, weekly, monthly } with status for each
   */
  checkBudgets() {
    const budgets = this.storage.getBudgets();

    const daily = this.checkBudget('1 day', budgets.daily_limit_usd, budgets.alert_threshold_percent);
    const weekly = this.checkBudget('7 days', budgets.weekly_limit_usd, budgets.alert_threshold_percent);
    const monthly = this.checkBudget('30 days', budgets.monthly_limit_usd, budgets.alert_threshold_percent);

    return {
      daily,
      weekly,
      monthly,
      circuit_breaker_enabled: budgets.circuit_breaker_enabled === 1
    };
  }

  /**
   * Check a single budget period
   */
  checkBudget(timeframe, limit, thresholdPercent) {
    const { total_cost, request_count } = this.storage.getTotalCost(timeframe);
    const percentUsed = (total_cost / limit) * 100;

    let status = 'safe';
    let shouldAlert = false;
    let shouldBreak = false;

    if (percentUsed >= 100) {
      status = 'exceeded';
      shouldAlert = true;
      shouldBreak = true;
    } else if (percentUsed >= 90) {
      status = 'critical';
      shouldAlert = true;
    } else if (percentUsed >= thresholdPercent) {
      status = 'warning';
      shouldAlert = true;
    }

    return {
      timeframe,
      limit,
      used: total_cost,
      remaining: Math.max(0, limit - total_cost),
      percentUsed: Math.round(percentUsed),
      requestCount: request_count,
      status,
      shouldAlert,
      shouldBreak
    };
  }

  /**
   * Determine if circuit breaker should trip
   */
  shouldTripBreaker() {
    const status = this.checkBudgets();

    if (!status.circuit_breaker_enabled) {
      return { should_trip: false, reason: 'Circuit breaker disabled' };
    }

    // Check if any budget is exceeded
    const budgets = [status.daily, status.weekly, status.monthly];
    const exceeded = budgets.find(b => b.status === 'exceeded');

    if (exceeded) {
      return {
        should_trip: true,
        reason: `${exceeded.timeframe} budget exceeded`,
        budget_type: exceeded.timeframe,
        amount_exceeded: exceeded.used - exceeded.limit
      };
    }

    return { should_trip: false };
  }

  /**
   * Get budget status summary for display
   */
  getStatusSummary() {
    const status = this.checkBudgets();
    const summary = this.storage.getUsageSummary('1 day');
    const topAgents = this.storage.getTopAgents('1 day', 5);

    return {
      budgets: status,
      providers: summary,
      topAgents,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate alert message
   */
  generateAlertMessage(budget) {
    const status = budget.status === 'exceeded' ? '🛑' :
                   budget.status === 'critical' ? '⚠️' : '⚠️';

    const providers = this.storage.getUsageSummary('1 day');
    const topAgents = this.storage.getTopAgents('1 day', 3);

    let message = `${status} OpenClaw Budget Alert\\n\\n`;
    message += `You've used ${budget.percentUsed}% of your ${budget.timeframe} budget `;
    message += `($${budget.used.toFixed(2)} / $${budget.limit.toFixed(2)})\\n\\n`;

    if (budget.status === 'exceeded') {
      message += `❌ Budget exceeded by $${(budget.used - budget.limit).toFixed(2)}\\n\\n`;
    }

    if (providers.length > 0) {
      message += `Current usage:\\n`;
      providers.forEach(p => {
        const percent = ((p.total_cost / budget.used) * 100).toFixed(0);
        message += `- ${p.provider} ${p.model}: $${p.total_cost.toFixed(2)} (${percent}%)\\n`;
      });
      message += `\\n`;
    }

    if (topAgents.length > 0 && topAgents[0].agent_id) {
      message += `Top agents:\\n`;
      topAgents.forEach(a => {
        message += `- ${a.agent_id}: $${a.total_cost.toFixed(2)}\\n`;
      });
      message += `\\n`;
    }

    return message;
  }
}
