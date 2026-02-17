import { Model } from "./model/model.js";
import { View } from "./view/view.js";
import { Controller } from "./controller/controller.js";

function getBrowser() {
  return self.browser || self.chrome;
}

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

const asyncHandlers = new Map([
  ["REQUEST_ADD_ITEM", (msg) =>
    controller.handleAddItem(msg.title, msg.url, msg.quantity, msg.tabId)],
  ["REQUEST_LOAD_BASKET", () => controller.handleLoadBasket()],
]);

const syncHandlers = new Map([
  ["REQUEST_REMOVE_ITEM", (msg) => controller.handleRemoveItem(msg.title)],
  ["REQUEST_UPDATE_QUANTITY", (msg) =>
    controller.handleUpdateQuantity(msg.title, msg.quantity)],
  ["REQUEST_CLEAR_BASKET", () => controller.handleClearBasket()],
  ["REQUEST_COMPUTE_DEALS", () => controller.handleComputeDeals()],
]);

getBrowser().runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!controller) {
    sendResponse({ status: "error", error: "Still initializing" });
    return true;
  }

  const asyncHandler = asyncHandlers.get(message.type);
  if (asyncHandler) {
    asyncHandler(message)
      .then(() => sendResponse({ status: "ok" }))
      .catch((err) => sendResponse({ status: "error", error: err.message }));
    return true;
  }

  const syncHandler = syncHandlers.get(message.type);
  if (syncHandler) {
    syncHandler(message);
    sendResponse({ status: "ok" });
    return;
  }

  console.warn("Unknown message type:", message.type);
});
