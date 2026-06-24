/**
 * H2SManager.js
 * Hardware-to-Software (H2S) Manager
 *
 * Abstracts physical hardware devices as modular software packages.
 * Manages VR/XR devices, edge nodes, and holographic displays as
 * software-installable capabilities in the quantum mesh.
 *
 * Based on the H2S architecture described in the PDF report:
 * - VR Hardware Packages (Quest 3, Vision Pro, Pico 4, Varjo)
 * - Holographic Kiosk integration
 * - Edge node deployment (Moto G35 / Termux)
 * - Sovereign Engine spatial mesh reconstruction
 */

'use strict';

const { EventEmitter } = require('events');

const DEVICE_TYPE = {
  VR_XR: 'VR_XR',
  HOLOGRAPHIC: 'HOLOGRAPHIC',
  EDGE_NODE: 'EDGE_NODE',
  MOBILE: 'MOBILE',
  DESKTOP: 'DESKTOP',
  QUANTUM_PROCESSOR: 'QUANTUM_PROCESSOR',
};

const DEVICE_STATUS = {
  OFFLINE: 'OFFLINE',
  CONNECTING: 'CONNECTING',
  ONLINE: 'ONLINE',
  DEGRADED: 'DEGRADED',
  INSTALLING: 'INSTALLING',
};

// ─── Hardware Device Catalog ─────────────────────────────────────────────────
const DEVICE_CATALOG = {
  'meta-quest-3': {
    id: 'meta-quest-3',
    name: 'Meta Quest 3',
    type: DEVICE_TYPE.VR_XR,
    capabilities: ['6dof_tracking', 'hand_tracking', 'passthrough', 'webxr', 'openxr'],
    renderingBackend: 'WebXR/WebGL2',
    maxQubitsLocal: 0,
    h2sPackage: 'packages/vr-hardware/src/devices/quest3',
  },
  'apple-vision-pro': {
    id: 'apple-vision-pro',
    name: 'Apple Vision Pro',
    type: DEVICE_TYPE.VR_XR,
    capabilities: ['eye_tracking', 'hand_tracking', 'spatial_audio', 'visionos', 'webxr'],
    renderingBackend: 'Metal/WebXR',
    maxQubitsLocal: 0,
    h2sPackage: 'packages/vr-hardware/src/devices/vision-pro',
  },
  'pico-4-ultra': {
    id: 'pico-4-ultra',
    name: 'Pico 4 Ultra Enterprise',
    type: DEVICE_TYPE.VR_XR,
    capabilities: ['6dof_tracking', 'eye_tracking', 'enterprise_mdm', 'openxr'],
    renderingBackend: 'OpenXR/Vulkan',
    maxQubitsLocal: 0,
    h2sPackage: 'packages/vr-hardware/src/devices/pico4-ultra',
  },
  'varjo-xr-4': {
    id: 'varjo-xr-4',
    name: 'Varjo XR-4',
    type: DEVICE_TYPE.VR_XR,
    capabilities: ['high_fidelity_passthrough', 'eye_tracking', 'varjo_reality_cloud'],
    renderingBackend: 'DirectX12/Vulkan',
    maxQubitsLocal: 0,
    h2sPackage: 'packages/vr-hardware/src/devices/varjo-xr4',
  },
  'axiom-holographic': {
    id: 'axiom-holographic',
    name: 'Axiom Holographics Display',
    type: DEVICE_TYPE.HOLOGRAPHIC,
    capabilities: ['glasses_free_3d', 'lightfield', 'webgl2'],
    renderingBackend: 'WebGL2/LightField',
    maxQubitsLocal: 0,
    h2sPackage: 'packages/holographic-kiosk/src/hardware/axiom',
  },
  'moto-g35-edge': {
    id: 'moto-g35-edge',
    name: 'Moto G35 Edge Node (Termux)',
    type: DEVICE_TYPE.EDGE_NODE,
    capabilities: ['termux_linux', 'vulkan_compute', 'arm64', 'persistent_websocket'],
    renderingBackend: 'Termux/Vulkan',
    maxQubitsLocal: 8,
    h2sPackage: 'packages/chronos-os/src/kernel',
  },
};

/**
 * H2SDevice
 * Software representation of a physical hardware device.
 */
class H2SDevice {
  constructor(catalogEntry) {
    Object.assign(this, catalogEntry);
    this.status = DEVICE_STATUS.OFFLINE;
    this.installedAt = null;
    this.lastHeartbeat = null;
    this.spatialAnchor = null;
    this.metrics = { latencyMs: 0, frameRate: 0, batteryLevel: null };
  }

  install() {
    this.status = DEVICE_STATUS.INSTALLING;
    return new Promise((resolve) => {
      setTimeout(() => {
        this.status = DEVICE_STATUS.ONLINE;
        this.installedAt = new Date().toISOString();
        this.lastHeartbeat = new Date().toISOString();
        resolve(this);
      }, 200 + Math.random() * 300);
    });
  }

  heartbeat() {
    this.lastHeartbeat = new Date().toISOString();
    this.metrics.latencyMs = 5 + Math.random() * 20;
    this.metrics.frameRate = 72 + Math.floor(Math.random() * 18);
  }

  setSpatialAnchor(anchor) {
    this.spatialAnchor = anchor;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      capabilities: this.capabilities,
      installedAt: this.installedAt,
      lastHeartbeat: this.lastHeartbeat,
      metrics: this.metrics,
      spatialAnchor: this.spatialAnchor,
    };
  }
}

/**
 * H2SManager
 * Manages the lifecycle of all hardware-as-software devices in the mesh.
 */
class H2SManager extends EventEmitter {
  constructor() {
    super();
    this.devices = new Map();
    this._heartbeatTimer = null;
  }

  /**
   * Install a device from the catalog.
   */
  async install(deviceId) {
    const entry = DEVICE_CATALOG[deviceId];
    if (!entry) throw new Error(`Unknown device: ${deviceId}. Available: ${Object.keys(DEVICE_CATALOG).join(', ')}`);

    if (this.devices.has(deviceId)) {
      console.log(`[H2SManager] Device ${deviceId} already installed.`);
      return this.devices.get(deviceId);
    }

    const device = new H2SDevice(entry);
    this.devices.set(deviceId, device);
    this.emit('device:installing', device.toJSON());

    await device.install();
    this.emit('device:online', device.toJSON());
    console.log(`[H2SManager] Device installed: ${device.name} (${deviceId})`);
    return device;
  }

  /**
   * Uninstall a device.
   */
  uninstall(deviceId) {
    if (!this.devices.has(deviceId)) return false;
    const device = this.devices.get(deviceId);
    device.status = DEVICE_STATUS.OFFLINE;
    this.devices.delete(deviceId);
    this.emit('device:offline', { id: deviceId });
    return true;
  }

  /**
   * Get a device by ID.
   */
  getDevice(deviceId) {
    return this.devices.get(deviceId) || null;
  }

  /**
   * List all installed devices.
   */
  listDevices() {
    return Array.from(this.devices.values()).map((d) => d.toJSON());
  }

  /**
   * List all available devices from the catalog.
   */
  listCatalog() {
    return Object.values(DEVICE_CATALOG);
  }

  /**
   * Start heartbeat monitoring for all installed devices.
   */
  startHeartbeat(intervalMs = 5000) {
    this._heartbeatTimer = setInterval(() => {
      for (const device of this.devices.values()) {
        if (device.status === DEVICE_STATUS.ONLINE) {
          device.heartbeat();
          this.emit('device:heartbeat', device.toJSON());
        }
      }
    }, intervalMs);
  }

  stopHeartbeat() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
  }
}

module.exports = { H2SManager, H2SDevice, DEVICE_CATALOG, DEVICE_TYPE, DEVICE_STATUS };
