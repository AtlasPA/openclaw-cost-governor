import fetch from 'node-fetch';

export class Alerter {
  constructor(storage) {
    this.storage = storage;
    this.lastAlerts = new Map(); // Track last alert time to prevent spam
    this.alertCooldown = 60 * 60 * 1000; // 1 hour cooldown between similar alerts
  }

  /**
   * Send alert through configured channels
   */
  async sendAlert(type, data) {
    const alertKey = `${type}-${data.budget?.timeframe}`;

    // Check cooldown
    const lastAlert = this.lastAlerts.get(alertKey);
    if (lastAlert && Date.now() - lastAlert < this.alertCooldown) {
      console.log(`[Cost Governor] Alert on cooldown: ${alertKey}`);
      return { sent: false, reason: 'Cooldown active' };
    }

    const channels = this.storage.getAlertChannels();
    const results = [];

    for (const channel of channels) {
      try {
        let result;
        switch (channel.type) {
          case 'console':
            result = await this.sendConsoleAlert(type, data);
            break;
          case 'discord':
            result = await this.sendDiscordAlert(type, data, channel.config);
            break;
          case 'webhook':
            result = await this.sendWebhookAlert(type, data, channel.config);
            break;
          default:
            console.warn(`[Cost Governor] Unknown alert channel: ${channel.type}`);
        }
        results.push({ channel: channel.type, success: true, result });
      } catch (error) {
        console.error(`[Cost Governor] Error sending alert via ${channel.type}:`, error);
        results.push({ channel: channel.type, success: false, error: error.message });
      }
    }

    this.lastAlerts.set(alertKey, Date.now());

    return { sent: true, results };
  }

  /**
   * Send console/terminal alert
   */
  async sendConsoleAlert(type, data) {
    const message = this.formatAlertMessage(type, data);
    console.log('\\n' + '='.repeat(60));
    console.log(message);
    console.log('='.repeat(60) + '\\n');
    return { output: 'console' };
  }

  /**
   * Send Discord webhook alert
   */
  async sendDiscordAlert(type, data, config) {
    if (!config.webhook_url) {
      throw new Error('Discord webhook URL not configured');
    }

    const message = this.formatAlertMessage(type, data);
    const embed = {
      title: this.getAlertTitle(type, data),
      description: message,
      color: this.getAlertColor(type, data),
      timestamp: new Date().toISOString()
    };

    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.statusText}`);
    }

    return { webhook: 'discord', status: response.status };
  }

  /**
   * Send custom webhook alert
   */
  async sendWebhookAlert(type, data, config) {
    if (!config.url) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      type,
      data,
      message: this.formatAlertMessage(type, data),
      timestamp: new Date().toISOString()
    };

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }

    return { webhook: 'custom', status: response.status };
  }

  /**
   * Format alert message
   */
  formatAlertMessage(type, data) {
    switch (type) {
      case 'budget_warning':
      case 'budget_critical':
      case 'budget_exceeded':
        return this.formatBudgetAlert(data);
      case 'circuit_breaker_trip':
        return this.formatBreakerAlert(data);
      case 'daily_summary':
        return this.formatDailySummary(data);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Format budget alert message
   */
  formatBudgetAlert(data) {
    const { budget, providers, topAgents } = data;
    const status = budget.status === 'exceeded' ? '🛑' :
                   budget.status === 'critical' ? '⚠️' : '⚠️';

    let msg = `${status} OpenClaw Budget Alert\\n\\n`;
    msg += `You've used ${budget.percentUsed}% of your ${budget.timeframe} budget `;
    msg += `($${budget.used.toFixed(2)} / $${budget.limit.toFixed(2)})\\n\\n`;

    if (budget.status === 'exceeded') {
      msg += `❌ Budget exceeded by $${(budget.used - budget.limit).toFixed(2)}\\n\\n`;
    }

    if (providers && providers.length > 0) {
      msg += `Current usage:\\n`;
      providers.slice(0, 3).forEach(p => {
        const percent = ((p.total_cost / budget.used) * 100).toFixed(0);
        msg += `  - ${p.provider} ${p.model}: $${p.total_cost.toFixed(2)} (${percent}%)\\n`;
      });
      msg += `\\n`;
    }

    if (topAgents && topAgents.length > 0 && topAgents[0].agent_id) {
      msg += `Top agents:\\n`;
      topAgents.slice(0, 3).forEach(a => {
        msg += `  - ${a.agent_id}: $${a.total_cost.toFixed(2)}\\n`;
      });
      msg += `\\n`;
    }

    msg += `View dashboard: http://localhost:9090`;

    return msg;
  }

  /**
   * Format circuit breaker alert
   */
  formatBreakerAlert(data) {
    let msg = `🛑 OpenClaw Circuit Breaker Activated\\n\\n`;
    msg += `${data.reason}\\n\\n`;
    msg += `Agents have been paused to prevent further charges.\\n\\n`;
    msg += `To resume:\\n`;
    msg += `1. Review usage: http://localhost:9090\\n`;
    msg += `2. Reset breaker: claw cost-governor reset\\n\\n`;

    if (data.recentExpensive) {
      msg += `Recent expensive operations:\\n`;
      data.recentExpensive.forEach(op => {
        msg += `  - ${op.agent_id} (${op.timestamp}): $${op.cost}\\n`;
      });
    }

    return msg;
  }

  /**
   * Format daily summary
   */
  formatDailySummary(data) {
    let msg = `📊 OpenClaw Daily Cost Summary\\n\\n`;
    msg += `Total spent today: $${data.total.toFixed(2)}\\n`;
    msg += `Requests: ${data.requestCount}\\n`;
    msg += `Average per request: $${(data.total / data.requestCount).toFixed(4)}\\n\\n`;

    if (data.byProvider) {
      msg += `By provider:\\n`;
      data.byProvider.forEach(p => {
        msg += `  - ${p.provider}: $${p.cost.toFixed(2)} (${p.requests} requests)\\n`;
      });
    }

    return msg;
  }

  /**
   * Get alert title for embeds
   */
  getAlertTitle(type, data) {
    switch (type) {
      case 'budget_warning':
        return `⚠️ Budget Warning (${data.budget.percentUsed}%)`;
      case 'budget_critical':
        return `⚠️ Critical Budget Alert (${data.budget.percentUsed}%)`;
      case 'budget_exceeded':
        return `🛑 Budget Exceeded`;
      case 'circuit_breaker_trip':
        return `🛑 Circuit Breaker Activated`;
      case 'daily_summary':
        return `📊 Daily Cost Summary`;
      default:
        return `OpenClaw Cost Alert`;
    }
  }

  /**
   * Get alert color for Discord embeds
   */
  getAlertColor(type, data) {
    switch (type) {
      case 'budget_warning':
        return 0xFFA500; // Orange
      case 'budget_critical':
        return 0xFF4500; // Red-orange
      case 'budget_exceeded':
      case 'circuit_breaker_trip':
        return 0xFF0000; // Red
      case 'daily_summary':
        return 0x00FF00; // Green
      default:
        return 0x808080; // Gray
    }
  }
}
