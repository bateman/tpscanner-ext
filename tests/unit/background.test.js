import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// background.js has import-time side effects: it registers a
// runtime.onMessage listener and kicks off Model.create(). To test it we mock
// the browser API, control storage timing so Model.create() can be deferred,
// and re-import the module fresh per test via vi.resetModules() + import().

globalThis.self = globalThis;
globalThis.browser = undefined;

// A deferred we can resolve on demand to control Model.create() timing.
function createDeferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

let storageGetDeferred;
let listener;
let sendMessageMock;

// Installs a fresh chrome mock and captures the onMessage listener that
// background.js registers at import time.
function installChromeMock() {
  storageGetDeferred = createDeferred();
  listener = undefined;
  sendMessageMock = vi.fn().mockResolvedValue(undefined);

  globalThis.chrome = {
    runtime: {
      onMessage: {
        addListener: vi.fn((fn) => {
          listener = fn;
        }),
      },
      sendMessage: sendMessageMock,
    },
    scripting: {
      executeScript: vi.fn().mockResolvedValue([{ result: [] }]),
    },
    storage: {
      local: {
        // get() stays pending until the test resolves the deferred,
        // simulating a slow cold-start Model.create().
        get: vi.fn(() => storageGetDeferred.promise),
        set: vi.fn().mockResolvedValue(undefined),
      },
    },
  };
}

// Imports background.js fresh, triggering its registration side effects.
async function importBackgroundFresh() {
  vi.resetModules();
  installChromeMock();
  await import("../../js/background.js");
}

// Resolves the deferred storage read so Model.create() (and thus the `ready`
// promise in background.js) completes, then flushes the microtask queue.
async function completeInit(storeData = {}) {
  storageGetDeferred.resolve(storeData);
  // Flush the microtask/macrotask queues so the chain
  // Model.create() -> build controller -> ready.then(dispatch) completes.
  await flushAsync();
}

// Yields across both microtask and macrotask queues enough times for the
// full async init + dispatch chain in background.js to settle.
async function flushAsync() {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("background.js message router", () => {
  beforeEach(async () => {
    await importBackgroundFresh();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("registers a runtime.onMessage listener at import time", () => {
    expect(globalThis.chrome.runtime.onMessage.addListener).toHaveBeenCalledOnce();
    expect(typeof listener).toBe("function");
  });

  // --- Regression guard: MV3 cold-start race ---

  describe("cold-start race", () => {
    it("returns true synchronously while controller is still initializing", () => {
      // Model.create() is still pending (storageGetDeferred unresolved).
      const sendResponse = vi.fn();
      const result = listener(
        { type: "REQUEST_LOAD_BASKET" },
        {},
        sendResponse
      );

      // Channel must stay open for the async response.
      expect(result).toBe(true);
      // Nothing dispatched yet because init has not resolved.
      expect(sendResponse).not.toHaveBeenCalled();
    });

    it("dispatches the first message once init completes (not dropped)", async () => {
      const sendResponse = vi.fn();
      listener({ type: "REQUEST_LOAD_BASKET" }, {}, sendResponse);
      expect(sendResponse).not.toHaveBeenCalled();

      await completeInit();

      // The cold-start message was queued, then dispatched after init.
      expect(sendResponse).toHaveBeenCalledWith({ status: "ok" });
    });
  });

  // --- Routing ---

  describe("routing", () => {
    it("routes REQUEST_LOAD_BASKET through the async path", async () => {
      const sendResponse = vi.fn();
      listener({ type: "REQUEST_LOAD_BASKET" }, {}, sendResponse);
      await completeInit();
      expect(sendResponse).toHaveBeenCalledWith({ status: "ok" });
    });

    it("routes REQUEST_ADD_ITEM through the async path", async () => {
      const sendResponse = vi.fn();
      const msg = {
        type: "REQUEST_ADD_ITEM",
        title: "Product",
        url: "https://www.trovaprezzi.it/x",
        quantity: 1,
        tabId: 123,
      };
      listener(msg, {}, sendResponse);
      await completeInit();
      expect(sendResponse).toHaveBeenCalledWith({ status: "ok" });
    });

    it("routes REQUEST_REMOVE_ITEM through the sync path", async () => {
      const sendResponse = vi.fn();
      listener({ type: "REQUEST_REMOVE_ITEM", title: "Product" }, {}, sendResponse);
      await completeInit();
      expect(sendResponse).toHaveBeenCalledWith({ status: "ok" });
    });

    it("routes REQUEST_UPDATE_QUANTITY through the sync path", async () => {
      const sendResponse = vi.fn();
      const msg = { type: "REQUEST_UPDATE_QUANTITY", title: "Product", quantity: 2 };
      listener(msg, {}, sendResponse);
      await completeInit();
      expect(sendResponse).toHaveBeenCalledWith({ status: "ok" });
    });

    it("routes REQUEST_CLEAR_BASKET through the sync path", async () => {
      const sendResponse = vi.fn();
      listener({ type: "REQUEST_CLEAR_BASKET" }, {}, sendResponse);
      await completeInit();
      expect(sendResponse).toHaveBeenCalledWith({ status: "ok" });
    });

    it("routes REQUEST_COMPUTE_DEALS through the sync path", async () => {
      const sendResponse = vi.fn();
      listener({ type: "REQUEST_COMPUTE_DEALS" }, {}, sendResponse);
      await completeInit();
      expect(sendResponse).toHaveBeenCalledWith({ status: "ok" });
    });
  });

  // --- Unknown message type ---

  describe("unknown message type", () => {
    it("responds with an error for an unrecognized type", async () => {
      const sendResponse = vi.fn();
      listener({ type: "REQUEST_NONSENSE" }, {}, sendResponse);
      await completeInit();
      expect(sendResponse).toHaveBeenCalledWith({
        status: "error",
        error: "Unknown message type",
      });
    });
  });
});
