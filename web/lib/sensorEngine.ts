'use client';

import { api } from './api';

type TriggerType = 'Manual' | 'Accelerometer' | 'GPS_Deviation' | 'Timeout';

export class SensorEngine {
  private watchId: number | null = null;
  private stoppedSince: number | null = null;
  private lastCoords: GeolocationCoordinates | null = null;
  private onSOS: (type: TriggerType) => void;
  private accelBuffer: number[] = [];
  private motionHandler: ((e: DeviceMotionEvent) => void) | null = null;

  constructor(onSOS: (type: TriggerType) => void) {
    this.onSOS = onSOS;
  }

  start() {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    // GPS watcher
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePosition(pos),
      (err) => console.warn(`GPS warning: [Code ${err.code}] ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    // Accelerometer — request permission on iOS
    if (typeof DeviceMotionEvent !== 'undefined') {
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        (DeviceMotionEvent as any).requestPermission().then((state: string) => {
          if (state === 'granted') this.attachMotionListener();
        });
      } else {
        this.attachMotionListener();
      }
    }
  }

  private attachMotionListener() {
    this.motionHandler = (e: DeviceMotionEvent) => this.handleMotion(e);
    window.addEventListener('devicemotion', this.motionHandler);
  }

  private handlePosition(pos: GeolocationPosition) {
    const { speed } = pos.coords;
    this.lastCoords = pos.coords;

    const isStationary = (speed ?? 0) < 0.5; // < 0.5 m/s = essentially stopped

    if (isStationary) {
      if (!this.stoppedSince) {
        this.stoppedSince = Date.now();
      } else if (Date.now() - this.stoppedSince > 120_000) {
        // Stopped for > 2 minutes — trigger SOS
        this.fireSOS('Timeout');
        this.stoppedSince = null; // Reset to avoid repeated firing
      }
    } else {
      this.stoppedSince = null;
    }
  }

  private handleMotion(e: DeviceMotionEvent) {
    const acc = e.accelerationIncludingGravity;
    if (!acc || acc.x == null) return;

    const magnitude = Math.sqrt(
      (acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2
    );

    // Keep rolling buffer of last 10 readings
    this.accelBuffer.push(magnitude);
    if (this.accelBuffer.length > 10) this.accelBuffer.shift();

    // Detect sudden spike (sprint/impact) — sustained high variance
    if (this.accelBuffer.length === 10) {
      const avg = this.accelBuffer.reduce((s, v) => s + v, 0) / 10;
      const variance = this.accelBuffer.reduce((s, v) => s + (v - avg) ** 2, 0) / 10;
      if (variance > 50) {
        this.fireSOS('Accelerometer');
        this.accelBuffer = []; // Reset
      }
    }
  }

  private fireSOS(type: TriggerType) {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    this.onSOS(type);
  }

  getCurrentCoords(): GeolocationCoordinates | null {
    return this.lastCoords;
  }

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler);
      this.motionHandler = null;
    }
    this.stoppedSince = null;
    this.accelBuffer = [];
  }
}
