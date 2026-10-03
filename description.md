# Project Context: Proactive Safety Routing & Response (Hackathon MVP)

**Target Category:** ImpactHer (Technology for Real Change)
**Problem Statement:** Existing safety applications rely on reactive triggers (pressing a button during an attack) and standard navigation apps (Google Maps) optimize for efficiency, routing pedestrians through unsafe or unlit areas to save time. 
**Solution:** A proactive safety application that utilizes multi-layered routing (prioritizing lit streets and safe zones) and sensor-fusion anomaly detection to trigger automatic SOS protocols without user interaction.

## Core Features & Logic

### 1. Proactive Contextual SOS (Sensor-Driven Dead Man's Switch)
*   **Mechanism:** Continuously monitors hardware sensors (Accelerometer, GPS) to detect anomalies.
*   **Triggers:**
    *   Sudden acceleration/sprinting (Accelerometer variance threshold).
    *   Unplanned prolonged stop in a high-risk zone (>120 seconds).
    *   Severe deviation from the active safe route.
*   **Escalation Protocol:** 
    *   Triggers a 60-second local UI countdown ("Are you safe?").
    *   If not manually dismissed via a secure PIN/biometric, fires the SOS payload to trusted contacts/authorities.
*   **Offline-Resilient Broadcasting:** If internet connectivity drops, the app compresses the current GPS coordinates and alert type into an SMS payload and dispatches it via the cellular network.

### 2. Multi-Layered Safety Routing
*   **Mechanism:** Custom routing heuristic that penalizes distance in favor of safety scores.
*   **Data Layers:**
    *   Municipal/OpenStreetMap data (streetlights, open businesses).
    *   Official police danger zones (e.g., Polish KMZB API).
    *   Real-time community danger reports.

### 3. Shadow Trust Metric (Anti-Sabotage Reputation System)
*   **Mechanism:** A server-side user reputation system that validates community reports (e.g., "Aggressive group here") to prevent malicious routing sabotage (e.g., creating fake danger to reroute victims).
*   **Logic:**
    *   Reputation score is strictly hidden from the client UI.
    *   Score increases when other users physically pass the reported node and validate it.
    *   Score penalizes heavily for unverified or contradicted reports.
    *   Reports from users with a score below the threshold are shadow-banned (saved in DB but ignored by the routing algorithm).

## Proposed Data Models

**User**
*   `user_id` (UUID)
*   `trusted_contacts` (Array of phone numbers)
*   `reputation_score` (Float, Default: 1.0)
*   `total_reports_validated` (Int)

**Report**
*   `report_id` (UUID)
*   `author_id` (UUID)
*   `coordinates` (Lat/Lng)
*   `category` (Enum: Suspicious Activity, Lighting Issue, Obstacle)
*   `timestamp` (DateTime)
*   `validation_count` (Int)
*   `status` (Enum: Active, Resolved, Shadowbanned)

**SOS_Event**
*   `event_id` (UUID)
*   `user_id` (UUID)
*   `trigger_type` (Enum: Manual, Accelerometer, GPS_Deviation, Timeout)
*   `last_known_location` (Lat/Lng)
*   `dispatched_via` (Enum: API, SMS)

## Hackathon MVP Execution Scope (24-Hour Build)

To successfully implement this within the hackathon time constraints, the AI agent should focus on the following priorities:

1.  **Frontend/Mobile (Primary Focus):** React Native or Expo. Build the map UI, the route comparison screen, and the one-tap reporting interface.
2.  **Sensor Logic (Core Demo):** Implement the local accelerometer/GPS listener and the countdown UI. This is the critical "wow factor" feature that must function live.
3.  **Backend (Secondary Focus):** Node.js/Express or a BaaS like Firebase/Supabase. Mock the routing engine data. Implement the CRUD endpoints for submitting reports and calculating the Shadow Trust Metric logic.