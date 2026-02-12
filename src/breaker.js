import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export class CircuitBreaker {
  constructor(storage, openclawConfigPath) {
    this.storage = storage;
    this.configPath = openclawConfigPath;
    this.tripped = false;
    this.checkStatus();
  }

  /**
   * Check if breaker is currently tripped
   */
  checkStatus() {
    const lastEvent = this.storage.getLastBreakerEvent();
    if (lastEvent && lastEvent.event_type === 'trip') {
      // Check if it should still be tripped (hasn't been reset)
      const events = this.storage.getBreakerEvents('1 day');
      const lastReset = events.find(e => e.event_type === 'reset' && e.timestamp > lastEvent.timestamp);
      this.tripped = !lastReset;
    }
    return this.tripped;
  }

  /**
   * Trip the circuit breaker
   */
  async trip(reason, budgetType, amountExceeded) {
    if (this.tripped) {
      console.log('[Cost Governor] Circuit breaker already tripped');
      return { success: false, reason: 'Already tripped' };
    }

    console.log(`[Cost Governor] Tripping circuit breaker: ${reason}`);

    try {
      // Record event
      this.storage.recordBreakerEvent('trip', reason, budgetType, amountExceeded);

      // Disable expensive providers in OpenClaw config
      await this.disableExpensiveProviders();

      this.tripped = true;

      return {
        success: true,
        reason,
        timestamp: new Date().toISOString(),
        message: `Circuit breaker activated. Agents paused to prevent further charges.`
      };
    } catch (error) {
      console.error('[Cost Governor] Error tripping breaker:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reset the circuit breaker
   */
  async reset(manual = false) {
    if (!this.tripped) {
      console.log('[Cost Governor] Circuit breaker not tripped');
      return { success: false, reason: 'Not tripped' };
    }

    console.log('[Cost Governor] Resetting circuit breaker');

    try {
      // Record reset event
      const reason = manual ? 'Manual reset' : 'Automatic reset';
      this.storage.recordBreakerEvent('reset', reason, null, null);

      // Re-enable providers in OpenClaw config
      await this.enableProviders();

      this.tripped = false;

      return {
        success: true,
        timestamp: new Date().toISOString(),
        message: `Circuit breaker reset. Agents re-enabled.`
      };
    } catch (error) {
      console.error('[Cost Governor] Error resetting breaker:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Disable expensive providers by modifying OpenClaw config
   */
  async disableExpensiveProviders() {
    if (!existsSync(this.configPath)) {
      console.warn('[Cost Governor] OpenClaw config not found, cannot disable providers');
      return;
    }

    try {
      const config = JSON.parse(readFileSync(this.configPath, 'utf-8'));

      // Backup original config
      if (!config._cost_governor_backup) {
        config._cost_governor_backup = {
          agents: { ...config.agents }
        };
      }

      // Find most expensive providers from recent usage
      const expensive = this.storage.getUsageSummary('1 hour');

      if (expensive.length > 0) {
        // Sort by cost, get top provider
        expensive.sort((a, b) => b.total_cost - a.total_cost);
        const topProvider = expensive[0];

        console.log(`[Cost Governor] Pausing expensive provider: ${topProvider.provider}/${topProvider.model}`);

        // Disable in config (implementation depends on OpenClaw's config structure)
        // This is a placeholder - adjust based on actual OpenClaw config format
        if (config.agents && config.agents.defaults && config.agents.defaults.model) {
          config.agents.defaults.model._cost_governor_paused = true;
        }
      }

      writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('[Cost Governor] Error modifying config:', error);
      throw error;
    }
  }

  /**
   * Re-enable providers by restoring OpenClaw config
   */
  async enableProviders() {
    if (!existsSync(this.configPath)) {
      console.warn('[Cost Governor] OpenClaw config not found');
      return;
    }

    try {
      const config = JSON.parse(readFileSync(this.configPath, 'utf-8'));

      // Restore from backup
      if (config._cost_governor_backup) {
        config.agents = { ...config._cost_governor_backup.agents };
        delete config._cost_governor_backup;
        writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      }
    } catch (error) {
      console.error('[Cost Governor] Error restoring config:', error);
      throw error;
    }
  }

  /**
   * Get current breaker status
   */
  getStatus() {
    const lastEvent = this.storage.getLastBreakerEvent();
    return {
      tripped: this.tripped,
      lastEvent,
      recentEvents: this.storage.getBreakerEvents('7 days')
    };
  }
}
