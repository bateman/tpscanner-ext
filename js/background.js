import { Model } from "./model/model.js";
import { View } from "./view/view.js";
import { Controller } from "./controller/controller.js";

function getBrowser() {
  return self.browser || self.chrome;
}

let controller;

// Resolves once the controller is initialized. Message handling awaits this
// so the first message after a cold service-worker start is not dropped while
// Model.create() is still pending (MV3 terminates idle workers).
const ready = Model.create()
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

function dispatch(message, sendResponse) {
  const asyncHandler = asyncHandlers.get(message.type);
  if (asyncHandler) {
    asyncHandler(message)
      .then(() => sendResponse({ status: "ok" }))
      .catch((err) => sendResponse({ status: "error", error: err.message }));
    return;
  }

  const syncHandler = syncHandlers.get(message.type);
  if (syncHandler) {
    syncHandler(message);
    sendResponse({ status: "ok" });
    return;
  }

  console.warn("Unknown message type:", message.type);
  sendResponse({ status: "error", error: "Unknown message type" });
}

getBrowser().runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Wait for initialization so a cold-start message isn't dropped. The
  // .catch guards against init ever rejecting, so the response channel is
  // always closed instead of being left open until MV3 GC.
  ready
    .then(() => dispatch(message, sendResponse))
    .catch((err) => sendResponse({ status: "error", error: err.message }));
  return true; // keep the response channel open until init completes
});
