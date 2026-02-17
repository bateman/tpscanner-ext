import { convertDataTypes } from "../utils/scraping.js";

function getBrowser() {
  return self.browser || self.chrome;
}

/**
 * Runs in the page context via executeScript. Must be self-contained
 * (no imports) since the service worker cannot inject module dependencies.
 */
function scrapeListingItems() {
  function tryGet(fn, fallback = null) {
    try {
      return fn();
    } catch (_e) {
      return fallback;
    }
  }

  function scrapeElement(el) {
    const info = el.querySelector(".item_info .item_merchant");
    const prices = el.querySelector(".item_price");
    const reviewsSel =
      '.wrap_merchant_reviews a[class="merchant_reviews"]';
    const ratingSel =
      '.wrap_merchant_reviews a[class^="merchant_reviews rating_image"]';
    return {
      merchant: info.querySelector("a span").textContent.trim(),
      merchantLink: info
        .querySelector(".merchant_name_and_logo a")
        .getAttribute("href"),
      merchantReviews: info.querySelector(reviewsSel).textContent.trim(),
      merchantReviewsLink: info
        .querySelector(reviewsSel)
        .getAttribute("href"),
      merchantRating: tryGet(() =>
        info.querySelector(ratingSel).getAttribute("class")
      ),
      price: prices.querySelector(".item_basic_price").textContent.trim(),
      deliveryPrice: tryGet(() =>
        prices.querySelector(".item_delivery_price").textContent.trim()
      ),
      freeDelivery: tryGet(() =>
        prices
          .querySelector(".free_shipping_threshold span span span")
          .textContent.trim()
      ),
      availability: tryGet(
        () =>
          prices
            .querySelector(".item_availability span")
            .getAttribute("class"),
        "not available"
      ),
      offerLink: el.querySelector(".item_actions a").getAttribute("href"),
    };
  }

  const items = [];
  for (const element of document.querySelectorAll("#listing ul li")) {
    try {
      items.push(scrapeElement(element));
    } catch (_e) {
      // Skip malformed listing elements
    }
  }
  return items;
}

export class Controller {
  constructor(model, view) {
    this.model = model;
    this.view = view;

    this.model.subscribe((action, data) => {
      this.onModelChanged(action, data);
    });
  }

  onModelChanged(action, data) {
    this.view.update(action, data);
  }

  async handleAddItem(title, url, quantity, tabId) {
    try {
      const results = await getBrowser().scripting.executeScript({
        target: { tabId: tabId },
        func: scrapeListingItems,
      });
      const rawItems = results[0].result;
      const deals = rawItems.map((item) =>
        convertDataTypes(
          item.merchant,
          item.merchantLink,
          item.merchantReviews,
          item.merchantReviewsLink,
          item.merchantRating,
          item.price,
          item.deliveryPrice,
          item.freeDelivery,
          item.availability,
          item.offerLink
        )
      );
      this.model.addItem(title, url, quantity, deals);
    } catch (error) {
      console.error("An error occurred adding an item to the basket: ", error);
      this.view.update("ERROR", { error: error.message });
    }
  }

  handleRemoveItem(title) {
    this.model.removeItem(title);
  }

  handleUpdateQuantity(title, quantity) {
    this.model.updateItemQuantity(title, quantity);
  }

  handleClearBasket() {
    this.model.clearBasket();
  }

  handleComputeDeals() {
    this.model.computeDeals();
  }

  async handleLoadBasket() {
    await this.model.loadState();
    this.view.update("BASKET_LOADED", {
      selectedItems: this.model.getSelectedItems(),
      bestIndividualDeals: this.model.getBestIndividualDeals(),
      bestCumulativeDeals: this.model.getBestCumulativeDeals(),
      bestOverallDeal: this.model.getBestOverallDeal(),
    });
  }
}
