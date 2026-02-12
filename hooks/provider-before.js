/**
 * OpenClaw Hook: Called before provider API request
 *
 * This hook is called before OpenClaw makes an API call to any provider
 * (OpenAI, Anthropic, Google, etc.)
 */

import { getCostGovernor } from '../src/index.js';

export default async function providerBefore(context) {
  const { requestId, provider, model, agentId, sessionId, requestData } = context;

  try {
    const governor = getCostGovernor();

    // Check if circuit breaker is tripped
    if (governor.breaker.tripped) {
      throw new Error('[Cost Governor] Circuit breaker is tripped. Reset to continue.');
    }

    // Track request start
    await governor.beforeRequest(requestId, provider, model, agentId, sessionId, requestData);

  } catch (error) {
    console.error('[Cost Governor] Error in provider-before hook:', error);
    // Don't block the request on error
  }
}
