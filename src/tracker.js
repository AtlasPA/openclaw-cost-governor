export class TokenTracker {
  constructor(storage) {
    this.storage = storage;
    this.pendingRequests = new Map();
  }

  /**
   * Called before provider API request
   */
  async beforeRequest(requestId, provider, model, agentId, sessionId, requestData) {
    this.pendingRequests.set(requestId, {
      provider,
      model,
      agentId,
      sessionId,
      requestData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Called after provider API response
   */
  async afterRequest(requestId, response) {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      console.warn(`[Cost Governor] No pending request found for ID: ${requestId}`);
      return null;
    }

    this.pendingRequests.delete(requestId);

    // Extract token counts from response
    const tokens = this.extractTokens(response, pending.provider);

    // Calculate cost
    const cost = this.calculateCost(
      pending.provider,
      pending.model,
      tokens.prompt,
      tokens.completion
    );

    // Record usage
    const usageData = {
      timestamp: pending.timestamp,
      provider: pending.provider,
      model: pending.model,
      agent_id: pending.agentId,
      session_id: pending.sessionId,
      tokens_prompt: tokens.prompt,
      tokens_completion: tokens.completion,
      tokens_total: tokens.total,
      cost_usd: cost,
      task_type: pending.requestData?.task_type,
      request_data: pending.requestData
    };

    this.storage.recordUsage(usageData);

    return {
      ...usageData,
      cost_usd: cost
    };
  }

  /**
   * Extract token counts from provider response
   */
  extractTokens(response, provider) {
    let prompt = 0;
    let completion = 0;

    try {
      if (provider === 'openai') {
        prompt = response?.usage?.prompt_tokens || 0;
        completion = response?.usage?.completion_tokens || 0;
      } else if (provider === 'anthropic') {
        prompt = response?.usage?.input_tokens || 0;
        completion = response?.usage?.output_tokens || 0;
      } else if (provider === 'google') {
        prompt = response?.usageMetadata?.promptTokenCount || 0;
        completion = response?.usageMetadata?.candidatesTokenCount || 0;
      } else {
        // Generic fallback
        prompt = response?.usage?.prompt_tokens || response?.usage?.input_tokens || 0;
        completion = response?.usage?.completion_tokens || response?.usage?.output_tokens || 0;
      }
    } catch (error) {
      console.error('[Cost Governor] Error extracting tokens:', error);
    }

    return {
      prompt,
      completion,
      total: prompt + completion
    };
  }

  /**
   * Calculate cost based on current pricing
   */
  calculateCost(provider, model, promptTokens, completionTokens) {
    const pricing = this.storage.getPricing(provider, model);

    if (!pricing) {
      console.warn(`[Cost Governor] No pricing found for ${provider}/${model}`);
      return 0;
    }

    const promptCost = (promptTokens / 1000) * pricing.cost_per_1k_prompt;
    const completionCost = (completionTokens / 1000) * pricing.cost_per_1k_completion;

    return promptCost + completionCost;
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(timeframe = '1 day') {
    return {
      summary: this.storage.getUsageSummary(timeframe),
      total: this.storage.getTotalCost(timeframe),
      topAgents: this.storage.getTopAgents(timeframe, 5)
    };
  }
}
