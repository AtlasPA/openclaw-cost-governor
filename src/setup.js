#!/usr/bin/env node

/**
 * Interactive setup for OpenClaw Cost Governor
 */

import { createInterface } from 'readline';
import { getCostGovernor } from './index.js';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setup() {
  console.log('\\n' + '='.repeat(60));
  console.log('OpenClaw Cost Governor - Setup');
  console.log('='.repeat(60) + '\\n');

  console.log('Let\\'s configure your budget limits and alerts.\\n');

  // Daily budget
  const dailyLimit = await question('Daily budget limit (USD): [$10] ') || '10';

  // Weekly budget
  const weeklyLimit = await question('Weekly budget limit (USD): [$50] ') || '50';

  // Monthly budget
  const monthlyLimit = await question('Monthly budget limit (USD): [$200] ') || '200';

  // Alert threshold
  const alertThreshold = await question('Alert threshold (% of budget): [75] ') || '75';

  // Circuit breaker
  const enableBreaker = await question('Enable automatic circuit breaker? (y/n): [y] ') || 'y';

  console.log('\\n📊 Configuration Summary:\\n');
  console.log(`  Daily Budget: $${dailyLimit}`);
  console.log(`  Weekly Budget: $${weeklyLimit}`);
  console.log(`  Monthly Budget: $${monthlyLimit}`);
  console.log(`  Alert Threshold: ${alertThreshold}%`);
  console.log(`  Circuit Breaker: ${enableBreaker.toLowerCase() === 'y' ? 'Enabled' : 'Disabled'}\\n');

  const confirm = await question('Save this configuration? (y/n): [y] ') || 'y';

  if (confirm.toLowerCase() === 'y') {
    const governor = getCostGovernor();

    governor.updateBudgets({
      daily_limit_usd: parseFloat(dailyLimit),
      weekly_limit_usd: parseFloat(weeklyLimit),
      monthly_limit_usd: parseFloat(monthlyLimit),
      alert_threshold_percent: parseInt(alertThreshold),
      circuit_breaker_enabled: enableBreaker.toLowerCase() === 'y'
    });

    // Add console alert channel by default
    governor.storage.addAlertChannel('console', {});

    console.log('\\n✅ Configuration saved successfully!\\n');
    console.log('Next steps:');
    console.log('  - Check status: node src/cli.js status');
    console.log('  - Open dashboard: node src/cli.js dashboard');
    console.log('  - View report: node src/cli.js report\\n');

    governor.close();
  } else {
    console.log('\\nSetup cancelled.\\n');
  }

  rl.close();
}

setup().catch(console.error);
