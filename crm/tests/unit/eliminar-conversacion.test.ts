import { describe, expect, it } from "vitest";
import { canConfigure } from "@/lib/auth/roles";

describe("canConfigure", () => {
  it("permite a owner y admin", () => {
    expect(canConfigure("owner")).toBe(true);
    expect(canConfigure("admin")).toBe(true);
  });

  it("rechaza a member, viewer o roles vacíos", () => {
    expect(canConfigure("member")).toBe(false);
    expect(canConfigure("viewer")).toBe(false);
    expect(canConfigure(null)).toBe(false);
    expect(canConfigure(undefined)).toBe(false);
    expect(canConfigure("")).toBe(false);
  });
});
