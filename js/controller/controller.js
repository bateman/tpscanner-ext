import { convertDataTypes } from "../utils/scraping.js";

function getBrowser() {
  return self.browser || self.chrome;
}

/**
 * Runs in the page context via executeScript. Must be self-contained
 * (no imports) since the service worker cannot inject module dependencies.
 */
function scrapeListingItems() {
  const items = [];
  const elements = document.querySelectorAll("#listing ul li");
  for (const element of elements) {
    try {
      const merchant = element
        .querySelector(".item_info .item_merchant a span")
        .textContent.trim();
      const merchantLink = element
        .querySelector(".item_info .item_merchant .merchant_name_and_logo a")
        .getAttribute("href");
      const merchantReviews = element
        .querySelector(
          '.item_info .item_merchant .wrap_merchant_reviews a[class="merchant_reviews"]'
        )
        .textContent.trim();
      const merchantReviewsLink = element
        .querySelector(
          '.item_info .item_merchant .wrap_merchant_reviews a[class="merchant_reviews"]'
        )
        .getAttribute("href");
      let merchantRating = null;
      try {
        merchantRating = element
          .querySelector(
            '.item_info .item_merchant .wrap_merchant_reviews a[class^="merchant_reviews rating_image"]'
          )
          .getAttribute("class");
      } catch (_e) {
        // No rating available
      }
      const price = element
        .querySelector(".item_price .item_basic_price")
        .textContent.trim();
      let deliveryPrice = null;
      try {
        deliveryPrice = element
          .querySelector(".item_price .item_delivery_price")
          .textContent.trim();
      } catch (_e) {
        // No delivery price
      }
      let freeDelivery = null;
      try {
        freeDelivery = element
          .querySelector(
            ".item_price .free_shipping_threshold span span span"
          )
          .textContent.trim();
      } catch (_e) {
        // No free delivery threshold
      }
      let availability = "not available";
      try {
        availability = element
          .querySelector(".item_price .item_availability span")
          .getAttribute("class");
      } catch (_e) {
        // Not available
      }
      const offerLink = element
        .querySelector(".item_actions a")
        .getAttribute("href");

      items.push({
        merchant,
        merchantLink,
        merchantReviews,
        merchantReviewsLink,
        merchantRating,
        price,
        deliveryPrice,
        freeDelivery,
        availability,
        offerLink,
      });
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
