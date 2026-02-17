function getBrowser() {
  return self.browser || self.chrome;
}

export class Model {
  constructor() {
    this.subscribers = [];
    this.selectedItems = {};
    this.bestIndividualDeals = {};
    this.bestCumulativeDeals = {};
    this.bestOverallDeal = {};
  }

  static async create() {
    const model = new Model();
    await model.loadState();
    return model;
  }

  // --- Observer Pattern ---

  subscribe(callback) {
    this.subscribers.push(callback);
  }

  notify(action, data) {
    for (const callback of this.subscribers) {
      callback(action, data);
    }
  }

  // --- State Persistence ---

  async loadState() {
    const data = await getBrowser().storage.local.get([
      "selectedItems",
      "bestIndividualDeals",
      "bestCumulativeDeals",
      "bestOverallDeal",
    ]);
    this.selectedItems = data.selectedItems || {};
    this.bestIndividualDeals = data.bestIndividualDeals || {};
    this.bestCumulativeDeals = data.bestCumulativeDeals || {};
    this.bestOverallDeal = data.bestOverallDeal || {};
  }

  saveState() {
    getBrowser().storage.local.set({
      selectedItems: this.selectedItems,
      bestIndividualDeals: this.bestIndividualDeals,
      bestCumulativeDeals: this.bestCumulativeDeals,
      bestOverallDeal: this.bestOverallDeal,
    });
  }

  // --- State Methods ---

  getSelectedItems() {
    return this.selectedItems;
  }

  getBestIndividualDeals() {
    return this.bestIndividualDeals;
  }

  getBestCumulativeDeals() {
    return this.bestCumulativeDeals;
  }

  getBestOverallDeal() {
    return this.bestOverallDeal;
  }

  addItem(title, url, quantity, deals) {
    const itemData = {
      url: url,
      quantity: quantity,
      deals: deals,
    };
    Object.defineProperty(this.selectedItems, title, {
      value: itemData,
      enumerable: true,
      writable: true,
      configurable: true,
    });

    // Clear computed deals when basket changes
    this.bestIndividualDeals = {};
    this.bestCumulativeDeals = {};
    this.bestOverallDeal = {};
    this.saveState();

    this.notify("ITEM_ADDED", {
      title,
      url,
      quantity,
      dealsCount: deals.length,
      selectedItems: this.selectedItems,
    });
  }

  removeItem(title) {
    this.selectedItems = Object.fromEntries(
      Object.entries(this.selectedItems).filter(([key]) => key !== title)
    );

    // Clear computed deals when basket changes
    this.bestIndividualDeals = {};
    this.bestCumulativeDeals = {};
    this.bestOverallDeal = {};
    this.saveState();

    this.notify("ITEM_REMOVED", {
      title,
      selectedItems: this.selectedItems,
    });
  }

  updateItemQuantity(title, quantity) {
    for (const [key, item] of Object.entries(this.selectedItems)) {
      if (key === title) {
        item.quantity = quantity;
        this.saveState();
        return;
      }
    }
  }

  clearBasket() {
    this.selectedItems = {};
    this.bestIndividualDeals = {};
    this.bestCumulativeDeals = {};
    this.bestOverallDeal = {};
    this.saveState();

    this.notify("BASKET_CLEARED", {});
  }

  computeDeals() {
    const entries = Object.entries(this.selectedItems);
    if (entries.length === 0) return;

    const dealsMap = new Map();

    for (const [itemName, itemData] of entries) {
      const [, deals] = Model.removeUnavailableItems(itemData.deals);
      itemData.deals = deals;

      const bestDeals = Model.findBestIndividualDeals(
        itemName,
        itemData.deals,
        itemData.quantity
      );
      dealsMap.set(itemName, bestDeals);
    }

    const bestIndividualDeals = Object.fromEntries(dealsMap);

    let bestCumulativeDeals = {};
    if (entries.length > 1) {
      bestCumulativeDeals = Model.findBestCumulativeDeals(
        this.selectedItems
      );
    }

    const bestOverallDeal = Model.findBestOverallDeal(
      bestIndividualDeals,
      bestCumulativeDeals
    );

    this.bestIndividualDeals = bestIndividualDeals;
    this.bestCumulativeDeals = bestCumulativeDeals;
    this.bestOverallDeal = bestOverallDeal;
    this.saveState();

    this.notify("DEALS_COMPUTED", {
      bestIndividualDeals: this.bestIndividualDeals,
      bestCumulativeDeals: this.bestCumulativeDeals,
      bestOverallDeal: this.bestOverallDeal,
    });
  }

  // --- Deal-Finding Algorithms (static for testability) ---

  static removeUnavailableItems(deals) {
    let count = 0;
    const newDeals = [];

    for (const currentDeal of deals) {
      if (currentDeal && typeof currentDeal === "object") {
        if (
          currentDeal.availability === false &&
          currentDeal.seller &&
          !currentDeal.seller.toLowerCase().includes("amazon")
        ) {
          count++;
        } else {
          newDeals.push(currentDeal);
        }
      } else {
        newDeals.push(currentDeal);
      }
    }

    return [count, newDeals];
  }

  static findBestIndividualDeals(itemName, itemDeals, itemQuantity) {
    const bestIndividualDeals = itemDeals.map((deal) => {
      const total_price = deal.price * itemQuantity;
      const total_price_plus_delivery =
        deal.free_delivery && total_price >= deal.free_delivery
          ? total_price
          : total_price + deal.delivery_price;
      return {
        ...deal,
        name: itemName,
        total_price,
        total_price_plus_delivery,
        quantity: itemQuantity,
      };
    });
    bestIndividualDeals.sort(
      (a, b) => a.total_price_plus_delivery - b.total_price_plus_delivery
    );
    return bestIndividualDeals;
  }

  static findBestCumulativeDeals(individualDeals) {
    const itemsDict = Model.createItemSellersDictionary(individualDeals);
    const commonSellers = Model.findCommonSellers(itemsDict);
    let bestCumulativeDeals = Model.calculateDealsForCommonSellers(
      individualDeals,
      commonSellers
    );
    bestCumulativeDeals = Model.addDeliveryPrices(bestCumulativeDeals);
    return Model.sortAndFormatDeals(bestCumulativeDeals);
  }

  static createItemSellersDictionary(individualDeals) {
    const itemsDict = new Map();
    for (const [itemName, itemData] of Object.entries(individualDeals)) {
      const itemSellers = itemData.deals.map((deal) => deal.seller);
      itemsDict.set(itemName, itemSellers);
    }
    return itemsDict;
  }

  static findCommonSellers(itemsDict) {
    const values = [...itemsDict.values()];
    const commonSellers = new Set(values[0]);

    for (const itemSellers of values) {
      commonSellers.forEach((seller) => {
        if (!itemSellers.includes(seller)) {
          commonSellers.delete(seller);
        }
      });
    }

    return Array.from(commonSellers);
  }

  static calculateDealsForCommonSellers(individualDeals, commonSellers) {
    const bestCumulativeDeals = new Map();

    for (const seller of commonSellers) {
      bestCumulativeDeals.set(
        seller,
        Model.processSellerDeals(individualDeals, seller)
      );
    }

    return bestCumulativeDeals;
  }

  static processSellerDeals(individualDeals, seller) {
    let bestDealItems = {
      cumulativePrice: 0,
    };

    for (const [, item] of Object.entries(individualDeals)) {
      if (!Model.isValidItem(item)) continue;

      const sellerDeal = Model.findSellerDealForItem(item.deals, seller);
      if (sellerDeal) {
        Model.updateBestDealItems(bestDealItems, sellerDeal, item.quantity);
      }
    }

    return bestDealItems;
  }

  static isValidItem(item) {
    return (
      item &&
      typeof item === "object" &&
      item.deals &&
      Array.isArray(item.deals) &&
      "quantity" in item
    );
  }

  static findSellerDealForItem(itemDeals, seller) {
    return itemDeals.find((deal) => deal && deal.seller === seller);
  }

  static updateBestDealItems(bestDealItems, deal, itemQuantity) {
    bestDealItems.sellerLink = deal.seller_link;
    bestDealItems.sellerReviews = deal.seller_reviews;
    bestDealItems.sellerReviewsLink = deal.seller_reviews_link;
    bestDealItems.sellerRating = deal.seller_rating;
    bestDealItems.deliveryPrice = deal.delivery_price;
    bestDealItems.freeDelivery = deal.free_delivery;
    bestDealItems.availability = deal.availability;
    bestDealItems.cumulativePrice += deal.price * itemQuantity;
  }

  static addDeliveryPrices(bestCumulativeDeals) {
    for (const [, item] of bestCumulativeDeals) {
      if (item.freeDelivery && item.cumulativePrice >= item.freeDelivery) {
        item.cumulativePricePlusDelivery = item.cumulativePrice;
      } else {
        item.cumulativePricePlusDelivery =
          item.cumulativePrice + item.deliveryPrice;
      }
    }

    return bestCumulativeDeals;
  }

  static sortAndFormatDeals(bestCumulativeDeals) {
    const sorted = [...bestCumulativeDeals.entries()].sort(
      ([, a], [, b]) =>
        a.cumulativePricePlusDelivery - b.cumulativePricePlusDelivery
    );

    return sorted.map(([key, value]) => ({ [key]: value }));
  }

  static findBestOverallDeal(bestIndividualDeals, bestCumulativeDeals) {
    let totalIndividualCost = 0;
    if (bestIndividualDeals) {
      for (const [, itemDeals] of Object.entries(bestIndividualDeals)) {
        const bestDeal =
          Array.isArray(itemDeals) && itemDeals.length > 0
            ? itemDeals[0]
            : null;
        if (
          bestDeal &&
          typeof bestDeal.total_price_plus_delivery === "number"
        ) {
          totalIndividualCost += bestDeal.total_price_plus_delivery;
        }
      }
    }

    let bestCumulativeCost = 0;
    let bestCumulativeDeal = {};
    if (
      bestCumulativeDeals &&
      Object.keys(bestCumulativeDeals).length !== 0
    ) {
      bestCumulativeDeal = bestCumulativeDeals[0];
      bestCumulativeCost =
        Object.values(bestCumulativeDeal)[0].cumulativePricePlusDelivery;
    }

    const chooseCumulative =
      totalIndividualCost === 0 ||
      (bestCumulativeCost > 0 && bestCumulativeCost < totalIndividualCost);

    return {
      best_deal_type: chooseCumulative ? "cumulative" : "individual",
      best_total_price: parseFloat(
        (chooseCumulative
          ? bestCumulativeCost
          : totalIndividualCost
        ).toFixed(2)
      ),
    };
  }
}
