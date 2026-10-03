// Navigation walker marker. She always faces her direction of travel: the map
// picks one of four views from the angle between her heading and the camera
// (see walkerDirection). In turn-by-turn mode the camera follows the heading,
// so normally she is seen from behind, walking "into" the screen.
// Animations live in globals.css under `.lw-*`.

export const WALK_CYCLE: Record<number, string> = { 1: '0.8s', 2: '0.55s', 4: '0.38s' };

export type WalkerDirection = 'up' | 'right' | 'down' | 'left';

const VIEW_CENTER: Record<WalkerDirection, number> = { up: 0, right: 90, down: 180, left: 270 };
/** Extra degrees past a 45° boundary before switching, so zig-zag paths don't flicker. */
const HYSTERESIS = 15;

/** Which view to show, from the walking heading and the map bearing (degrees). */
export function walkerDirection(heading: number, mapBearing: number, previous?: WalkerDirection): WalkerDirection {
  const rel = (((heading - mapBearing) % 360) + 360) % 360;
  if (previous) {
    const diff = Math.abs(((rel - VIEW_CENTER[previous] + 540) % 360) - 180);
    if (diff < 45 + HYSTERESIS) return previous;
  }
  if (rel < 45 || rel >= 315) return 'up';
  if (rel < 135) return 'right';
  if (rel < 225) return 'down';
  return 'left';
}

const SKIN = '#f6c7a6';
const SKIN_SHADE = '#e8b08f';
const LEGGINGS = '#312e81';
const SLEEVE = '#9333ea';

// Paint servers live in a zero-size (not display:none) SVG so every view can use them
const DEFS = `
  <svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <defs>
      <linearGradient id="lw-jacket" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#a855f7" />
        <stop offset="1" stop-color="#ec4899" />
      </linearGradient>
      <linearGradient id="lw-hair" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6b3a24" />
        <stop offset="1" stop-color="#3b1d12" />
      </linearGradient>
    </defs>
  </svg>`;

const GROUND = `
    <ellipse class="lw-pulse" cx="30" cy="87" rx="14" ry="4.5" fill="none" stroke="#a78bfa" stroke-width="1.4" />
    <ellipse class="lw-shadow" cx="30" cy="87" rx="11" ry="3" fill="#1e1b4b" opacity="0.35" />`;

/** Front/back legs; `heelTab` draws the sneaker from behind. */
function frontBackLeg(cls: string, x: number, heelTab: boolean): string {
  return `
    <g class="${cls}">
      <line x1="${x}" y1="52" x2="${x}" y2="78.5" stroke="${LEGGINGS}" stroke-width="6.6" stroke-linecap="round" />
      <rect x="${x - 3.7}" y="77.4" width="7.4" height="5.6" rx="2.2" fill="#ffffff" />
      <rect x="${x - 3.7}" y="81.6" width="7.4" height="1.8" rx="0.9" fill="#ec4899" />
      ${heelTab
        ? `<rect x="${x - 0.9}" y="77" width="1.8" height="2.8" rx="0.6" fill="#ec4899" />`
        : `<path d="M${x - 2.4} 79.2 h4.8" stroke="#f9a8d4" stroke-width="0.9" stroke-linecap="round" />`}
    </g>`;
}

function frontBackArms(): string {
  return `
    <g class="lw-barm-l">
      <line x1="23.4" y1="33" x2="21.8" y2="49.4" stroke="${SLEEVE}" stroke-width="5" stroke-linecap="round" />
      <circle cx="21.6" cy="51" r="2.1" fill="${SKIN}" />
    </g>
    <g class="lw-barm-r">
      <line x1="36.6" y1="33" x2="38.2" y2="49.4" stroke="${SLEEVE}" stroke-width="5" stroke-linecap="round" />
      <circle cx="38.4" cy="51" r="2.1" fill="${SKIN}" />
    </g>`;
}

const TORSO = `
    <path d="M22.6 35 Q22.9 29.8 28 29.5 H32 Q37.1 29.8 37.4 35 L37 51 Q36.6 55.6 32.5 55.6 H27.5 Q23.4 55.6 23 51 Z" fill="url(#lw-jacket)" />
    <path d="M23.2 52.4 H36.8" stroke="#831843" stroke-width="1.6" opacity="0.3" />`;

// Seen from behind: walking away from the camera, ponytail swinging on her back
const BACK_VIEW = `
  <svg class="lw-view lw-view-back" viewBox="0 0 60 92" width="52" height="80">
    ${GROUND}
    ${frontBackLeg('lw-bleg-l', 26.5, true)}
    ${frontBackLeg('lw-bleg-r', 33.5, true)}
    <g class="lw-bbody">
      ${TORSO}
      <path d="M24.6 30.6 Q30 37 35.4 30.6 Q34.4 28.2 30 28.2 Q25.6 28.2 24.6 30.6 Z" fill="#7e22ce" opacity="0.85" />
      <path d="M30 37 V53" stroke="#c084fc" stroke-width="0.7" opacity="0.6" />
      ${frontBackArms()}
      <rect x="28" y="25.5" width="4" height="4" rx="1.4" fill="${SKIN_SHADE}" />
      <ellipse cx="21.3" cy="20" rx="1.3" ry="1.9" fill="${SKIN_SHADE}" />
      <ellipse cx="38.7" cy="20" rx="1.3" ry="1.9" fill="${SKIN_SHADE}" />
      <circle cx="30" cy="19" r="9" fill="url(#lw-hair)" />
      <path d="M24 14.6 Q30 10.4 36 14.6" stroke="#8b5a3c" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7" />
      <g class="lw-bpony">
        <path d="M27.7 15 C26 20.5 26.4 26.5 28.4 31.4 Q30 34 31.6 31.4 C33.6 26.5 34 20.5 32.3 15 Z" fill="url(#lw-hair)" />
        <path d="M29.2 18 C28.6 22 28.9 26 29.8 29.5" stroke="#8b5a3c" stroke-width="0.7" fill="none" opacity="0.6" />
        <circle cx="30" cy="14.6" r="1.9" fill="#ec4899" />
      </g>
    </g>
  </svg>`;

// Seen from the front: walking towards the camera
const FRONT_VIEW = `
  <svg class="lw-view lw-view-front" viewBox="0 0 60 92" width="52" height="80">
    ${GROUND}
    ${frontBackLeg('lw-bleg-l', 26.5, false)}
    ${frontBackLeg('lw-bleg-r', 33.5, false)}
    <g class="lw-bbody">
      <g class="lw-bpony">
        <path d="M37 13.5 C42 15 43 21 41 27 C40 29 38.6 29.4 38.2 27.6 C39.2 23 38.6 18 36 15.5 Z" fill="url(#lw-hair)" />
      </g>
      ${TORSO}
      <path d="M26.2 29.8 L30 34.5 L33.8 29.8" fill="#fbcfe8" opacity="0.9" />
      <path d="M30 34.5 V55" stroke="#fbcfe8" stroke-width="0.8" opacity="0.8" />
      ${frontBackArms()}
      <rect x="28" y="25.5" width="4" height="4.5" rx="1.4" fill="${SKIN_SHADE}" />
      <ellipse cx="21.3" cy="20" rx="1.3" ry="1.9" fill="${SKIN_SHADE}" />
      <ellipse cx="38.7" cy="20" rx="1.3" ry="1.9" fill="${SKIN_SHADE}" />
      <circle cx="30" cy="19" r="9" fill="${SKIN}" />
      <ellipse cx="26.8" cy="19.8" rx="1.05" ry="1.4" fill="#1f2937" />
      <ellipse cx="33.2" cy="19.8" rx="1.05" ry="1.4" fill="#1f2937" />
      <circle cx="27.15" cy="19.3" r="0.35" fill="#ffffff" />
      <circle cx="33.55" cy="19.3" r="0.35" fill="#ffffff" />
      <ellipse cx="24.9" cy="22.4" rx="1.5" ry="0.9" fill="#fb7185" opacity="0.45" />
      <ellipse cx="35.1" cy="22.4" rx="1.5" ry="0.9" fill="#fb7185" opacity="0.45" />
      <path d="M28.4 23.6 Q30 24.9 31.6 23.6" stroke="#be123c" stroke-width="0.75" fill="none" stroke-linecap="round" />
      <path d="M20.9 19.5 C20.4 10.6 25.6 8.4 30 8.4 C34.4 8.4 39.6 10.6 39.1 19.5 C37.8 15.6 35.4 13.8 32.6 14.6 C31.2 13.2 28.6 13.1 27 14.4 C24.6 13.6 22.2 15.6 20.9 19.5 Z" fill="url(#lw-hair)" />
      <path d="M25 11.6 Q30 9.2 35 11.6" stroke="#8b5a3c" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7" />
    </g>
  </svg>`;

// Side profile facing right; mirrored by CSS when walking left
const SIDE_VIEW = `
  <svg class="lw-view lw-view-side" viewBox="0 0 60 92" width="52" height="80">
    ${GROUND}
    <g class="lw-body">
      <g class="lw-arm-far">
        <line x1="30" y1="33" x2="30" y2="42" stroke="#6d28d9" stroke-width="5" stroke-linecap="round" />
        <g class="lw-fore-far">
          <line x1="30" y1="42" x2="30" y2="49.5" stroke="#6d28d9" stroke-width="4.4" stroke-linecap="round" />
          <circle cx="30" cy="51" r="2.2" fill="${SKIN_SHADE}" />
        </g>
      </g>
      <g class="lw-thigh-far">
        <line x1="30" y1="52" x2="30" y2="65" stroke="#1e1b4b" stroke-width="7" stroke-linecap="round" />
        <g class="lw-shin-far">
          <line x1="30" y1="65" x2="30" y2="78" stroke="#1e1b4b" stroke-width="6" stroke-linecap="round" />
          <path d="M26.6 77 h5.6 c3.6 0 5.2 1.6 5.4 4 v0.6 h-11 z" fill="#e5e7eb" />
          <path d="M26.6 81.6 h11" stroke="#db2777" stroke-width="1.3" stroke-linecap="round" />
        </g>
      </g>
      <g class="lw-pony">
        <path d="M25 13.5 C18.5 12 15 17.5 16 24 C16.6 28.5 19.4 30.5 18.8 34 C22.6 31 23.6 26 23 21.5 C22.7 18.5 23.6 16.5 26 15.2 Z" fill="url(#lw-hair)" />
      </g>
      <path d="M24.3 34 Q24.6 29.6 29 29.4 H32.4 Q37 29.6 37.2 34.5 L36.6 50.5 Q36.2 55 32 55 H28.4 Q24.4 55 24.3 50.5 Z" fill="url(#lw-jacket)" />
      <path d="M33.5 30 L33 54.5" stroke="#fbcfe8" stroke-width="0.8" opacity="0.8" />
      <path d="M24.6 51.5 H36.6" stroke="#831843" stroke-width="1.6" opacity="0.35" />
      <g class="lw-thigh-near">
        <line x1="30" y1="52" x2="30" y2="65" stroke="${LEGGINGS}" stroke-width="7" stroke-linecap="round" />
        <g class="lw-shin-near">
          <line x1="30" y1="65" x2="30" y2="78" stroke="${LEGGINGS}" stroke-width="6" stroke-linecap="round" />
          <path d="M26.6 77 h5.6 c3.6 0 5.2 1.6 5.4 4 v0.6 h-11 z" fill="#ffffff" />
          <path d="M26.6 81.6 h11" stroke="#ec4899" stroke-width="1.3" stroke-linecap="round" />
        </g>
      </g>
      <rect x="29" y="25" width="4" height="5.5" rx="1.5" fill="${SKIN_SHADE}" />
      <circle cx="32" cy="19" r="8.6" fill="${SKIN}" />
      <ellipse cx="29.4" cy="20" rx="1.4" ry="1.9" fill="${SKIN_SHADE}" />
      <ellipse cx="36" cy="18.6" rx="1.05" ry="1.45" fill="#1f2937" />
      <circle cx="36.35" cy="18.1" r="0.35" fill="#ffffff" />
      <path d="M35 16.6 Q36.2 15.9 37.4 16.5" stroke="#3b1d12" stroke-width="0.7" fill="none" stroke-linecap="round" />
      <ellipse cx="35.6" cy="21.6" rx="1.6" ry="1" fill="#fb7185" opacity="0.45" />
      <path d="M37.3 23.2 Q38.4 23.4 39 22.6" stroke="#be123c" stroke-width="0.75" fill="none" stroke-linecap="round" />
      <path d="M40.3 17.2 C40 10.2 34.6 7.6 29.6 8.9 C25 10.1 22.9 14.4 23.6 20.5 C24.6 23.8 27 23.4 27.7 20.6 C28.3 17.6 29.7 15.4 32.6 14.9 C35.6 14.4 38.4 15.6 40.3 17.2 Z" fill="url(#lw-hair)" />
      <path d="M29.5 10.6 C32 9.6 35 9.9 37 11.4" stroke="#8b5a3c" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8" />
      <circle cx="25" cy="14.4" r="1.7" fill="#ec4899" />
      <g class="lw-arm-near">
        <line x1="30" y1="33" x2="30" y2="42" stroke="${SLEEVE}" stroke-width="5" stroke-linecap="round" />
        <g class="lw-fore-near">
          <line x1="30" y1="42" x2="30" y2="49.5" stroke="${SLEEVE}" stroke-width="4.4" stroke-linecap="round" />
          <circle cx="30" cy="51" r="2.2" fill="${SKIN}" />
        </g>
      </g>
    </g>
  </svg>`;

/**
 * Marker HTML. All views are rendered once; switching direction only flips
 * `data-dir`, and pausing swaps `walking-active` for `walking-paused` (standing
 * pose), so running animations are never rebuilt.
 */
export function renderWalkingPersonHTML(isWalking: boolean, speed: number, dir: WalkerDirection = 'up'): string {
  const duration = WALK_CYCLE[speed] ?? WALK_CYCLE[1];
  const walkClass = isWalking ? 'walking-active' : 'walking-paused';

  // translateY lifts the figure so her feet, not her waist, sit on the route point
  return `
  <div class="lw-root ${walkClass} pointer-events-none select-none" data-dir="${dir}" style="--walk-duration: ${duration}; transform: translateY(-36px); filter: drop-shadow(0 2px 3px rgba(15, 23, 42, 0.35));">
    ${DEFS}
    ${BACK_VIEW}
    ${FRONT_VIEW}
    ${SIDE_VIEW}
  </div>`;
}
