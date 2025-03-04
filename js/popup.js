import { extractPricesPlusShipping } from "./scraping.js";
import {
  removeUnavailableItems,
  findBestIndividualDeals,
  findBestCumulativeDeals,
  findBestOverallDeal,
} from "./dealsfinder.js";
var browser = window.msBrowser || window.browser || window.chrome;
console.log("popup.js loaded");

// ---------------- Listeners ----------------

document.addEventListener("DOMContentLoaded", function () {
  // Display extension version in the footer
  fetch("../manifest.json")
    .then((response) => response.json())
    .then((data) => {
      document.getElementById("version").textContent = data.version;
    });

  var addButton = document.getElementById("add");
  var clearButton = document.getElementById("clear");
  var itemsList = document.getElementById("items");

  // Load items from local storage
  var selectedItems = JSON.parse(localStorage.getItem("selectedItems")) || {};
  // Populate list
  for (var key in selectedItems) {
    if (Object.prototype.hasOwnProperty.call(selectedItems, key)) {
      addItemToList(key, selectedItems[key].url, selectedItems[key].quantity);
    }
  }
  // Update best deals message
  var bII = JSON.parse(localStorage.getItem("bestIndividualDeals")) || {};
  var bCD = JSON.parse(localStorage.getItem("bestCumulativeDeals")) || {};
  var bOD = JSON.parse(localStorage.getItem("bestOverallDeal")) || {};
  if (Object.keys(bII).length > 0 || Object.keys(bCD).length > 0) {
    updateBestDealsMessage(bII, bCD, bOD);
  }

  browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var url = tabs[0].url;
    var title = tabs[0].title;
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
        var quantity = document.getElementById("quantity").value;
        getDeals()
          .then((deals) => {
            // Use a safe property assignment approach
            const itemData = {
              url: url,
              quantity: quantity,
              deals: deals,
            };
            // Replace direct bracket notation with Object.prototype methods
            if (title) {
              Object.defineProperty(selectedItems, title, {
                value: itemData,
                enumerable: true,
                writable: true,
                configurable: true,
              });
              console.log("Found ", deals.length, " deals for ", title);
              localStorage.setItem(
                "selectedItems",
                JSON.stringify(selectedItems)
              );
              addItemToList(title, url, quantity);
              // Clear the best deals local storage
              localStorage.setItem("bestIndividualDeals", JSON.stringify({}));
              localStorage.setItem("bestCumulativeDeals", JSON.stringify({}));
              localStorage.setItem("bestOverallDeal", JSON.stringify({}));
              // Clear the box-deals message
              updateBestDealsMessage(null, null, null);
            }
          })
          .catch((error) => {
            console.error(
              "An error occurred adding an item to the basket: ",
              error
            );
          });
      }
    });

    clearButton.addEventListener("click", function () {
      // Clear the local storage and the list
      selectedItems = {};
      localStorage.setItem("selectedItems", JSON.stringify(selectedItems));

      // Clear all rows from tbody
      const tbody = itemsList.querySelector("tbody");
      // If the header is in thead, clear all tbody rows
      while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
      }

      // Clear the best deals local storage
      localStorage.setItem("bestIndividualDeals", JSON.stringify({}));
      localStorage.setItem("bestCumulativeDeals", JSON.stringify({}));
      localStorage.setItem("bestOverallDeal", JSON.stringify({}));
      // Clear the box-deals message
      updateBestDealsMessage(null, null, null);
    });
  });

  function addItemToList(title, url, quantity) {
    var itemsTable = document
      .getElementById("items")
      .getElementsByTagName("tbody")[0];
    var rowExists = false;

    // Check if a row with the same title already exists
    for (let row of itemsTable.rows) {
      if (row.cells[0].textContent === title) {
        // Update the quantity
        row.cells[1].getElementsByTagName("input")[0].value = quantity;
        rowExists = true;

        // Add the blink class
        row.classList.add("blink");
        // Change the background color
        row.style.backgroundColor = "#f4f8fb";

        // Remove the blink class after a short delay
        setTimeout(function () {
          row.classList.remove("blink");
          row.style.backgroundColor = "";
        }, 1000);

        break;
      }
    }

    // If no such row exists, append a new row
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
      qtyInput.id = "quantity";
      qtyInput.addEventListener("change", function () {
        if (Object.prototype.hasOwnProperty.call(selectedItems, title)) {
          selectedItems[title].quantity = this.value;
          localStorage.setItem("selectedItems", JSON.stringify(selectedItems));
        }
      });
      cellQty.appendChild(qtyInput);

      var cellBtn = row.insertCell(2);
      var removeButton = document.createElement("button");
      removeButton.textContent = "x";
      removeButton.classList.add("remove");
      removeButton.addEventListener("click", function () {
        selectedItems = Object.fromEntries(
          Object.entries(selectedItems).filter(([key]) => key !== title)
        );
        localStorage.setItem("selectedItems", JSON.stringify(selectedItems));
        itemsTable.deleteRow(row.rowIndex - 1);
        // Clear the box-deals message when an item is removed from the list
        updateBestDealsMessage(null, null, null);
        // Update storage with no deals
        localStorage.setItem("bestIndividualDeals", JSON.stringify({}));
        localStorage.setItem("bestCumulativeDeals", JSON.stringify({}));
        localStorage.setItem("bestOverallDeal", JSON.stringify({}));
      });
      cellBtn.appendChild(removeButton);
    }
  }

  document.getElementById("find-deals").addEventListener("click", function () {
    let len = Object.keys(selectedItems).length;
    if (len > 0) {
      let bestIndividualDeals = {};
      let bestCumulativeDeals = {};
      let bestOverallDeal = {};
      // iterate over the selected basket items in the local storage
      for (var itemName in selectedItems) {
        if (Object.prototype.hasOwnProperty.call(selectedItems, itemName)) {
          console.log("Finding best deals for " + itemName);
          let [count, deals] = removeUnavailableItems(
            selectedItems[itemName].deals
          );
          selectedItems[itemName].deals = deals;
          console.log(
            "Removed " + count + " unavailable item(s) for " + itemName
          );
          let bestDeals = findBestIndividualDeals(
            itemName,
            selectedItems[itemName].deals,
            selectedItems[itemName].quantity
          );
          console.log(
            "Found " +
              bestDeals.length +
              " best individual deal(s) for " +
              itemName +
              " (q.ty: " +
              selectedItems[itemName].quantity +
              ")"
          );
          console.log(
            "Best individual deals for " + itemName + ": ",
            bestDeals
          );
          bestIndividualDeals[itemName] = bestDeals;
        }
      }
      console.log("Best individual deals for all items: ", bestIndividualDeals);
      len = Object.keys(selectedItems).length;
      if (len > 1) {
        console.log("Finding best cumulative deals for " + len + " item(s)");
        bestCumulativeDeals = findBestCumulativeDeals(selectedItems);
        console.log(
          "Found " +
            bestCumulativeDeals.length +
            " best cumulative deal(s) for " +
            len +
            " item(s)"
        );
        console.log("Best cumulative deals: ", bestCumulativeDeals);
        console.log("Finding the best overall deal for " + len + " item(s");
      }
      bestOverallDeal = findBestOverallDeal(
        bestIndividualDeals,
        bestCumulativeDeals
      );
      console.log("Found the best overall deal for " + len + " item(s)");
      console.log("Best overall deal: ", bestOverallDeal);

      // Save the best deals to local storage
      bII = bestIndividualDeals;
      bCD = bestCumulativeDeals;
      bOD = bestOverallDeal;
      localStorage.setItem("bestIndividualDeals", JSON.stringify(bII));
      localStorage.setItem("bestCumulativeDeals", JSON.stringify(bCD));
      localStorage.setItem("bestOverallDeal", JSON.stringify(bOD));
      // Update the best deals message
      updateBestDealsMessage(bII, bCD, bOD);
    }
  });
});

// ---------------- Functions ----------------

function updateBestDealsMessage(
  individualDeals,
  cumulativeDeals,
  bestOverallDeal
) {
  const boxDeals = document.getElementById("box-deals");

  // Calculate individual deals count (n)
  let n = getIndividualDealsCount(individualDeals);

  // Calculate cumulative deals count (m)
  let m = getCumulativeDealsCount(cumulativeDeals);

  // Get best total price (t)
  let t = getBestTotalPrice(bestOverallDeal);

  // Update message if data is available
  if (n !== -1 && m !== -1) {
    displayDealsMessage(boxDeals, n, m, t);
  } else {
    boxDeals.textContent = "";
  }
}

function getIndividualDealsCount(individualDeals) {
  // Calculate individual deals count (n)
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
  // Calculate cumulative deals count (m)
  let m = cumulativeDeals ? cumulativeDeals.length : -1;
  m = m ? m : 0;
  return m;
}

function getBestTotalPrice(bestOverallDeal) {
  // Get best total price (t)
  let t = 0;
  if (bestOverallDeal && bestOverallDeal.best_total_price) {
    t = bestOverallDeal.best_total_price;
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

  // Add animation effect
  boxDeals.classList.add("blink");
  setTimeout(() => boxDeals.classList.remove("blink"), 1000);
}

async function updateImageSrc() {
  try {
    let [tab] = await browser.tabs.query({ active: true, currentWindow: true });
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
              return result.singleNodeValue ? result.singleNodeValue.src : "";
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

function getDeals() {
  return new Promise((resolve, reject) => {
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        let tab = tabs[0]; // Safe to assume there will only be one result
        browser.scripting
          .executeScript({
            target: { tabId: tab.id },
            func: function () {
              return document.body.innerHTML;
            },
          })
          .then((results) => {
            const extractedResults = extractPricesPlusShipping(
              results[0].result
            );
            resolve(extractedResults);
          })
          .catch((error) => {
            reject(error);
          });
      })
      .catch((error) => {
        reject(error);
      });
  });
}
