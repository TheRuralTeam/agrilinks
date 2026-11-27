import { describe, expect, it } from "vitest";
import { AGRICULTURAL_PRODUCT_GROUPS, AGRICULTURAL_PRODUCTS } from "./agriculturalProducts";

describe("catálogo de produtos agrícolas angolanos", () => {
  it("organiza produtos agrícolas vegetais em categorias úteis", () => {
    expect(AGRICULTURAL_PRODUCT_GROUPS.length).toBeGreaterThanOrEqual(8);
    expect(AGRICULTURAL_PRODUCTS.length).toBeGreaterThanOrEqual(100);
  });

  it("inclui culturas, frutas, hortícolas e temperos relevantes em Angola", () => {
    const names = AGRICULTURAL_PRODUCTS.map((name) => name.toLocaleLowerCase("pt-AO"));
    for (const product of [
      "Mandioca", "Milho", "Feijão manteiga", "Massango", "Massambala",
      "Múcua", "Dendém", "Batata rena", "Alho", "Jindungo",
      "Piri-piri", "Tomate", "Banana", "Manga", "Cebola",
    ]) {
      expect(names).toContain(product.toLocaleLowerCase("pt-AO"));
    }
  });

  it("exclui carnes, pescado, marisco e apicultura do catálogo vegetal", () => {
    const names = AGRICULTURAL_PRODUCTS.map((name) => name.toLocaleLowerCase("pt-AO"));
    for (const forbidden of [
      "Frango", "Frangos vivos", "Carne bovina",
      "Cacusso", "Carapau", "Camarão", "Tilápia", "Mel", "Cera de abelha",
    ]) {
      expect(names).not.toContain(forbidden.toLocaleLowerCase("pt-AO"));
    }
    expect(AGRICULTURAL_PRODUCT_GROUPS.some((group) => /pecuária|pescado|aquicultura|carnes/i.test(group.label))).toBe(false);
  });

  it("não contém opções vazias ou nomes repetidos", () => {
    expect(AGRICULTURAL_PRODUCTS.every((name) => name.trim().length > 0)).toBe(true);
    expect(new Set(AGRICULTURAL_PRODUCTS).size).toBe(AGRICULTURAL_PRODUCTS.length);
  });
});
