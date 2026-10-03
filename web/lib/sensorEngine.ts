'use client';

import type { DangerFlagType, DeadManSettings } from '@/store/appStore';

type FlagCallback = (type: DangerFlagType, label: string) => void;

const ACCEL_WINDOW = 10;
const ACCEL_VARIANCE_THRESHOLD = 50;
const ACCEL_COOLDOWN_MS = 20_000;
const LOW_BATTERY_LEVEL = 0.15;

/**
 * Device sensors for the Dead Man's Switch. It only raises flags — deciding
 * whether enough flags add up to an SOS is done by DeadManMonitor.
 * GPS is intentionally not used (no location prompts); position-based flags
 * (route deviation, long stop) come from the navigation screen.
 */
export class SensorEngine {
  private accelBuffer: number[] = [];
  private lastAccelFlag = 0;
  private motionHandler: ((e: DeviceMotionEvent) => void) | null = null;
  private battery: any = null;
  private batteryHandler: (() => void) | null = null;
  private batteryFlagged = false;

  constructor(private onFlag: FlagCallback, private settings: DeadManSettings) {}

  start() {
    this.applySettings();
  }

  updateSettings(settings: DeadManSettings) {
    this.settings = settings;
    this.applySettings();
  }

  private applySettings() {
    if (this.settings.detectRun) this.attachMotion();
    else this.detachMotion();

    if (this.settings.detectLowBattery) this.attachBattery();
    else this.detachBattery();
  }

  private attachMotion() {
    if (this.motionHandler || typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') return;
    this.motionHandler = (e) => this.handleMotion(e);
    window.addEventListener('devicemotion', this.motionHandler);

    // iOS requires an explicit permission request (only succeeds after a user gesture)
    const requestPermission = (DeviceMotionEvent as any).requestPermission;
    if (typeof requestPermission === 'function') {
      requestPermission.call(DeviceMotionEvent).catch(() => {});
    }
  }

  private detachMotion() {
    if (this.motionHandler) window.removeEventListener('devicemotion', this.motionHandler);
    this.motionHandler = null;
    this.accelBuffer = [];
  }

  private handleMotion(e: DeviceMotionEvent) {
    const acc = e.accelerationIncludingGravity;
    if (!acc || acc.x == null) return;

    const magnitude = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2);
    this.accelBuffer.push(magnitude);
    if (this.accelBuffer.length > ACCEL_WINDOW) this.accelBuffer.shift();
    if (this.accelBuffer.length < ACCEL_WINDOW) return;

    // Sustained high variance = sprinting or a struggle
    const avg = this.accelBuffer.reduce((s, v) => s + v, 0) / ACCEL_WINDOW;
    const variance = this.accelBuffer.reduce((s, v) => s + (v - avg) ** 2, 0) / ACCEL_WINDOW;
    const now = Date.now();
    if (variance > ACCEL_VARIANCE_THRESHOLD && now - this.lastAccelFlag > ACCEL_COOLDOWN_MS) {
      this.lastAccelFlag = now;
      this.accelBuffer = [];
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      this.onFlag('Accelerometer', 'Nagły bieg / szamotanina');
    }
  }

  private attachBattery() {
    if (this.batteryHandler || typeof navigator === 'undefined') return;
    const getBattery = (navigator as any).getBattery;
    if (typeof getBattery !== 'function') return;

    this.batteryHandler = () => {
      const b = this.battery;
      if (!b) return;
      const low = b.level < LOW_BATTERY_LEVEL && !b.charging;
      if (low && !this.batteryFlagged) {
        this.batteryFlagged = true;
        this.onFlag('LowBattery', `Bateria ${Math.round(b.level * 100)}%`);
      } else if (!low) {
        this.batteryFlagged = false;
      }
    };

    getBattery.call(navigator).then((battery: any) => {
      if (!this.batteryHandler) return; // stopped meanwhile
      this.battery = battery;
      battery.addEventListener('levelchange', this.batteryHandler);
      battery.addEventListener('chargingchange', this.batteryHandler);
      this.batteryHandler!();
    }).catch(() => {});
  }

  private detachBattery() {
    if (this.battery && this.batteryHandler) {
      this.battery.removeEventListener('levelchange', this.batteryHandler);
      this.battery.removeEventListener('chargingchange', this.batteryHandler);
    }
    this.battery = null;
    this.batteryHandler = null;
    this.batteryFlagged = false;
  }

  stop() {
    this.detachMotion();
    this.detachBattery();
  }
}
