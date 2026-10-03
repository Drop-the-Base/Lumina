'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/appStore';

export default function ContactsPage() {
  const {
    trustedContacts,
    addTrustedContact,
    removeTrustedContact,
    smsFallbackGlobal,
    toggleSmsFallbackGlobal,
    liveLocationSharing,
    toggleLiveLocationSharing,
  } = useAppStore();

  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('Rodzina');
  const [appAccount, setAppAccount] = useState('');
  const [smsFallback, setSmsFallback] = useState(true);
  const [liveLocation, setLiveLocation] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    addTrustedContact({
      name,
      phone,
      relation,
      appAccount: appAccount ? (appAccount.startsWith('@') ? appAccount : `@${appAccount}`) : undefined,
      smsFallback,
      liveLocation,
    });
    setName('');
    setPhone('');
    setAppAccount('');
    setIsAdding(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 pt-6 pb-24 max-w-md mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            👥 Zaufane Kontakty
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">
            Osoby, które natychmiast otrzymają powiadomienie SMS / In-App podczas SOS.
          </p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
        >
          {isAdding ? 'Anuluj' : '+ Dodaj'}
        </button>
      </div>

      {/* Global Fallback & Live Location Toggles */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 space-y-4 shadow-xl">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
          Ustawienia Awaryjne & Łączność
        </div>

        {/* SMS Fallback Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 pr-2">
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>💬 Wysyłanie sygnału SMS (Offline)</span>
            </div>
            <p className="text-xs text-gray-400">
              Gdy brak internetu, aplikacja wyśle automatyczny SMS z pozycją GPS do zaufanych numerów.
            </p>
          </div>
          <button
            onClick={toggleSmsFallbackGlobal}
            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${
              smsFallbackGlobal ? 'bg-violet-600' : 'bg-gray-700'
            }`}
          >
            <span
              className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                smsFallbackGlobal ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        <hr className="border-gray-800" />

        {/* Live Location Sharing Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 pr-2">
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>📍 Udostępnianie lokalizacji na żywo</span>
              <span className="px-2 py-0.5 bg-red-950 text-red-300 border border-red-800 rounded text-[9px] font-bold">
                TYLKO W STANIE ALARMOWYM
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Pozycja GPS jest przesyłana do kontaktów <strong className="text-gray-200">wyłącznie podczas aktywnego alarmu SOS</strong> lub wykrycia anomalii. Brak stałego śledzenia w trybie codziennym.
            </p>
          </div>
          <button
            onClick={toggleLiveLocationSharing}
            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${
              liveLocationSharing ? 'bg-emerald-600' : 'bg-gray-700'
            }`}
          >
            <span
              className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                liveLocationSharing ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Add Contact Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-violet-700/60 rounded-2xl p-4 space-y-3 shadow-2xl animate-fade-in">
          <div className="text-sm font-bold text-violet-300">Dodaj Nowy Zaufany Kontakt</div>

          <div>
            <label className="text-xs text-gray-400 font-medium">Imię i nazwisko / Nazwa</label>
            <input
              type="text"
              required
              placeholder="np. Kasia (Siostra)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 font-medium">Numer telefonu (SMS)</label>
              <input
                type="tel"
                required
                placeholder="+48 600 000 000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full mt-1 bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium">Relacja</label>
              <select
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                className="w-full mt-1 bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                <option value="Rodzina">Rodzina</option>
                <option value="Bliski znajomy">Bliski znajomy</option>
                <option value="Partner">Partner / Partnerka</option>
                <option value="Współlokator">Współlokator</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 font-medium">Konto w aplikacji (opcjonalnie)</label>
            <input
              type="text"
              placeholder="@nick_w_lumina"
              value={appAccount}
              onChange={(e) => setAppAccount(e.target.value)}
              className="w-full mt-1 bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={smsFallback}
                onChange={(e) => setSmsFallback(e.target.checked)}
                className="rounded border-gray-700 text-violet-600 focus:ring-violet-500"
              />
              SMS Fallback
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={liveLocation}
                onChange={(e) => setLiveLocation(e.target.checked)}
                className="rounded border-gray-700 text-violet-600 focus:ring-violet-500"
              />
              Podgląd trasy GPS
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl text-sm transition-all"
          >
            Zapisz Kontakt
          </button>
        </form>
      )}

      {/* Contacts List */}
      <div className="space-y-3">
        <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
          Zapisani Odbiorcy Alarmu ({trustedContacts.length})
        </div>

        {trustedContacts.length === 0 ? (
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 text-center text-gray-400 text-sm">
            Brak zaufanych kontaktów. Dodaj przynajmniej jedną osobę!
          </div>
        ) : (
          trustedContacts.map((c) => (
            <div
              key={c.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between shadow-md hover:border-gray-700 transition-all"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-base">{c.name}</span>
                  <span className="px-2 py-0.5 bg-violet-950 border border-violet-800/60 rounded-full text-[10px] text-violet-300 font-semibold">
                    {c.relation}
                  </span>
                </div>
                <div className="text-xs text-gray-400 font-mono">
                  📞 {c.phone} {c.appAccount && <span className="text-violet-400 ml-2">({c.appAccount})</span>}
                </div>
                <div className="flex gap-2 pt-1 text-[11px]">
                  {c.smsFallback && (
                    <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                      ✓ Powiadomienie SMS
                    </span>
                  )}
                  {c.liveLocation && (
                    <span className="text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/40">
                      📍 Live GPS
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => removeTrustedContact(c.id)}
                className="p-2 text-gray-500 hover:text-red-400 rounded-xl hover:bg-red-950/40 transition-colors"
                title="Usuń kontakt"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
