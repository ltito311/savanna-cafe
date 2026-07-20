// Tiny sound player. Browsers only allow audio after the first tap, so
// every call is fire-and-forget and silently tolerates being blocked.

const FILES = {
  click: "/assets/audio/click.ogg",
  cash: "/assets/audio/cash.ogg",
  coin: "/assets/audio/coin-stack.ogg",
} as const;

export type SoundName = keyof typeof FILES;

const lastPlayed: Partial<Record<SoundName, number>> = {};

export function playSound(name: SoundName, volume = 0.5, throttleMs = 120) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - (lastPlayed[name] ?? 0) < throttleMs) return;
  lastPlayed[name] = now;
  try {
    const audio = new Audio(FILES[name]);
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch {
    // no audio support — the game plays fine silently
  }
}
