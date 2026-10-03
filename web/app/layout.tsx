import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import BottomNav from '@/components/BottomNav';
import PhoneFrame from '@/components/PhoneFrame';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Lumina / ImpactHer — Inteligentny Powrót do Domu',
  description: 'Bezpieczny routing, automatyczny Dead Man’s Switch oraz sieć zaufanych kontaktów i raportów.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen antialiased selection:bg-violet-600 selection:text-white`}>
        <PhoneFrame>
          {children}
          <BottomNav />
        </PhoneFrame>
      </body>
    </html>
  );
}
