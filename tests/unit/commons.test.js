import { describe, it, expect } from "vitest";
import { formatCurrency } from "../../js/view/commons.js";

describe("commons", () => {
  describe("formatCurrency", () => {
    it("should format a positive number as EUR currency", () => {
      const result = formatCurrency(29.99);
      expect(result).toContain("29,99");
      expect(result).toContain("€");
    });

    it("should format zero", () => {
      const result = formatCurrency(0);
      expect(result).toContain("0,00");
      expect(result).toContain("€");
    });

    it("should format a large number correctly", () => {
      const result = formatCurrency(1234.56);
      // jsdom may or may not apply thousands grouping
      expect(result).toContain("1234,56");
      expect(result).toContain("€");
    });

    it("should return 0,00 EUR for NaN", () => {
      const result = formatCurrency(NaN);
      expect(result).toContain("0,00");
    });

    it("should return 0,00 EUR for Infinity", () => {
      const result = formatCurrency(Infinity);
      expect(result).toContain("0,00");
    });

    it("should return 0,00 EUR for undefined", () => {
      const result = formatCurrency(undefined);
      expect(result).toContain("0,00");
    });

    it("should return 0,00 EUR for null", () => {
      const result = formatCurrency(null);
      expect(result).toContain("0,00");
    });

    it("should return 0,00 EUR for a string", () => {
      const result = formatCurrency("not a number");
      expect(result).toContain("0,00");
    });

    it("should format negative numbers", () => {
      const result = formatCurrency(-15.5);
      expect(result).toContain("15,50");
    });
  });
});
