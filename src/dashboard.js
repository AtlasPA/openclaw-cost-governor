import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getCostGovernor } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.argv.includes('--port') ?
  parseInt(process.argv[process.argv.indexOf('--port') + 1]) : 9090;

// Serve static files
app.use(express.static(join(__dirname, '../web')));

// API endpoints
app.get('/api/status', (req, res) => {
  try {
    const governor = getCostGovernor();
    const status = governor.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/report', (req, res) => {
  try {
    const governor = getCostGovernor();
    const timeframe = req.query.timeframe || '7 days';
    const report = governor.getReport(timeframe);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reset-breaker', (req, res) => {
  try {
    const governor = getCostGovernor();
    const result = governor.resetBreaker();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// x402 Payment endpoints for agent subscriptions
app.use(express.json());

app.post('/api/x402/subscribe', async (req, res) => {
  try {
    const { agent_wallet } = req.body;
    if (!agent_wallet) {
      return res.status(400).json({ error: 'agent_wallet required' });
    }

    const governor = getCostGovernor();
    const paymentRequest = await governor.createPaymentRequest(agent_wallet);

    res.json({
      success: true,
      payment_request: paymentRequest,
      instructions: 'Send payment via x402 protocol, then call /api/x402/verify with tx_hash'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/x402/verify', async (req, res) => {
  try {
    const { request_id, tx_hash, agent_wallet } = req.body;
    if (!request_id || !tx_hash || !agent_wallet) {
      return res.status(400).json({
        error: 'request_id, tx_hash, and agent_wallet required'
      });
    }

    const governor = getCostGovernor();
    const result = await governor.verifyPayment(request_id, tx_hash, agent_wallet);

    res.json({
      success: true,
      ...result,
      message: 'Payment verified! Pro features activated.'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/x402/license/:wallet', (req, res) => {
  try {
    const governor = getCostGovernor();
    const license = governor.checkLicense(req.params.wallet);

    res.json({
      ...license,
      pricing: {
        pro_monthly: '0.5 USDT/month',
        features: [
          'Unlimited history',
          'Advanced analytics',
          'Priority alerts',
          'Export reports'
        ]
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`\\n✅ Cost Governor dashboard running at http://localhost:${port}`);
  console.log('   Press Ctrl+C to stop\\n');
});
