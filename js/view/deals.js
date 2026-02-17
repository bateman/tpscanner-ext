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
    const wb = XLSX.utils.table_to_book(document.getElementById("bii"), {
      sheet: "Best individual deals",
      display: true,
      raw: true,
    });
    const ws1 = wb.Sheets["Best individual deals"];
    ws1["!cols"] = calculateColumnWidths(ws1);

    // Second worksheet
    const ws2 = XLSX.utils.table_to_sheet(document.getElementById("bcd"), {
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

async function loadBestDeals() {
  const data = await browser.storage.local.get([
    "bestIndividualDeals",
    "bestCumulativeDeals",
    "bestOverallDeal",
  ]);
  const bII = data.bestIndividualDeals || {};
  const bCD = data.bestCumulativeDeals || {};
  const bOD = data.bestOverallDeal || {};

  if (Object.keys(bII).length > 0 || Object.keys(bCD).length > 0) {
    populateBestIndividualDealsTable(bII, bOD);
    populateBestCumulativeDealsTable(bCD, bOD);
  }
}

function safeHref(url) {
  try {
    return new URL(url).toString();
  } catch (_e) {
    return "#";
  }
}

function appendSellerCell(cell, name, link, reviewsLink, reviewsCount) {
  const sellerAnchor = document.createElement("a");
  sellerAnchor.href = safeHref(link);
  sellerAnchor.textContent = name;
  sellerAnchor.target = "_blank";
  cell.appendChild(sellerAnchor);
  cell.appendChild(document.createTextNode(" ("));
  const reviewsAnchor = document.createElement("a");
  reviewsAnchor.href = safeHref(reviewsLink);
  reviewsAnchor.textContent = reviewsCount;
  reviewsAnchor.target = "_blank";
  cell.appendChild(reviewsAnchor);
  cell.appendChild(document.createTextNode(")"));
}

function appendAvailabilityCell(cell, isAvailable) {
  const text = document.createTextNode(
    isAvailable
      ? browser.i18n.getMessage("dealsDisplayerYes")
      : browser.i18n.getMessage("dealsDisplayerNo")
  );
  const symbol = document.createElement("span");
  symbol.textContent = isAvailable ? "\u2713" : "\u2717";
  cell.appendChild(text);
  cell.appendChild(symbol);
}

function appendRatingCell(cell, rating) {
  const text = rating
    ? rating.toFixed(1) + " / 5 \u2605"
    : "N/A";
  cell.textContent = text;
}

function populateIndividualDealRow(table, deal, itemName, isFirst, bOD) {
  const row = table.insertRow(-1);
  if (isFirst) {
    row.className = "best-deal";
  }
  const cellProduct = row.insertCell(0);
  const link = document.createElement("a");
  link.href = safeHref(deal.link);
  link.textContent = itemName;
  link.target = "_blank";
  cellProduct.appendChild(link);
  if (isFirst && bOD.best_deal_type === "individual") {
    cellProduct.appendChild(document.createTextNode(" \uD83E\uDD47"));
  }
  row.insertCell(1).textContent = deal.quantity;
  row.insertCell(2).textContent = formatCurrency(deal.price);
  row.insertCell(3).textContent = formatCurrency(deal.total_price);
  row.insertCell(4).textContent = formatCurrency(deal.delivery_price);
  row.insertCell(5).textContent = formatCurrency(deal.free_delivery || 0.0);
  row.insertCell(6).textContent = formatCurrency(
    deal.total_price_plus_delivery
  );
  appendAvailabilityCell(row.insertCell(7), deal.availability);
  const cellSeller = row.insertCell(8);
  appendSellerCell(
    cellSeller, deal.seller, deal.seller_link,
    deal.seller_reviews_link, deal.seller_reviews
  );
  appendRatingCell(row.insertCell(9), deal.seller_rating);
}

function populateBestIndividualDealsTable(bII, bOD) {
  const table = document.getElementById("bii");
  let previousItemName = "";

  for (const [itemName, itemDeals] of Object.entries(bII)) {
    if (!Array.isArray(itemDeals)) continue;

    for (const deal of itemDeals) {
      const isFirst = previousItemName !== itemName;
      populateIndividualDealRow(table, deal, itemName, isFirst, bOD);
      previousItemName = itemName;
    }
  }
}

function populateCumulativeDealRow(table, seller, itemDeal, isFirst, bOD) {
  const row = table.insertRow(-1);
  if (isFirst) {
    row.className = "best-deal";
  }
  const cellSeller = row.insertCell(0);
  appendSellerCell(
    cellSeller, seller, itemDeal.sellerLink,
    itemDeal.sellerReviewsLink, itemDeal.sellerReviews
  );
  if (isFirst && bOD.best_deal_type === "cumulative") {
    cellSeller.appendChild(document.createTextNode(" \uD83E\uDD47"));
  }
  appendRatingCell(row.insertCell(1), itemDeal.sellerRating);
  row.insertCell(2).textContent = formatCurrency(itemDeal.cumulativePrice);
  row.insertCell(3).textContent = formatCurrency(itemDeal.deliveryPrice);
  row.insertCell(4).textContent = formatCurrency(
    itemDeal.freeDelivery || 0.0
  );
  row.insertCell(5).textContent = formatCurrency(
    itemDeal.cumulativePricePlusDelivery
  );
  appendAvailabilityCell(row.insertCell(6), itemDeal.availability);
}

function populateBestCumulativeDealsTable(bCD, bOD) {
  const table = document.getElementById("bcd");
  for (const [i, cumulativeDeal] of bCD.entries()) {
    for (const [seller, itemDeal] of Object.entries(cumulativeDeal)) {
      populateCumulativeDealRow(table, seller, itemDeal, i === 0, bOD);
    }
  }
}
