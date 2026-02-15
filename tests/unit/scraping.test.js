import { describe, it, expect } from "vitest";
import {
  extractPricesPlusShipping,
  extractBestPriceShippingIncluded,
  convertDataTypes,
} from "../../js/utils/scraping.js";

describe("scraping", () => {
  describe("convertDataTypes", () => {
    it("should convert merchant data correctly", () => {
      const result = convertDataTypes(
        "TestShop",
        "/merchants/testshop",
        "150 recensioni",
        "/merchants/testshop/reviews",
        "merchant_reviews rating_image rate45",
        "29,99 \u20AC",
        "4,99 \u20AC",
        "49,99 \u20AC",
        "available",
        "/go/offer123"
      );

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
      const result = convertDataTypes(
        "Shop",
        "/merchants/shop",
        "50 recensioni",
        "/merchants/shop/reviews",
        null,
        "10,00 \u20AC",
        null,
        null,
        "not available",
        "/go/offer"
      );

      expect(result.delivery_price).toBe(0.0);
      expect(result.free_delivery).toBeNull();
      expect(result.seller_rating).toBeNull();
      expect(result.availability).toBe(false);
    });

    it("should handle reviews with dots as thousand separators", () => {
      const result = convertDataTypes(
        "BigShop",
        "/merchants/bigshop",
        "1.234 recensioni",
        "/merchants/bigshop/reviews",
        null,
        "10,00 \u20AC",
        null,
        null,
        "available",
        "/go/offer"
      );

      expect(result.seller_reviews).toBe(1234);
    });

    it("should parse prices with comma decimal separator", () => {
      const result = convertDataTypes(
        "Shop",
        "/merchants/shop",
        "10 recensioni",
        "/merchants/shop/reviews",
        null,
        "29,99 \u20AC",
        "12,50 \u20AC",
        null,
        "available",
        "/go/offer"
      );

      expect(result.price).toBe(29.99);
      expect(result.delivery_price).toBe(12.5);
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
  });

  describe("extractBestPriceShippingIncluded", () => {
    it("should have arity bug: calls convertDataTypes with 8 args instead of 10", () => {
      // This test documents a pre-existing bug in extractBestPriceShippingIncluded.
      // The function calls convertDataTypes with 8 positional args (missing
      // merchantLink and merchantReviewsLink), but convertDataTypes expects 10.
      // This causes the arguments to shift: merchantReviews is treated as
      // merchantLink, merchantRating as merchantReviews, etc.
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

      // The function will error because merchantReviews ("100 recensioni")
      // is passed as merchantLink, and then merchantRating (null) is passed
      // as merchantReviews. When it tries to call .match() on null, it throws.
      expect(() => extractBestPriceShippingIncluded(html)).toThrow();
    });
  });
});
