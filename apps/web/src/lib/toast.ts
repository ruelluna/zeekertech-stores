"use client";

// Tiny toast store: call toast() from anywhere on the client; <Toaster /> (root layout) shows them.

export type ToastTone = "info" | "success" | "warning" | "error";

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
  href?: string;
}

const DURATION_MS = 7000;
const listeners = new Set<() => void>();
let toasts: Toast[] = [];
let nextId = 1;

function emit() {
  for (const l of listeners) l();
}

export function toast(t: Omit<Toast, "id" | "tone"> & { tone?: ToastTone }): void {
  const id = nextId++;
  toasts = [...toasts.slice(-3), { tone: "info", ...t, id }]; // keep the newest 4
  emit();
  setTimeout(() => dismissToast(id), DURATION_MS);
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toastStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => toasts,
};

/** A short two-note chime (no audio file). Browsers only allow it after the page has been tapped once. */
export function chime(): void {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    });
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    // Audio unavailable: the toast still shows.
  }
}
