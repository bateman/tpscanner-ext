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
    it("should execute script, parse results, and add item to model", async () => {
      const htmlContent =
        '<div id="listing"><ul><li>' +
        '<div class="item_info"><div class="item_merchant">' +
        '<div class="merchant_name_and_logo"><a href="/seller"><span>TestShop</span></a></div>' +
        '<div class="wrap_merchant_reviews">' +
        '<a class="merchant_reviews" href="/reviews">100 recensioni</a>' +
        "</div></div></div>" +
        '<div class="item_price">' +
        '<span class="item_basic_price">29,99 &euro;</span>' +
        '<span class="item_delivery_price">4,99 &euro;</span>' +
        "</div>" +
        '<div class="item_actions"><a href="/buy"></a></div>' +
        "</li></ul></div>";

      globalThis.chrome.scripting.executeScript.mockResolvedValue([
        { result: htmlContent },
      ]);

      await controller.handleAddItem("Test Product", "https://example.com", 1, 123);

      expect(globalThis.chrome.scripting.executeScript).toHaveBeenCalledWith(
        expect.objectContaining({
          target: { tabId: 123 },
        })
      );
      expect(mockModel.addItem).toHaveBeenCalledWith(
        "Test Product",
        "https://example.com",
        1,
        expect.any(Array)
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
  });
});
