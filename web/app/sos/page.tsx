'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { api } from '@/lib/api';

export default function SosPage() {
  const router = useRouter();
  const { userId, sosTriggerType, userLocation, dismissSOS } = useAppStore();
  const [count, setCount] = useState(60);
  const [fired, setFired] = useState(false);
  const [sent, setSent] = useState(false);

  // Fire SOS when countdown hits 0
  useEffect(() => {
    if (count <= 0 && !fired) {
      setFired(true);
      api.fireSos({
        user_id: userId,
        trigger_type: sosTriggerType || 'Timeout',
        lat: userLocation?.[0] ?? 52.2297,
        lng: userLocation?.[1] ?? 21.0122,
      }).then(() => setSent(true)).catch(console.error);
      return;
    }

    const timer = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, fired]);

  const handleDismiss = () => {
    dismissSOS();
    router.push('/map');
  };

  if (sent) {
    return (
      <div className="fixed inset-0 bg-red-950 flex flex-col items-center justify-center text-center px-8 space-y-6">
        <div className="text-6xl animate-bounce">🆘</div>
        <h1 className="text-3xl font-bold text-white">SOS Sent</h1>
        <p className="text-red-300 text-lg">
          Your trusted contacts have been notified with your GPS coordinates.
        </p>
        {userLocation && (
          <p className="text-red-400 text-sm font-mono">
            {userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}
          </p>
        )}
        <button
          onClick={handleDismiss}
          className="mt-8 px-10 py-4 bg-white text-red-900 font-bold text-lg rounded-full hover:bg-gray-100 transition-colors"
        >
          I'm safe now
        </button>
      </div>
    );
  }

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = (count / 60) * circumference;

  return (
    <div className="fixed inset-0 bg-red-950 flex flex-col items-center justify-center text-center px-8 space-y-8">
      {/* Pulsing ring + countdown */}
      <div className="relative flex items-center justify-center">
        {/* Outer pulse */}
        <div className="absolute w-64 h-64 rounded-full bg-red-600/20 animate-ping" />
        <div className="absolute w-48 h-48 rounded-full bg-red-600/30 animate-pulse" />

        {/* SVG ring */}
        <svg width="220" height="220" className="-rotate-90">
          <circle cx="110" cy="110" r={radius} fill="none" stroke="#7f1d1d" strokeWidth="8" />
          <circle
            cx="110" cy="110" r={radius}
            fill="none" stroke="#ef4444" strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>

        {/* Countdown number */}
        <div className="absolute text-7xl font-black text-white tabular-nums">{count}</div>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">Are you safe?</h1>
        <p className="text-red-300">
          Trigger: <span className="font-semibold">{sosTriggerType}</span>
        </p>
        {userLocation && (
          <p className="text-red-400 text-xs font-mono">
            {userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}
          </p>
        )}
      </div>

      <button
        onClick={handleDismiss}
        className="px-14 py-5 bg-white text-red-900 font-black text-xl rounded-full shadow-2xl hover:bg-gray-100 transition-all active:scale-95"
      >
        ✓ I'M SAFE
      </button>

      <p className="text-red-400/60 text-sm">
        SOS will fire automatically in {count}s
      </p>
    </div>
  );
}
