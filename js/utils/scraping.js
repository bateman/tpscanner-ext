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
