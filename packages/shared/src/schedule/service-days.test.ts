import { describe, expect, it } from "vitest";
import { manilaInstant, nextServiceDay, openDaysLabel, type StoreHoursDay } from "./hours";

const hours = (openDays: number[]): StoreHoursDay[] =>
  [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, opensAt: "13:00", closesAt: "21:00", isOpen: openDays.includes(dayOfWeek) }));

// Weekend Food Hub's weekend schedule: Friday, Saturday and Sunday, 1–9 PM.
const weekend = hours([5, 6, 0]);
// 2026-11-03 is a Tuesday; 2026-11-06 a Friday; 2026-11-08 a Sunday.
const at = (dateKey: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return manilaInstant(dateKey, h! * 60 + m!);
};

describe("nextServiceDay", () => {
  it("points a Tuesday visitor at Friday", () => {
    expect(nextServiceDay({ now: at("2026-11-03", "10:00"), hours: weekend, closures: [] })).toEqual({
      dateKey: "2026-11-06",
      isToday: false,
      weekday: "Fri",
    });
  });

  it("is today on an open day, before opening and while open", () => {
    expect(nextServiceDay({ now: at("2026-11-06", "10:00"), hours: weekend, closures: [] })?.isToday).toBe(true);
    expect(nextServiceDay({ now: at("2026-11-06", "14:00"), hours: weekend, closures: [] })?.isToday).toBe(true);
  });

  it("moves to next weekend after Sunday closing", () => {
    expect(nextServiceDay({ now: at("2026-11-08", "22:00"), hours: weekend, closures: [] })?.dateKey).toBe("2026-11-13");
  });

  it("skips closed dates", () => {
    expect(nextServiceDay({ now: at("2026-11-03", "10:00"), hours: weekend, closures: ["2026-11-06"] })?.weekday).toBe("Sat");
  });

  it("is null when the store never opens", () => {
    expect(nextServiceDay({ now: at("2026-11-03", "10:00"), hours: hours([]), closures: [] })).toBeNull();
  });
});

describe("openDaysLabel", () => {
  it("describes the open days", () => {
    expect(openDaysLabel(weekend)).toBe("Fri–Sun");
    expect(openDaysLabel(hours([0, 1, 2, 3, 4, 5, 6]))).toBe("every day");
    expect(openDaysLabel(hours([]))).toBeNull();
    expect(openDaysLabel(hours([6, 0, 1]))).toBe("Sat–Mon");
    expect(openDaysLabel(hours([1, 2, 3, 6]))).toBe("Mon–Wed, Sat");
    expect(openDaysLabel(hours([3]))).toBe("Wed");
  });
});
