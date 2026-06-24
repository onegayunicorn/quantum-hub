/**
 * StateSync.js
 * Chronos State Synchronization Module
 *
 * Cross-domain state mapping that connects neural activity signals, digital states,
 * and geometric forms. Implements the "State Sync" workflow from the PDF report.
 * Manages peer-to-peer node connectivity for the decentralized mesh.
 */

'use strict';

const { EventEmitter } = require('events');

const SYNC_STATE = {
  IDLE: 'IDLE',
  SYNCING: 'SYNCING',
  SYNCED: 'SYNCED',
  CONFLICT: 'CONFLICT',
  ERROR: 'ERROR',
};

/**
 * StateNode
 * Represents a single node in the decentralized mesh.
 */
class StateNode {
  constructor(id, type = 'edge') {
    this.id = id;
    this.type = type; // 'edge' | 'cloud' | 'mobile' | 'desktop'
    this.state = {};
    this.version = 0;
    this.lastSeen = new Date().toISOString();
    this.syncStatus = SYNC_STATE.IDLE;
  }

  update(patch) {
    this.state = { ...this.state, ...patch };
    this.version += 1;
    this.lastSeen = new Date().toISOString();
    this.syncStatus = SYNC_STATE.SYNCED;
  }
}

/**
 * StateSync
 * Manages distributed state across all nodes in the quantum mesh.
 * Implements optimistic concurrency with vector-clock-style versioning.
 */
class StateSync extends EventEmitter {
  constructor(localNodeId) {
    super();
    this.localNodeId = localNodeId;
    this.nodes = new Map();
    this.globalState = {};
    this.vectorClock = {};
    this._localNode = new StateNode(localNodeId, 'local');
    this.nodes.set(localNodeId, this._localNode);
  }

  /**
   * Register a remote node.
   */
  registerNode(nodeId, type = 'edge') {
    if (!this.nodes.has(nodeId)) {
      const node = new StateNode(nodeId, type);
      this.nodes.set(nodeId, node);
      this.vectorClock[nodeId] = 0;
      this.emit('node:registered', { nodeId, type });
      console.log(`[StateSync] Node registered: ${nodeId} (${type})`);
    }
  }

  /**
   * Apply a local state update and broadcast to peers.
   */
  localUpdate(domain, patch) {
    this._localNode.update({ [domain]: patch });
    this.vectorClock[this.localNodeId] = (this.vectorClock[this.localNodeId] || 0) + 1;

    const event = {
      sourceNodeId: this.localNodeId,
      domain,
      patch,
      version: this.vectorClock[this.localNodeId],
      timestamp: new Date().toISOString(),
    };

    this.globalState[domain] = { ...this.globalState[domain], ...patch };
    this.emit('state:updated', event);
    this.emit('state:broadcast', event);
    return event;
  }

  /**
   * Apply an incoming state update from a remote node.
   */
  remoteUpdate(event) {
    const { sourceNodeId, domain, patch, version } = event;

    if (!this.nodes.has(sourceNodeId)) {
      this.registerNode(sourceNodeId, 'remote');
    }

    const node = this.nodes.get(sourceNodeId);
    const currentVersion = this.vectorClock[sourceNodeId] || 0;

    if (version <= currentVersion) {
      // Stale update — ignore
      return { accepted: false, reason: 'stale' };
    }

    node.update({ [domain]: patch });
    this.vectorClock[sourceNodeId] = version;
    this.globalState[domain] = { ...this.globalState[domain], ...patch };

    this.emit('state:updated', { ...event, local: false });
    return { accepted: true };
  }

  /**
   * Get the full global state.
   */
  getGlobalState() {
    return {
      state: { ...this.globalState },
      vectorClock: { ...this.vectorClock },
      nodeCount: this.nodes.size,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get a specific domain state.
   */
  getDomain(domain) {
    return this.globalState[domain] || null;
  }

  /**
   * List all registered nodes.
   */
  listNodes() {
    return Array.from(this.nodes.values()).map((n) => ({
      id: n.id,
      type: n.type,
      version: n.version,
      lastSeen: n.lastSeen,
      syncStatus: n.syncStatus,
    }));
  }
}

module.exports = { StateSync, StateNode, SYNC_STATE };
