import { describe, it, expect, vi, afterEach } from "vitest";
import { emitUsageEvent } from "../usageEvents";

describe("emitUsageEvent", () => {
  afterEach(() => vi.restoreAllMocks());

  it("dispatches a CustomEvent with the given name", () => {
    const spy = vi.spyOn(window, "dispatchEvent");
    emitUsageEvent("homelens:usage_page_viewed", { tier: "buyer" });
    expect(spy).toHaveBeenCalledTimes(1);
    const evt = spy.mock.calls[0][0] as CustomEvent;
    expect(evt.type).toBe("homelens:usage_page_viewed");
    expect((evt as CustomEvent).detail).toEqual({ tier: "buyer" });
  });

  it("strips undefined and null fields from the payload", () => {
    const spy = vi.spyOn(window, "dispatchEvent");
    emitUsageEvent("homelens:usage_indicator_clicked", {
      tier: "free",
      source: "header_chip",
      pct: 42,
      driver: "daily",
      cap_type: undefined,
    });
    const evt = spy.mock.calls[0][0] as CustomEvent;
    expect(evt.detail).toEqual({
      tier: "free",
      source: "header_chip",
      pct: 42,
      driver: "daily",
    });
  });

  it("never throws when dispatch fails", () => {
    vi.spyOn(window, "dispatchEvent").mockImplementation(() => {
      throw new Error("boom");
    });
    expect(() =>
      emitUsageEvent("homelens:topup_pack_clicked", {
        tier: "investor",
        source: "topup_packs",
        pack_size: "small",
      }),
    ).not.toThrow();
  });
});