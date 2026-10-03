import Link from 'next/link';

export default function Home() {
  return (
    <main className="h-full overflow-y-auto bg-gray-950 text-white flex flex-col items-center px-6 pt-4 pb-28 scrollbar-none">
      <div className="max-w-sm w-full text-center space-y-6 my-auto">
        {/* Logo & Icon */}
        <div className="space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-violet-600 to-pink-500 flex items-center justify-center text-3xl shadow-xl shadow-violet-950/60 ring-1 ring-white/20">
            🛡️
          </div>
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-violet-400 via-pink-400 to-amber-300 bg-clip-text text-transparent tracking-tight">
              Lumina
            </h1>
            <p className="text-gray-400 text-sm mt-1 font-medium">
              Inteligentny i Bezpieczny Powrót do Domu
            </p>
          </div>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-1.5 pt-1">
          {['Bezpieczny Routing', 'Dead Man’s Switch', 'Safe Havens', 'Alarm SOS'].map((feature) => (
            <span
              key={feature}
              className="px-3 py-1 bg-violet-950/80 border border-violet-700/50 rounded-full text-xs font-semibold text-violet-300 shadow-sm"
            >
              {feature}
            </span>
          ))}
        </div>

        {/* Description Box */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 text-xs text-gray-300 leading-relaxed shadow-lg text-left space-y-1.5">
          <div className="font-bold text-violet-400 flex items-center gap-1.5 text-xs">
            <span>⚡ Proaktywny System Ochrony</span>
          </div>
          <p>
            Omijanie niebezpiecznych stref i nieoświetlonych alej, automatyczna detekcja anomalii ruchu w tle oraz łączność awaryjna z bliskimi.
          </p>
        </div>

        {/* CTA Button */}
        <Link
          href="/map"
          className="block w-full py-3.5 bg-gradient-to-r from-violet-600 via-pink-600 to-violet-600 rounded-2xl text-white font-black text-base shadow-xl shadow-violet-950/80 hover:opacity-95 active:scale-95 transition-all"
        >
          Otwórz Mapę Bezpieczeństwa ➔
        </Link>

        <p className="text-gray-500 text-[11px] font-medium pt-1">
          HackYeah 2026 · Kategoria ImpactHer
        </p>
      </div>
    </main>
  );
}
