import { describe, it, expect, beforeEach, vi } from "vitest";
import { Model } from "../../js/model/model.js";

// Mock chrome.storage.local
let store = {};
const storageMock = {
  get: vi.fn((keys) => {
    const result = {};
    for (const key of keys) {
      if (store[key] !== undefined) {
        result[key] = store[key];
      }
    }
    return Promise.resolve(result);
  }),
  set: vi.fn((items) => {
    Object.assign(store, items);
    return Promise.resolve();
  }),
};

globalThis.self = globalThis;
globalThis.chrome = {
  storage: { local: storageMock },
};
globalThis.browser = undefined;

describe("Model", () => {
  let model;

  beforeEach(() => {
    store = {};
    storageMock.get.mockClear();
    storageMock.set.mockClear();
    model = new Model();
  });

  // --- Observer Pattern ---

  describe("Observer Pattern", () => {
    it("should subscribe and notify callbacks", () => {
      const callback = vi.fn();
      model.subscribe(callback);
      model.notify("TEST_ACTION", { foo: "bar" });
      expect(callback).toHaveBeenCalledWith("TEST_ACTION", { foo: "bar" });
    });

    it("should notify multiple subscribers", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      model.subscribe(callback1);
      model.subscribe(callback2);
      model.notify("ACTION", {});
      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).toHaveBeenCalledOnce();
    });
  });

  // --- Factory Method ---

  describe("Model.create", () => {
    it("should create model and load persisted state", async () => {
      store = {
        selectedItems: { "Saved Product": { url: "https://x.com", quantity: 2, deals: [] } },
        bestIndividualDeals: {},
        bestCumulativeDeals: {},
        bestOverallDeal: {},
      };

      const m = await Model.create();
      expect(m.getSelectedItems()).toHaveProperty("Saved Product");
      expect(storageMock.get).toHaveBeenCalled();
    });
  });

  // --- State Management ---

  describe("State Management", () => {
    it("should initialize with empty state", () => {
      expect(model.getSelectedItems()).toEqual({});
      expect(model.getBestIndividualDeals()).toEqual({});
      expect(model.getBestCumulativeDeals()).toEqual({});
      expect(model.getBestOverallDeal()).toEqual({});
    });

    it("should add an item and notify", () => {
      const callback = vi.fn();
      model.subscribe(callback);

      const deals = [
        {
          seller: "Amazon",
          price: 10,
          delivery_price: 5,
          free_delivery: null,
          availability: true,
        },
      ];
      model.addItem("Test Product", "https://example.com", 1, deals);

      expect(model.getSelectedItems()).toHaveProperty("Test Product");
      expect(model.getSelectedItems()["Test Product"].quantity).toBe(1);
      expect(model.getSelectedItems()["Test Product"].deals).toEqual(deals);
      expect(callback).toHaveBeenCalledWith(
        "ITEM_ADDED",
        expect.objectContaining({
          title: "Test Product",
          dealsCount: 1,
        })
      );
    });

    it("should remove an item and notify", () => {
      const deals = [{ seller: "Amazon", price: 10 }];
      model.addItem("Product A", "https://a.com", 1, deals);

      const callback = vi.fn();
      model.subscribe(callback);
      model.removeItem("Product A");

      expect(model.getSelectedItems()).not.toHaveProperty("Product A");
      expect(callback).toHaveBeenCalledWith(
        "ITEM_REMOVED",
        expect.objectContaining({ title: "Product A" })
      );
    });

    it("should update item quantity", () => {
      const deals = [{ seller: "Amazon", price: 10 }];
      model.addItem("Product A", "https://a.com", 1, deals);
      model.updateItemQuantity("Product A", 3);

      expect(model.getSelectedItems()["Product A"].quantity).toBe(3);
    });

    it("should clear basket and notify", () => {
      const deals = [{ seller: "Amazon", price: 10 }];
      model.addItem("Product A", "https://a.com", 1, deals);

      const callback = vi.fn();
      model.subscribe(callback);
      model.clearBasket();

      expect(model.getSelectedItems()).toEqual({});
      expect(model.getBestIndividualDeals()).toEqual({});
      expect(callback).toHaveBeenCalledWith("BASKET_CLEARED", {});
    });

    it("should overwrite existing item when adding duplicate name", () => {
      const deals1 = [{ seller: "Shop A", price: 10 }];
      const deals2 = [{ seller: "Shop B", price: 20 }];
      model.addItem("Product A", "https://a.com", 1, deals1);
      model.addItem("Product A", "https://b.com", 2, deals2);

      const items = model.getSelectedItems();
      expect(Object.keys(items)).toHaveLength(1);
      expect(items["Product A"].url).toBe("https://b.com");
      expect(items["Product A"].quantity).toBe(2);
      expect(items["Product A"].deals).toEqual(deals2);
    });

    it("should handle removeItem on non-existent item without error", () => {
      model.addItem("Product A", "https://a.com", 1, []);
      const callback = vi.fn();
      model.subscribe(callback);

      model.removeItem("Non Existent");

      expect(model.getSelectedItems()).toHaveProperty("Product A");
      expect(callback).toHaveBeenCalledWith(
        "ITEM_REMOVED",
        expect.objectContaining({ title: "Non Existent" })
      );
    });

    it("should handle updateItemQuantity on non-existent item (no-op)", () => {
      model.addItem("Product A", "https://a.com", 1, []);
      storageMock.set.mockClear();

      model.updateItemQuantity("Non Existent", 5);

      expect(model.getSelectedItems()["Product A"].quantity).toBe(1);
      expect(storageMock.set).not.toHaveBeenCalled();
    });

    it("should clear computed deals when basket changes", () => {
      model.bestIndividualDeals = { someKey: [] };
      model.bestCumulativeDeals = [{ someSeller: {} }];
      model.bestOverallDeal = { best_deal_type: "individual" };

      model.addItem("New Product", "https://new.com", 1, []);
      expect(model.getBestIndividualDeals()).toEqual({});
      expect(model.getBestCumulativeDeals()).toEqual({});
      expect(model.getBestOverallDeal()).toEqual({});
    });

    it("should persist state to chrome.storage.local", () => {
      const deals = [{ seller: "Amazon", price: 10 }];
      model.addItem("Product A", "https://a.com", 1, deals);

      expect(storageMock.set).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedItems: expect.any(Object),
        })
      );
    });

    it("should load state from chrome.storage.local", async () => {
      store = {
        selectedItems: { "Loaded Product": { url: "https://l.com", quantity: 1, deals: [] } },
        bestOverallDeal: { best_deal_type: "individual", best_total_price: 42 },
      };

      await model.loadState();

      expect(model.getSelectedItems()).toHaveProperty("Loaded Product");
      expect(model.getBestOverallDeal().best_total_price).toBe(42);
    });
  });

  // --- removeUnavailableItems ---

  describe("removeUnavailableItems", () => {
    it("should remove unavailable items", () => {
      const deals = [
        { seller: "Shop A", availability: false },
        { seller: "Shop B", availability: true },
      ];
      const [count, result] = Model.removeUnavailableItems(deals);
      expect(count).toBe(1);
      expect(result).toHaveLength(1);
      expect(result[0].seller).toBe("Shop B");
    });

    it("should keep Amazon even if unavailable", () => {
      const deals = [
        { seller: "Amazon", availability: false },
        { seller: "Shop B", availability: false },
      ];
      const [count, result] = Model.removeUnavailableItems(deals);
      expect(count).toBe(1);
      expect(result).toHaveLength(1);
      expect(result[0].seller).toBe("Amazon");
    });

    it("should keep all available items", () => {
      const deals = [
        { seller: "Shop A", availability: true },
        { seller: "Shop B", availability: true },
      ];
      const [count, result] = Model.removeUnavailableItems(deals);
      expect(count).toBe(0);
      expect(result).toHaveLength(2);
    });

    it("should handle empty deals array", () => {
      const deals = [];
      const [count, result] = Model.removeUnavailableItems(deals);
      expect(count).toBe(0);
      expect(result).toHaveLength(0);
    });

    it("should handle non-object items gracefully", () => {
      const deals = [null, undefined, { seller: "Shop A", availability: true }];
      const [count, result] = Model.removeUnavailableItems(deals);
      expect(count).toBe(0);
      expect(result).toHaveLength(3);
    });

    it("should keep Amazon case-insensitive variants even if unavailable", () => {
      const deals = [
        { seller: "amazon.it", availability: false },
        { seller: "Amazon.it", availability: false },
        { seller: "AMAZON", availability: false },
        { seller: "Shop A", availability: false },
      ];
      const [count, result] = Model.removeUnavailableItems(deals);
      expect(count).toBe(1);
      expect(result).toHaveLength(3);
      expect(result.map((d) => d.seller)).toEqual(["amazon.it", "Amazon.it", "AMAZON"]);
    });
  });

  // --- findBestIndividualDeals ---

  describe("findBestIndividualDeals", () => {
    it("should find deals meeting free delivery threshold", () => {
      const deals = [
        {
          seller: "Shop A",
          price: 50,
          delivery_price: 5,
          free_delivery: 40,
          availability: true,
        },
        {
          seller: "Shop B",
          price: 30,
          delivery_price: 5,
          free_delivery: 40,
          availability: true,
        },
      ];
      const result = Model.findBestIndividualDeals("Product", deals, 1);
      expect(result).toHaveLength(1);
      expect(result[0].seller).toBe("Shop A");
      expect(result[0].total_price).toBe(50);
      expect(result[0].total_price_plus_delivery).toBe(50); // free delivery
    });

    it("should sort by total price plus delivery ascending", () => {
      const deals = [
        {
          seller: "Expensive",
          price: 60,
          delivery_price: 5,
          free_delivery: 50,
          availability: true,
        },
        {
          seller: "Cheap",
          price: 50,
          delivery_price: 5,
          free_delivery: 40,
          availability: true,
        },
      ];
      const result = Model.findBestIndividualDeals("Product", deals, 1);
      expect(result[0].seller).toBe("Cheap");
    });

    it("should apply quantity to total price", () => {
      const deals = [
        {
          seller: "Shop A",
          price: 20,
          delivery_price: 5,
          free_delivery: 30,
          availability: true,
        },
      ];
      const result = Model.findBestIndividualDeals("Product", deals, 2);
      expect(result).toHaveLength(1);
      expect(result[0].total_price).toBe(40);
      expect(result[0].quantity).toBe(2);
    });

    it("should return empty array when no deals meet threshold", () => {
      const deals = [
        {
          seller: "Shop A",
          price: 10,
          delivery_price: 5,
          free_delivery: 50,
          availability: true,
        },
      ];
      const result = Model.findBestIndividualDeals("Product", deals, 1);
      expect(result).toHaveLength(0);
    });

    it("should exclude deals with null free_delivery", () => {
      const deals = [
        {
          seller: "Shop A",
          price: 50,
          delivery_price: 5,
          free_delivery: null,
          availability: true,
        },
        {
          seller: "Shop B",
          price: 30,
          delivery_price: 3,
          free_delivery: 25,
          availability: true,
        },
      ];
      const result = Model.findBestIndividualDeals("Product", deals, 1);
      expect(result).toHaveLength(1);
      expect(result[0].seller).toBe("Shop B");
    });

    it("should return empty array for empty deals", () => {
      const result = Model.findBestIndividualDeals("Product", [], 1);
      expect(result).toHaveLength(0);
    });
  });

  // --- findBestCumulativeDeals ---

  describe("findBestCumulativeDeals", () => {
    it("should find common sellers across items", () => {
      const selectedItems = {
        "Product A": {
          quantity: 1,
          deals: [
            {
              seller: "CommonShop",
              seller_link: "/s1",
              seller_reviews: 10,
              seller_reviews_link: "/r1",
              seller_rating: 4.5,
              price: 20,
              delivery_price: 5,
              free_delivery: null,
              availability: true,
            },
            {
              seller: "OnlyA",
              seller_link: "/s2",
              seller_reviews: 5,
              seller_reviews_link: "/r2",
              seller_rating: 3.0,
              price: 15,
              delivery_price: 3,
              free_delivery: null,
              availability: true,
            },
          ],
        },
        "Product B": {
          quantity: 1,
          deals: [
            {
              seller: "CommonShop",
              seller_link: "/s1",
              seller_reviews: 10,
              seller_reviews_link: "/r1",
              seller_rating: 4.5,
              price: 30,
              delivery_price: 5,
              free_delivery: null,
              availability: true,
            },
          ],
        },
      };

      const result = Model.findBestCumulativeDeals(selectedItems);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("CommonShop");
      expect(result[0]["CommonShop"].cumulativePrice).toBe(50);
    });

    it("should return empty array when no common sellers", () => {
      const selectedItems = {
        "Product A": {
          quantity: 1,
          deals: [
            {
              seller: "ShopA",
              seller_link: "/a",
              seller_reviews: 5,
              seller_reviews_link: "/ra",
              seller_rating: 3.0,
              price: 10,
              delivery_price: 5,
              free_delivery: null,
              availability: true,
            },
          ],
        },
        "Product B": {
          quantity: 1,
          deals: [
            {
              seller: "ShopB",
              seller_link: "/b",
              seller_reviews: 5,
              seller_reviews_link: "/rb",
              seller_rating: 3.0,
              price: 20,
              delivery_price: 5,
              free_delivery: null,
              availability: true,
            },
          ],
        },
      };

      const result = Model.findBestCumulativeDeals(selectedItems);
      expect(result).toHaveLength(0);
    });

    it("should multiply price by quantity for cumulative deals", () => {
      const selectedItems = {
        "Product A": {
          quantity: 3,
          deals: [
            {
              seller: "CommonShop",
              seller_link: "/s1",
              seller_reviews: 10,
              seller_reviews_link: "/r1",
              seller_rating: 4.5,
              price: 20,
              delivery_price: 5,
              free_delivery: null,
              availability: true,
            },
          ],
        },
        "Product B": {
          quantity: 2,
          deals: [
            {
              seller: "CommonShop",
              seller_link: "/s1",
              seller_reviews: 10,
              seller_reviews_link: "/r1",
              seller_rating: 4.5,
              price: 10,
              delivery_price: 5,
              free_delivery: null,
              availability: true,
            },
          ],
        },
      };

      const result = Model.findBestCumulativeDeals(selectedItems);
      expect(result).toHaveLength(1);
      // 20*3 + 10*2 = 80
      expect(result[0]["CommonShop"].cumulativePrice).toBe(80);
    });

    it("should apply free delivery threshold to cumulative price", () => {
      const selectedItems = {
        "Product A": {
          quantity: 1,
          deals: [
            {
              seller: "CommonShop",
              seller_link: "/s1",
              seller_reviews: 10,
              seller_reviews_link: "/r1",
              seller_rating: 4.5,
              price: 30,
              delivery_price: 5,
              free_delivery: 50,
              availability: true,
            },
          ],
        },
        "Product B": {
          quantity: 1,
          deals: [
            {
              seller: "CommonShop",
              seller_link: "/s1",
              seller_reviews: 10,
              seller_reviews_link: "/r1",
              seller_rating: 4.5,
              price: 25,
              delivery_price: 5,
              free_delivery: 50,
              availability: true,
            },
          ],
        },
      };

      const result = Model.findBestCumulativeDeals(selectedItems);
      expect(result).toHaveLength(1);
      // cumulative 30+25=55 >= freeDelivery 50, so no delivery charge
      expect(result[0]["CommonShop"].cumulativePrice).toBe(55);
      expect(result[0]["CommonShop"].cumulativePricePlusDelivery).toBe(55);
    });

    it("should add delivery when below free delivery threshold", () => {
      const selectedItems = {
        "Product A": {
          quantity: 1,
          deals: [
            {
              seller: "CommonShop",
              seller_link: "/s1",
              seller_reviews: 10,
              seller_reviews_link: "/r1",
              seller_rating: 4.5,
              price: 10,
              delivery_price: 5,
              free_delivery: 50,
              availability: true,
            },
          ],
        },
        "Product B": {
          quantity: 1,
          deals: [
            {
              seller: "CommonShop",
              seller_link: "/s1",
              seller_reviews: 10,
              seller_reviews_link: "/r1",
              seller_rating: 4.5,
              price: 10,
              delivery_price: 5,
              free_delivery: 50,
              availability: true,
            },
          ],
        },
      };

      const result = Model.findBestCumulativeDeals(selectedItems);
      expect(result).toHaveLength(1);
      // cumulative 10+10=20 < freeDelivery 50, so delivery is added
      expect(result[0]["CommonShop"].cumulativePrice).toBe(20);
      expect(result[0]["CommonShop"].cumulativePricePlusDelivery).toBe(25);
    });

    it("should sort cumulative deals by price ascending", () => {
      const selectedItems = {
        "Product A": {
          quantity: 1,
          deals: [
            {
              seller: "Expensive",
              seller_link: "/e",
              seller_reviews: 5,
              seller_reviews_link: "/re",
              seller_rating: 3.0,
              price: 100,
              delivery_price: 10,
              free_delivery: null,
              availability: true,
            },
            {
              seller: "Cheap",
              seller_link: "/c",
              seller_reviews: 5,
              seller_reviews_link: "/rc",
              seller_rating: 3.0,
              price: 10,
              delivery_price: 2,
              free_delivery: null,
              availability: true,
            },
          ],
        },
        "Product B": {
          quantity: 1,
          deals: [
            {
              seller: "Expensive",
              seller_link: "/e",
              seller_reviews: 5,
              seller_reviews_link: "/re",
              seller_rating: 3.0,
              price: 100,
              delivery_price: 10,
              free_delivery: null,
              availability: true,
            },
            {
              seller: "Cheap",
              seller_link: "/c",
              seller_reviews: 5,
              seller_reviews_link: "/rc",
              seller_rating: 3.0,
              price: 10,
              delivery_price: 2,
              free_delivery: null,
              availability: true,
            },
          ],
        },
      };

      const result = Model.findBestCumulativeDeals(selectedItems);
      expect(result).toHaveLength(2);
      expect(Object.keys(result[0])[0]).toBe("Cheap");
    });
  });

  // --- findBestOverallDeal ---

  describe("findBestOverallDeal", () => {
    it("should choose individual when it is cheaper", () => {
      const bestIndividual = {
        "Product A": [{ total_price_plus_delivery: 25 }],
        "Product B": [{ total_price_plus_delivery: 30 }],
      };
      const bestCumulative = [
        {
          CommonSeller: { cumulativePricePlusDelivery: 60 },
        },
      ];

      const result = Model.findBestOverallDeal(bestIndividual, bestCumulative);
      expect(result.best_deal_type).toBe("individual");
      expect(result.best_total_price).toBe(55);
    });

    it("should choose cumulative when individual cost is 0 (no deals found)", () => {
      const bestIndividual = {};
      const bestCumulative = [
        { CommonSeller: { cumulativePricePlusDelivery: 50 } },
      ];

      const result = Model.findBestOverallDeal(bestIndividual, bestCumulative);
      expect(result.best_deal_type).toBe("cumulative");
    });

    it("should handle empty cumulative deals", () => {
      const bestIndividual = {
        "Product A": [{ total_price_plus_delivery: 25 }],
      };
      const bestCumulative = {};

      const result = Model.findBestOverallDeal(bestIndividual, bestCumulative);
      expect(result.best_deal_type).toBe("individual");
      expect(result.best_total_price).toBe(25);
    });

    it("should handle null inputs", () => {
      const result = Model.findBestOverallDeal(null, null);
      expect(result.best_deal_type).toBe("cumulative");
      expect(result.best_total_price).toBe(0);
    });

    it("should handle items with no valid deals", () => {
      const bestIndividual = {
        "Product A": [],
        "Product B": [{ total_price_plus_delivery: 30 }],
      };
      const bestCumulative = [
        { CommonSeller: { cumulativePricePlusDelivery: 25 } },
      ];

      const result = Model.findBestOverallDeal(bestIndividual, bestCumulative);
      expect(result.best_deal_type).toBe("cumulative");
      expect(result.best_total_price).toBe(25);
    });

    it("should prefer individual even when cumulative is cheaper if all items available", () => {
      // When all individual items have deals, chooseCumulative requires
      // notAllItemsAvailable to be true. Even if cumulative is cheaper,
      // individual is chosen when all items have valid individual deals.
      const bestIndividual = {
        "Product A": [{ total_price_plus_delivery: 40 }],
        "Product B": [{ total_price_plus_delivery: 35 }],
      };
      const bestCumulative = [
        { CommonSeller: { cumulativePricePlusDelivery: 50 } },
      ];

      const result = Model.findBestOverallDeal(bestIndividual, bestCumulative);
      expect(result.best_deal_type).toBe("individual");
      expect(result.best_total_price).toBe(75);
    });

    it("should choose cumulative when not all items have individual deals and cumulative is cheaper", () => {
      const bestIndividual = {
        "Product A": [{ total_price_plus_delivery: 40 }],
        "Product B": [], // no individual deals for this item
      };
      const bestCumulative = [
        { CommonSeller: { cumulativePricePlusDelivery: 35 } },
      ];

      const result = Model.findBestOverallDeal(bestIndividual, bestCumulative);
      expect(result.best_deal_type).toBe("cumulative");
      expect(result.best_total_price).toBe(35);
    });
  });

  // --- computeDeals integration ---

  describe("computeDeals", () => {
    it("should compute deals and notify", () => {
      const deals = [
        {
          seller: "Shop A",
          price: 50,
          delivery_price: 5,
          free_delivery: 40,
          availability: true,
          seller_link: "/s",
          seller_reviews: 10,
          seller_reviews_link: "/r",
          seller_rating: 4.0,
        },
      ];
      model.addItem("Product A", "https://a.com", 1, deals);

      const callback = vi.fn();
      model.subscribe(callback);
      model.computeDeals();

      expect(callback).toHaveBeenCalledWith(
        "DEALS_COMPUTED",
        expect.objectContaining({
          bestIndividualDeals: expect.any(Object),
          bestOverallDeal: expect.any(Object),
        })
      );
      expect(model.getBestOverallDeal()).toHaveProperty("best_deal_type");
    });

    it("should do nothing with empty basket", () => {
      const callback = vi.fn();
      model.subscribe(callback);
      model.computeDeals();
      expect(callback).not.toHaveBeenCalled();
    });

    it("should compute cumulative deals for multiple items", () => {
      const commonDeal = {
        seller: "CommonShop",
        price: 25,
        delivery_price: 5,
        free_delivery: 40,
        availability: true,
        seller_link: "/cs",
        seller_reviews: 50,
        seller_reviews_link: "/csr",
        seller_rating: 4.0,
      };
      model.addItem("Product A", "https://a.com", 1, [{ ...commonDeal, price: 25 }]);
      model.addItem("Product B", "https://b.com", 1, [{ ...commonDeal, price: 30 }]);

      const callback = vi.fn();
      model.subscribe(callback);
      model.computeDeals();

      expect(callback).toHaveBeenCalledWith(
        "DEALS_COMPUTED",
        expect.objectContaining({
          bestCumulativeDeals: expect.any(Array),
        })
      );
      const data = callback.mock.calls[0][1];
      expect(data.bestCumulativeDeals.length).toBeGreaterThan(0);
      expect(data.bestCumulativeDeals[0]).toHaveProperty("CommonShop");
    });

    it("should persist computed deals to storage", () => {
      const deals = [
        {
          seller: "Shop A",
          price: 50,
          delivery_price: 5,
          free_delivery: 40,
          availability: true,
          seller_link: "/s",
          seller_reviews: 10,
          seller_reviews_link: "/r",
          seller_rating: 4.0,
        },
      ];
      model.addItem("Product A", "https://a.com", 1, deals);
      storageMock.set.mockClear();

      model.computeDeals();

      expect(storageMock.set).toHaveBeenCalledWith(
        expect.objectContaining({
          bestIndividualDeals: expect.any(Object),
          bestOverallDeal: expect.any(Object),
        })
      );
    });
  });
});
