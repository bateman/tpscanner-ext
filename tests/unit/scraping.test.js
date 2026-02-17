/* global DOMParser */
import { describe, it, expect } from "vitest";
import { convertDataTypes } from "../../js/utils/scraping.js";

// --- Test-only HTML parsing utilities ---
// These simulate what executeScript does in the page context.
// They use DOMParser (available in jsdom) to parse HTML fixtures.

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
    offerLink: element
      .querySelector(".item_actions a")
      .getAttribute("href"),
  };
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
    offerLink: element
      .querySelector(".item_actions a")
      .getAttribute("href"),
  };
}

function extractPricesPlusShipping(htmlContent) {
  const results = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    for (const element of doc.querySelectorAll("#listing ul li")) {
      results.push(convertDataTypes(scrapeListingElement(element)));
    }
  } catch (_e) {
    // Return empty results for invalid HTML
  }
  return results;
}

function extractBestPriceShippingIncluded(htmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");
  const itemNames = Array.from(
    doc.querySelectorAll(
      ".name_and_rating h1 strong, .name_and_rating h1"
    )
  ).map((el) => el.textContent.trim());
  const itemName = itemNames.join(" ").trim();
  const raw = scrapeBestPriceElement(
    doc.querySelector("#listing ul li")
  );
  return [itemName, convertDataTypes(raw)];
}

describe("scraping", () => {
  describe("convertDataTypes", () => {
    it("should convert merchant data correctly", () => {
      const result = convertDataTypes({
        merchant: "TestShop",
        merchantLink: "/merchants/testshop",
        merchantReviews: "150 recensioni",
        merchantReviewsLink: "/merchants/testshop/reviews",
        merchantRating: "merchant_reviews rating_image rate45",
        price: "29,99 \u20AC",
        deliveryPrice: "4,99 \u20AC",
        freeDelivery: "49,99 \u20AC",
        availability: "available",
        offerLink: "/go/offer123",
      });

      expect(result.seller).toBe("TestShop");
      expect(result.seller_link).toBe(
        "https://www.trovaprezzi.it/merchants/testshop"
      );
      expect(result.seller_reviews).toBe(150);
      expect(result.seller_reviews_link).toBe(
        "https://www.trovaprezzi.it/merchants/testshop/reviews"
      );
      expect(result.seller_rating).toBe(4.5);
      expect(result.price).toBe(29.99);
      expect(result.delivery_price).toBe(4.99);
      expect(result.free_delivery).toBe(49.99);
      expect(result.availability).toBe(true);
      expect(result.link).toBe("https://www.trovaprezzi.it/go/offer123");
    });

    it("should handle null delivery price", () => {
      const result = convertDataTypes({
        merchant: "Shop",
        merchantLink: "/merchants/shop",
        merchantReviews: "50 recensioni",
        merchantReviewsLink: "/merchants/shop/reviews",
        merchantRating: null,
        price: "10,00 \u20AC",
        deliveryPrice: null,
        freeDelivery: null,
        availability: "not available",
        offerLink: "/go/offer",
      });

      expect(result.delivery_price).toBe(0.0);
      expect(result.free_delivery).toBeNull();
      expect(result.seller_rating).toBeNull();
      expect(result.availability).toBe(false);
    });

    it("should handle reviews with dots as thousand separators", () => {
      const result = convertDataTypes({
        merchant: "BigShop",
        merchantLink: "/merchants/bigshop",
        merchantReviews: "1.234 recensioni",
        merchantReviewsLink: "/merchants/bigshop/reviews",
        merchantRating: null,
        price: "10,00 \u20AC",
        deliveryPrice: null,
        freeDelivery: null,
        availability: "available",
        offerLink: "/go/offer",
      });

      expect(result.seller_reviews).toBe(1234);
    });

    it("should parse prices with comma decimal separator", () => {
      const result = convertDataTypes({
        merchant: "Shop",
        merchantLink: "/merchants/shop",
        merchantReviews: "10 recensioni",
        merchantReviewsLink: "/merchants/shop/reviews",
        merchantRating: null,
        price: "29,99 \u20AC",
        deliveryPrice: "12,50 \u20AC",
        freeDelivery: null,
        availability: "available",
        offerLink: "/go/offer",
      });

      expect(result.price).toBe(29.99);
      expect(result.delivery_price).toBe(12.5);
    });

    it("should parse different rating values", () => {
      const ratings = [
        ["merchant_reviews rating_image rate10", 1.0],
        ["merchant_reviews rating_image rate25", 2.5],
        ["merchant_reviews rating_image rate50", 5.0],
      ];

      for (const [ratingClass, expected] of ratings) {
        const result = convertDataTypes({
          merchant: "Shop",
          merchantLink: "/merchants/shop",
          merchantReviews: "10 recensioni",
          merchantReviewsLink: "/merchants/shop/reviews",
          merchantRating: ratingClass,
          price: "10,00 \u20AC",
          deliveryPrice: null,
          freeDelivery: null,
          availability: "available",
          offerLink: "/go/offer",
        });
        expect(result.seller_rating).toBe(expected);
      }
    });

    it("should handle zero reviews", () => {
      const result = convertDataTypes({
        merchant: "NewShop",
        merchantLink: "/merchants/newshop",
        merchantReviews: "0 recensioni",
        merchantReviewsLink: "/merchants/newshop/reviews",
        merchantRating: null,
        price: "10,00 \u20AC",
        deliveryPrice: null,
        freeDelivery: null,
        availability: "available",
        offerLink: "/go/offer",
      });

      expect(result.seller_reviews).toBe(0);
    });

    it("should handle delivery price with no numeric value (Gratis)", () => {
      const result = convertDataTypes({
        merchant: "Shop",
        merchantLink: "/merchants/shop",
        merchantReviews: "10 recensioni",
        merchantReviewsLink: "/merchants/shop/reviews",
        merchantRating: null,
        price: "10,00 \u20AC",
        deliveryPrice: "Gratis",
        freeDelivery: null,
        availability: "available",
        offerLink: "/go/offer",
      });

      // "Gratis" does not match the number pattern, so defaults to 0.0
      expect(result.delivery_price).toBe(0.0);
    });

    it("should handle missing merchantLink and merchantReviewsLink", () => {
      const result = convertDataTypes({
        merchant: "Shop",
        merchantReviews: "10 recensioni",
        merchantRating: null,
        price: "10,00 \u20AC",
        deliveryPrice: null,
        freeDelivery: null,
        availability: "available",
        offerLink: "/go/offer",
      });

      expect(result.seller).toBe("Shop");
      expect(result.seller_link).toBeNull();
      expect(result.seller_reviews).toBe(10);
      expect(result.seller_reviews_link).toBeNull();
      expect(result.price).toBe(10.0);
    });

    it("should handle missing merchantReviews", () => {
      const result = convertDataTypes({
        merchant: "Shop",
        merchantLink: "/merchants/shop",
        merchantReviews: null,
        merchantReviewsLink: "/merchants/shop/reviews",
        merchantRating: null,
        price: "10,00 \u20AC",
        deliveryPrice: null,
        freeDelivery: null,
        availability: "available",
        offerLink: "/go/offer",
      });

      expect(result.seller_reviews).toBe(0);
    });

    it("should handle missing price", () => {
      const result = convertDataTypes({
        merchant: "Shop",
        merchantLink: "/merchants/shop",
        merchantReviews: "10 recensioni",
        merchantReviewsLink: "/merchants/shop/reviews",
        merchantRating: null,
        price: null,
        deliveryPrice: null,
        freeDelivery: null,
        availability: "available",
        offerLink: "/go/offer",
      });

      expect(result.price).toBe(0);
    });
  });

  describe("extractPricesPlusShipping", () => {
    const buildListingHtml = (items) => {
      const listItems = items
        .map(
          (item) => `
        <li>
          <div class="item_info">
            <div class="item_merchant">
              <div class="merchant_name_and_logo">
                <a href="${item.merchantLink}"><span>${item.merchant}</span></a>
              </div>
              <div class="wrap_merchant_reviews">
                <a class="merchant_reviews" href="${item.reviewsLink}">${item.reviews}</a>
                ${item.rating ? `<a class="merchant_reviews rating_image ${item.rating}"></a>` : ""}
              </div>
            </div>
          </div>
          <div class="item_price">
            <span class="item_basic_price">${item.price}</span>
            ${item.delivery ? `<span class="item_delivery_price">${item.delivery}</span>` : ""}
            ${item.freeDelivery ? `<span class="free_shipping_threshold"><span><span><span>${item.freeDelivery}</span></span></span></span>` : ""}
            ${item.available !== undefined ? `<span class="item_availability"><span class="${item.available ? "available" : "not_available"}"></span></span>` : ""}
          </div>
          <div class="item_actions">
            <a href="${item.offerLink}"></a>
          </div>
        </li>
      `
        )
        .join("");
      return `<div id="listing"><ul>${listItems}</ul></div>`;
    };

    it("should extract a single listing item", () => {
      const html = buildListingHtml([
        {
          merchant: "TestShop",
          merchantLink: "/merchants/testshop",
          reviews: "100 recensioni",
          reviewsLink: "/merchants/testshop/reviews",
          rating: "rate40",
          price: "29,99 \u20AC",
          delivery: "4,99 \u20AC",
          freeDelivery: "49,99 \u20AC",
          available: true,
          offerLink: "/go/offer1",
        },
      ]);

      const result = extractPricesPlusShipping(html);

      expect(result).toHaveLength(1);
      expect(result[0].seller).toBe("TestShop");
      expect(result[0].price).toBe(29.99);
      expect(result[0].delivery_price).toBe(4.99);
      expect(result[0].free_delivery).toBe(49.99);
      expect(result[0].availability).toBe(true);
    });

    it("should extract multiple listing items", () => {
      const html = buildListingHtml([
        {
          merchant: "Shop A",
          merchantLink: "/merchants/a",
          reviews: "50 recensioni",
          reviewsLink: "/merchants/a/reviews",
          price: "20,00 \u20AC",
          delivery: "3,00 \u20AC",
          available: true,
          offerLink: "/go/a",
        },
        {
          merchant: "Shop B",
          merchantLink: "/merchants/b",
          reviews: "200 recensioni",
          reviewsLink: "/merchants/b/reviews",
          price: "25,50 \u20AC",
          delivery: "0,00 \u20AC",
          available: false,
          offerLink: "/go/b",
        },
      ]);

      const result = extractPricesPlusShipping(html);

      expect(result).toHaveLength(2);
      expect(result[0].seller).toBe("Shop A");
      expect(result[0].price).toBe(20.0);
      expect(result[1].seller).toBe("Shop B");
      expect(result[1].price).toBe(25.5);
      expect(result[1].availability).toBe(false);
    });

    it("should return empty array for page with no listings", () => {
      const html = '<div id="listing"><ul></ul></div>';
      const result = extractPricesPlusShipping(html);
      expect(result).toHaveLength(0);
    });

    it("should return empty array for invalid HTML input", () => {
      const result = extractPricesPlusShipping("");
      expect(result).toHaveLength(0);
    });

    it("should extract listing with missing optional fields", () => {
      // No delivery price, no free delivery, no rating, no availability
      const html = buildListingHtml([
        {
          merchant: "BasicShop",
          merchantLink: "/merchants/basic",
          reviews: "5 recensioni",
          reviewsLink: "/merchants/basic/reviews",
          price: "15,00 \u20AC",
          offerLink: "/go/basic",
        },
      ]);

      const result = extractPricesPlusShipping(html);

      expect(result).toHaveLength(1);
      expect(result[0].seller).toBe("BasicShop");
      expect(result[0].price).toBe(15.0);
      expect(result[0].delivery_price).toBe(0.0);
      expect(result[0].free_delivery).toBeNull();
      expect(result[0].seller_rating).toBeNull();
      expect(result[0].availability).toBe(false);
    });
  });

  describe("extractBestPriceShippingIncluded", () => {
    it("should extract item with missing merchantLink and merchantReviewsLink", () => {
      const html = `
        <div class="name_and_rating"><h1><strong>Test Product</strong></h1></div>
        <div id="listing"><ul><li>
          <div class="item_info"><div class="item_merchant">
            <div class="merchant_name_and_logo"><a href="/seller"><span>TestShop</span></a></div>
            <div class="wrap_merchant_reviews">
              <a class="merchant_reviews" href="/reviews">100 recensioni</a>
            </div>
          </div></div>
          <div class="item_price total_price_sorting">
            <span class="item_basic_price">29,99 \u20AC</span>
            <span class="item_availability"><span class="available"></span></span>
          </div>
          <div class="item_actions"><a href="/go/offer1"></a></div>
        </li></ul></div>`;

      const [itemName, item] = extractBestPriceShippingIncluded(html);

      expect(itemName).toContain("Test Product");
      expect(item.seller).toBe("TestShop");
      expect(item.price).toBe(29.99);
      expect(item.seller_link).toBeNull();
      expect(item.seller_reviews_link).toBeNull();
      expect(item.seller_reviews).toBe(100);
      expect(item.seller_rating).toBeNull();
      expect(item.delivery_price).toBe(0.0);
      expect(item.availability).toBe(true);
      expect(item.link).toBe("https://www.trovaprezzi.it/go/offer1");
    });
  });
});
