# 🛡️ LUMINA — Pitch & Presentation Guide
> **Category:** ImpactHer (HackYeah 2026)  
> **Tagline:** Proactive safety navigation & invisible emergency automation for women returning home.

---

## 1. 🚨 Problem

Every night in cities around the world, millions of women and vulnerable individuals face fear and anxiety when returning home alone from work, university, or evening events.

* **Google Maps & Traditional Navigation are Blind to Safety:** Standard navigation apps calculate the shortest or fastest route. They route users through dark, unlit alleys, deserted parks, or high-risk areas because they only optimize for time and distance.
* **Current SOS Solutions are Reactive & Require Finger Contact:** Existing safety apps rely on a big, red "SOS Button". In real-world panic situations—such as a sudden assault, grab, fall, or health crisis—the victim rarely has time or physical ability to unlock their phone, open an app, and hold a screen button.
* **Loss of Network Vulnerability:** Standard tracking apps fail when cellular data drops or signal is lost in dark spots or underground passages.

---

## 2. 💡 Solution

**Lumina** bridges pre-incident risk avoidance with invisible, zero-touch emergency automation during a return commute.

### Key Pillars:
1. **🛡️ SafeRouting Engine:**
   * Calculates dual routes: **Fastest Route** (blue) vs. **Safe Route** (green).
   * Automatically detours walking paths around unlit areas, active danger reports, and police hazard clusters (KMZB - Krajowa Mapa Zagrożeń Bezpieczeństwa).
   * Explains detours transparently (e.g., *"+2 min detour avoids unlit alley & suspicious activity"*).

2. **⚡ Proactive Dead Man’s Switch (Zero-Click SOS):**
   * Uses smartphone motion sensors (accelerometer, GPS, battery meter) in the background.
   * Detects crisis flags automatically:
     * 🏃 **Sudden Sprinting / Shake:** Panic movement or struggle.
     * 🛑 **Unlit Alley Standstill:** Stopping in a dark zone for >2 minutes.
     * 🗺️ **Significant Route Deviation:** Sudden unexpected trajectory shift.
     * 🔋 **Critical Battery (<5%):** Pre-warning contacts before phone dies.
   * Triggers a 60-second countdown with sound/visual alert: if the user does not cancel it (*"I'M SAFE"*), Lumina automatically dispatches SOS alerts with exact GPS coordinates.

3. **💬 SMS Fallback Protocol (Offline Reliability):**
   * If mobile internet fails or drops, Lumina seamlessly dispatches SMS text alerts directly to trusted emergency contacts.

4. **🏠 Verified Safe Havens Network:**
   * Interactive map overlay showing 24/7 safe shelters: Police Stations, Hospitals, Pharmacy Shelters, Verified *Ask for Angela* partner venues, and personal Trusted Homes.

---

## 3. 🚀 What's Done So Far & Project Goals

### 🛠️ What is Done So Far (Fully Functional Working MVP):
* ✅ **Interactive Navigation Map (`/map`):** Full MapLibre GL implementation with dynamic OSRM foot routing comparing Fastest vs. Safe routes with live detour explanations.
* ✅ **Proactive Sensor Engine (`SensorEngine.ts`):** Background accelerometer panic detection, standstill detection, and customizable sensor sensitivity.
* ✅ **Dead Man’s Switch & Threshold Configuration (`/settings`):** Configurable activation rules (1, 2, or 3 flags threshold, countdown timers).
* ✅ **Automated Emergency SOS Countdown (`/sos`):** Animated countdown screen, SMS Fallback dispatch trigger, and GPS broadcast payload.
* ✅ **Trusted Contacts Manager (`/contacts`):** Emergency contacts list with offline SMS toggle and live location tracking flags.
* ✅ **Safe Haven Shelter Layer:** Dynamic markers for Police Stations, Hospitals, and custom safe shelters with one-tap destination setting.
* ✅ **Sleek Mobile Mockup Presentation Frame (`PhoneFrame.tsx`):** Ultra-polished titanium smartphone shell presentation layout for hackathon live demos.
* ✅ **Production-Ready Stack:** Next.js 16 + Express + Node.js backend + Supabase PostGIS + MapLibre GL.

---

### 🎯 Goal of the Project:
1. **Zero Friction Safety:** Provide an invisible safety net that works passively in a pocket without requiring constant interaction.
2. **Empowerment & Peace of Mind:** Enable women to travel freely and fearlessly at night knowing they are guided along lit paths and backed by automated emergency protection.
3. **Community & Institutional Integration:** Scale Lumina to integrate directly with municipal lighting data, city CCTV coverage, and local emergency dispatch services.

---

## 🎤 1-Minute Pitch Script (For Judges Presentation)

> **"Cześć! Obojętnie jak bardzo rozwijają się nasze miasta, kobiety powracające nocą samotnie do domu wciąż odczuwają lęk. Dlaczego? Bo Google Maps prowadzi najszybszą trasą — prosto w ciemny zaułek.**
>
> **Oto Lumina.** Aplikacja nawigacyjna stworzona z myślą o klastrze **ImpactHer**, która łączy **inteligentne omijanie ryzyka przed zdarzeniem** z **automatyczną opieką w trakcie powrotu**.
>
> Lumina wyznacza **Bezpieczną Trasę**, omijając nieoświetlone strefy i zgłoszenia niebezpieczeństw. Ale co najważniejsze: nie wymaga wciskania żadnego przycisku w chwili zagrożenia. W tle działa nasz **Dead Man’s Switch** — jeśli akcelerometr wykryje nagły bieg, szamotaninę lub zatrzymanie w ciemnej uliczce, aplikacja sama rozpocznie odliczanie i wyśle alert z pozycją GPS do bliskich. Działa to nawet bez dostępu do internetu dzięki naszemu **SMS Fallback Protocol**.
>
> Mamy w pełni działające MVP z podwójnym silnikiem tras, sensoryką i schronieniami Safe Haven. **Dziękujemy!"**
