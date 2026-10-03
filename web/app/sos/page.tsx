'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { api, SosResponse } from '@/lib/api';

const TRIGGER_LABELS: Record<string, string> = {
  Manual: 'Ręczny alarm',
  Accelerometer: 'Nagły bieg / szamotanina',
  GPS_Deviation: 'Zboczenie z trasy',
  Timeout: 'Brak ruchu w ciemnym miejscu',
  LowBattery: 'Krytycznie niska bateria',
  DeadManSwitch: 'Kilka flag zagrożenia naraz',
};

type SendState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'done'; result: SosResponse }
  | { status: 'failed'; error: string };

export default function SosPage() {
  const router = useRouter();
  const {
    userId,
    sosTriggerType,
    sosFlags,
    userLocation,
    dismissSOS,
    deadManSettings,
    trustedContacts,
    smsFallbackGlobal,
  } = useAppStore();

  const isManual = sosTriggerType === 'Manual';
  const initialSeconds = isManual
    ? deadManSettings.manualCountdownSeconds || 5
    : deadManSettings.autoCountdownSeconds || 60;

  const [count, setCount] = useState(initialSeconds);
  const [send, setSend] = useState<SendState>({ status: 'idle' });

  const lat = userLocation?.[0] ?? 50.0646;
  const lng = userLocation?.[1] ?? 19.9449;
  const smsContacts = trustedContacts.filter((c) => c.smsFallback && c.phone);
  const smsBody =
    `🆘 LUMINA SOS: potrzebuję pomocy (${TRIGGER_LABELS[sosTriggerType] ?? sosTriggerType}). ` +
    `Moja lokalizacja: https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
  // Native SMS intent: works without mobile data, which is the whole point of the fallback
  const smsHref = `sms:${smsContacts.map((c) => c.phone.replace(/\s+/g, '')).join(',')}?&body=${encodeURIComponent(smsBody)}`;

  const executeSendSos = async () => {
    if (send.status !== 'idle') return;
    setSend({ status: 'sending' });
    try {
      const result = await api.fireSos({
        user_id: userId,
        trigger_type: sosTriggerType || 'Manual',
        lat,
        lng,
        contacts: smsFallbackGlobal ? smsContacts.map((c) => ({ name: c.name, phone: c.phone })) : [],
      });
      setSend({ status: 'done', result });
    } catch (err: any) {
      console.error('Failed to dispatch SOS:', err);
      setSend({ status: 'failed', error: err?.message || 'Brak połączenia' });
    }
  };

  // Countdown timer logic — the send is triggered from the timer callback,
  // not synchronously inside the effect
  useEffect(() => {
    if (send.status !== 'idle') return;
    const timer = setTimeout(() => {
      if (count <= 1) executeSendSos();
      setCount((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, send.status]);

  const handleDismiss = () => {
    dismissSOS();
    router.push('/map');
  };

  if (send.status !== 'idle') {
    const result = send.status === 'done' ? send.result : null;
    const allSmsSent = !!result && result.sms_requested > 0 && result.sms_sent === result.sms_requested;

    const headline =
      send.status === 'sending'
        ? 'Wysyłanie alarmu…'
        : send.status === 'failed'
        ? 'Brak połączenia z serwerem'
        : allSmsSent
        ? 'Alarm wysłany'
        : 'Alarm zarejestrowany';

    const explanation =
      send.status === 'sending'
        ? 'Łączenie z serwerem Lumina.'
        : send.status === 'failed'
        ? 'Alarm NIE dotarł do serwera. Wyślij SMS do zaufanych kontaktów lub zadzwoń na 112.'
        : allSmsSent
        ? `SMS z Twoją lokalizacją wysłano do ${result!.sms_sent} ${result!.sms_sent === 1 ? 'kontaktu' : 'kontaktów'}.`
        : result!.sms_sent > 0
        ? `SMS dotarł tylko do ${result!.sms_sent} z ${result!.sms_requested} kontaktów — wyślij SMS ręcznie do pozostałych.`
        : 'Alarm zapisano na serwerze, ale automatyczna bramka SMS nie jest skonfigurowana. Wyślij SMS ręcznie — to zajmie sekundę.';

    return (
      <div className="absolute inset-0 z-50 bg-red-950 overflow-y-auto scrollbar-none">
      <div className="min-h-full flex flex-col items-center justify-center text-center px-6 space-y-5 py-8">
        <div className={`text-6xl ${send.status === 'sending' ? 'animate-pulse' : 'animate-bounce'}`}>🆘</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">{headline}</h1>
          <p className={`text-sm max-w-sm ${send.status === 'failed' ? 'text-amber-200 font-semibold' : 'text-red-200'}`}>
            {explanation}
          </p>
        </div>

        {send.status !== 'sending' && (
          <div className="w-full max-w-xs space-y-2">
            {!allSmsSent && smsContacts.length > 0 && (
              <a
                href={smsHref}
                className="block w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-gray-950 font-black text-base rounded-2xl shadow-xl active:scale-95 transition-all"
              >
                📱 Wyślij SMS do {smsContacts.length} {smsContacts.length === 1 ? 'kontaktu' : 'kontaktów'}
              </a>
            )}
            <a
              href="tel:112"
              className="block w-full py-3 bg-red-700 hover:bg-red-600 text-white font-black text-base rounded-2xl border border-red-400/60 active:scale-95 transition-all"
            >
              📞 Zadzwoń na 112
            </a>
          </div>
        )}

        <div className="w-full max-w-xs bg-red-900/60 border border-red-700/60 rounded-2xl p-4 text-left space-y-2">
          <div className="text-xs text-red-300 uppercase tracking-widest font-semibold">Szczegóły</div>
          <div className="flex justify-between text-sm text-white font-medium gap-2">
            <span>Przyczyna:</span>
            <span className="text-amber-300 text-xs text-right">{TRIGGER_LABELS[sosTriggerType] ?? sosTriggerType}</span>
          </div>
          <div className="flex justify-between text-sm text-white font-medium">
            <span>Serwer:</span>
            <span className={`text-xs font-bold ${result ? 'text-emerald-400' : send.status === 'failed' ? 'text-red-300' : 'text-gray-300'}`}>
              {result ? 'zarejestrowano ✔' : send.status === 'failed' ? 'niedostępny ✖' : '…'}
            </span>
          </div>
          {result && (
            <div className="flex justify-between text-sm text-white font-medium">
              <span>SMS automatyczny:</span>
              <span className="text-xs font-bold text-amber-300">
                {result.sms_gateway ? `${result.sms_sent}/${result.sms_requested}` : 'brak bramki'}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm text-white font-medium">
            <span>Współrzędne GPS:</span>
            <span className="text-red-200 font-mono text-xs">
              {lat.toFixed(4)}, {lng.toFixed(4)}
            </span>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="w-full max-w-xs py-4 bg-white text-red-950 font-black text-lg rounded-2xl shadow-xl hover:bg-gray-100 active:scale-95 transition-all"
        >
          ✓ JESTEM BEZPIECZNA / BEZPIECZNY
        </button>
      </div>
      </div>
    );
  }

  const radius = 85;
  const circumference = 2 * Math.PI * radius;
  const progress = (count / initialSeconds) * circumference;

  return (
    <div className="absolute inset-0 z-50 bg-gradient-to-b from-red-950 via-gray-950 to-red-950 flex flex-col items-center justify-between py-10 px-6 text-center">
      {/* Header alert type */}
      <div className="space-y-1 mt-4">
        <div className="inline-block px-3 py-1 bg-red-900/80 border border-red-600/80 rounded-full text-xs text-red-200 font-bold uppercase tracking-widest">
          {isManual ? '⚠️ MANUALNE ODLICZANIE SOS' : '🚨 ANOMALIA / DEAD MAN’S SWITCH'}
        </div>
        <h1 className="text-2xl font-black text-white">Czy potrzebujesz pomocy?</h1>
        <p className="text-red-300 text-sm max-w-xs mx-auto">
          {isManual
            ? `Szybkie odliczanie (${initialSeconds}s). Jeśli to pomyłka, zatrzymaj alarm teraz!`
            : `Wykryto: ${TRIGGER_LABELS[sosTriggerType] ?? sosTriggerType}. Masz ${count}s na powstrzymanie automatycznego alarmu.`}
        </p>
        {sosFlags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 pt-1">
            {sosFlags.map((f) => (
              <span key={f.type} className="text-[10px] px-2 py-0.5 rounded-lg bg-red-900/80 border border-red-600/70 text-red-100">
                {f.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* SVG Ring & Big Countdown Number */}
      <div className="relative flex items-center justify-center my-auto">
        {/* Decorative halos: animate-ping scales to 2x and used to swallow clicks on the buttons */}
        <div className="absolute w-72 h-72 rounded-full bg-red-600/10 animate-ping pointer-events-none" />
        <div className="absolute w-56 h-56 rounded-full bg-red-600/20 animate-pulse pointer-events-none" />

        <svg width="240" height="240" className="-rotate-90">
          <circle cx="120" cy="120" r={radius} fill="none" stroke="#450a0a" strokeWidth="10" />
          <circle
            cx="120"
            cy="120"
            r={radius}
            fill="none"
            stroke="#ef4444"
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>

        <div className="absolute flex flex-col items-center">
          <span className="text-7xl font-black text-white tabular-nums tracking-tighter">{count}</span>
          <span className="text-xs text-red-400 font-semibold uppercase tracking-widest">sekund</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="relative z-10 w-full max-w-xs space-y-3 mb-6">
        <button
          onClick={handleDismiss}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-950/50 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          JESTEM BEZPIECZNA / ANULUJ
        </button>

        <button
          onClick={executeSendSos}
          className="w-full py-3 bg-red-800/60 hover:bg-red-700/80 text-red-200 border border-red-600/50 font-bold text-sm rounded-xl transition-all active:scale-95"
        >
          🚨 Wyślij SOS natychmiast (bez czekania)
        </button>
      </div>
    </div>
  );
}
