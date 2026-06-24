# ⬡ Quantum Hub

**Sovereign Quantum-Bio-AI Unified Platform**

A comprehensive multi-platform quantum orchestration ecosystem. Quantum Hub bridges classical edge devices, mobile applications, desktop clients, and web dashboards with remote quantum backends through a unified orchestration engine — the **ChronosOS** core.

---

## Architecture Overview

```
quantum-hub/
├── apps/
│   ├── web-dashboard/       # Unified quantum dashboard (HTML/JS, real-time WebSocket)
│   ├── mobile-app/          # React Native mobile app (quantum-classical bridge)
│   ├── desktop-app/         # Electron desktop application
│   ├── cli-tool/            # Node.js CLI for edge orchestration (Termux / Moto G35)
│   └── api-gateway/         # Express REST + WebSocket API server
├── packages/
│   ├── core-engine/         # ChronosOS — quantum orchestrator, telemetry, state sync
│   ├── ui-components/       # Shared React components (glassmorphism, dark mode)
│   ├── hardware-drivers/    # H2S (Hardware-to-Software) device abstraction layer
│   └── ai-agent/            # Omega AI agent — predictive scheduling and orchestration
├── infrastructure/
│   ├── docker/              # Docker Compose stack (PostgreSQL, Redis, ClickHouse, Traefik)
│   └── k8s/                 # Kubernetes deployment manifests
└── docs/                    # Architecture documentation
```

---

## Quick Start

### 1. Install dependencies and start the API Gateway

```bash
cd apps/api-gateway && npm install && npm run dev
# Running at http://localhost:3001
```

### 2. Start the Web Dashboard

```bash
cd apps/web-dashboard && npm install && npm run dev
# Running at http://localhost:3000
```

### 3. Use the CLI

```bash
node apps/cli-tool/src/index.js health
node apps/cli-tool/src/index.js submit 4 VQE
node apps/cli-tool/src/index.js telemetry
node apps/cli-tool/src/index.js compile bell
node apps/cli-tool/src/index.js devices
node apps/cli-tool/src/index.js agent
```

### 4. Run with Docker Compose

```bash
cd infrastructure/docker && docker-compose up -d
```

---

## Core Components

| Component | Path | Description |
|---|---|---|
| ChronosOS Core Engine | `packages/core-engine` | Quantum orchestrator, telemetry, state sync, compiler, hybrid executor |
| API Gateway | `apps/api-gateway` | REST + WebSocket API server |
| Web Dashboard | `apps/web-dashboard` | Real-time quantum operations dashboard |
| CLI Tool | `apps/cli-tool` | Edge orchestration CLI for Termux/Moto G35 |
| Mobile App | `apps/mobile-app` | React Native quantum-classical bridge |
| Desktop App | `apps/desktop-app` | Electron desktop client |
| H2S Hardware Drivers | `packages/hardware-drivers` | VR/XR, edge, holographic device abstraction |
| Omega AI Agent | `packages/ai-agent` | Predictive scheduling and agentic orchestration |

---

## License

MIT — see [LICENSE](LICENSE)

*Quantum Hub v1.0.0 — Built on the Unicorn Hub Monorepo / Chronos OS architecture*
