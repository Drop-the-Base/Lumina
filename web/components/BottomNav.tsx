'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/store/appStore';

export default function BottomNav() {
  const pathname = usePathname();
  const { deadManSettings, navigationActive, trustedContacts } = useAppStore();

  // Hide on the full screen SOS page and during turn-by-turn navigation,
  // where it covered the progress panel and the "end navigation" button
  if (pathname === '/sos' || (pathname === '/map' && navigationActive)) return null;

  const navItems = [
    {
      href: '/map',
      label: 'Nawigacja',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
    },
    {
      href: '/contacts',
      label: 'Kontakty',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      badge: trustedContacts.length > 0 ? String(trustedContacts.length) : undefined,
    },
    {
      href: '/settings',
      label: 'Dead Man',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      statusIndicator: deadManSettings?.enabled ? 'bg-emerald-500' : 'bg-gray-500',
    },
  ];

  return (
    <nav className="absolute bottom-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 px-4 py-2 pb-5">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive
                  ? 'text-violet-400 font-bold bg-violet-950/60'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.statusIndicator && (
                  <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${item.statusIndicator} ring-2 ring-gray-900`} />
                )}
                {item.badge && (
                  <span className="absolute -top-1 -right-2 px-1 text-[9px] font-black bg-violet-600 text-white rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
