'use client';

import { useState } from 'react';
import { useAppStore, SafeHaven } from '@/store/appStore';

export default function AddHavenModal() {
  const { setAddHavenModalOpen, addSafeHaven, userLocation } = useAppStore();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<SafeHaven['category']>('Personal');
  const [address, setAddress] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const iconMap: Record<SafeHaven['category'], string> = {
      Police: '🚓',
      SafeHaven: '🛡️',
      Personal: '🏠',
      Medical: '🏥',
    };

    addSafeHaven({
      name,
      category,
      address: address || 'Kraków (wskazany punkt)',
      lat: userLocation ? userLocation[0] : 50.0646,
      lng: userLocation ? userLocation[1] : 19.9449,
      icon: iconMap[category],
    });

    setAddHavenModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-emerald-700/60 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl animate-fade-in text-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <span>🛡️ Dodaj Bezpieczne Miejsce</span>
          </h2>
          <button
            onClick={() => setAddHavenModalOpen(false)}
            className="text-gray-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-gray-300 font-medium block mb-1">Nazwa miejsca</label>
            <input
              type="text"
              required
              placeholder="np. Mój Dom, Mieszkanie Przyjaciółki"
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
              placeholder="np. ul. Floriańska 12, II piętro"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-2.5 text-emerald-300 text-[11px]">
            📍 Miejsce zostanie zapisane na Twojej osobistej mapie i posłuży jako bezpieczny cel nawigacyjny.
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddHavenModalOpen(false)}
              className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl"
            >
              Anuluj
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-950/50"
            >
              Dodaj Miejsce
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
