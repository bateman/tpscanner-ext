import { describe, it, expect, beforeEach, vi } from "vitest";
import { Controller } from "../../js/controller/controller.js";

// Mock browser API
globalThis.self = globalThis;
globalThis.chrome = {
  scripting: {
    executeScript: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
};
globalThis.browser = undefined;

describe("Controller", () => {
  let controller;
  let mockModel;
  let mockView;

  beforeEach(() => {
    mockModel = {
      subscribe: vi.fn(),
      addItem: vi.fn(),
      removeItem: vi.fn(),
      updateItemQuantity: vi.fn(),
      clearBasket: vi.fn(),
      computeDeals: vi.fn(),
      loadState: vi.fn().mockResolvedValue(undefined),
      getSelectedItems: vi.fn().mockReturnValue({}),
      getBestIndividualDeals: vi.fn().mockReturnValue({}),
      getBestCumulativeDeals: vi.fn().mockReturnValue({}),
      getBestOverallDeal: vi.fn().mockReturnValue({}),
    };

    mockView = {
      update: vi.fn(),
    };

    controller = new Controller(mockModel, mockView);
  });

  describe("constructor", () => {
    it("should subscribe to model changes", () => {
      expect(mockModel.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("onModelChanged", () => {
    it("should update the view when model changes", () => {
      // Get the callback that was passed to subscribe
      const callback = mockModel.subscribe.mock.calls[0][0];
      callback("TEST_ACTION", { foo: "bar" });
      expect(mockView.update).toHaveBeenCalledWith("TEST_ACTION", {
        foo: "bar",
      });
    });
  });

  describe("handleAddItem", () => {
    it("should execute script, convert raw data, and add item to model", async () => {
      const rawItems = [
        {
          merchant: "TestShop",
          merchantLink: "/seller",
          merchantReviews: "100 recensioni",
          merchantReviewsLink: "/reviews",
          merchantRating: null,
          price: "29,99 \u20AC",
          deliveryPrice: "4,99 \u20AC",
          freeDelivery: null,
          availability: "available",
          offerLink: "/buy",
        },
      ];

      globalThis.chrome.scripting.executeScript.mockResolvedValue([
        { result: rawItems },
      ]);

      await controller.handleAddItem("Test Product", "https://example.com", 1, 123);

      expect(globalThis.chrome.scripting.executeScript).toHaveBeenCalledWith(
        expect.objectContaining({
          target: { tabId: 123 },
          func: expect.any(Function),
        })
      );
      expect(mockModel.addItem).toHaveBeenCalledWith(
        "Test Product",
        "https://example.com",
        1,
        expect.arrayContaining([
          expect.objectContaining({
            seller: "TestShop",
            price: 29.99,
            delivery_price: 4.99,
          }),
        ])
      );
    });

    it("should update view with error on failure", async () => {
      globalThis.chrome.scripting.executeScript.mockRejectedValue(
        new Error("Tab not found")
      );

      await controller.handleAddItem("Product", "https://example.com", 1, 999);

      expect(mockModel.addItem).not.toHaveBeenCalled();
      expect(mockView.update).toHaveBeenCalledWith("ERROR", {
        error: "Tab not found",
      });
    });

    it("should add item with empty deals when scraping finds no listings", async () => {
      globalThis.chrome.scripting.executeScript.mockResolvedValue([
        { result: [] },
      ]);

      await controller.handleAddItem("Empty Product", "https://example.com", 1, 123);

      expect(mockModel.addItem).toHaveBeenCalledWith(
        "Empty Product",
        "https://example.com",
        1,
        []
      );
    });
  });

  describe("handleRemoveItem", () => {
    it("should delegate to model.removeItem", () => {
      controller.handleRemoveItem("Product A");
      expect(mockModel.removeItem).toHaveBeenCalledWith("Product A");
    });
  });

  describe("handleUpdateQuantity", () => {
    it("should delegate to model.updateItemQuantity", () => {
      controller.handleUpdateQuantity("Product A", 3);
      expect(mockModel.updateItemQuantity).toHaveBeenCalledWith(
        "Product A",
        3
      );
    });
  });

  describe("handleClearBasket", () => {
    it("should delegate to model.clearBasket", () => {
      controller.handleClearBasket();
      expect(mockModel.clearBasket).toHaveBeenCalled();
    });
  });

  describe("handleComputeDeals", () => {
    it("should delegate to model.computeDeals", () => {
      controller.handleComputeDeals();
      expect(mockModel.computeDeals).toHaveBeenCalled();
    });
  });

  describe("handleLoadBasket", () => {
    it("should await loadState and update view with current data", async () => {
      mockModel.getSelectedItems.mockReturnValue({ "Product A": {} });
      mockModel.getBestIndividualDeals.mockReturnValue({ "Product A": [] });
      mockModel.getBestCumulativeDeals.mockReturnValue([]);
      mockModel.getBestOverallDeal.mockReturnValue({
        best_deal_type: "individual",
      });

      await controller.handleLoadBasket();

      expect(mockModel.loadState).toHaveBeenCalled();
      expect(mockView.update).toHaveBeenCalledWith("BASKET_LOADED", {
        selectedItems: { "Product A": {} },
        bestIndividualDeals: { "Product A": [] },
        bestCumulativeDeals: [],
        bestOverallDeal: { best_deal_type: "individual" },
      });
    });

    it("should propagate error when loadState rejects", async () => {
      mockModel.loadState.mockRejectedValue(new Error("Storage error"));

      await expect(controller.handleLoadBasket()).rejects.toThrow(
        "Storage error"
      );
      expect(mockView.update).not.toHaveBeenCalled();
    });
  });
});
