import { describe, expect, it } from "vitest";
import { isProfileComplete } from "./RouteGuards";

describe("isProfileComplete", () => {
  const completeProfile = {
    user_type: "comprador" as const,
    identity_document: "123456789LA123",
    province_id: "luanda",
    municipality_id: "viana",
  };

  it("accepts a profile with all required fields", () => {
    expect(isProfileComplete(completeProfile)).toBe(true);
  });

  it("rejects a missing profile", () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete(undefined)).toBe(false);
  });

  it.each(["user_type", "identity_document", "province_id", "municipality_id"] as const)(
    "rejects a profile without %s",
    (field) => {
      expect(isProfileComplete({ ...completeProfile, [field]: null })).toBe(false);
    },
  );
});
