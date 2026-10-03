import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo */}
        <div className="space-y-2">
          <div className="text-6xl">🛡️</div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
            ImpactHer
          </h1>
          <p className="text-gray-400 text-lg">
            Safe routes. Proactive protection. Community-powered.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {['Safe routing', 'SOS alerts', 'Community reports', 'Shadow trust'].map((f) => (
            <span key={f} className="px-3 py-1 bg-violet-900/40 border border-violet-700/50 rounded-full text-sm text-violet-300">
              {f}
            </span>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/map"
          className="block w-full py-4 bg-gradient-to-r from-violet-600 to-pink-600 rounded-2xl text-white font-bold text-lg hover:opacity-90 transition-opacity"
        >
          Open Safety Map
        </Link>

        <p className="text-gray-600 text-sm">
          HackYeah 2026 · ImpactHer Category
        </p>
      </div>
    </main>
  );
}
