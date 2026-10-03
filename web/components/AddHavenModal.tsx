'use client';

import { useState } from 'react';
import { useAppStore, SafeHaven } from '@/store/appStore';
import { api } from '@/lib/api';

export default function AddHavenModal() {
  const {
    setAddHavenModalOpen,
    addSafeHaven,
    userLocation,
    clickedLocation,
    setClickedLocation,
    showToast,
    hideToast,
  } = useAppStore();

  const activeCoord: [number, number] = clickedLocation || userLocation || [50.0646, 19.9449];

  const [name, setName] = useState('');
  const [category, setCategory] = useState<SafeHaven['category']>('Personal');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    const iconMap: Record<SafeHaven['category'], string> = {
      Police: '🚓',
      SafeHaven: '🛡️',
      Personal: '🏠',
      Medical: '🏥',
    };

    try {
      const savedPlace = await api.addPlace({
        name: name.trim(),
        category,
        address: address.trim() || `Punkt na mapie (${activeCoord[0].toFixed(4)}, ${activeCoord[1].toFixed(4)})`,
        lat: activeCoord[0],
        lng: activeCoord[1],
        icon: iconMap[category],
      });

      addSafeHaven(savedPlace);
      setClickedLocation(null);
      setAddHavenModalOpen(false);
      showToast('Zapisano bezpieczne miejsce w bazie!');
      setTimeout(() => hideToast(), 3000);
    } catch (err: any) {
      console.error('Failed to save place to database:', err);
      setErrorMsg(err.message || 'Wystąpił błąd podczas zapisywania miejsca w bazie.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setClickedLocation(null);
    setAddHavenModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-emerald-700/60 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl animate-fade-in text-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <span>🛡️ Zapisz Miejsce w Bazie</span>
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-950/80 border border-red-800 text-red-300 text-xs p-2.5 rounded-xl">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-gray-300 font-medium block mb-1">Nazwa miejsca *</label>
            <input
              type="text"
              required
              placeholder="np. Mój Dom, Przystanek, Kawiarnia"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-gray-300 font-medium block mb-1">Kategoria bezpieczeństwa</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="Personal">🏠 Prywatne Miejsce (Mój Dom, Rodzina, Przyjaciele)</option>
              <option value="SafeHaven">🛡️ Safe Haven (Przyjazny Bar / Lokale Ask for Angela)</option>
              <option value="Police">🚓 Posterunek Policji / Służby</option>
              <option value="Medical">🏥 Punkt Medyczny 24/7</option>
            </select>
          </div>

          <div>
            <label className="text-gray-300 font-medium block mb-1">Adres / Wskazówka</label>
            <input
              type="text"
              placeholder="np. ul. Floriańska 12, róg z Plantami"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-2.5 text-emerald-300 text-[11px] space-y-1">
            <div className="font-semibold flex items-center gap-1">
              <span>📍 Współrzędne z mapy:</span>
              <span className="font-mono text-[10px] text-white">
                {activeCoord[0].toFixed(5)}, {activeCoord[1].toFixed(5)}
              </span>
            </div>
            <div className="text-gray-400 text-[10px]">
              Miejsce zostanie trwale zapisane w bazie danych i będzie dostępne w nawigacji.
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleClose}
              className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Zapisywanie...</span>
              ) : (
                <span>Zapisz w bazie</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
