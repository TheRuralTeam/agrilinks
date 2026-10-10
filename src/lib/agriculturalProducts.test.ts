import { describe, expect, it } from "vitest";
import { AGRICULTURAL_PRODUCT_GROUPS, AGRICULTURAL_PRODUCTS } from "./agriculturalProducts";

describe("catálogo pesquisável de produtos do campo", () => {
  it("inclui várias áreas da cadeia agroalimentar", () => {
    expect(AGRICULTURAL_PRODUCT_GROUPS.length).toBeGreaterThanOrEqual(10);
    expect(AGRICULTURAL_PRODUCTS.length).toBeGreaterThanOrEqual(200);
  });

  it("inclui produtos relevantes para a agricultura angolana", () => {
    const names = AGRICULTURAL_PRODUCTS.map((name) => name.toLocaleLowerCase("pt-AO"));
    for (const product of ["Mandioca", "Milho", "Feijão manteiga", "Massango", "Mexoeira", "Múcua", "Cacusso", "Dendém", "Batata rena"]) {
      expect(names).toContain(product.toLocaleLowerCase("pt-AO"));
    }
  });

  it("não contém opções vazias e permite pesquisa por texto", () => {
    expect(AGRICULTURAL_PRODUCTS.every((name) => name.trim().length > 0)).toBe(true);
    expect(AGRICULTURAL_PRODUCT_GROUPS.some((group) => group.products.some((name) => name.toLocaleLowerCase("pt-AO").includes("mandioca")))).toBe(true);
  });
});
