import { describe, expect, it } from "vitest";
import { normalizeFacebookUrl } from "./links";

describe("normalizeFacebookUrl", () => {
  it("accepts Page links however they were copied", () => {
    expect(normalizeFacebookUrl("facebook.com/weekendfoodhub")).toBe("https://www.facebook.com/weekendfoodhub");
    expect(normalizeFacebookUrl("https://m.facebook.com/weekendfoodhub/")).toBe("https://www.facebook.com/weekendfoodhub/");
    expect(normalizeFacebookUrl("http://www.facebook.com/treatsbyyang")).toBe("https://www.facebook.com/treatsbyyang");
    expect(normalizeFacebookUrl(" fb.com/weekendfoodhub ")).toBe("https://www.facebook.com/weekendfoodhub");
    expect(normalizeFacebookUrl("https://www.facebook.com/profile.php?id=61550000000000")).toBe(
      "https://www.facebook.com/profile.php?id=61550000000000",
    );
  });

  it("rejects anything that isn't a Facebook Page", () => {
    expect(normalizeFacebookUrl("")).toBeNull();
    expect(normalizeFacebookUrl("facebook.com")).toBeNull();
    expect(normalizeFacebookUrl("https://evil.example/facebook.com/x")).toBeNull();
    expect(normalizeFacebookUrl("https://facebook.com.evil.example/x")).toBeNull();
    expect(normalizeFacebookUrl("0917 123 4567")).toBeNull();
  });
});
