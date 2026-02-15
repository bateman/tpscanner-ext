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
    if (Object.prototype.hasOwnProperty.call(this.selectedItems, title)) {
      this.selectedItems[title].quantity = quantity;
      this.saveState();
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
    const len = Object.keys(this.selectedItems).length;
    if (len === 0) return;

    let bestIndividualDeals = {};

    for (const itemName in this.selectedItems) {
      if (
        Object.prototype.hasOwnProperty.call(this.selectedItems, itemName)
      ) {
        const [, deals] = Model.removeUnavailableItems(
          this.selectedItems[itemName].deals
        );
        this.selectedItems[itemName].deals = deals;

        const bestDeals = Model.findBestIndividualDeals(
          itemName,
          this.selectedItems[itemName].deals,
          this.selectedItems[itemName].quantity
        );
        bestIndividualDeals[itemName] = bestDeals;
      }
    }

    let bestCumulativeDeals = {};
    if (len > 1) {
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

    deals.length = 0;
    deals.push(...newDeals);

    return [count, deals];
  }

  static findBestIndividualDeals(itemName, itemDeals, itemQuantity) {
    let bestIndividualDeals = [];
    for (let deal of itemDeals) {
      if (
        deal.free_delivery &&
        deal.price * itemQuantity >= deal.free_delivery
      ) {
        deal.name = itemName;
        deal.total_price = deal.price * itemQuantity;
        deal.total_price_plus_delivery =
          deal.free_delivery && deal.total_price >= deal.free_delivery
            ? deal.total_price
            : deal.total_price + deal.delivery_price;
        deal.quantity = itemQuantity;
        bestIndividualDeals.push(deal);
      }
    }
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
    let itemsDict = {};
    for (let itemName in individualDeals) {
      let itemDeals = individualDeals[itemName].deals;
      let itemSellers = [];
      for (const deal of itemDeals) {
        itemSellers.push(deal.seller);
      }
      itemsDict[itemName] = itemSellers;
    }
    return itemsDict;
  }

  static findCommonSellers(itemsDict) {
    const firstItemSellers = new Set(
      itemsDict[Object.keys(itemsDict)[0]]
    );

    for (const itemSellers of Object.values(itemsDict)) {
      firstItemSellers.forEach((seller) => {
        if (!itemSellers.includes(seller)) {
          firstItemSellers.delete(seller);
        }
      });
    }

    return Array.from(firstItemSellers);
  }

  static calculateDealsForCommonSellers(individualDeals, commonSellers) {
    let bestCumulativeDeals = {};

    for (let seller of commonSellers) {
      bestCumulativeDeals[seller] = Model.processSellerDeals(
        individualDeals,
        seller
      );
    }

    return bestCumulativeDeals;
  }

  static processSellerDeals(individualDeals, seller) {
    let bestDealItems = {
      cumulativePrice: 0,
    };

    const itemNames = Object.keys(individualDeals);

    for (const itemName of itemNames) {
      const item = individualDeals[itemName];
      if (!Model.isValidItem(item)) continue;

      const sellerDeal = Model.findSellerDealForItem(item.deals, seller);
      if (sellerDeal) {
        Model.updateBestDealItems(
          bestDealItems,
          sellerDeal,
          itemName,
          item.quantity
        );
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

  static updateBestDealItems(bestDealItems, deal, itemName, itemQuantity) {
    bestDealItems.name = itemName;
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
    for (let seller in bestCumulativeDeals) {
      let item = bestCumulativeDeals[seller];
      if (item.freeDelivery && item.cumulativePrice >= item.freeDelivery) {
        item.cumulativePricePlusDelivery = item.cumulativePrice;
      } else {
        item.cumulativePricePlusDelivery =
          item.cumulativePrice + item.deliveryPrice;
      }
      bestCumulativeDeals[seller] = item;
    }

    return bestCumulativeDeals;
  }

  static sortAndFormatDeals(bestCumulativeDeals) {
    let sortedBestCumulativeDeals = {};
    Object.keys(bestCumulativeDeals)
      .sort(
        (a, b) =>
          bestCumulativeDeals[a].cumulativePricePlusDelivery -
          bestCumulativeDeals[b].cumulativePricePlusDelivery
      )
      .forEach((key) => {
        sortedBestCumulativeDeals[key] = bestCumulativeDeals[key];
      });

    let arrayBestCumulativeDeals = Object.keys(
      sortedBestCumulativeDeals
    ).map((key) => {
      return { [key]: sortedBestCumulativeDeals[key] };
    });

    return arrayBestCumulativeDeals;
  }

  static findBestOverallDeal(bestIndividualDeals, bestCumulativeDeals) {
    let notAllItemsAvailable = false;
    let totalIndividualCost = 0;
    if (bestIndividualDeals) {
      let n = 0;
      for (var itemName in bestIndividualDeals) {
        if (
          typeof itemName === "string" &&
          Object.prototype.hasOwnProperty.call(
            bestIndividualDeals,
            itemName
          )
        ) {
          const itemDeals = bestIndividualDeals[itemName];
          n +=
            itemDeals && Array.isArray(itemDeals) ? itemDeals.length : 0;
        }
      }
      if (n > 0) {
        for (let itemName in bestIndividualDeals) {
          if (
            Object.prototype.hasOwnProperty.call(
              bestIndividualDeals,
              itemName
            )
          ) {
            const itemDeals = bestIndividualDeals[itemName];
            let bestDeal =
              Array.isArray(itemDeals) && itemDeals.length > 0
                ? itemDeals[0]
                : null;
            if (
              bestDeal &&
              typeof bestDeal.total_price_plus_delivery === "number"
            ) {
              totalIndividualCost += bestDeal.total_price_plus_delivery;
            } else {
              notAllItemsAvailable = true;
            }
          } else {
            notAllItemsAvailable = true;
          }
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
      (notAllItemsAvailable &&
        bestCumulativeCost > 0 &&
        bestCumulativeCost < totalIndividualCost);

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
