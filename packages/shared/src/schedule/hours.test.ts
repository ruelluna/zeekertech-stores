import { describe, expect, it } from "vitest";
import {
  cartPrepMinutes,
  checkSlot,
  DEFAULT_SCHEDULE_SETTINGS,
  DEFAULT_STORE_HOURS,
  listSlots,
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

describe("listSlots", () => {
  it("lists 15-minute slots from 1:30 PM to 9:00 PM for a 30-min lead", () => {
    const slots = listSlots({ ...base, dateKey: DAY, now: at("09:00"), leadMinutes: 30 });
    expect(manilaParts(slots[0]!).minutes).toBe(13 * 60 + 30);
    expect(manilaParts(slots.at(-1)!).minutes).toBe(21 * 60);
    expect(slots).toHaveLength(31);
  });
});
