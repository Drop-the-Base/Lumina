'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/appStore';

export default function ReportsHistoryPage() {
  const { reports, voteReport } = useAppStore();
  const [activeTab, setActiveTab] = useState<'All' | 'MyHistory'>('All');
  const [filter, setFilter] = useState<'All' | 'Suspicious Activity' | 'Lighting Issue' | 'Obstacle' | 'KMZB Police Import'>('All');

  // Demo user reports history
  const myUserReports = [
    {
      report_id: 'my_rep_1',
      category: 'Lighting Issue' as const,
      description: 'Zepsuta latarnia miejska i ciemny zaułek przy ul. Grodzkiej 14.',
      validation_count: 9,
      status: 'Active' as const,
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      lat: 50.057,
      lng: 19.938,
      source: 'User' as const,
    },
    {
      report_id: 'my_rep_2',
      category: 'Obstacle' as const,
      description: 'Rozbite szkło i wykopy na wąskim chodniku wzdłuż ul. Brackiej.',
      validation_count: 4,
      status: 'Active' as const,
      created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
      lat: 50.059,
      lng: 19.936,
      source: 'User' as const,
    },
  ];

  const allCommunityReports = reports.length > 0 ? reports : [
    {
      report_id: 'kmzb_101',
      category: 'KMZB Police Import' as const,
      description: 'Oficjalne zgłoszenie KMZB: Miejsce niebezpieczne - zgromadzenia pod wpływem alkoholu.',
      validation_count: 18,
      status: 'Active' as const,
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      lat: 50.062,
      lng: 19.938,
      source: 'KMZB' as const,
    },
    {
      report_id: 'rep_202',
      category: 'Lighting Issue' as const,
      description: 'Brak oświetlenia latarni wzdłuż alei przy parku. Ciemno od godziny 20:00.',
      validation_count: 7,
      status: 'Active' as const,
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      lat: 50.058,
      lng: 19.942,
      source: 'Community' as const,
    },
    {
      report_id: 'rep_303',
      category: 'Suspicious Activity' as const,
      description: 'Podejrzana osoba kręcąca się przy klatkach schodowych.',
      validation_count: 12,
      status: 'Active' as const,
      created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      lat: 50.055,
      lng: 19.939,
      source: 'Community' as const,
    },
  ];

  const displayedList = activeTab === 'MyHistory'
    ? myUserReports
    : (filter === 'All' ? allCommunityReports : allCommunityReports.filter((r) => r.category === filter));

  return (
    <div className="h-full overflow-y-auto bg-gray-950 text-white px-4 pt-4 pb-28 max-w-md mx-auto space-y-6 scrollbar-none">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          📋 Historia Zgłoszeń & Raporty
        </h1>
        <p className="text-gray-400 text-xs mt-0.5">
          Przegląd Twoich wpisów oraz zgłoszeń społeczności i Krajowej Mapy Zagrożeń Bezpieczeństwa.
        </p>
      </div>

      {/* Shadow Trust Engine Info Box (Reputation used implicitly in background) */}
      <div className="bg-gradient-to-r from-violet-950/80 to-gray-900 border border-violet-700/50 rounded-2xl p-4 space-y-2 shadow-xl">
        <div className="flex items-center gap-2 text-violet-300 font-bold text-sm">
          <span>🔒 Algorytm Shadow Trust w tle</span>
          <span className="ml-auto px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full text-[10px] font-bold">
            OCHRONA AKTYWNA
          </span>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">
          Ocena zaufania i reputacji użytkownika nie jest wyświetlana publicznie — działa w tle, aby automatycznie odsiewać trolling oraz fałszywe alarmy i priorytetyzować sprawdzone raporty.
        </p>
      </div>

      {/* Tab Selector: Community Reports vs My History */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab('All')}
          className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all ${
            activeTab === 'All'
              ? 'border-violet-500 text-violet-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          🌐 Raporty Społeczności & KMZB ({allCommunityReports.length})
        </button>
        <button
          onClick={() => setActiveTab('MyHistory')}
          className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all ${
            activeTab === 'MyHistory'
              ? 'border-violet-500 text-violet-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          👤 Moja Historia Zgłoszeń ({myUserReports.length})
        </button>
      </div>

      {/* Category Filter Pills (Only on Community Tab) */}
      {activeTab === 'All' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'All', label: 'Wszystkie' },
              { id: 'KMZB Police Import', label: '🚓 KMZB Policja' },
              { id: 'Lighting Issue', label: '💡 Oświetlenie' },
              { id: 'Suspicious Activity', label: '⚠️ Podejrzane' },
              { id: 'Obstacle', label: '🚧 Przeszkoda' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filter === item.id
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reports Feed */}
      <div className="space-y-3">
        {displayedList.map((report) => {
          const isKmzb = report.category === 'KMZB Police Import' || report.source === 'KMZB';
          const isMyReport = activeTab === 'MyHistory' || report.source === 'User';
          return (
            <div
              key={report.report_id}
              className={`border rounded-2xl p-4 space-y-3 shadow-md transition-all ${
                isKmzb
                  ? 'bg-blue-950/20 border-blue-800/60'
                  : isMyReport
                  ? 'bg-violet-950/20 border-violet-800/60'
                  : 'bg-gray-900 border-gray-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isKmzb
                        ? 'bg-blue-900 text-blue-200 border border-blue-700'
                        : report.category === 'Suspicious Activity'
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : report.category === 'Lighting Issue'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-orange-950 text-orange-300 border border-orange-800'
                    }`}>
                      {isKmzb ? '🚓 KMZB Policja' : report.category}
                    </span>
                    {isMyReport && (
                      <span className="px-2 py-0.5 bg-violet-900/60 text-violet-300 text-[9px] font-bold rounded">
                        MOJE ZGŁOSZENIE
                      </span>
                    )}
                    <span className="text-[10px] text-gray-500">
                      {new Date(report.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-200 leading-snug">
                    {report.description || 'Brak opisu.'}
                  </p>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-800">
                    +{report.validation_count} potw.
                  </span>
                </div>
              </div>

              {/* Verification & Status Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-800/80 text-xs">
                {activeTab === 'MyHistory' ? (
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                    <span>✓ Status: Aktywne w systemie nawigacji</span>
                  </div>
                ) : (
                  <>
                    <span className="text-gray-400">Czy zgłoszenie jest aktualne?</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => voteReport(report.report_id, true)}
                        className="px-3 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 rounded-lg font-bold transition-all active:scale-95 flex items-center gap-1"
                      >
                        👍 Potwierdzam
                      </button>
                      <button
                        onClick={() => voteReport(report.report_id, false)}
                        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg font-medium transition-all active:scale-95"
                      >
                        👎 Brak
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
