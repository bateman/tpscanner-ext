# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TPscanner is a cross-browser extension for comparing prices on [trovaprezzi.it](https://www.trovaprezzi.it). Users add products to a basket, and the extension scrapes seller listings to find the best individual and cumulative deals across sellers. It supports Chrome, Firefox, Edge, and Safari.

## Architecture

**Pattern**: MVC adapted to the browser extension architecture. Components cannot call each other directly across contexts (popup vs service worker), so communication happens via `runtime.sendMessage` / `runtime.onMessage`.

**MVC role mapping**:
- **Model** (`model.js`): Runs in the service worker. Owns all state (basket, deals), persists to `chrome.storage.local`, and notifies observers on changes.
- **View**: Split across two contexts:
  - `popup.js` / `deals.js` — Run in the popup context. Render the UI and send user actions as messages to the service worker.
  - `view.js` — Runs in the service worker. Acts as a bridge: receives model notifications and forwards them to the popup via `runtime.sendMessage`.
- **Controller** (`controller.js`): Runs in the service worker. Receives user actions (routed by `background.js`), orchestrates model updates and page scraping via `executeScript`.
- **Router** (`background.js`): Service worker entry point. Listens for messages from the popup and dispatches them to the appropriate controller method.

**Message Flow**:
```
popup.js → background.js → controller.js → model.js → chrome.storage.local
                                 ↓
popup.js ← view.js ← controller.js ← model.js (observer pattern)
```

**Key Components**:

| File | Purpose |
|------|---------|
| `js/background.js` | Service worker, routes messages from popup to controller |
| `js/model/model.js` | State management, deal-finding algorithms, storage persistence |
| `js/controller/controller.js` | Mediates model and view, triggers page scraping |
| `js/view/popup.js` | Main popup UI, basket management, quantity inputs |
| `js/view/deals.js` | Deals display page, table rendering, XLSX export |
| `js/view/view.js` | Background-side bridge, forwards model notifications to popup |
| `js/view/commons.js` | Shared utilities (browser compat, i18n, currency formatting) |
| `js/utils/scraping.js` | Data conversion for trovaprezzi.it listings (`convertDataTypes`) |

**Message Types** (handled in background.js):
- `REQUEST_ADD_ITEM` - Scrape page and add product to basket (async)
- `REQUEST_REMOVE_ITEM` - Remove product from basket
- `REQUEST_UPDATE_QUANTITY` - Change item quantity
- `REQUEST_CLEAR_BASKET` - Empty the basket
- `REQUEST_COMPUTE_DEALS` - Run deal-finding algorithms
- `REQUEST_LOAD_BASKET` - Load persisted state from storage (async)

**Response Types** (sent from view.js to popup.js via `runtime.sendMessage`):
- `RESPONSE_ITEM_ADDED`, `RESPONSE_ITEM_REMOVED`, `RESPONSE_BASKET_CLEARED`
- `RESPONSE_DEALS_COMPUTED`, `RESPONSE_BASKET_LOADED`, `RESPONSE_ERROR`

**Storage Keys** (via `chrome.storage.local` / `browser.storage.local`):
- `selectedItems` - Basket items with URLs, quantities, and scraped deal arrays
- `bestIndividualDeals` - Best per-item deals (sorted by price + delivery)
- `bestCumulativeDeals` - Best deals from sellers carrying all items
- `bestOverallDeal` - Overall recommendation (individual vs cumulative)

## Browser Differences

- `manifest.json` - Used for Chrome, Edge, Safari
- `manifest.firefox.json` - Firefox-specific, includes `browser_specific_settings.gecko`

The build process (Makefile) swaps manifests automatically. Both must be kept in sync for version, permissions, and service worker config.

**Browser API resolution**:
- Service worker context: `self.browser || self.chrome` (via `getBrowser()` for deferred resolution)
- Page context (popup, deals): `window.msBrowser || window.browser || window.chrome` (via `commons.js`)

**Service worker limitations (MV3)**:
- DOM APIs (`DOMParser`, `document`, `window`) are **not available** in the service worker. All DOM querying must happen in the page context via `executeScript`, returning structured data to the service worker. Never parse HTML in `background.js` or `controller.js` — use `executeScript` with a self-contained function to query the DOM in-page, then process the raw data in the service worker (see `scrapeListingItems` in `controller.js`).

## Deal-Finding Algorithms

All static methods on `Model` for testability:

1. **`removeUnavailableItems`** - Filters out unavailable sellers (except Amazon)
2. **`findBestIndividualDeals`** - Finds deals where `price * quantity >= free_delivery` threshold, sorted by total price + delivery
3. **`findBestCumulativeDeals`** - Finds sellers carrying all basket items, calculates cumulative cost:
   - `createItemSellersDictionary` → `findCommonSellers` → `calculateDealsForCommonSellers` → `addDeliveryPrices` → `sortAndFormatDeals`
4. **`findBestOverallDeal`** - Compares cheapest individual vs cheapest cumulative

## Known Issues

- **`extractBestPriceShippingIncluded` arity bug** (`scraping.js:156-164`): Calls `convertDataTypes` with 8 args instead of 10 (missing `merchantLink` and `merchantReviewsLink`), causing all subsequent positional arguments to shift. Documented in test suite.

## Testing

**Framework**: Vitest with jsdom environment.

```bash
npm test          # Run all tests
npm run test:watch  # Watch mode
make test         # Via Makefile
```

**Test files**: `tests/unit/{model,controller,scraping}.test.js` (48 tests)

**Mock setup**: Tests mock `globalThis.chrome.storage.local` with `get`/`set` functions and `globalThis.chrome.scripting.executeScript`. Set `globalThis.browser = undefined` to force Chrome path.

**Model tests**: Use `new Model()` for sync construction (no storage load) or `await Model.create()` for async factory. Pre-populate `store` object before `loadState()`.

## Common Code Patterns

**Deferred browser resolution** (for testability in service worker context):
```javascript
function getBrowser() {
  return self.browser || self.chrome;
}
```

**Async model initialization**:
```javascript
const model = await Model.create();  // loads state from storage
// or
const model = new Model();  // empty state, no storage access
```

**Storage access** (fire-and-forget writes, awaited reads):
```javascript
// Write (no await needed)
getBrowser().storage.local.set({ key: value });

// Read (must await)
const data = await getBrowser().storage.local.get(["key1", "key2"]);
```

**Safe DOM element creation**:
```javascript
const el = document.createElement("div");
el.textContent = userContent;  // Never use innerHTML
el.className = "safe-class";
parent.appendChild(el);
```

## Code Quality & Security

**Security:**
- Use safe DOM methods (`createElement`, `textContent`) instead of `innerHTML`
- Validate URLs via `new URL()` with try/catch before setting `href` attributes
- Parse numeric inputs at message boundaries (`parseInt(value, 10) || default`)
- Guard formatting functions against non-number values
- `host_permissions` restricted to `trovaprezzi.it` only
- `executeScript` runs a self-contained function in the page context to query the DOM and return structured data (never raw HTML)
- Message handlers include `default` case for unrecognized types
- **Avoid generic object injection sinks**: Never use bracket notation (`obj[key]`) with dynamic keys on plain objects without guarding access. Use `Object.hasOwn(obj, key)` before reading/writing, or use `Map`/`Set` instead of plain objects for dictionaries with dynamic keys. When iterating, prefer `Object.entries()`, `Object.keys()`, or `Object.values()` over `for...in` with bracket access.

```javascript
// BAD — triggers Generic Object Injection Sink
const value = obj[userKey];
obj[dynamicKey] = data;

// GOOD — guard with hasOwn
if (Object.hasOwn(obj, userKey)) {
  const value = obj[userKey];
}

// GOOD — use Map for dynamic key dictionaries
const map = new Map();
map.set(dynamicKey, data);
const value = map.get(dynamicKey);

// GOOD — destructure during iteration instead of bracket access
for (const [key, value] of Object.entries(obj)) {
  process(key, value);
}
```

**Quality:**
- Use `const`/`let` instead of `var`
- Use strict equality (`===`) instead of loose (`==`)
- Handle promise rejections with `.catch()` or try/catch
- `Model.create()` has `.catch()` fallback to empty state on storage failure
- Async message handlers return `true` to keep `sendResponse` channel open
- **Keep functions under 50 lines of code.** Extract helper functions to stay within this limit. This applies to both production code and test code (including individual `it()` blocks). When a function or test grows beyond 50 lines, refactor by extracting setup logic, helper builders, or sub-functions.

## Dependencies

**Runtime**: No npm packages. Pure vanilla JavaScript with ES6 modules. XLSX export uses bundled `xlsx-0.20.3.full.min.js`.

**Dev**: `vitest` (test runner), `jsdom` (DOM environment for tests).

**Build tools**: `jq`, `zip`, `git`, `make`. For Firefox: `web-ext`. For Safari: Xcode.

## Repository Info

- **Provider**: GitHub
- **Organization**: `bateman`
- **Repository**: `tpscanner-ext`
