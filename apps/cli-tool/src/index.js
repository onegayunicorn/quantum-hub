#!/usr/bin/env node
/**
 * Quantum Hub CLI Tool (qhub)
 * Edge orchestration tool for constrained devices.
 * Designed to run on Moto G35 / Termux and other edge nodes.
 *
 * Commands:
 *   qhub health          — Check system health
 *   qhub submit          — Submit a quantum job
 *   qhub jobs            — List recent jobs
 *   qhub telemetry       — Show live telemetry
 *   qhub compile <preset>— Compile a circuit
 *   qhub devices         — List hardware devices
 *   qhub install <id>    — Install a hardware device
 *   qhub agent           — Show AI agent status
 */

'use strict';

const http = require('http');

const GATEWAY_URL = process.env.QUANTUM_GATEWAY || 'http://localhost:3001';
const args = process.argv.slice(2);
const command = args[0];

// ─── HTTP Helper ─────────────────────────────────────────────────────────────
function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(GATEWAY_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── Display Helpers ─────────────────────────────────────────────────────────
function printHeader(title) {
  const line = '═'.repeat(52);
  console.log(`\n╔${line}╗`);
  console.log(`║  ${title.padEnd(50)} ║`);
  console.log(`╚${line}╝`);
}

function printTable(rows) {
  if (!rows || rows.length === 0) { console.log('  (no data)'); return; }
  const keys = Object.keys(rows[0]);
  const widths = keys.map((k) => Math.max(k.length, ...rows.map((r) => String(r[k] || '').length)));
  const header = keys.map((k, i) => k.padEnd(widths[i])).join('  │  ');
  const sep = widths.map((w) => '─'.repeat(w)).join('──┼──');
  console.log(`  ${header}`);
  console.log(`  ${sep}`);
  rows.forEach((row) => {
    console.log(`  ${keys.map((k, i) => String(row[k] || '').padEnd(widths[i])).join('  │  ')}`);
  });
}

// ─── Commands ────────────────────────────────────────────────────────────────
async function cmdHealth() {
  printHeader('Quantum Hub — System Health');
  try {
    const health = await apiRequest('GET', '/health');
    console.log(`\n  Node ID:      ${health.nodeId}`);
    console.log(`  Timestamp:    ${health.timestamp}`);
    console.log(`\n  Orchestrator:`);
    console.log(`    Status:     ${health.orchestrator?.status}`);
    console.log(`    Queue:      ${health.orchestrator?.queueLength} jobs`);
    console.log(`    Active:     ${health.orchestrator?.activeJobs} jobs`);
    console.log(`    Completed:  ${health.orchestrator?.completedJobs} jobs`);
    console.log(`\n  Telemetry:`);
    const t = health.telemetry;
    if (t) {
      console.log(`    Coherence:  ${(t.coherenceLevel * 100).toFixed(1)}%`);
      console.log(`    Temp:       ${t.temperature?.toFixed(1)}°C`);
      console.log(`    Humidity:   ${t.humidity?.toFixed(1)}%`);
      console.log(`    Decoherence Risk: ${(t.decoherenceRisk * 100).toFixed(1)}%`);
    }
    console.log(`\n  Providers:`);
    printTable(health.orchestrator?.providers || []);
  } catch (err) {
    console.error(`  ERROR: Cannot reach gateway at ${GATEWAY_URL}`);
    console.error(`  ${err.message}`);
  }
}

async function cmdSubmit() {
  printHeader('Submit Quantum Job');
  const qubits = parseInt(args[1]) || 4;
  const algorithm = args[2] || 'custom';
  try {
    const result = await apiRequest('POST', '/api/jobs', {
      qubits,
      shots: 1024,
      algorithm,
      circuit: `${algorithm}_${qubits}q`,
    });
    console.log(`\n  Job submitted successfully!`);
    console.log(`  Job ID:    ${result.jobId}`);
    console.log(`  Status:    ${result.status}`);
    console.log(`  Created:   ${result.createdAt}`);
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
  }
}

async function cmdTelemetry() {
  printHeader('Live Telemetry Snapshot');
  try {
    const t = await apiRequest('GET', '/api/telemetry');
    console.log(`\n  Node:          ${t.nodeId}`);
    console.log(`  Timestamp:     ${t.timestamp}`);
    console.log(`  Coherence:     ${(t.coherenceLevel * 100).toFixed(2)}%`);
    console.log(`  Temperature:   ${t.temperature?.toFixed(2)}°C`);
    console.log(`  Humidity:      ${t.humidity?.toFixed(2)}%`);
    console.log(`  Magnetic Flux: ${t.magneticFlux?.toFixed(5)} T`);
    console.log(`  CPU Usage:     ${t.cpuUsage?.toFixed(1)}%`);
    console.log(`  Memory Usage:  ${t.memoryUsage?.toFixed(1)}%`);
    console.log(`  Decoherence Risk: ${(t.decoherenceRisk * 100).toFixed(2)}%`);
    console.log(`  Jobs Processed: ${t.jobsProcessed}`);
    console.log(`  Jobs Failed:    ${t.jobsFailed}`);
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
  }
}

async function cmdCompile() {
  const preset = args[1] || 'bell';
  printHeader(`Compile Circuit: ${preset}`);
  try {
    const result = await apiRequest('POST', '/api/compile', { preset, numQubits: 3, optimizationLevel: 2 });
    console.log(`\n  Circuit: ${preset}`);
    console.log(`  Qubits: ${result.circuit?.numQubits}`);
    console.log(`  Depth: ${result.circuit?.metadata?.depth}`);
    console.log(`  Gates Removed: ${result.circuit?.metadata?.gatesRemoved || 0}`);
    console.log(`\n  OpenQASM Output:`);
    console.log('  ' + (result.qasm || '').split('\n').join('\n  '));
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
  }
}

async function cmdDevices() {
  printHeader('Hardware Devices (H2S)');
  try {
    const data = await apiRequest('GET', '/api/devices');
    console.log(`\n  Installed Devices (${data.installed?.length || 0}):`);
    if (data.installed?.length) printTable(data.installed.map((d) => ({ id: d.id, name: d.name, status: d.status, type: d.type })));
    else console.log('  (none installed)');
    console.log(`\n  Available in Catalog (${data.catalog?.length || 0}):`);
    printTable(data.catalog?.map((d) => ({ id: d.id, name: d.name, type: d.type })) || []);
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
  }
}

async function cmdInstall() {
  const deviceId = args[1];
  if (!deviceId) { console.error('  Usage: qhub install <device-id>'); return; }
  printHeader(`Installing Device: ${deviceId}`);
  try {
    const device = await apiRequest('POST', `/api/devices/${deviceId}/install`);
    console.log(`\n  Device installed: ${device.name}`);
    console.log(`  Status: ${device.status}`);
    console.log(`  Installed at: ${device.installedAt}`);
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
  }
}

async function cmdAgent() {
  printHeader('Omega AI Agent Status');
  try {
    const agent = await apiRequest('GET', '/api/agent');
    console.log(`\n  Agent ID:    ${agent.agentId}`);
    console.log(`  Name:        ${agent.name}`);
    console.log(`  State:       ${agent.state}`);
    console.log(`  Queue:       ${agent.queueLength} tasks`);
    console.log(`  Completed:   ${agent.completedTasks} tasks`);
    console.log(`  Capabilities: ${agent.capabilities?.join(', ')}`);
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
  }
}

function cmdHelp() {
  printHeader('Quantum Hub CLI (qhub)');
  console.log(`
  Usage: qhub <command> [options]

  Commands:
    health              Show system health and provider status
    submit [qubits] [algorithm]  Submit a quantum job
    telemetry           Show live telemetry snapshot
    compile [preset]    Compile a circuit (bell | ghz | qft)
    devices             List hardware devices (H2S catalog)
    install <device-id> Install a hardware device
    agent               Show Omega AI agent status
    help                Show this help message

  Environment:
    QUANTUM_GATEWAY     Gateway URL (default: http://localhost:3001)

  Examples:
    qhub health
    qhub submit 5 VQE
    qhub compile ghz
    qhub install moto-g35-edge
  `);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  switch (command) {
    case 'health': await cmdHealth(); break;
    case 'submit': await cmdSubmit(); break;
    case 'telemetry': await cmdTelemetry(); break;
    case 'compile': await cmdCompile(); break;
    case 'devices': await cmdDevices(); break;
    case 'install': await cmdInstall(); break;
    case 'agent': await cmdAgent(); break;
    case 'help':
    default: cmdHelp(); break;
  }
})();
