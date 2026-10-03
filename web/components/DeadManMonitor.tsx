'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { SensorEngine } from '@/lib/sensorEngine';

/**
 * Runs app-wide (not only on the map) so the switch keeps watching while the
 * user looks at other screens. Fires the auto SOS countdown once enough
 * independent danger flags are live at the same time.
 */
export default function DeadManMonitor() {
  const router = useRouter();
  const settings = useAppStore((s) => s.deadManSettings);
  const dangerFlags = useAppStore((s) => s.dangerFlags);
  const sosActive = useAppStore((s) => s.sosActive);
  const raiseFlag = useAppStore((s) => s.raiseFlag);
  const activateSOS = useAppStore((s) => s.activateSOS);
  const clearFlags = useAppStore((s) => s.clearFlags);
  const engineRef = useRef<SensorEngine | null>(null);

  useEffect(() => {
    if (!settings.enabled) {
      engineRef.current?.stop();
      engineRef.current = null;
      clearFlags();
      return;
    }
    if (!engineRef.current) {
      engineRef.current = new SensorEngine(raiseFlag, settings);
      engineRef.current.start();
    } else {
      engineRef.current.updateSettings(settings);
    }
  }, [settings, raiseFlag, clearFlags]);

  useEffect(() => () => engineRef.current?.stop(), []);

  useEffect(() => {
    if (!settings.enabled || sosActive) return;
    if (dangerFlags.length < settings.requiredFlags) return;

    const trigger = dangerFlags.length > 1 ? 'DeadManSwitch' : dangerFlags[0].type;
    activateSOS(trigger, dangerFlags);
    clearFlags();
    router.push('/sos');
  }, [dangerFlags, settings.enabled, settings.requiredFlags, sosActive, activateSOS, clearFlags, router]);

  return null;
}
