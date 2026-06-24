/**
 * @quantum-hub/core-engine
 * Sovereign Quantum Orchestration Core Engine
 *
 * Main entry point. Exports all core modules for use by apps and services.
 */

'use strict';

const { QuantumOrchestrator, QuantumServiceRegistry, QuantumJob, JOB_STATUS, PROVIDER_TYPE } =
  require('./orchestrator/QuantumOrchestrator');
const { TelemetryDaemon } = require('./telemetry/TelemetryDaemon');
const { StateSync, StateNode, SYNC_STATE } = require('./state-sync/StateSync');
const { QuantumCompiler, QuantumCircuit, GATES } = require('./quantum-compiler/QuantumCompiler');
const { HybridExecutor, ALGORITHM } = require('./hybrid-executor/HybridExecutor');

/**
 * ChronosOS
 * The sovereign orchestration layer that wires together all core engine components.
 * Named after the Chronos OS concept from the Unicorn Hub Monorepo.
 */
class ChronosOS {
  constructor(options = {}) {
    this.nodeId = options.nodeId || `chronos-${Date.now()}`;

    // Initialize all subsystems
    this.orchestrator = new QuantumOrchestrator({
      maxConcurrent: options.maxConcurrent || 5,
      enableFallback: options.enableFallback !== false,
    });

    this.telemetry = new TelemetryDaemon({
      nodeId: this.nodeId,
      intervalMs: options.telemetryIntervalMs || 2000,
    });

    this.stateSync = new StateSync(this.nodeId);

    this.compiler = new QuantumCompiler({
      optimizationLevel: options.optimizationLevel || 1,
      targetBackend: options.targetBackend || 'generic',
    });

    this.hybridExecutor = new HybridExecutor(this.orchestrator, {
      maxLocalQubits: options.maxLocalQubits || 12,
    });

    this._wireEvents();
  }

  /**
   * Start all subsystems.
   */
  start() {
    this.orchestrator.start();
    this.telemetry.start();
    console.log(`[ChronosOS] System started on node: ${this.nodeId}`);
    return this;
  }

  /**
   * Stop all subsystems.
   */
  stop() {
    this.orchestrator.stop();
    this.telemetry.stop();
    console.log(`[ChronosOS] System stopped.`);
    return this;
  }

  /**
   * Get a full system health report.
   */
  getSystemHealth() {
    return {
      nodeId: this.nodeId,
      orchestrator: this.orchestrator.getHealth(),
      telemetry: this.telemetry.getSnapshot(),
      stateSync: this.stateSync.getGlobalState(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Wire internal events for cross-subsystem communication.
   */
  _wireEvents() {
    // Update telemetry when jobs complete
    this.orchestrator.on('job:completed', (job) => {
      this.telemetry.update({ jobsProcessed: (this.telemetry._metrics.jobsProcessed || 0) + 1 });
      this.stateSync.localUpdate('jobs', { [job.id]: { status: job.status, result: job.result } });
    });

    this.orchestrator.on('job:failed', (job) => {
      this.telemetry.update({ jobsFailed: (this.telemetry._metrics.jobsFailed || 0) + 1 });
    });

    // Pause quantum execution on high decoherence risk
    this.telemetry.on('decoherence:warning', (data) => {
      console.warn(`[ChronosOS] Decoherence warning! Risk: ${data.risk.toFixed(3)}. Pausing new submissions.`);
      this.stateSync.localUpdate('system', { decoherenceWarning: true, risk: data.risk });
    });
  }
}

module.exports = {
  ChronosOS,
  QuantumOrchestrator,
  QuantumServiceRegistry,
  QuantumJob,
  JOB_STATUS,
  PROVIDER_TYPE,
  TelemetryDaemon,
  StateSync,
  StateNode,
  SYNC_STATE,
  QuantumCompiler,
  QuantumCircuit,
  GATES,
  HybridExecutor,
  ALGORITHM,
};
