import { describe, expect, it } from "vitest";
import { smsParts, smsPeso, toPhMobile, toSmsText } from "./sms";

describe("toSmsText", () => {
  it("swaps the peso sign, smart quotes and dashes for GSM characters", () => {
    expect(toSmsText("Total: ₱349 — it’s “ready”…")).toBe(`Total: PHP 349 - it's "ready"...`);
  });

  it("keeps Ñ and strips accents GSM doesn't have", () => {
    expect(toSmsText("Peñaflor, José Ángel")).toBe("Peñaflor, José Angel");
  });

  it("drops emoji and tidies spaces", () => {
    expect(toSmsText("🛵 Rider  is on the way 🎉")).toBe("Rider is on the way");
  });
});

describe("smsParts", () => {
  it("bills 160 characters as one part and longer texts in 153-character parts", () => {
    expect(smsParts("a".repeat(160))).toBe(1);
    expect(smsParts("a".repeat(161))).toBe(2);
    expect(smsParts("a".repeat(306))).toBe(2);
    expect(smsParts("a".repeat(307))).toBe(3);
  });

  it("counts extended characters twice", () => {
    expect(smsParts("[".repeat(80))).toBe(1);
    expect(smsParts("[".repeat(81))).toBe(2);
  });
});

describe("toPhMobile", () => {
  it("accepts the usual ways people write a PH mobile number", () => {
    expect(toPhMobile("09171234567")).toBe("639171234567");
    expect(toPhMobile("+63 917 123 4567")).toBe("639171234567");
    expect(toPhMobile("917-123-4567")).toBe("639171234567");
  });

  it("rejects landlines and short numbers", () => {
    expect(toPhMobile("032 123 4567")).toBeNull();
    expect(toPhMobile("0917123456")).toBeNull();
    expect(toPhMobile(null)).toBeNull();
  });
});

describe("smsPeso", () => {
  it("writes PHP without trailing zeros on whole amounts", () => {
    expect(smsPeso(349)).toBe("PHP 349");
    expect(smsPeso(349.5)).toBe("PHP 349.50");
  });
});
