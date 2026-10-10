import { describe, expect, it } from "vitest";
import { AGRICULTURAL_PRODUCT_GROUPS, AGRICULTURAL_PRODUCTS } from "./agriculturalProducts";

describe("catálogo de produtos do campo adaptado a Angola", () => {
  it("organiza produtos locais em categorias úteis para o formulário", () => {
    expect(AGRICULTURAL_PRODUCT_GROUPS.length).toBeGreaterThanOrEqual(10);
    expect(AGRICULTURAL_PRODUCTS.length).toBeGreaterThanOrEqual(100);
  });

  it("inclui produtos agrícolas, frutas, temperos e produtos alimentares conhecidos em Angola", () => {
    const names = AGRICULTURAL_PRODUCTS.map((name) => name.toLocaleLowerCase("pt-AO"));
    for (const product of [
      "Mandioca", "Milho", "Feijão manteiga", "Massango", "Massambala",
      "Múcua (fruto do embondeiro)", "Cacusso", "Dendém", "Batata rena",
      "Alho", "Jindungo", "Piri-piri", "Tomate", "Banana", "Manga",
    ]) {
      expect(names).toContain(product.toLocaleLowerCase("pt-AO"));
    }
  });

  it("não tem opções vazias, nomes repetidos ou produtos exóticos fora do catálogo", () => {
    expect(AGRICULTURAL_PRODUCTS.every((name) => name.trim().length > 0)).toBe(true);
    expect(new Set(AGRICULTURAL_PRODUCTS).size).toBe(AGRICULTURAL_PRODUCTS.length);
    expect(AGRICULTURAL_PRODUCTS).not.toContain("Mirtilo");
    expect(AGRICULTURAL_PRODUCTS).not.toContain("Quinoa");
    expect(AGRICULTURAL_PRODUCTS).not.toContain("Salmão");
  });
});
