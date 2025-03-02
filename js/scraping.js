console.log('scraping.js loaded');

export function extractPricesPlusShipping(htmlContent) {
    const results = [];

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, "text/html");     

        const elements = Array.from(doc.querySelectorAll('#listing ul li'));
        for (const element of elements) {
            const merchant = element.querySelector('.item_info .item_merchant a span').textContent.trim();
            const merchantLink = element.querySelector('.item_info .item_merchant .merchant_name_and_logo a').getAttribute('href');
            const merchantReviews = element.querySelector('.item_info .item_merchant .wrap_merchant_reviews a[class="merchant_reviews"]').textContent.trim();
            const merchantReviewsLink = element.querySelector('.item_info .item_merchant .wrap_merchant_reviews a[class="merchant_reviews"]').getAttribute('href');
            let merchantRating = null;
            try {
                merchantRating = element.querySelector('.item_info .item_merchant .wrap_merchant_reviews a[class^="merchant_reviews rating_image"]').getAttribute("class");
            } catch (error) {
                // Do nothing
            }
            const price = element.querySelector('.item_price .item_basic_price').textContent.trim();
            let deliveryPrice = null;
            try {
                deliveryPrice = element.querySelector('.item_price .item_delivery_price').textContent.trim();
            } catch (error) {
                console.log("Error scraping delivery price: " + error);
            }
            let freeDelivery = null;
            try {
                freeDelivery = element.querySelector('.item_price .free_shipping_threshold span span span').textContent.trim();
            } catch (error) {
                // Do nothing
            }
            let availability = "not available";
            try {
                availability = element.querySelector('.item_price .item_availability span').getAttribute('class');
            } catch (error) {
                // Do nothing
            }
            const offerLink = element.querySelector('.item_actions a').getAttribute('href');

            // Convert item values to the appropriate data types
            const item = convertDataTypes(
                merchant,
                merchantLink,
                merchantReviews,
                merchantReviewsLink,
                merchantRating,
                price,
                deliveryPrice,
                freeDelivery,
                availability,
                offerLink
            );
            results.push(item);
        }
    } catch (error) {
        const message = "Error during scraping.";
        console.error(message);
        throw error;
    }

    return results;
}

function extractBestPriceShippingIncluded(htmlContent) {
    let item = {};
    let itemName = "";
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, "text/html");

        // Use XPath to access the sellers and items
        const itemNames = Array.from(doc.querySelectorAll('.name_and_rating h1 strong, .name_and_rating h1'))
            .map(item => item.textContent.trim());
        itemName = itemNames.join(" ").trim();

        // We only need the first item (best price shipping included)
        const element = doc.querySelector('#listing ul li');

        const merchant = element.querySelector('.item_info .item_merchant a span').textContent.trim();
        const merchantReviews = element.querySelector('.item_info .item_merchant .wrap_merchant_reviews a[class="merchant_reviews"]').textContent.trim();
        let merchantRating = null;
        try {
            merchantRating = element.querySelector('.item_info .item_merchant .wrap_merchant_reviews a[class^="merchant_reviews rating_image"]').getAttribute("class");
        } catch (error) {
            // Do nothing
        }
        const price = element.querySelector('.item_price.total_price_sorting .item_basic_price').textContent.trim();
        const deliveryPrice = null;
        let freeDelivery = null;
        try {
            freeDelivery = element.querySelector('.item_price.total_price_sorting .free_shipping_threshold span span span').textContent.trim();
        } catch (error) {
            // Do nothing
        }
        let availability = "not available";
        try {
            availability = element.querySelector('.item_price.total_price_sorting .item_availability span').getAttribute('class');
        } catch (error) {
            // Do nothing
        }    
        const offerLink = element.querySelector('.item_actions a').getAttribute('href');

        // Convert item values to the appropriate data types
        item = convertDataTypes(
            merchant,
            merchantReviews,
            merchantRating,
            price,
            deliveryPrice,
            freeDelivery,
            availability,
            offerLink
        );
    } catch (error) {
        const message = "Error during scraping.";
        console.error(message);
        throw error;
    }

    return [itemName, item];
}


function convertDataTypes(merchant, merchantLink, merchantReviews, merchantReviewsLink, merchantRating, price, deliveryPrice, freeDelivery, availability, offerLink) {
    const numberPattern = /\b\d+[,.]?\d*\b/;
    const item = {};

    item.seller = merchant;
    item.seller_link = 'https://www.trovaprezzi.it' + merchantLink;
    item.seller_reviews = parseInt(merchantReviews.match(numberPattern)[0].replace(".", ""));
    item.seller_reviews_link = 'https://www.trovaprezzi.it' + merchantReviewsLink;
    item.seller_rating = merchantRating ? parseFloat(merchantRating.split(" ")[2].replace("rate", "")) / 10.0 : null;
    item.price = parseFloat(price.match(numberPattern)[0].replace(",", "."));
    item.quantity = quantity;
    item.delivery_price = deliveryPrice && deliveryPrice.match(numberPattern) 
        ? parseFloat(deliveryPrice.match(numberPattern)[0].replace(",", ".")) 
        : 0.0;
    //item.total_price = item.price * quantity;
    item.free_delivery = freeDelivery ? parseFloat(freeDelivery.match(numberPattern)[0].replace(",", ".")) : null;
    //item.total_price_plus_delivery = freeDelivery && item.total_price >= item.free_delivery ? item.total_price : item.total_price + item.delivery_price;
    item.availability = availability === "available";
    item.link = "https://www.trovaprezzi.it" + offerLink;

    return item;
}
