import { describe, expect, it } from "vitest";
import {
  ANGOLA_PROVINCE_COUNT,
  ANGOLA_PROVINCE_IDS,
  countryLocations,
} from "./country-locations";

describe("localizações administrativas de Angola", () => {
  const provinces = countryLocations.AO;
  const municipalities = provinces.flatMap((province) => province.municipalities);

  it("mantém as 21 províncias configuradas", () => {
    expect(provinces).toHaveLength(ANGOLA_PROVINCE_COUNT);
    expect(provinces.map((province) => province.id)).toEqual([...ANGOLA_PROVINCE_IDS]);
  });

  it("mantém 326 municípios sem identificadores duplicados", () => {
    expect(municipalities).toHaveLength(326);
    expect(new Set(municipalities.map((municipality) => municipality.id)).size).toBe(326);
  });

  it("não repete identificadores de províncias", () => {
    expect(new Set(provinces.map((province) => province.id)).size).toBe(provinces.length);
  });

  it("não repete identificadores de municípios dentro de uma província", () => {
    for (const province of provinces) {
      const ids = province.municipalities.map((municipality) => municipality.id);
      expect(new Set(ids).size, province.name).toBe(ids.length);
    }
  });
});
