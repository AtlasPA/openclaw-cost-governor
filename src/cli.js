#!/usr/bin/env node

import { getCostGovernor } from './index.js';
import { spawn } from 'child_process';

/**
 * Show current status
 */
export async function status(args = {}) {
  const governor = getCostGovernor();
  const statusData = governor.getStatus();

  console.log('\\n' + '='.repeat(60));
  console.log('OpenClaw Cost Governor - Status');
  console.log('='.repeat(60) + '\\n');

  // Budget status
  console.log('📊 Budget Status:\\n');

  const budgets = [
    { name: 'Daily', data: statusData.budgets.daily },
    { name: 'Weekly', data: statusData.budgets.weekly },
    { name: 'Monthly', data: statusData.budgets.monthly }
  ];

  for (const { name, data } of budgets) {
    const emoji = data.status === 'exceeded' ? '🛑' :
                  data.status === 'critical' ? '⚠️' :
                  data.status === 'warning' ? '⚠️' : '✅';

    console.log(`${emoji} ${name}: $${data.used.toFixed(2)} / $${data.limit.toFixed(2)} (${data.percentUsed}%)`);
  }

  console.log('');

  // Circuit breaker status
  const breaker = statusData.breaker;
  if (breaker.tripped) {
    console.log('🛑 Circuit Breaker: TRIPPED');
    if (breaker.lastEvent) {
      console.log(`   Reason: ${breaker.lastEvent.reason}`);
      console.log(`   Time: ${new Date(breaker.lastEvent.timestamp).toLocaleString()}`);
    }
  } else {
    console.log('✅ Circuit Breaker: ACTIVE');
  }

  console.log('');

  // Top providers
  if (statusData.summary.providers.length > 0) {
    console.log('💰 Top Providers (today):\\n');
    statusData.summary.providers.slice(0, 3).forEach(p => {
      console.log(`   ${p.provider}/${p.model}: $${p.total_cost.toFixed(2)} (${p.request_count} requests)`);
    });
    console.log('');
  }

  // Top agents
  if (statusData.summary.topAgents.length > 0 && statusData.summary.topAgents[0].agent_id) {
    console.log('🤖 Top Agents (today):\\n');
    statusData.summary.topAgents.slice(0, 3).forEach(a => {
      console.log(`   ${a.agent_id}: $${a.total_cost.toFixed(2)}`);
    });
    console.log('');
  }

  console.log('View full dashboard: http://localhost:9090');
  console.log('='.repeat(60) + '\\n');

  governor.close();
}

/**
 * Open web dashboard
 */
export async function dashboard(args = {}) {
  console.log('\\n🚀 Starting Cost Governor dashboard...\\n');

  const port = args.port || 9090;

  // Start dashboard server
  const dashboardProc = spawn('node', [
    new URL('./dashboard.js', import.meta.url).pathname,
    '--port',
    port
  ], {
    stdio: 'inherit'
  });

  dashboardProc.on('error', (error) => {
    console.error('Failed to start dashboard:', error);
  });
}

/**
 * Reset circuit breaker
 */
export async function reset(args = {}) {
  const governor = getCostGovernor();

  console.log('\\n🔄 Resetting circuit breaker...\\n');

  const result = await governor.resetBreaker();

  if (result.success) {
    console.log('✅ Circuit breaker reset successfully');
    console.log('   Agents re-enabled and ready to use\\n');
  } else {
    console.log(`❌ Failed to reset: ${result.reason || result.error}\\n`);
  }

  governor.close();
}

/**
 * Generate cost report
 */
export async function report(args = {}) {
  const governor = getCostGovernor();
  const timeframe = args.last || args.timeframe || '7 days';
  const reportData = governor.getReport(timeframe);

  console.log('\\n' + '='.repeat(60));
  console.log(`OpenClaw Cost Report - Last ${timeframe}`);
  console.log('='.repeat(60) + '\\n');

  // Total
  console.log(`💰 Total Cost: $${reportData.total.total_cost.toFixed(2)}`);
  console.log(`📊 Total Requests: ${reportData.total.request_count}`);
  console.log(`📈 Average per request: $${(reportData.total.total_cost / reportData.total.request_count).toFixed(4)}\\n`);

  // By provider
  if (reportData.summary.length > 0) {
    console.log('Breakdown by Provider:\\n');
    reportData.summary.forEach(p => {
      const avgCost = p.total_cost / p.request_count;
      console.log(`  ${p.provider}/${p.model}:`);
      console.log(`    Cost: $${p.total_cost.toFixed(2)} (${p.request_count} requests)`);
      console.log(`    Avg: $${avgCost.toFixed(4)}/request\\n`);
    });
  }

  // Top agents
  if (reportData.topAgents.length > 0 && reportData.topAgents[0].agent_id) {
    console.log('Top Agents:\\n');
    reportData.topAgents.slice(0, 10).forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.agent_id}: $${a.total_cost.toFixed(2)} (${a.request_count} requests)`);
    });
    console.log('');
  }

  console.log('='.repeat(60) + '\\n');

  governor.close();
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const args = {};

  // Parse simple args
  for (let i = 3; i < process.argv.length; i += 2) {
    const key = process.argv[i].replace(/^--/, '');
    const value = process.argv[i + 1];
    args[key] = value;
  }

  switch (command) {
    case 'status':
      await status(args);
      break;
    case 'dashboard':
      await dashboard(args);
      break;
    case 'reset':
      await reset(args);
      break;
    case 'report':
      await report(args);
      break;
    default:
      console.log('\\nOpenClaw Cost Governor\\n');
      console.log('Usage: cost-governor <command> [options]\\n');
      console.log('Commands:');
      console.log('  status            Show current usage and budget status');
      console.log('  dashboard [--port 9090]   Open web dashboard');
      console.log('  reset             Reset circuit breaker');
      console.log('  report [--last "7 days"]  Generate cost report\\n');
      break;
  }
}
