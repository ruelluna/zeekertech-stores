import type { Fulfillment } from "../enums";

// The Philippines is UTC+8 all year (no daylight saving), so a fixed offset is exact.
const MANILA_OFFSET_MINUTES = 8 * 60;

/** "HH:MM" in Manila time. */
export type ClockTime = `${number}:${number}`;

export interface StoreHoursDay {
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: number;
  opensAt: ClockTime;
  closesAt: ClockTime;
  isOpen: boolean;
}

export interface ScheduleSettings {
  /** Used when no item in the cart has its own prep time. */
  defaultPrepMinutes: number;
  deliveryBufferMinutes: number;
  /** Same-day cutoff for subject-to-availability items. */
  uncertainItemsCutoff: ClockTime;
  /** First pickup/delivery time = opening + this. */
  slotStartOffsetMinutes: number;
  /** Last pickup/delivery time = closing − this. */
  slotEndOffsetMinutes: number;
}

/** 1:00 PM – 9:00 PM every day; pickup/delivery times run 2:00–8:00 PM (PLAN.md §3.6). */
export const DEFAULT_STORE_HOURS: StoreHoursDay[] = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  opensAt: "13:00",
  closesAt: "21:00",
  isOpen: true,
}));

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  defaultPrepMinutes: 30,
  deliveryBufferMinutes: 10,
  uncertainItemsCutoff: "20:00",
  slotStartOffsetMinutes: 60,
  slotEndOffsetMinutes: 60,
};

export function clockToMinutes(t: ClockTime): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Manila calendar date (YYYY-MM-DD), weekday and minutes since midnight for an instant. */
export function manilaParts(instant: Date): { dateKey: string; dayOfWeek: number; minutes: number } {
  const shifted = new Date(instant.getTime() + MANILA_OFFSET_MINUTES * 60_000);
  return {
    dateKey: shifted.toISOString().slice(0, 10),
    dayOfWeek: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** A Manila date (YYYY-MM-DD) plus some calendar days. */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** The instant for a Manila date (YYYY-MM-DD) plus minutes since midnight. */
export function manilaInstant(dateKey: string, minutes: number): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 0, minutes - MANILA_OFFSET_MINUTES));
}

/** Prep time for a cart = its slowest item (or the store default if none set one). */
export function cartPrepMinutes(items: { prepMinutes: number | null }[], defaultPrepMinutes: number): number {
  const times = items.map((i) => i.prepMinutes).filter((m): m is number => m !== null);
  return times.length ? Math.max(...times) : defaultPrepMinutes;
}

/** Minutes needed between placing an order and its pickup/delivery time. */
export function requiredLeadMinutes(input: {
  fulfillment: Fulfillment;
  prepMinutes: number;
  travelMinutes?: number | null;
  bufferMinutes: number;
}): number {
  if (input.fulfillment === "pickup") return input.prepMinutes;
  return input.prepMinutes + Math.ceil(input.travelMinutes ?? 0) + input.bufferMinutes;
}

export type SlotCheck =
  | { ok: true }
  | {
      ok: false;
      reason: "closed_that_day" | "outside_hours" | "too_soon" | "uncertain_items_cutoff" | "needs_notice";
    };

/**
 * Whether a pickup/delivery time can be offered. Slots run from opening + the start offset (or the
 * lead time, if longer) up to closing − the end offset, and must be at least the lead time from now.
 */
export function checkSlot(input: {
  now: Date;
  slot: Date;
  leadMinutes: number;
  hours: StoreHoursDay[];
  closures: string[];
  hasUncertainItems: boolean;
  uncertainItemsCutoff: ClockTime;
  /** First slot = opening + this (default 0). */
  slotStartOffsetMinutes?: number;
  /** Last slot = closing − this (default 0). */
  slotEndOffsetMinutes?: number;
  /** Made-to-order items (e.g. cakes): the earliest date is today + this many days (default 0). */
  noticeDays?: number;
}): SlotCheck {
  const slot = manilaParts(input.slot);
  const now = manilaParts(input.now);
  const day = input.hours.find((h) => h.dayOfWeek === slot.dayOfWeek);

  if (!day?.isOpen || input.closures.includes(slot.dateKey)) return { ok: false, reason: "closed_that_day" };

  if (input.noticeDays && slot.dateKey < addDays(now.dateKey, input.noticeDays)) {
    return { ok: false, reason: "needs_notice" };
  }

  const open = clockToMinutes(day.opensAt);
  const close = clockToMinutes(day.closesAt);
  const earliest = open + Math.max(input.leadMinutes, input.slotStartOffsetMinutes ?? 0);
  const latest = close - (input.slotEndOffsetMinutes ?? 0);
  if (slot.minutes < earliest || slot.minutes > latest) {
    return { ok: false, reason: "outside_hours" };
  }

  if (input.slot.getTime() - input.now.getTime() < input.leadMinutes * 60_000) {
    return { ok: false, reason: "too_soon" };
  }

  if (
    input.hasUncertainItems &&
    slot.dateKey === now.dateKey &&
    now.minutes > clockToMinutes(input.uncertainItemsCutoff)
  ) {
    return { ok: false, reason: "uncertain_items_cutoff" };
  }

  return { ok: true };
}

export type StoreStatus =
  | { state: "open"; closesAt: Date }
  | { state: "paused" }
  | { state: "closed"; opensAt: Date | null };

/** Whether ordering is open right now, and when it next opens or closes (looks ahead 14 days). */
export function storeStatus(input: {
  now: Date;
  hours: StoreHoursDay[];
  closures: string[];
  paused: boolean;
}): StoreStatus {
  if (input.paused) return { state: "paused" };

  const now = manilaParts(input.now);
  for (let offset = 0; offset < 14; offset++) {
    const dateKey = manilaParts(new Date(input.now.getTime() + offset * 86_400_000)).dateKey;
    const dayOfWeek = (now.dayOfWeek + offset) % 7;
    const day = input.hours.find((h) => h.dayOfWeek === dayOfWeek);
    if (!day?.isOpen || input.closures.includes(dateKey)) continue;

    const open = clockToMinutes(day.opensAt);
    const close = clockToMinutes(day.closesAt);
    if (offset === 0 && now.minutes >= open && now.minutes < close) {
      return { state: "open", closesAt: manilaInstant(dateKey, close) };
    }
    if (offset > 0 || now.minutes < open) return { state: "closed", opensAt: manilaInstant(dateKey, open) };
  }
  return { state: "closed", opensAt: null };
}

/** "1:00 PM" style label for a Manila time. */
export function formatManilaTime(instant: Date): string {
  const { minutes } = manilaParts(instant);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** All bookable slots for one Manila date, every `intervalMinutes`. */
export function listSlots(input: {
  dateKey: string;
  now: Date;
  leadMinutes: number;
  hours: StoreHoursDay[];
  closures: string[];
  hasUncertainItems: boolean;
  uncertainItemsCutoff: ClockTime;
  slotStartOffsetMinutes?: number;
  slotEndOffsetMinutes?: number;
  noticeDays?: number;
  intervalMinutes?: number;
}): Date[] {
  const interval = input.intervalMinutes ?? 15;
  const slots: Date[] = [];
  for (let m = 0; m < 24 * 60; m += interval) {
    const slot = manilaInstant(input.dateKey, m);
    if (checkSlot({ ...input, slot }).ok) slots.push(slot);
  }
  return slots;
}

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The next day the store hands out orders (pickup or delivery): today if it is still open today, else
 * its next open day. Null if it has no open day in the next two weeks.
 */
export function nextServiceDay(input: { now: Date; hours: StoreHoursDay[]; closures: string[] }): {
  dateKey: string;
  isToday: boolean;
  /** "Fri" */
  weekday: string;
} | null {
  const status = storeStatus({ ...input, paused: false });
  const at = status.state === "open" ? input.now : status.state === "closed" ? status.opensAt : null;
  if (!at) return null;
  const day = manilaParts(at);
  return { dateKey: day.dateKey, isToday: day.dateKey === manilaParts(input.now).dateKey, weekday: SHORT_DAYS[day.dayOfWeek]! };
}

/**
 * The days a store is open, for the menu: "every day", "Fri–Sun", "Mon–Wed, Sat", or null if none.
 * Runs of consecutive days are joined with a dash, wrapping past Sunday (Sat–Mon).
 */
export function openDaysLabel(hours: StoreHoursDay[]): string | null {
  const open = [0, 1, 2, 3, 4, 5, 6].map((d) => hours.some((h) => h.dayOfWeek === d && h.isOpen));
  const count = open.filter(Boolean).length;
  if (count === 0) return null;
  if (count === 7) return "every day";

  // Start just after a closed day, so a run that wraps past Sunday stays in one piece.
  const firstClosed = open.indexOf(false);
  const runs: [number, number][] = [];
  for (let i = 1; i <= 7; i++) {
    const day = (firstClosed + i) % 7;
    if (!open[day]) continue;
    const last = runs[runs.length - 1];
    if (last && (last[1] + 1) % 7 === day) last[1] = day;
    else runs.push([day, day]);
  }
  return runs.map(([a, b]) => (a === b ? SHORT_DAYS[a] : `${SHORT_DAYS[a]}–${SHORT_DAYS[b]}`)).join(", ");
}
