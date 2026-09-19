import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateAllCasualtyData } from "../casualtyInvalidation";
import { qk } from "../queryKeys";

describe("invalidateAllCasualtyData", () => {
  it("invalidates every casualty-related root key", () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");
    invalidateAllCasualtyData(qc);
    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        qk.incidents.all,
        qk.kia.all,
        qk.militants.all,
        qk.stats.all,
        qk.integrity.all,
        qk.incidents.countsAll,
      ])
    );
  });
});

describe("qk factory", () => {
  it("produces stable keys for the same filter object", () => {
    const a = qk.incidents.list({ province: "Punjab" });
    const b = qk.incidents.list({ province: "Punjab" });
    expect(a).toEqual(b);
  });
  it("byIncident is order-independent", () => {
    expect(qk.kia.byIncident(["b", "a"])).toEqual(qk.kia.byIncident(["a", "b"]));
  });
});
