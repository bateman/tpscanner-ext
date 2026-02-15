import { browser, applyI18n } from "./commons.js";

let selectedItems = {};
let bestIndividualDeals = {};
let bestCumulativeDeals = {};
let bestOverallDeal = {};

// --- Listeners ---

document.addEventListener("DOMContentLoaded", function () {
  applyI18n();

  // Display extension version in the footer
  fetch("../manifest.json")
    .then((response) => response.json())
    .then((data) => {
      document.getElementById("version").textContent = data.version;
    });

  var addButton = document.getElementById("add");
  var clearButton = document.getElementById("clear");

  // Request basket state from background
  browser.runtime.sendMessage({ type: "REQUEST_LOAD_BASKET" });

  // Listen for responses from background
  browser.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case "RESPONSE_BASKET_LOADED":
        onBasketLoaded(message.data);
        break;
      case "RESPONSE_ITEM_ADDED":
        onItemAdded(message.data);
        break;
      case "RESPONSE_ITEM_REMOVED":
        onItemRemoved(message.data);
        break;
      case "RESPONSE_BASKET_CLEARED":
        onBasketCleared();
        break;
      case "RESPONSE_DEALS_COMPUTED":
        onDealsComputed(message.data);
        break;
      case "RESPONSE_ERROR":
        console.error("Background error:", message.data.error);
        break;
    }
  });

  browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var url = tabs[0].url;
    var title = tabs[0].title;
    var tabId = tabs[0].id;
    if (title) {
      title = title.split("|")[0].trim();
    } else {
      return;
    }
    var parsedUrl = new URL(url);
    if (
      parsedUrl.hostname === "www.trovaprezzi.it" &&
      parsedUrl.pathname !== "/" &&
      parsedUrl.pathname !== ""
    ) {
      document.getElementById("title").textContent = title;
    }

    addButton.addEventListener("click", function () {
      var parsedUrl = new URL(url);
      if (
        parsedUrl.hostname === "www.trovaprezzi.it" &&
        parsedUrl.pathname !== "/" &&
        parsedUrl.pathname !== ""
      ) {
        var quantity = parseInt(document.getElementById("quantity").value, 10) || 1;
        browser.runtime.sendMessage({
          type: "REQUEST_ADD_ITEM",
          title: title,
          url: url,
          quantity: quantity,
          tabId: tabId,
        });
      }
    });

    clearButton.addEventListener("click", function () {
      browser.runtime.sendMessage({ type: "REQUEST_CLEAR_BASKET" });
    });
  });

  document.getElementById("find-deals").addEventListener("click", function () {
    if (Object.keys(selectedItems).length > 0) {
      browser.runtime.sendMessage({ type: "REQUEST_COMPUTE_DEALS" });
    }
  });
});

// --- Response handlers ---

function onBasketLoaded(data) {
  selectedItems = data.selectedItems || {};
  bestIndividualDeals = data.bestIndividualDeals || {};
  bestCumulativeDeals = data.bestCumulativeDeals || {};
  bestOverallDeal = data.bestOverallDeal || {};

  for (var key in selectedItems) {
    if (Object.prototype.hasOwnProperty.call(selectedItems, key)) {
      addItemToList(key, selectedItems[key].url, selectedItems[key].quantity);
    }
  }

  if (
    Object.keys(bestIndividualDeals).length > 0 ||
    Object.keys(bestCumulativeDeals).length > 0
  ) {
    updateBestDealsMessage(
      bestIndividualDeals,
      bestCumulativeDeals,
      bestOverallDeal
    );
  }
}

function onItemAdded(data) {
  selectedItems = data.selectedItems;
  addItemToList(data.title, data.url, data.quantity);
  updateBestDealsMessage(null, null, null);
}

function onItemRemoved(data) {
  selectedItems = data.selectedItems;
  updateBestDealsMessage(null, null, null);
}

function onBasketCleared() {
  selectedItems = {};

  const itemsList = document.getElementById("items");
  const tbody = itemsList.querySelector("tbody");
  while (tbody.firstChild) {
    tbody.removeChild(tbody.firstChild);
  }

  updateBestDealsMessage(null, null, null);
}

function onDealsComputed(data) {
  bestIndividualDeals = data.bestIndividualDeals;
  bestCumulativeDeals = data.bestCumulativeDeals;
  bestOverallDeal = data.bestOverallDeal;
  updateBestDealsMessage(
    bestIndividualDeals,
    bestCumulativeDeals,
    bestOverallDeal
  );
}

// --- UI Functions ---

function addItemToList(title, url, quantity) {
  var itemsTable = document
    .getElementById("items")
    .getElementsByTagName("tbody")[0];
  var rowExists = false;

  for (let row of itemsTable.rows) {
    if (row.cells[0].textContent === title) {
      row.cells[1].getElementsByTagName("input")[0].value = quantity;
      rowExists = true;

      row.classList.add("blink");
      row.style.backgroundColor = "#f4f8fb";

      setTimeout(function () {
        row.classList.remove("blink");
        row.style.backgroundColor = "";
      }, 1000);

      break;
    }
  }

  if (!rowExists) {
    var row = itemsTable.insertRow();

    var cellTitle = row.insertCell(0);
    var link = document.createElement("a");
    try {
      link.href = new URL(url).toString();
    } catch (e) {
      console.error(e);
      link.href = "https://www.trovaprezzi.it";
    }
    link.textContent = title;
    link.target = "_blank";
    cellTitle.appendChild(link);

    var cellQty = row.insertCell(1);
    var qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.value = quantity;
    qtyInput.min = "1";
    qtyInput.addEventListener("change", function () {
      browser.runtime.sendMessage({
        type: "REQUEST_UPDATE_QUANTITY",
        title: title,
        quantity: parseInt(this.value, 10) || 1,
      });
    });
    cellQty.appendChild(qtyInput);

    var cellBtn = row.insertCell(2);
    var removeButton = document.createElement("button");
    removeButton.textContent = "x";
    removeButton.classList.add("remove");
    removeButton.addEventListener("click", function () {
      itemsTable.deleteRow(row.rowIndex - 1);
      browser.runtime.sendMessage({
        type: "REQUEST_REMOVE_ITEM",
        title: title,
      });
    });
    cellBtn.appendChild(removeButton);
  }
}

function updateBestDealsMessage(
  individualDeals,
  cumulativeDeals,
  overallDeal
) {
  const boxDeals = document.getElementById("box-deals");

  let n = getIndividualDealsCount(individualDeals);
  let m = getCumulativeDealsCount(cumulativeDeals);
  let t = getBestTotalPrice(overallDeal);

  if (n !== -1 && m !== -1) {
    displayDealsMessage(boxDeals, n, m, t);
  } else {
    boxDeals.textContent = "";
  }
}

function getIndividualDealsCount(individualDeals) {
  let n = -1;
  if (individualDeals) {
    n = 0;
    for (const itemName in individualDeals) {
      if (Object.prototype.hasOwnProperty.call(individualDeals, itemName)) {
        n += individualDeals[itemName].length;
      }
    }
  }
  return n;
}

function getCumulativeDealsCount(cumulativeDeals) {
  let m = cumulativeDeals ? cumulativeDeals.length : -1;
  m = m ? m : 0;
  return m;
}

function getBestTotalPrice(overallDeal) {
  let t = 0;
  if (overallDeal && overallDeal.best_total_price) {
    t = overallDeal.best_total_price;
  }
  return t;
}

function displayDealsMessage(
  boxDeals,
  individualCount,
  cumulativeCount,
  totalPrice
) {
  let textContext =
    browser.i18n.getMessage("popupBestDealsMessageFound") + individualCount;
  textContext +=
    browser.i18n.getMessage("popupBestDealsMessageIndividuals") +
    cumulativeCount;
  textContext += browser.i18n.getMessage("popupBestDealsMessageCumulative");
  textContext +=
    browser.i18n.getMessage("popupBestDealsMessagePrice") +
    totalPrice +
    " \u20AC";

  boxDeals.textContent = textContext;

  boxDeals.classList.add("blink");
  setTimeout(() => boxDeals.classList.remove("blink"), 1000);
}

async function updateImageSrc() {
  try {
    let [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab && tab.url) {
      const url = new URL(tab.url).hostname;
      if (url === "www.trovaprezzi.it") {
        await browser.scripting
          .executeScript({
            target: { tabId: tab.id },
            func: function () {
              var xpath =
                './/a[@class="gallery_popup_link first" or @class="suggested_product"]/img';
              var result = document.evaluate(
                xpath,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
              );
              return result.singleNodeValue
                ? result.singleNodeValue.src
                : "";
            },
          })
          .then(([result] = []) => {
            if (result.result) {
              document.getElementById("item-image").src = result.result;
            }
          })
          .catch((error) => {
            console.error(error);
          });
      }
    }
  } catch (error) {
    console.error(error);
  }
}
updateImageSrc();
