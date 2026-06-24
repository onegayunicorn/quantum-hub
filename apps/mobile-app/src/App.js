/**
 * Quantum Hub Mobile App
 * React Native — Quantum-Classical Bridge
 *
 * The mobile device acts as the "conscious field" — the secure, environmentally
 * aware bridge between the biological operator and the quantum cloud substrate.
 *
 * Architecture:
 * - Connects to the Quantum Hub API Gateway via persistent WebSocket
 * - Displays real-time telemetry from the Lux Arrays daemon
 * - Allows job submission to remote quantum backends
 * - Monitors decoherence risk and environmental factors
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';

const GATEWAY_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001/ws/telemetry';

// ─── Colour Palette (Dark Mode / Glassmorphism) ───────────────────────────────
const COLORS = {
  bg: '#0a0a1a',
  surface: '#111130',
  accent: '#00d4ff',
  accentGreen: '#00ff88',
  accentPurple: '#8b5cf6',
  warning: '#fbbf24',
  danger: '#ef4444',
  text: '#e2e8f0',
  textMuted: '#64748b',
  border: '#1e293b',
};

// ─── Components ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, unit, color }) {
  return (
    <View style={[styles.metricCard, { borderColor: color || COLORS.border }]}>
      <Text style={[styles.metricValue, { color: color || COLORS.accent }]}>{value}</Text>
      <Text style={styles.metricUnit}>{unit}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }) {
  const color = status === 'RUNNING' ? COLORS.accentGreen
    : status === 'COMPLETED' ? COLORS.accent
    : status === 'FAILED' ? COLORS.danger
    : COLORS.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{status}</Text>
    </View>
  );
}

// ─── Main App Component ───────────────────────────────────────────────────────
export default function App() {
  const [telemetry, setTelemetry] = useState(null);
  const [connected, setConnected] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    connectWebSocket();
    return () => wsRef.current?.close();
  }, []);

  function connectWebSocket() {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connectWebSocket, 3000); // Auto-reconnect
      };
      ws.onerror = () => setConnected(false);
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'telemetry' || msg.type === 'snapshot') {
          setTelemetry(msg.data);
        } else if (msg.type === 'job_completed') {
          setJobs((prev) => [msg.data, ...prev].slice(0, 10));
        }
      };
    } catch (e) {
      console.warn('WebSocket connection failed:', e.message);
    }
  }

  async function submitJob() {
    setSubmitting(true);
    try {
      const response = await fetch(`${GATEWAY_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qubits: 4, shots: 512, algorithm: 'VQE', circuit: 'vqe_4q' }),
      });
      const data = await response.json();
      Alert.alert('Job Submitted', `Job ID: ${data.jobId}\nStatus: ${data.status}`);
    } catch (e) {
      Alert.alert('Error', 'Could not reach the Quantum Gateway. Ensure the API server is running.');
    } finally {
      setSubmitting(false);
    }
  }

  const decoherenceRisk = telemetry?.decoherenceRisk || 0;
  const riskColor = decoherenceRisk > 0.7 ? COLORS.danger
    : decoherenceRisk > 0.4 ? COLORS.warning
    : COLORS.accentGreen;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⬡ Quantum Hub</Text>
        <View style={[styles.connectionDot, { backgroundColor: connected ? COLORS.accentGreen : COLORS.danger }]} />
        <Text style={[styles.connectionText, { color: connected ? COLORS.accentGreen : COLORS.danger }]}>
          {connected ? 'LIVE' : 'OFFLINE'}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Telemetry Grid */}
        <Text style={styles.sectionTitle}>Lux Arrays — Live Telemetry</Text>
        {telemetry ? (
          <View style={styles.metricsGrid}>
            <MetricCard
              label="Coherence"
              value={(telemetry.coherenceLevel * 100).toFixed(1)}
              unit="%"
              color={COLORS.accent}
            />
            <MetricCard
              label="Temperature"
              value={telemetry.temperature?.toFixed(1)}
              unit="°C"
              color={COLORS.accentPurple}
            />
            <MetricCard
              label="Humidity"
              value={telemetry.humidity?.toFixed(1)}
              unit="%"
              color={COLORS.accentGreen}
            />
            <MetricCard
              label="Decoherence Risk"
              value={(decoherenceRisk * 100).toFixed(1)}
              unit="%"
              color={riskColor}
            />
            <MetricCard
              label="CPU"
              value={telemetry.cpuUsage?.toFixed(1)}
              unit="%"
              color={COLORS.warning}
            />
            <MetricCard
              label="Memory"
              value={telemetry.memoryUsage?.toFixed(1)}
              unit="%"
              color={COLORS.textMuted}
            />
          </View>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={COLORS.accent} size="large" />
            <Text style={styles.loadingText}>Connecting to Quantum Gateway...</Text>
          </View>
        )}

        {/* Submit Job */}
        <Text style={styles.sectionTitle}>Quantum Job Submission</Text>
        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={submitJob}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color={COLORS.bg} size="small" />
            : <Text style={styles.buttonText}>⚛ Submit VQE Job (4 Qubits)</Text>
          }
        </TouchableOpacity>

        {/* Recent Jobs */}
        {jobs.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Jobs</Text>
            {jobs.map((job, i) => (
              <View key={i} style={styles.jobCard}>
                <Text style={styles.jobId} numberOfLines={1}>{job.jobId}</Text>
                <StatusBadge status="COMPLETED" />
              </View>
            ))}
          </>
        )}

        {/* Node Info */}
        {telemetry && (
          <>
            <Text style={styles.sectionTitle}>Node Information</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoRow}>Node ID: <Text style={styles.infoValue}>{telemetry.nodeId}</Text></Text>
              <Text style={styles.infoRow}>Jobs Processed: <Text style={styles.infoValue}>{telemetry.jobsProcessed}</Text></Text>
              <Text style={styles.infoRow}>Jobs Failed: <Text style={styles.infoValue}>{telemetry.jobsFailed}</Text></Text>
              <Text style={styles.infoRow}>Last Update: <Text style={styles.infoValue}>{new Date(telemetry.timestamp).toLocaleTimeString()}</Text></Text>
            </View>
          </>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { flex: 1, color: COLORS.accent, fontSize: 20, fontWeight: '700', letterSpacing: 1 },
  connectionDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  connectionText: { fontSize: 12, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionTitle: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 1.5, marginTop: 24, marginBottom: 12, textTransform: 'uppercase' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    width: '30%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  metricValue: { fontSize: 22, fontWeight: '700' },
  metricUnit: { color: COLORS.textMuted, fontSize: 11 },
  metricLabel: { color: COLORS.textMuted, fontSize: 10, marginTop: 4, textAlign: 'center' },
  loadingContainer: { alignItems: 'center', padding: 40 },
  loadingText: { color: COLORS.textMuted, marginTop: 12 },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: COLORS.bg, fontWeight: '700', fontSize: 15 },
  jobCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  jobId: { color: COLORS.text, fontSize: 12, flex: 1, marginRight: 8, fontFamily: 'monospace' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoRow: { color: COLORS.textMuted, fontSize: 13, marginBottom: 6 },
  infoValue: { color: COLORS.text, fontWeight: '600' },
});
