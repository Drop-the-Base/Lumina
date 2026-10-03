'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { api } from '@/lib/api';

const CATEGORIES = [
  { id: 'Suspicious Activity', emoji: '🚨', label: 'Suspicious Activity', color: 'border-red-500 bg-red-900/30' },
  { id: 'Lighting Issue', emoji: '💡', label: 'Lighting Issue', color: 'border-amber-500 bg-amber-900/30' },
  { id: 'Obstacle', emoji: '🚧', label: 'Obstacle', color: 'border-orange-500 bg-orange-900/30' },
] as const;

export default function ReportModal() {
  const { setReportModalOpen, userLocation, userId, showToast, hideToast, addCommunityReport } = useAppStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selected) return;
    setLoading(true);

    try {
      await api.submitReport({
        lat: userLocation?.[0] ?? 50.0646,
        lng: userLocation?.[1] ?? 19.9449,
        category: selected,
        description,
        author_id: userId,
      });
      addCommunityReport({
        category: selected as any,
        description,
        lat: userLocation?.[0] ?? 50.0646,
        lng: userLocation?.[1] ?? 19.9449,
      });
      setReportModalOpen(false);
      showToast('Zgłoszono niebezpieczne miejsce!');
      setTimeout(() => hideToast(), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={() => setReportModalOpen(false)}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-700 rounded-t-3xl p-6 space-y-5">
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto" />

        <h2 className="text-white font-bold text-xl text-center">Zgłoś Niebezpieczeństwo</h2>

        {/* Category selector */}
            <div className="grid grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelected(cat.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    selected === cat.id ? cat.color : 'border-gray-700 bg-gray-800'
                  }`}
                >
                  <span className="text-2xl">{cat.emoji}</span>
                  <span className="text-xs text-gray-300 text-center leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>

        {/* Description */}
        <textarea
          placeholder="Opcjonalnie: opisz co widzisz..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-red-500"
        />

            {/* Location */}
            {userLocation && (
              <p className="text-gray-500 text-xs text-center font-mono">
                📍 {userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}
              </p>
            )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!selected || loading}
          className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-2xl text-white font-bold text-lg disabled:opacity-40 transition-all active:scale-95 shadow-lg shadow-red-900/50 border-2 border-red-500/50"
        >
          {loading ? 'Wysyłanie...' : 'Dodaj Zgłoszenie'}
        </button>
      </div>
    </>
  );
}
