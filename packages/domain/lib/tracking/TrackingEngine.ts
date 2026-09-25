/**
 * Driver-side GPS tracking engine (singleton).
 *
 * Responsibilities:
 *  - Manage tracking session lifecycle (idle → starting → tracking → paused → stopping)
 *  - Filter GPS readings by movement threshold (client-side gate mirrors DB gate)
 *  - Publish live pings via Supabase Broadcast (no DB write per ping)
 *  - Queue pings when channel is offline; flush on reconnect (latest only)
 *  - Persist sparse checkpoints via tracking_record_checkpoint RPC (120s or 500m)
 *  - Send heartbeat to tracking_sessions every 30s
 *
 * GPS data never flows through React state. This class owns all GPS-driven state
 * in plain properties and refs so React renders are not triggered per ping.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import type { LocationObject } from 'expo-location';
import { supabase } from '@pulse/core/lib/supabase';
import { haversineMeters } from './haversine';
import type {
  BroadcastGpsEvent,
  BroadcastHeartbeatEvent,
  BroadcastSessionEvent,
  GpsReading,
  TrackingPhase,
  TrackingState,
} from '../../../../lib/tracking/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_DISTANCE_M = 50;
const MAX_SILENT_MS = 32_000;     // force ping every 32s regardless of movement
const MAX_QUEUE_SIZE = 50;        // drop oldest when offline queue overflows
const CHECKPOINT_INTERVAL_MS = 120_000;
const CHECKPOINT_DISTANCE_M = 500;
const HEARTBEAT_INTERVAL_MS = 30_000;
const PRESENCE_UPSERT_INTERVAL_MS = 30_000;

// ── TrackingEngine ────────────────────────────────────────────────────────────

class TrackingEngine {
  private static _instance: TrackingEngine | null = null;
  static getInstance(): TrackingEngine {
    return (TrackingEngine._instance ??= new TrackingEngine());
  }

  private state: TrackingState = {
    phase: 'idle',
    sessionId: null,
    tripId: null,
    driverId: null,
    orgId: null,
    lastPingSentAt: null,
    queuedPings: [],
    isChannelConnected: false,
  };

  private channel: RealtimeChannel | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private lastSentReading: GpsReading | null = null;
  private lastCheckpointAt = 0;
  private lastCheckpointPos: [number, number] | null = null;
  private lastPresenceAt = 0;

  // ── Public: lifecycle ───────────────────────────────────────────────────────

  get phase(): TrackingPhase {
    return this.state.phase;
  }

  get sessionId(): string | null {
    return this.state.sessionId;
  }

  async startTracking(opts: {
    tripId: string;
    driverId: string;
    orgId: string;
    deviceId: string;
  }): Promise<void> {
    if (this.state.phase !== 'idle') {
      throw new Error(`Cannot start tracking from phase: ${this.state.phase}`);
    }

    this.state = { ...this.state, phase: 'starting', ...opts };

    const { data: session, error } = await supabase()
      .from('trip_tracking_sessions')
      .insert({
        trip_id: opts.tripId,
        driver_id: opts.driverId,
        organization_id: opts.orgId,
        device_id: opts.deviceId,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      this.state.phase = 'idle';
      // 23P01 = exclusion constraint (unique index violation on is_active sessions)
      // Caller should surface a "Tracking already active on another session" UI
      throw Object.assign(new Error(error.message), { code: error.code });
    }

    this.state.sessionId = session.id;

    await this._joinChannel(opts.tripId, session.id, opts.driverId);
    this.state.phase = 'tracking';
    this._startHeartbeat();
  }

  async stopTracking(): Promise<void> {
    if (this.state.phase === 'idle') return;
    this.state.phase = 'stopping';

    this._stopHeartbeat();

    if (this.channel) {
      if (this.state.sessionId && this.state.driverId) {
        this.channel.send({
          type: 'broadcast',
          event: 'session_ended',
          payload: {
            type: 'session_ended',
            session_id: this.state.sessionId,
            driver_id: this.state.driverId,
            trip_id: this.state.tripId,
            ts: Date.now(),
          } satisfies BroadcastSessionEvent,
        });
      }
      await supabase().removeChannel(this.channel);
      this.channel = null;
    }

    if (this.state.sessionId) {
      await supabase()
        .from('trip_tracking_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', this.state.sessionId);
    }

    this.state = {
      phase: 'idle',
      sessionId: null,
      tripId: null,
      driverId: null,
      orgId: null,
      lastPingSentAt: null,
      queuedPings: [],
      isChannelConnected: false,
    };
    this.lastSentReading = null;
    this.lastCheckpointAt = 0;
    this.lastCheckpointPos = null;
    this.lastPresenceAt = 0;
  }

  onForeground(): void {
    if (this.state.phase === 'paused') {
      this.state.phase = 'tracking';
    }
  }

  onBackground(): void {
    if (this.state.phase === 'tracking') {
      this.state.phase = 'paused';
    }
  }

  // ── Public: GPS input ───────────────────────────────────────────────────────

  handleGpsReading(coords: LocationObject['coords'], timestamp: number): void {
    if (this.state.phase !== 'tracking' && this.state.phase !== 'paused') return;

    const reading: GpsReading = {
      lat: coords.latitude,
      lon: coords.longitude,
      accuracy: coords.accuracy ?? null,
      heading: coords.heading ?? null,
      speed_kmh: coords.speed != null ? coords.speed * 3.6 : null,
      ts: timestamp,
    };

    if (!this._shouldSend(reading)) return;

    if (this.state.isChannelConnected) {
      this._flushQueue();
      this._broadcastPing(reading);
    } else {
      if (this.state.queuedPings.length >= MAX_QUEUE_SIZE) {
        this.state.queuedPings.shift();
      }
      this.state.queuedPings.push(reading);
    }

    this._maybeWriteCheckpoint(reading);
  }

  // ── Private: filtering ──────────────────────────────────────────────────────

  private _shouldSend(reading: GpsReading): boolean {
    if (!this.lastSentReading) return true;
    const dist = haversineMeters(
      this.lastSentReading.lat,
      this.lastSentReading.lon,
      reading.lat,
      reading.lon,
    );
    const elapsed = reading.ts - this.lastSentReading.ts;
    return dist >= MIN_DISTANCE_M || elapsed >= MAX_SILENT_MS;
  }

  // ── Private: Broadcast channel ──────────────────────────────────────────────

  private async _joinChannel(tripId: string, sessionId: string, driverId: string): Promise<void> {
    this.channel = supabase()
      .channel(`tracking:trip:${tripId}`)
      .on('broadcast', { event: 'ping_request' }, () => {
        // Dispatcher requested an immediate GPS fix — bypass movement filter.
        void this._handlePingRequest();
      })
      .subscribe((status) => {
        const wasConnected = this.state.isChannelConnected;
        this.state.isChannelConnected = status === 'SUBSCRIBED';

        if (status === 'SUBSCRIBED') {
          if (!wasConnected) {
            // Reconnected: announce session and flush any queued pings
            this.channel?.send({
              type: 'broadcast',
              event: 'session_started',
              payload: {
                type: wasConnected ? 'session_resumed' : 'session_started',
                session_id: sessionId,
                driver_id: driverId,
                trip_id: tripId,
                ts: Date.now(),
              } satisfies BroadcastSessionEvent,
            });
          }
          this._flushQueue();
        }
      });
  }

  private async _handlePingRequest(): Promise<void> {
    if (!this.channel || !this.state.sessionId || !this.state.driverId || !this.state.tripId) return;
    try {
      // Dynamic import: expo-location is a native-only module.
      const Location = await import('expo-location') as typeof import('expo-location');
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }) as { coords: { latitude: number; longitude: number; accuracy?: number | null; heading?: number | null; speed?: number | null }; timestamp: number };
      this._broadcastPing({
        lat: fix.coords.latitude,
        lon: fix.coords.longitude,
        accuracy: fix.coords.accuracy ?? null,
        heading: fix.coords.heading ?? null,
        speed_kmh: fix.coords.speed != null ? fix.coords.speed * 3.6 : null,
        ts: fix.timestamp,
      });
    } catch {
      // Location unavailable — driver may have denied permission or GPS is off; silently ignore.
    }
  }

  private _broadcastPing(reading: GpsReading): void {
    if (!this.channel || !this.state.sessionId || !this.state.driverId) return;
    this.channel.send({
      type: 'broadcast',
      event: 'gps_ping',
      payload: {
        type: 'gps_ping',
        session_id: this.state.sessionId,
        driver_id: this.state.driverId,
        trip_id: this.state.tripId,
        lat: reading.lat,
        lon: reading.lon,
        accuracy: reading.accuracy,
        heading: reading.heading,
        speed_kmh: reading.speed_kmh,
        ts: reading.ts,
      } satisfies BroadcastGpsEvent,
    });
    this.lastSentReading = reading;
    this.state.lastPingSentAt = reading.ts;
  }

  private _flushQueue(): void {
    if (this.state.queuedPings.length === 0) return;
    // Send only the latest — intermediate positions are acceptable to drop
    const latest = this.state.queuedPings[this.state.queuedPings.length - 1];
    this._broadcastPing(latest);
    this.state.queuedPings = [];
  }

  // ── Private: checkpoint persistence ────────────────────────────────────────

  private _maybeWriteCheckpoint(reading: GpsReading): void {
    const elapsed = reading.ts - this.lastCheckpointAt;
    const dist = this.lastCheckpointPos
      ? haversineMeters(
          this.lastCheckpointPos[1],
          this.lastCheckpointPos[0],
          reading.lat,
          reading.lon,
        )
      : Infinity;

    if (elapsed < CHECKPOINT_INTERVAL_MS && dist < CHECKPOINT_DISTANCE_M) return;

    // Also upsert presence whenever a checkpoint is written
    this._upsertPresence(reading);

    if (!this.state.tripId || !this.state.driverId || !this.state.orgId || !this.state.sessionId) {
      return;
    }

    supabase()
      .rpc('tracking_record_checkpoint', {
        p_trip_id: this.state.tripId,
        p_driver_id: this.state.driverId,
        p_org_id: this.state.orgId,
        p_session_id: this.state.sessionId,
        p_latitude: reading.lat,
        p_longitude: reading.lon,
        p_accuracy: reading.accuracy,
        p_heading: reading.heading,
        p_speed_kmh: reading.speed_kmh,
        p_source: 'live',
        p_recorded_at: new Date(reading.ts).toISOString(),
      })
      .then(({ error }) => {
        if (error) console.warn('[TrackingEngine] checkpoint rpc:', error.message);
      });

    this.lastCheckpointAt = reading.ts;
    this.lastCheckpointPos = [reading.lon, reading.lat];
  }

  private _upsertPresence(reading: GpsReading): void {
    if (reading.ts - this.lastPresenceAt < PRESENCE_UPSERT_INTERVAL_MS) return;
    if (!this.state.driverId || !this.state.orgId || !this.state.sessionId) return;

    supabase()
      .from('driver_presence')
      .upsert(
        {
          driver_id: this.state.driverId,
          organization_id: this.state.orgId,
          trip_id: this.state.tripId,
          session_id: this.state.sessionId,
          latitude: reading.lat,
          longitude: reading.lon,
          accuracy: reading.accuracy,
          heading: reading.heading,
          speed_kmh: reading.speed_kmh,
          recorded_at: new Date(reading.ts).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'driver_id' },
      )
      .then(({ error }) => {
        if (error) console.warn('[TrackingEngine] presence upsert:', error.message);
      });

    this.lastPresenceAt = reading.ts;
  }

  // ── Private: heartbeat ──────────────────────────────────────────────────────

  private _startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.state.phase !== 'tracking' || !this.state.sessionId || !this.state.driverId) return;

      this.channel?.send({
        type: 'broadcast',
        event: 'heartbeat',
        payload: {
          type: 'heartbeat',
          session_id: this.state.sessionId,
          driver_id: this.state.driverId,
          ts: Date.now(),
        } satisfies BroadcastHeartbeatEvent,
      });

      supabase()
        .from('trip_tracking_sessions')
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('id', this.state.sessionId)
        .then(() => {});
    }, HEARTBEAT_INTERVAL_MS);
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export { TrackingEngine };
