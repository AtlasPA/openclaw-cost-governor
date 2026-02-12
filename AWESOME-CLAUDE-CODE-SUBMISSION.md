# Awesome Claude Code Resource Submission

**Submission URL:** https://github.com/hesreallyhim/awesome-claude-code/issues/new?template=recommend-resource.yml

---

## Form Fields

### Display Name
```
OpenClaw Cost Governor
```

### Category
```
Tooling
```

### Sub-Category
```
Tooling: Usage Monitors
```

### Primary Link
```
https://github.com/AtlasPA/openclaw-cost-governor
```

### Author Name
```
AtlasPA
```

### Author Link
```
https://github.com/AtlasPA
```

### License
```
MIT
```

### Description
```
Real-time cost tracking with proactive alerts and automatic circuit breakers for OpenClaw agents. Monitor every API call, set multi-tier budgets (hourly/daily/monthly), get spending alerts, and automatically pause agents when budget exceeded. Free tier: basic tracking. Pro tier (0.5 USDT/month): unlimited tracking with circuit breakers and AI-powered cost optimization recommendations. Includes CLI and web dashboard on port 9090.
```

### Validate Claims
```
1. Install the tool: `cd ~/.openclaw && git clone https://github.com/AtlasPA/openclaw-cost-governor.git && cd openclaw-cost-governor && npm install && npm run setup`
2. Start the dashboard: `npm run dashboard` (runs on http://localhost:9090)
3. Check cost status: `node src/cli.js status --wallet 0xTestWallet`
4. Make some API calls through OpenClaw and observe cost tracking in real-time
5. Set a budget: `node src/cli.js set-budget --daily 5.00 --wallet 0xTestWallet`
6. Observe automatic alerts at 75%, 90%, 100% thresholds
```

### Specific Task(s)
```
Install the OpenClaw Cost Governor and configure budget limits. Make several API calls with different models and observe cost tracking, budget monitoring, and automatic alerts when approaching limits.
```

### Specific Prompt(s)
```
"Install the OpenClaw Cost Governor from ~/.openclaw/openclaw-cost-governor and set a daily budget of $5. Show me my current spending and which providers are costing the most."
```

### Additional Comments
```
This is part of the OpenClaw ecosystem (5 tools total: Cost Governor, Memory System, Context Optimizer, Smart Router, and API Quota Tracker). All tools use the same x402 payment protocol for Pro tier subscriptions. The Cost Governor provides the foundation for budget-aware routing in Smart Router and cost optimization recommendations based on usage patterns.
```

### Recommendation Checklist
- [x] I have checked that this resource hasn't already been submitted
- [x] My resource provides genuine value to Claude Code users, and any risks are clearly stated
- [x] All provided links are working and publicly accessible
- [x] I am submitting only ONE resource in this issue
- [x] I understand that low-quality or duplicate submissions may be rejected

---

## Instructions

1. Go to: https://github.com/hesreallyhim/awesome-claude-code/issues/new?template=recommend-resource.yml
2. Copy and paste each field from above into the corresponding form field
3. Check all the checkboxes at the bottom
4. Click "Submit new issue"
5. The automated validator will check your submission and post results as a comment
