/**
 * OpenClaw Hook: Called after provider API response
 *
 * This hook is called after OpenClaw receives a response from any provider
 * (OpenAI, Anthropic, Google, etc.)
 */

import { getCostGovernor } from '../src/index.js';

export default async function providerAfter(context) {
  const { requestId, response } = context;

  try {
    const governor = getCostGovernor();

    // Track response and calculate cost
    await governor.afterRequest(requestId, response);

  } catch (error) {
    console.error('[Cost Governor] Error in provider-after hook:', error);
    // Don't block on error
  }
}
