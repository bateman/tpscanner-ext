function tryGet(fn, fallback = null) {
  try {
    return fn();
  } catch (_e) {
    return fallback;
  }
}

function scrapeListingElement(element) {
  const info = element.querySelector(".item_info .item_merchant");
  const prices = element.querySelector(".item_price");
  const reviewsSel =
    '.wrap_merchant_reviews a[class="merchant_reviews"]';
  const ratingSel =
    '.wrap_merchant_reviews a[class^="merchant_reviews rating_image"]';
  return {
    merchant: info.querySelector("a span").textContent.trim(),
    merchantLink: info
      .querySelector(".merchant_name_and_logo a")
      .getAttribute("href"),
    merchantReviews: info.querySelector(reviewsSel).textContent.trim(),
    merchantReviewsLink: info
      .querySelector(reviewsSel)
      .getAttribute("href"),
    merchantRating: tryGet(() =>
      info.querySelector(ratingSel).getAttribute("class")
    ),
    price: prices.querySelector(".item_basic_price").textContent.trim(),
    deliveryPrice: tryGet(() =>
      prices.querySelector(".item_delivery_price").textContent.trim()
    ),
    freeDelivery: tryGet(() =>
      prices
        .querySelector(".free_shipping_threshold span span span")
        .textContent.trim()
    ),
    availability: tryGet(
      () =>
        prices
          .querySelector(".item_availability span")
          .getAttribute("class"),
      "not available"
    ),
    offerLink: element.querySelector(".item_actions a").getAttribute("href"),
  };
}

export function extractPricesPlusShipping(htmlContent) {
  const results = [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    for (const element of doc.querySelectorAll("#listing ul li")) {
      results.push(convertDataTypes(scrapeListingElement(element)));
    }
  } catch (error) {
    console.error("Error during scraping.");
    throw error;
  }

  return results;
}

function scrapeBestPriceElement(element) {
  const info = element.querySelector(".item_info .item_merchant");
  const prices = element.querySelector(".item_price.total_price_sorting");
  const reviewsSel =
    '.wrap_merchant_reviews a[class="merchant_reviews"]';
  const ratingSel =
    '.wrap_merchant_reviews a[class^="merchant_reviews rating_image"]';
  return {
    merchant: info.querySelector("a span").textContent.trim(),
    merchantReviews: info.querySelector(reviewsSel).textContent.trim(),
    merchantRating: tryGet(() =>
      info.querySelector(ratingSel).getAttribute("class")
    ),
    price: prices.querySelector(".item_basic_price").textContent.trim(),
    deliveryPrice: null,
    freeDelivery: tryGet(() =>
      prices
        .querySelector(".free_shipping_threshold span span span")
        .textContent.trim()
    ),
    availability: tryGet(
      () =>
        prices
          .querySelector(".item_availability span")
          .getAttribute("class"),
      "not available"
    ),
    offerLink: element.querySelector(".item_actions a").getAttribute("href"),
  };
}

export function extractBestPriceShippingIncluded(htmlContent) {
  let item = {};
  let itemName = "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    const itemNames = Array.from(
      doc.querySelectorAll(
        ".name_and_rating h1 strong, .name_and_rating h1"
      )
    ).map((el) => el.textContent.trim());
    itemName = itemNames.join(" ").trim();

    const raw = scrapeBestPriceElement(
      doc.querySelector("#listing ul li")
    );
    item = convertDataTypes(raw);
  } catch (error) {
    console.error("Error during scraping.");
    throw error;
  }

  return [itemName, item];
}

const NUMBER_PATTERN = /\b\d+[,.]?\d*\b/;
const BASE_URL = "https://www.trovaprezzi.it";

function prefixUrl(path) {
  return path ? BASE_URL + path : null;
}

function parseNumber(text, fallback = 0) {
  const match = text ? text.match(NUMBER_PATTERN) : null;
  return match ? parseFloat(match[0].replace(",", ".")) : fallback;
}

function parseReviewCount(text) {
  const match = text ? text.match(NUMBER_PATTERN) : null;
  return match ? parseInt(match[0].replace(".", "")) : 0;
}

function parseRating(ratingClass) {
  if (!ratingClass) return null;
  return parseFloat(ratingClass.split(" ")[2].replace("rate", "")) / 10.0;
}

export function convertDataTypes(raw) {
  return {
    seller: raw.merchant,
    seller_link: prefixUrl(raw.merchantLink),
    seller_reviews: parseReviewCount(raw.merchantReviews),
    seller_reviews_link: prefixUrl(raw.merchantReviewsLink),
    seller_rating: parseRating(raw.merchantRating),
    price: parseNumber(raw.price),
    delivery_price: parseNumber(raw.deliveryPrice, 0.0),
    free_delivery: parseNumber(raw.freeDelivery, null),
    availability: raw.availability === "available",
    link: prefixUrl(raw.offerLink),
  };
}
