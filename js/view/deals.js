/*global XLSX*/
/*eslint-env browser*/

import { browser, applyI18n, formatCurrency } from "./commons.js";

document.addEventListener("DOMContentLoaded", function () {
  applyI18n();

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("selected"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));
      tab.classList.add("selected");
      document
        .getElementById("content-" + tab.id.split("-")[1])
        .classList.add("active");
    });
  });

  document.getElementById("export").addEventListener("click", function () {
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, "-")
      .replace("T", "_")
      .split(".")[0];

    // First worksheet
    var wb = XLSX.utils.table_to_book(document.getElementById("bii"), {
      sheet: "Best individual deals",
      display: true,
      raw: true,
    });
    var ws1 = wb.Sheets["Best individual deals"];
    ws1["!cols"] = calculateColumnWidths(ws1);

    // Second worksheet
    var ws2 = XLSX.utils.table_to_sheet(document.getElementById("bcd"), {
      display: true,
      raw: true,
    });
    XLSX.utils.book_append_sheet(wb, ws2, "Best cumulative deals");
    ws2["!cols"] = calculateColumnWidths(ws2);

    // Write file
    XLSX.writeFile(wb, "TPscanner_best-deals_" + timestamp + ".xlsx", {
      bookType: "xlsx",
    });
  });

  // Select the first tab by default
  document.getElementById("tab-bii").click();

  loadBestDeals();
});

function calculateColumnWidths(ws) {
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const cols = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    let maxWidth = 0;
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v) {
        const width = (cell.v.toString().length + 2) * 1;
        maxWidth = Math.max(maxWidth, width);
      }
    }
    cols.push({ wch: maxWidth });
  }
  return cols;
}

function loadBestDeals() {
  var bII = JSON.parse(localStorage.getItem("bestIndividualDeals")) || {};
  var bCD = JSON.parse(localStorage.getItem("bestCumulativeDeals")) || {};
  var bOD = JSON.parse(localStorage.getItem("bestOverallDeal")) || {};

  if (Object.keys(bII).length > 0 || Object.keys(bCD).length > 0) {
    populateBestIndividualDealsTable(bII, bOD);
    populateBestCumulativeDealsTable(bCD, bOD);
  }
}

function populateBestIndividualDealsTable(bII, bOD) {
  var table = document.getElementById("bii");
  let previousItemName = "";

  Object.keys(bII).forEach((itemName) => {
    if (!Object.prototype.hasOwnProperty.call(bII, itemName)) {
      return;
    }

    const itemDeals = bII[itemName];
    if (!Array.isArray(itemDeals)) {
      return;
    }

    for (const deal of itemDeals) {
      var row = table.insertRow(-1);
      if (previousItemName !== itemName) {
        row.className = "best-deal";
      }
      var cellProduct = row.insertCell(0);
      var link = document.createElement("a");
      link.href = deal.link;
      link.textContent = itemName;
      link.target = "_blank";
      cellProduct.appendChild(link);
      if (
        previousItemName !== itemName &&
        bOD.best_deal_type === "individual"
      ) {
        var img = document.createTextNode(" \uD83E\uDD47");
        cellProduct.appendChild(img);
      }
      previousItemName = itemName;
      var cellQty = row.insertCell(1);
      cellQty.textContent = deal.quantity;
      var cellPrice = row.insertCell(2);
      cellPrice.textContent = formatCurrency(deal.price);
      var cellTotalPrice = row.insertCell(3);
      cellTotalPrice.textContent = formatCurrency(deal.total_price);
      var cellDelivery = row.insertCell(4);
      cellDelivery.textContent = formatCurrency(deal.delivery_price);
      var cellFreeDelivery = row.insertCell(5);
      var temp = deal.free_delivery ? deal.free_delivery : 0.0;
      cellFreeDelivery.textContent = formatCurrency(temp);
      var cellTotalPricePlusDelivery = row.insertCell(6);
      cellTotalPricePlusDelivery.textContent = formatCurrency(
        deal.total_price_plus_delivery
      );
      var cellAvailability = row.insertCell(7);
      let text = document.createTextNode(
        deal.availability
          ? browser.i18n.getMessage("dealsDisplayerYes")
          : browser.i18n.getMessage("dealsDisplayerNo")
      );
      let symbol = document.createElement("span");
      symbol.innerHTML = deal.availability ? "\u2713" : "\u2717";
      cellAvailability.innerHTML = "";
      cellAvailability.appendChild(text);
      cellAvailability.appendChild(symbol);
      var cellSeller = row.insertCell(8);
      var linkSeller = document.createElement("a");
      linkSeller.href = deal.seller_link;
      linkSeller.textContent = deal.seller;
      linkSeller.target = "_blank";
      cellSeller.appendChild(linkSeller);
      cellSeller.appendChild(document.createTextNode(" ("));
      var linkSellerReviews = document.createElement("a");
      linkSellerReviews.href = deal.seller_reviews_link;
      linkSellerReviews.textContent = deal.seller_reviews;
      linkSellerReviews.target = "_blank";
      cellSeller.appendChild(linkSellerReviews);
      cellSeller.appendChild(document.createTextNode(")"));
      var cellSellerRating = row.insertCell(9);
      var ratingText = deal.seller_rating
        ? deal.seller_rating.toFixed(1) + " / 5 \u2605"
        : "N/A";
      cellSellerRating.appendChild(document.createTextNode(ratingText));
    }
  });
}

function populateBestCumulativeDealsTable(bCD, bOD) {
  var table = document.getElementById("bcd");
  for (let i = 0; i < bCD.length; i++) {
    var cumulativeDeal = bCD[i];
    for (let seller in cumulativeDeal) {
      if (Object.prototype.hasOwnProperty.call(cumulativeDeal, seller)) {
        var itemDeal = cumulativeDeal[seller];
        var row = table.insertRow(-1);
        if (i === 0) {
          row.className = "best-deal";
        }
        var cellSeller = row.insertCell(0);
        var linkSeller = document.createElement("a");
        linkSeller.href = itemDeal.sellerLink;
        linkSeller.textContent = seller;
        linkSeller.target = "_blank";
        cellSeller.appendChild(linkSeller);
        cellSeller.appendChild(document.createTextNode(" ("));
        var linkSellerReviews = document.createElement("a");
        linkSellerReviews.href = itemDeal.sellerReviewsLink;
        linkSellerReviews.textContent = itemDeal.sellerReviews;
        linkSellerReviews.target = "_blank";
        cellSeller.appendChild(linkSellerReviews);
        cellSeller.appendChild(document.createTextNode(")"));
        if (i === 0 && bOD.best_deal_type === "cumulative") {
          var img = document.createTextNode(" \uD83E\uDD47");
          cellSeller.appendChild(img);
        }
        var cellRating = row.insertCell(1);
        var ratingText = itemDeal.sellerRating
          ? itemDeal.sellerRating.toFixed(1) + " / 5 \u2605"
          : "N/A";
        cellRating.textContent = ratingText;
        var cellCumulativePrice = row.insertCell(2);
        cellCumulativePrice.textContent = formatCurrency(
          itemDeal.cumulativePrice
        );
        var cellDelivery = row.insertCell(3);
        cellDelivery.textContent = formatCurrency(itemDeal.deliveryPrice);
        var cellFreeDelivery = row.insertCell(4);
        var temp = itemDeal.freeDelivery ? itemDeal.freeDelivery : 0.0;
        cellFreeDelivery.textContent = formatCurrency(temp);
        var cellCumulativePricePlusDelivery = row.insertCell(5);
        cellCumulativePricePlusDelivery.textContent = formatCurrency(
          itemDeal.cumulativePricePlusDelivery
        );
        var cellAvailability = row.insertCell(6);
        let text = document.createTextNode(
          itemDeal.availability
            ? browser.i18n.getMessage("dealsDisplayerYes")
            : browser.i18n.getMessage("dealsDisplayerNo")
        );
        let symbol = document.createElement("span");
        symbol.textContent = itemDeal.availability ? "\u2713" : "\u2717";
        cellAvailability.textContent = "";
        cellAvailability.appendChild(text);
        cellAvailability.appendChild(symbol);
      }
    }
  }
}
