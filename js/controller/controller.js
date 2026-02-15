import { extractPricesPlusShipping } from "../utils/scraping.js";

function getBrowser() {
  return self.browser || self.chrome;
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
        func: function () {
          return document.body.innerHTML;
        },
      });
      const deals = extractPricesPlusShipping(results[0].result);
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
