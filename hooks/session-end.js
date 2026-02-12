/**
 * OpenClaw Hook: Called at end of session
 *
 * This hook is called when an OpenClaw session ends
 */

import { getCostGovernor } from '../src/index.js';

export default async function sessionEnd(context) {
  const { sessionId, duration } = context;

  try {
    const governor = getCostGovernor();

    // Get session summary
    const status = governor.getStatus();

    console.log(`[Cost Governor] Session ${sessionId} complete`);
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Today: $${status.budgets.daily.used.toFixed(2)} / $${status.budgets.daily.limit.toFixed(2)}`);

  } catch (error) {
    console.error('[Cost Governor] Error in session-end hook:', error);
  }
}
