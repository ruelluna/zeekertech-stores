import { describe, expect, it } from "vitest";
import {
  addDays,
  cartPrepMinutes,
  checkSlot,
  DEFAULT_SCHEDULE_SETTINGS,
  DEFAULT_STORE_HOURS,
  formatManilaTime,
  listSlots,
  storeStatus,
  manilaInstant,
  manilaParts,
  requiredLeadMinutes,
} from "./hours";

const DAY = "2026-10-28"; // a Wednesday
const at = (hhmm: string, dateKey = DAY) => {
  const [h, m] = hhmm.split(":").map(Number);
  return manilaInstant(dateKey, h! * 60 + m!);
};
const base = {
  hours: DEFAULT_STORE_HOURS,
  closures: [] as string[],
  hasUncertainItems: false,
  uncertainItemsCutoff: DEFAULT_SCHEDULE_SETTINGS.uncertainItemsCutoff,
};

describe("manila time helpers", () => {
  it("converts between instants and Manila wall-clock time", () => {
    const instant = at("13:00");
    expect(instant.toISOString()).toBe("2026-10-28T05:00:00.000Z");
    expect(manilaParts(instant)).toEqual({ dateKey: DAY, dayOfWeek: 3, minutes: 780 });
  });

  it("rolls over to the next Manila day after 4 PM UTC", () => {
    expect(manilaParts(new Date("2026-10-28T16:30:00Z")).dateKey).toBe("2026-10-29");
  });
});

describe("lead time", () => {
  it("uses the slowest item, or the store default", () => {
    expect(cartPrepMinutes([{ prepMinutes: 15 }, { prepMinutes: 40 }], 30)).toBe(40);
    expect(cartPrepMinutes([{ prepMinutes: null }], 30)).toBe(30);
  });

  it("adds travel and buffer for delivery only", () => {
    expect(requiredLeadMinutes({ fulfillment: "pickup", prepMinutes: 15, travelMinutes: 15, bufferMinutes: 10 })).toBe(15);
    expect(requiredLeadMinutes({ fulfillment: "delivery", prepMinutes: 15, travelMinutes: 15, bufferMinutes: 10 })).toBe(40);
  });
});

describe("checkSlot", () => {
  it("allows a silog pickup at 9:00 PM if ordered by 8:45 PM", () => {
    expect(checkSlot({ ...base, now: at("20:45"), slot: at("21:00"), leadMinutes: 15 })).toEqual({ ok: true });
    expect(checkSlot({ ...base, now: at("20:46"), slot: at("21:00"), leadMinutes: 15 })).toEqual({
      ok: false,
      reason: "too_soon",
    });
  });

  it("closes silog delivery with a 15-min drive at 8:20 PM", () => {
    expect(checkSlot({ ...base, now: at("20:20"), slot: at("21:00"), leadMinutes: 40 }).ok).toBe(true);
    expect(checkSlot({ ...base, now: at("20:21"), slot: at("21:00"), leadMinutes: 40 }).ok).toBe(false);
  });

  it("never offers slots after 9:00 PM or before opening + lead", () => {
    expect(checkSlot({ ...base, now: at("10:00"), slot: at("21:15"), leadMinutes: 15 })).toEqual({
      ok: false,
      reason: "outside_hours",
    });
    expect(checkSlot({ ...base, now: at("10:00"), slot: at("13:15"), leadMinutes: 30 })).toEqual({
      ok: false,
      reason: "outside_hours",
    });
    expect(checkSlot({ ...base, now: at("10:00"), slot: at("13:30"), leadMinutes: 30 })).toEqual({ ok: true });
  });

  it("blocks same-day crab/shrimp orders after 8:00 PM but allows next-day pre-orders", () => {
    const uncertain = { ...base, hasUncertainItems: true, leadMinutes: 40 };
    expect(checkSlot({ ...uncertain, now: at("20:01"), slot: at("21:00") })).toEqual({
      ok: false,
      reason: "uncertain_items_cutoff",
    });
    expect(checkSlot({ ...uncertain, now: at("20:01"), slot: at("14:00", "2026-10-29") })).toEqual({ ok: true });
  });

  it("respects closed dates", () => {
    expect(checkSlot({ ...base, closures: [DAY], now: at("10:00"), slot: at("15:00"), leadMinutes: 15 })).toEqual({
      ok: false,
      reason: "closed_that_day",
    });
  });
});

describe("storeStatus", () => {
  const status = (hhmm: string, extra: { closures?: string[]; paused?: boolean } = {}) =>
    storeStatus({ now: at(hhmm), hours: DEFAULT_STORE_HOURS, closures: extra.closures ?? [], paused: extra.paused ?? false });

  it("is closed before 1 PM and says when it opens today", () => {
    const s = status("10:00");
    expect(s.state).toBe("closed");
    expect(s.state === "closed" && s.opensAt && formatManilaTime(s.opensAt)).toBe("1:00 PM");
    expect(s.state === "closed" && s.opensAt && manilaParts(s.opensAt).dateKey).toBe(DAY);
  });

  it("is open between 1 PM and 9 PM", () => {
    const s = status("13:00");
    expect(s.state).toBe("open");
    expect(s.state === "open" && formatManilaTime(s.closesAt)).toBe("9:00 PM");
  });

  it("opens tomorrow after 9 PM", () => {
    const s = status("21:00");
    expect(s.state === "closed" && s.opensAt && manilaParts(s.opensAt).dateKey).toBe("2026-10-29");
  });

  it("skips closed dates and reports a pause", () => {
    const s = status("15:00", { closures: [DAY, "2026-10-29"] });
    expect(s.state === "closed" && s.opensAt && manilaParts(s.opensAt).dateKey).toBe("2026-10-30");
    expect(status("15:00", { paused: true })).toEqual({ state: "paused" });
  });
});

describe("slot window (opening + 1 h to closing − 1 h)", () => {
  const windowed = {
    ...base,
    slotStartOffsetMinutes: DEFAULT_SCHEDULE_SETTINGS.slotStartOffsetMinutes,
    slotEndOffsetMinutes: DEFAULT_SCHEDULE_SETTINGS.slotEndOffsetMinutes,
  };

  it("offers 2:00 PM to 8:00 PM for 1–9 PM hours", () => {
    const slots = listSlots({ ...windowed, dateKey: DAY, now: at("09:00"), leadMinutes: 15 });
    expect(formatManilaTime(slots[0]!)).toBe("2:00 PM");
    expect(formatManilaTime(slots.at(-1)!)).toBe("8:00 PM");
  });

  it("rejects 1:45 PM and 8:15 PM", () => {
    expect(checkSlot({ ...windowed, now: at("09:00"), slot: at("13:45"), leadMinutes: 15 })).toEqual({ ok: false, reason: "outside_hours" });
    expect(checkSlot({ ...windowed, now: at("09:00"), slot: at("20:15"), leadMinutes: 15 })).toEqual({ ok: false, reason: "outside_hours" });
  });

  it("still uses the lead time when it's longer than the start offset", () => {
    expect(checkSlot({ ...windowed, now: at("09:00"), slot: at("14:00"), leadMinutes: 75 }).ok).toBe(false);
    expect(checkSlot({ ...windowed, now: at("09:00"), slot: at("14:15"), leadMinutes: 75 }).ok).toBe(true);
  });

  it("last same-day silog pickup is ordered by 7:45 PM", () => {
    expect(checkSlot({ ...windowed, now: at("19:45"), slot: at("20:00"), leadMinutes: 15 }).ok).toBe(true);
    expect(checkSlot({ ...windowed, now: at("19:46"), slot: at("20:00"), leadMinutes: 15 }).ok).toBe(false);
  });
});

describe("listSlots", () => {
  it("lists 15-minute slots from 1:30 PM to 9:00 PM for a 30-min lead", () => {
    const slots = listSlots({ ...base, dateKey: DAY, now: at("09:00"), leadMinutes: 30 });
    expect(manilaParts(slots[0]!).minutes).toBe(13 * 60 + 30);
    expect(manilaParts(slots.at(-1)!).minutes).toBe(21 * 60);
    expect(slots).toHaveLength(31);
  });
});

describe("advance notice (made-to-order cakes)", () => {
  it("adds calendar days across month ends", () => {
    expect(addDays("2026-10-30", 2)).toBe("2026-11-01");
    expect(addDays(DAY, 0)).toBe(DAY);
  });

  it("only offers dates at least the notice away, whatever the time of day", () => {
    const cake = { ...base, leadMinutes: 30, noticeDays: 2 };
    expect(checkSlot({ ...cake, now: at("10:00"), slot: at("18:00") })).toEqual({ ok: false, reason: "needs_notice" });
    expect(checkSlot({ ...cake, now: at("10:00"), slot: at("18:00", "2026-10-29") })).toEqual({ ok: false, reason: "needs_notice" });
    expect(checkSlot({ ...cake, now: at("20:59"), slot: at("14:00", "2026-10-30") })).toEqual({ ok: true });
  });

  it("lists no slots before the notice date", () => {
    const opts = { ...base, now: at("10:00"), leadMinutes: 30, noticeDays: 1 };
    expect(listSlots({ ...opts, dateKey: DAY })).toEqual([]);
    expect(listSlots({ ...opts, dateKey: "2026-10-29" }).length).toBeGreaterThan(0);
  });
});
