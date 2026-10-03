'use client';

import { useAppStore } from '@/store/appStore';

export default function SettingsPage() {
  const { deadManSettings, updateDeadManSettings } = useAppStore();

  return (
    <div className="h-full overflow-y-auto bg-gray-950 text-white px-4 pt-4 pb-28 max-w-md mx-auto space-y-6 scrollbar-none">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          ⚙️ Dead Man’s Switch & Sensory
        </h1>
        <p className="text-gray-400 text-xs mt-0.5">
          Konfiguracja automatycznego wykrywania anomalii ruchu i progu aktywacji alarmu ratunkowego.
        </p>
      </div>

      {/* Main Switch Card */}
      <div className={`border rounded-2xl p-4 transition-all shadow-xl ${
        deadManSettings.enabled
          ? 'bg-emerald-950/40 border-emerald-700/60'
          : 'bg-gray-900 border-gray-800'
      }`}>
        <div className="flex items-center justify-between">
          <div className="space-y-1 pr-3">
            <div className="text-base font-bold text-white flex items-center gap-2">
              <span>🛡️ Monitorowanie Proaktywne</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                deadManSettings.enabled
                  ? 'bg-emerald-900 text-emerald-300 border border-emerald-600'
                  : 'bg-gray-800 text-gray-400'
              }`}>
                {deadManSettings.enabled ? 'AKTYWNE' : 'WYŁĄCZONE'}
              </span>
            </div>
            <p className="text-xs text-gray-300">
              Analizuje sensory w kieszeni w tle i automatycznie powiadamia zaufane kontakty, jeśli wykryje zagrożenie.
            </p>
          </div>

          <button
            onClick={() => updateDeadManSettings({ enabled: !deadManSettings.enabled })}
            className={`w-14 h-7 rounded-full transition-colors relative flex-shrink-0 ${
              deadManSettings.enabled ? 'bg-emerald-500' : 'bg-gray-700'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition-transform absolute top-1 ${
                deadManSettings.enabled ? 'left-8' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Danger Flags Configuration */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 space-y-4 shadow-xl">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
          Flagi Zagrożenia (Sygnały Podejrzane)
        </div>

        {/* Flag 1: Run detection */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 pr-2">
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>🏃 Nagły bieg / Akcelerometr</span>
            </div>
            <p className="text-xs text-gray-400">
              Wykrywanie gwałtownego przyspieszenia ruchu lub szamotaniny.
            </p>
          </div>
          <input
            type="checkbox"
            checked={deadManSettings.detectRun}
            onChange={(e) => updateDeadManSettings({ detectRun: e.target.checked })}
            className="w-5 h-5 rounded border-gray-700 text-violet-600 focus:ring-violet-500"
          />
        </div>

        <hr className="border-gray-800" />

        {/* Flag 2: Dark alley stop */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 pr-2">
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>🛑 Zatrzymanie się w nieoświetlonym miejscu</span>
              </div>
              <p className="text-xs text-gray-400">
                Brak ruchu w strefie o słabym oświetleniu przez zadany czas.
              </p>
            </div>
            <input
              type="checkbox"
              checked={deadManSettings.detectDarkStop}
              onChange={(e) => updateDeadManSettings({ detectDarkStop: e.target.checked })}
              className="w-5 h-5 rounded border-gray-700 text-violet-600 focus:ring-violet-500"
            />
          </div>
          {deadManSettings.detectDarkStop && (
            <div className="flex items-center justify-between bg-gray-950/60 p-2.5 rounded-xl border border-gray-800 text-xs">
              <span className="text-gray-300">Maksymalny czas bez ruchu:</span>
              <select
                value={deadManSettings.stopMinutes}
                onChange={(e) => updateDeadManSettings({ stopMinutes: Number(e.target.value) })}
                className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-white"
              >
                <option value={1}>1 minuta</option>
                <option value={2}>2 minuty (zalecane)</option>
                <option value={3}>3 minuty</option>
                <option value={5}>5 minut</option>
              </select>
            </div>
          )}
        </div>

        <hr className="border-gray-800" />

        {/* Flag 3: Route deviation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 pr-2">
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>🗺️ Zboczenie z wyznaczonej bezpiecznej trasy</span>
              </div>
              <p className="text-xs text-gray-400">
                Wykrycie znacznego odejścia od zaplanowanej ścieżki.
              </p>
            </div>
            <input
              type="checkbox"
              checked={deadManSettings.detectRouteDeviation}
              onChange={(e) => updateDeadManSettings({ detectRouteDeviation: e.target.checked })}
              className="w-5 h-5 rounded border-gray-700 text-violet-600 focus:ring-violet-500"
            />
          </div>
          {deadManSettings.detectRouteDeviation && (
            <div className="flex items-center justify-between bg-gray-950/60 p-2.5 rounded-xl border border-gray-800 text-xs">
              <span className="text-gray-300">Dopuszczalne zboczenie:</span>
              <select
                value={deadManSettings.deviationMeters}
                onChange={(e) => updateDeadManSettings({ deviationMeters: Number(e.target.value) })}
                className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-white"
              >
                <option value={30}>30 metrów</option>
                <option value={50}>50 metrów (zalecane)</option>
                <option value={100}>100 metrów</option>
              </select>
            </div>
          )}
        </div>

        <hr className="border-gray-800" />

        {/* Flag 4: Low battery */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 pr-2">
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>🔋 Niski poziom baterii (&lt;5%)</span>
            </div>
            <p className="text-xs text-gray-400">
              Ostrzeżenie zaufanych kontaktów przed wyłączeniem telefonu.
            </p>
          </div>
          <input
            type="checkbox"
            checked={deadManSettings.detectLowBattery}
            onChange={(e) => updateDeadManSettings({ detectLowBattery: e.target.checked })}
            className="w-5 h-5 rounded border-gray-700 text-violet-600 focus:ring-violet-500"
          />
        </div>
      </div>

      {/* Activation threshold & Timing */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 space-y-4 shadow-xl">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
          Próg Aktywacji & Czasy Odliczania
        </div>

        {/* Required Flags count */}
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-white block">
            Próg uruchomienia alarmu (Wymagane flagi):
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((count) => (
              <button
                key={count}
                onClick={() => updateDeadManSettings({ requiredFlags: count })}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  deadManSettings.requiredFlags === count
                    ? 'border-violet-500 bg-violet-900/40 text-violet-300'
                    : 'border-gray-800 bg-gray-950 text-gray-400 hover:border-gray-700'
                }`}
              >
                {count === 1 ? '1 Flaga (Wysoka czułość)' : count === 2 ? '2 Flagi (Zrównoważony)' : '3 Flagi (Wysoki próg)'}
              </button>
            ))}
          </div>
        </div>

        <hr className="border-gray-800" />

        {/* Auto vs Manual Countdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300 font-medium">Czas na powstrzymanie (Automatyczny SOS):</span>
            <select
              value={deadManSettings.autoCountdownSeconds}
              onChange={(e) => updateDeadManSettings({ autoCountdownSeconds: Number(e.target.value) })}
              className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-1 text-white font-bold"
            >
              <option value={30}>30 sekund</option>
              <option value={60}>60 sekund (zalecany)</option>
              <option value={120}>2 minuty (120s)</option>
            </select>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300 font-medium">Czas odliczania (Manualny przycisk SOS):</span>
            <select
              value={deadManSettings.manualCountdownSeconds}
              onChange={(e) => updateDeadManSettings({ manualCountdownSeconds: Number(e.target.value) })}
              className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-1 text-white font-bold"
            >
              <option value={3}>3 sekundy</option>
              <option value={5}>5 sekund (zalecany)</option>
              <option value={10}>10 sekund</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
