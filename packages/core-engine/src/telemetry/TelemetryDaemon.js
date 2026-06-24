/**
 * TelemetryDaemon.js
 * Lux Arrays Telemetry Daemon
 *
 * Streams real-time telemetry data to dashboards (prudent-twin-sync-flow).
 * Monitors quantum decoherence levels, node health, job throughput, and
 * environmental factors. Based on the Lux Arrays concept from the PDF report.
 */

'use strict';

const { EventEmitter } = require('events');

/**
 * TelemetryDaemon
 * Collects and broadcasts system telemetry at configurable intervals.
 */
class TelemetryDaemon extends EventEmitter {
  constructor(options = {}) {
    super();
    this.intervalMs = options.intervalMs || 2000;
    this.nodeId = options.nodeId || `node-${Math.random().toString(36).slice(2, 8)}`;
    this._timer = null;
    this._metrics = {
      coherenceLevel: 0.95,
      temperature: 15.2,
      humidity: 42.0,
      magneticFlux: 0.001,
      jobsProcessed: 0,
      jobsFailed: 0,
      queueDepth: 0,
      cpuUsage: 0,
      memoryUsage: 0,
    };
    this._history = [];
    this._maxHistory = options.maxHistory || 100;
  }

  /**
   * Start the telemetry collection loop.
   */
  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._collect(), this.intervalMs);
    console.log(`[TelemetryDaemon] Started on node ${this.nodeId}, interval: ${this.intervalMs}ms`);
    this.emit('started', { nodeId: this.nodeId });
  }

  /**
   * Stop the telemetry collection loop.
   */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    console.log(`[TelemetryDaemon] Stopped on node ${this.nodeId}`);
    this.emit('stopped', { nodeId: this.nodeId });
  }

  /**
   * Update metrics from external sources (e.g., orchestrator callbacks).
   */
  update(patch) {
    Object.assign(this._metrics, patch);
  }

  /**
   * Get the latest telemetry snapshot.
   */
  getSnapshot() {
    return {
      nodeId: this.nodeId,
      timestamp: new Date().toISOString(),
      ...this._metrics,
      decoherenceRisk: this._calculateDecoherenceRisk(),
    };
  }

  /**
   * Get historical telemetry data.
   */
  getHistory(limit = 50) {
    return this._history.slice(-limit);
  }

  /**
   * Internal: collect metrics and emit telemetry event.
   */
  _collect() {
    // Simulate realistic metric drift
    this._metrics.coherenceLevel = this._drift(this._metrics.coherenceLevel, 0.85, 0.99, 0.005);
    this._metrics.temperature = this._drift(this._metrics.temperature, 10, 25, 0.3);
    this._metrics.humidity = this._drift(this._metrics.humidity, 30, 70, 1.0);
    this._metrics.magneticFlux = this._drift(this._metrics.magneticFlux, 0.0005, 0.005, 0.0002);
    this._metrics.cpuUsage = this._drift(this._metrics.cpuUsage, 5, 85, 5);
    this._metrics.memoryUsage = this._drift(this._metrics.memoryUsage, 20, 80, 3);

    const snapshot = this.getSnapshot();
    this._history.push(snapshot);
    if (this._history.length > this._maxHistory) this._history.shift();

    this.emit('telemetry', snapshot);

    // Emit decoherence warning if risk is high
    if (snapshot.decoherenceRisk > 0.7) {
      this.emit('decoherence:warning', {
        nodeId: this.nodeId,
        risk: snapshot.decoherenceRisk,
        timestamp: snapshot.timestamp,
      });
    }
  }

  /**
   * Calculate decoherence risk based on environmental factors.
   * High humidity, temperature extremes, and magnetic flux increase risk.
   */
  _calculateDecoherenceRisk() {
    const humidityFactor = Math.max(0, (this._metrics.humidity - 50) / 50);
    const tempFactor = Math.abs(this._metrics.temperature - 15) / 15;
    const fluxFactor = this._metrics.magneticFlux / 0.005;
    const coherenceFactor = 1 - this._metrics.coherenceLevel;
    return Math.min(1, (humidityFactor + tempFactor + fluxFactor + coherenceFactor) / 4);
  }

  /**
   * Drift a value within bounds with a random step.
   */
  _drift(current, min, max, step) {
    const delta = (Math.random() - 0.5) * 2 * step;
    return Math.max(min, Math.min(max, current + delta));
  }
}

module.exports = { TelemetryDaemon };
