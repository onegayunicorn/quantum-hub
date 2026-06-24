/**
 * Quantum Hub API Gateway
 * Main server entry point
 *
 * Provides REST API and WebSocket endpoints for:
 * - Quantum job submission and status
 * - Telemetry streaming (Lux Arrays / prudent-twin-sync-flow)
 * - Service registry queries
 * - System health monitoring
 * - AI agent task submission
 */

'use strict';

const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Import core engine
const {
  ChronosOS,
  QuantumCircuit,
  QuantumCompiler,
} = require('../../../packages/core-engine/src/index');

const { OmegaAgent, TASK_TYPE } = require('../../../packages/ai-agent/src/index');
const { H2SManager } = require('../../../packages/hardware-drivers/src/H2SManager');

// ─── Initialize Systems ──────────────────────────────────────────────────────
const chronos = new ChronosOS({
  nodeId: 'gateway-primary',
  maxConcurrent: 10,
  telemetryIntervalMs: 1500,
  optimizationLevel: 2,
});

const omegaAgent = new OmegaAgent({
  agentId: 'omega-gateway',
  orchestrator: chronos.orchestrator,
  telemetry: chronos.telemetry,
});

const h2sManager = new H2SManager();

chronos.start();

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json(chronos.getSystemHealth());
});

// Quantum job submission
app.post('/api/jobs', (req, res) => {
  try {
    const { circuit, qubits = 4, shots = 1024, algorithm = 'custom', metadata = {} } = req.body;
    const job = chronos.orchestrator.submit({ circuit, qubits, shots, algorithm, metadata });
    res.status(201).json({ jobId: job.id, status: job.status, createdAt: job.createdAt });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get job status
app.get('/api/jobs/:jobId', (req, res) => {
  const job = chronos.orchestrator.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({
    jobId: job.id,
    status: job.status,
    result: job.result,
    provider: job.provider,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    checkpoints: job.checkpoints,
  });
});

// List all providers
app.get('/api/providers', (req, res) => {
  res.json(chronos.orchestrator.registry.listAll());
});

// Compile a circuit
app.post('/api/compile', (req, res) => {
  try {
    const { numQubits = 3, preset = 'bell', optimizationLevel = 1 } = req.body;
    const compiler = new QuantumCompiler({ optimizationLevel });
    let circuit;
    switch (preset) {
      case 'bell': circuit = QuantumCircuit.bellState(); break;
      case 'ghz': circuit = QuantumCircuit.ghzState(numQubits); break;
      case 'qft': circuit = QuantumCircuit.qft(numQubits); break;
      default: circuit = QuantumCircuit.bellState();
    }
    const compiled = compiler.compile(circuit);
    res.json(compiled);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Telemetry snapshot
app.get('/api/telemetry', (req, res) => {
  res.json(chronos.telemetry.getSnapshot());
});

// Telemetry history
app.get('/api/telemetry/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(chronos.telemetry.getHistory(limit));
});

// State sync
app.get('/api/state', (req, res) => {
  res.json(chronos.stateSync.getGlobalState());
});

// AI agent status
app.get('/api/agent', (req, res) => {
  res.json(omegaAgent.getStatus());
});

// Submit task to AI agent
app.post('/api/agent/tasks', async (req, res) => {
  try {
    const task = await omegaAgent.submitTask(req.body);
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Hardware devices
app.get('/api/devices', (req, res) => {
  res.json({
    installed: h2sManager.listDevices(),
    catalog: h2sManager.listCatalog(),
  });
});

app.post('/api/devices/:deviceId/install', async (req, res) => {
  try {
    const device = await h2sManager.install(req.params.deviceId);
    res.json(device.toJSON());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── HTTP + WebSocket Server ──────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws/telemetry' });

const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  console.log(`[WS] Client connected. Total: ${wsClients.size}`);

  // Send initial snapshot
  ws.send(JSON.stringify({ type: 'snapshot', data: chronos.telemetry.getSnapshot() }));

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log(`[WS] Client disconnected. Total: ${wsClients.size}`);
  });
});

// Broadcast telemetry to all WebSocket clients
chronos.telemetry.on('telemetry', (snapshot) => {
  const msg = JSON.stringify({ type: 'telemetry', data: snapshot });
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
});

// Broadcast job events
chronos.orchestrator.on('job:completed', (job) => {
  const msg = JSON.stringify({ type: 'job_completed', data: { jobId: job.id, result: job.result } });
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Quantum Hub API Gateway                         ║`);
  console.log(`║  REST API:  http://localhost:${PORT}               ║`);
  console.log(`║  WebSocket: ws://localhost:${PORT}/ws/telemetry    ║`);
  console.log(`║  Health:    http://localhost:${PORT}/health         ║`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);
});

module.exports = { app, server, chronos, omegaAgent, h2sManager };
