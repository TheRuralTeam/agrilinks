import { assertEquals } from "jsr:@std/assert@1";
import { validateSourcingPayload } from "./agent-task-validation.ts";

Deno.test("accepts a complete sourcing request", () => {
  assertEquals(validateSourcingPayload({
    product_name: "Milho",
    quantity: 250,
    unit: "kg",
    delivery_location: "Huambo, Angola",
  }), []);
});

Deno.test("reports every missing required field", () => {
  assertEquals(validateSourcingPayload({}), [
    "product_name",
    "quantity",
    "unit",
    "delivery_location",
  ]);
});

Deno.test("rejects blank strings and invalid quantities", () => {
  assertEquals(validateSourcingPayload({
    product_name: "  ",
    quantity: Number.POSITIVE_INFINITY,
    unit: "",
    delivery_location: null,
  }), [
    "product_name",
    "quantity",
    "unit",
    "delivery_location",
  ]);
});

Deno.test("rejects zero and negative quantities", () => {
  assertEquals(validateSourcingPayload({
    product_name: "Feijão",
    quantity: 0,
    unit: "kg",
    delivery_location: "Benguela",
  }), ["quantity"]);
});
