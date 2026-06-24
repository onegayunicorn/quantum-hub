/**
 * QuantumOrchestrator.js
 * Sovereign Quantum Orchestration Core
 *
 * Manages job submission, routing, and lifecycle for hybrid classical-quantum workloads.
 * Implements the Quantum Service Registry, resource discovery, and graceful fallback
 * to classical approximations when quantum backends are unavailable.
 *
 * Architecture: Based on the Unicorn Hub Monorepo / Chronos OS design principles.
 */

'use strict';

const { EventEmitter } = require('events');

// ─── Job Status Constants ────────────────────────────────────────────────────
const JOB_STATUS = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  FALLBACK: 'FALLBACK_CLASSICAL',
};

// ─── Provider Types ──────────────────────────────────────────────────────────
const PROVIDER_TYPE = {
  GATE_BASED: 'GATE_BASED',
  ANNEALING: 'ANNEALING',
  PHOTONIC: 'PHOTONIC',
  SIMULATOR: 'SIMULATOR',
};

/**
 * QuantumServiceRegistry
 * Maintains a catalog of available quantum backends and their capabilities.
 */
class QuantumServiceRegistry {
  constructor() {
    this.providers = new Map();
    this._registerDefaults();
  }

  _registerDefaults() {
    this.register({
      id: 'ibm-quantum-sim',
      name: 'IBM Quantum Simulator',
      type: PROVIDER_TYPE.SIMULATOR,
      maxQubits: 32,
      available: true,
      latencyMs: 120,
      noiseModel: 'depolarizing',
      endpoint: 'https://api.quantum-computing.ibm.com/v2/jobs',
    });
    this.register({
      id: 'ionq-harmony-sim',
      name: 'IonQ Harmony Simulator',
      type: PROVIDER_TYPE.SIMULATOR,
      maxQubits: 11,
      available: true,
      latencyMs: 200,
      noiseModel: 'ion-trap',
      endpoint: 'https://api.ionq.co/v0.3/jobs',
    });
    this.register({
      id: 'local-statevector',
      name: 'Local Statevector Simulator',
      type: PROVIDER_TYPE.SIMULATOR,
      maxQubits: 20,
      available: true,
      latencyMs: 5,
      noiseModel: 'none',
      endpoint: 'local',
    });
  }

  register(provider) {
    this.providers.set(provider.id, { ...provider, registeredAt: new Date().toISOString() });
  }

  getAvailable(requiredQubits = 1) {
    return Array.from(this.providers.values()).filter(
      (p) => p.available && p.maxQubits >= requiredQubits
    );
  }

  getBestFor(requiredQubits, preferLowLatency = true) {
    const available = this.getAvailable(requiredQubits);
    if (!available.length) return null;
    return available.sort((a, b) =>
      preferLowLatency ? a.latencyMs - b.latencyMs : b.maxQubits - a.maxQubits
    )[0];
  }

  listAll() {
    return Array.from(this.providers.values());
  }
}

/**
 * QuantumJob
 * Represents a single quantum computation task.
 */
class QuantumJob {
  constructor({ id, circuit, qubits, shots = 1024, algorithm = 'custom', metadata = {} }) {
    this.id = id || `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.circuit = circuit;
    this.qubits = qubits;
    this.shots = shots;
    this.algorithm = algorithm;
    this.metadata = metadata;
    this.status = JOB_STATUS.PENDING;
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;
    this.result = null;
    this.provider = null;
    this.error = null;
    this.checkpoints = [];
  }

  checkpoint(label) {
    this.checkpoints.push({ label, time: new Date().toISOString() });
  }

  setStatus(status, extra = {}) {
    this.status = status;
    this.updatedAt = new Date().toISOString();
    Object.assign(this, extra);
  }
}

/**
 * QuantumOrchestrator
 * Main orchestration class. Manages job queue, provider routing, execution,
 * error mitigation, and classical fallback.
 */
class QuantumOrchestrator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.registry = new QuantumServiceRegistry();
    this.jobQueue = [];
    this.activeJobs = new Map();
    this.completedJobs = new Map();
    this.maxConcurrent = options.maxConcurrent || 5;
    this.enableFallback = options.enableFallback !== false;
    this.telemetryCallback = options.telemetryCallback || null;
    this._running = false;
  }

  /**
   * Submit a quantum job to the orchestrator.
   * @param {object} jobSpec - Job specification
   * @returns {QuantumJob}
   */
  submit(jobSpec) {
    const job = new QuantumJob(jobSpec);
    job.setStatus(JOB_STATUS.QUEUED);
    this.jobQueue.push(job);
    this.emit('job:queued', job);
    this._log(`Job queued: ${job.id} | Algorithm: ${job.algorithm} | Qubits: ${job.qubits}`);
    if (this._running) this._processQueue();
    return job;
  }

  /**
   * Start the orchestrator processing loop.
   */
  start() {
    this._running = true;
    this._log('Quantum Orchestrator started. Processing queue...');
    this._processQueue();
  }

  /**
   * Stop the orchestrator.
   */
  stop() {
    this._running = false;
    this._log('Quantum Orchestrator stopped.');
  }

  /**
   * Internal: process jobs from the queue up to maxConcurrent.
   */
  async _processQueue() {
    while (this._running && this.jobQueue.length > 0 && this.activeJobs.size < this.maxConcurrent) {
      const job = this.jobQueue.shift();
      this.activeJobs.set(job.id, job);
      this._executeJob(job).then(() => {
        this.activeJobs.delete(job.id);
        this.completedJobs.set(job.id, job);
        this._processQueue();
      });
    }
  }

  /**
   * Execute a single quantum job with provider selection and fallback.
   */
  async _executeJob(job) {
    const provider = this.registry.getBestFor(job.qubits);

    if (!provider) {
      if (this.enableFallback) {
        return this._classicalFallback(job, 'No quantum provider available');
      }
      job.setStatus(JOB_STATUS.FAILED, { error: 'No available quantum provider' });
      this.emit('job:failed', job);
      return;
    }

    job.setStatus(JOB_STATUS.RUNNING, { provider: provider.id });
    job.checkpoint('execution_start');
    this.emit('job:running', job);
    this._log(`Executing job ${job.id} on provider: ${provider.name}`);

    try {
      const result = await this._simulateExecution(job, provider);
      job.checkpoint('execution_complete');
      job.setStatus(JOB_STATUS.COMPLETED, { result });
      this.emit('job:completed', job);
      this._log(`Job ${job.id} completed. Counts: ${JSON.stringify(result.counts)}`);
    } catch (err) {
      if (this.enableFallback) {
        return this._classicalFallback(job, err.message);
      }
      job.setStatus(JOB_STATUS.FAILED, { error: err.message });
      this.emit('job:failed', job);
    }
  }

  /**
   * Simulate quantum circuit execution (local statevector simulation).
   * In production, this would call the actual provider API.
   */
  async _simulateExecution(job, provider) {
    // Simulate network latency
    await this._delay(provider.latencyMs + Math.random() * 50);

    // Generate simulated measurement counts
    const numStates = Math.pow(2, Math.min(job.qubits, 8));
    const counts = {};
    let remaining = job.shots;

    for (let i = 0; i < numStates - 1; i++) {
      const state = i.toString(2).padStart(job.qubits, '0');
      const count = Math.floor(Math.random() * (remaining / (numStates - i)));
      counts[state] = count;
      remaining -= count;
    }
    const lastState = (numStates - 1).toString(2).padStart(job.qubits, '0');
    counts[lastState] = remaining;

    return {
      counts,
      shots: job.shots,
      provider: provider.id,
      executionTime: provider.latencyMs,
      noiseModel: provider.noiseModel,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Classical fallback: approximate the quantum result using classical methods.
   */
  async _classicalFallback(job, reason) {
    this._log(`FALLBACK: Job ${job.id} falling back to classical approximation. Reason: ${reason}`);
    job.checkpoint('fallback_start');

    await this._delay(10);

    const result = {
      counts: { ['0'.repeat(job.qubits)]: job.shots },
      shots: job.shots,
      provider: 'classical-fallback',
      executionTime: 10,
      noiseModel: 'none',
      isFallback: true,
      fallbackReason: reason,
      timestamp: new Date().toISOString(),
    };

    job.setStatus(JOB_STATUS.FALLBACK, { result });
    job.checkpoint('fallback_complete');
    this.emit('job:fallback', job);
  }

  /**
   * Get status of a job by ID.
   */
  getJob(jobId) {
    return (
      this.activeJobs.get(jobId) ||
      this.completedJobs.get(jobId) ||
      this.jobQueue.find((j) => j.id === jobId) ||
      null
    );
  }

  /**
   * Get system health summary.
   */
  getHealth() {
    return {
      status: this._running ? 'RUNNING' : 'STOPPED',
      queueLength: this.jobQueue.length,
      activeJobs: this.activeJobs.size,
      completedJobs: this.completedJobs.size,
      providers: this.registry.listAll().map((p) => ({
        id: p.id,
        name: p.name,
        available: p.available,
        maxQubits: p.maxQubits,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  _log(msg) {
    const ts = new Date().toISOString();
    const line = `[QuantumOrchestrator ${ts}] ${msg}`;
    console.log(line);
    if (this.telemetryCallback) this.telemetryCallback({ type: 'log', message: msg, timestamp: ts });
  }
}

module.exports = { QuantumOrchestrator, QuantumServiceRegistry, QuantumJob, JOB_STATUS, PROVIDER_TYPE };
