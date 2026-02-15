import { Model } from "./model/model.js";
import { View } from "./view/view.js";
import { Controller } from "./controller/controller.js";

const browser = self.browser || self.chrome;

let controller;

Model.create()
  .then((model) => {
    const view = new View();
    controller = new Controller(model, view);
  })
  .catch((err) => {
    console.error("Failed to initialize model, using empty state:", err);
    const model = new Model();
    const view = new View();
    controller = new Controller(model, view);
  });

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!controller) {
    sendResponse({ status: "error", error: "Still initializing" });
    return true;
  }

  switch (message.type) {
    case "REQUEST_ADD_ITEM":
      controller
        .handleAddItem(
          message.title,
          message.url,
          message.quantity,
          message.tabId
        )
        .then(() => sendResponse({ status: "ok" }))
        .catch((err) => sendResponse({ status: "error", error: err.message }));
      return true; // async response

    case "REQUEST_REMOVE_ITEM":
      controller.handleRemoveItem(message.title);
      sendResponse({ status: "ok" });
      break;

    case "REQUEST_UPDATE_QUANTITY":
      controller.handleUpdateQuantity(message.title, message.quantity);
      sendResponse({ status: "ok" });
      break;

    case "REQUEST_CLEAR_BASKET":
      controller.handleClearBasket();
      sendResponse({ status: "ok" });
      break;

    case "REQUEST_COMPUTE_DEALS":
      controller.handleComputeDeals();
      sendResponse({ status: "ok" });
      break;

    case "REQUEST_LOAD_BASKET":
      controller
        .handleLoadBasket()
        .then(() => sendResponse({ status: "ok" }))
        .catch((err) => sendResponse({ status: "error", error: err.message }));
      return true; // async response

    default:
      console.warn("Unknown message type:", message.type);
      break;
  }
});
