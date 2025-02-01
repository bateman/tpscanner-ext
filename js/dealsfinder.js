console.log('dealsfinder.js loaded');

function removeUnavailableItems(deals) {
    let count = 0;
    for (let i = 0; i < deals.length; i++) {
        // Remove the deal if it's not available unless seller contains "Amazon"
        if (deals[i].availability === false && !deals[i].seller.toLowerCase().includes('amazon')) {
            deals.splice(i, 1);
            i--; // Decrement index to account for removed deal
            count++;
        }
    }
    return [count, deals];
}

function findBestIndividualDeals(itemName, itemDeals, itemQuantity) {
    let bestIndividualDeals = [];
    for (let i = 0; i < itemDeals.length; i++) {
        if (itemDeals[i].free_delivery && itemDeals[i].price * itemQuantity >= itemDeals[i].free_delivery) {
            itemDeals[i].name = itemName;
            itemDeals[i].total_price = itemDeals[i].price * itemQuantity;
            itemDeals[i].total_price_plus_delivery = itemDeals[i].free_delivery && itemDeals[i].total_price >= itemDeals[i].free_delivery ? itemDeals[i].total_price : itemDeals[i].total_price + itemDeals[i].delivery_price;
            itemDeals[i].quantity = itemQuantity;
            bestIndividualDeals.push(itemDeals[i]);
        }
    }
    // sort best deals by total price plus delivery
    bestIndividualDeals.sort((a, b) => a.total_price_plus_delivery - b.total_price_plus_delivery);
    return bestIndividualDeals;
}

function findBestCumulativeDeals(individualDeals) {
    // prepare the dictionary
    let itemsDict = {};
    for (let itemName in individualDeals) {
        let itemDeals = individualDeals[itemName].deals;
        let itemSellers = []
        for (let i = 0; i < itemDeals.length; i++) {
            itemSellers.push(itemDeals[i].seller);
        }
        itemsDict[itemName] = itemSellers;
    }
    // Find the common sellers
    // Get the sellers for the first item
    const firstItemSellers = new Set(itemsDict[Object.keys(itemsDict)[0]]);
    // Iterate through the items and find common sellers
    for (const itemSellers of Object.values(itemsDict)) {
        // Filter the common sellers for each item
        firstItemSellers.forEach(seller => {
            if (!itemSellers.includes(seller)) {
                // Remove the seller if it doesn't sell the current item
                firstItemSellers.delete(seller);
            }
        });
    }
    // Convert the set back to an array
    const commonSellers = Array.from(firstItemSellers);
    console.log(commonSellers.length + ' common seller(s) found');

    // for each common seller, find the cumulative price of all items sold by that seller
    // and sort the items by price
    let bestCumulativeDeals = {};
    for (let seller of commonSellers) {
        let bestDealItems = {};
        for (let itemName in individualDeals) {
            let itemDeals = individualDeals[itemName].deals;
            let itemQuantity = individualDeals[itemName].quantity;
            for (let i = 0; i < itemDeals.length; i++) {
                if (itemDeals[i].seller === seller) {
                    bestDealItems.name = itemName;
                    bestDealItems.sellerLink = itemDeals[i].seller_link;
                    bestDealItems.sellerReviews = itemDeals[i].seller_reviews;
                    bestDealItems.sellerReviewsLink = itemDeals[i].seller_reviews_link;
                    bestDealItems.sellerRating = itemDeals[i].seller_rating;
                    bestDealItems.deliveryPrice = itemDeals[i].delivery_price;
                    bestDealItems.freeDelivery = itemDeals[i].free_delivery;
                    bestDealItems.availability = itemDeals[i].availability;
                    bestDealItems.cumulativePrice = (bestDealItems.cumulativePrice || 0) + (itemDeals[i].price * itemQuantity);
                }
            }
        }
        bestCumulativeDeals[seller] = bestDealItems;
    }


    // add the delivery price to the cumulative price if the cumulative price is less than the free delivery price threshold
    for (let seller in bestCumulativeDeals) {
        let item = bestCumulativeDeals[seller];
        if (item.freeDelivery && item.cumulativePrice >= item.freeDelivery) {
            item.cumulativePricePlusDelivery = item.cumulativePrice;
        } else {
            item.cumulativePricePlusDelivery = item.cumulativePrice + item.deliveryPrice;
        }
        bestCumulativeDeals[seller] = item;
    }

    // sort best deals by price
    let sortedBestCumulativeDeals = {};
    Object.keys(bestCumulativeDeals).sort((a, b) => bestCumulativeDeals[a].cumulativePricePlusDelivery - bestCumulativeDeals[b].cumulativePricePlusDelivery).forEach(key => {
        sortedBestCumulativeDeals[key] = bestCumulativeDeals[key];
    });
    let arrayBestCumulativeDeals = Object.keys(sortedBestCumulativeDeals).map(key => {
        return { [key]: sortedBestCumulativeDeals[key] };
    });
    return arrayBestCumulativeDeals;
}

// Find the best overall deal by comparing the total amount spent by buying the best individual offer
// for each item (i.e., each item from different stores) to the best cumulative offer (i.e., all items 
// from the same store).
function findBestOverallDeal(bestIndividualDeals, bestCumulativeDeals) {
    // Step 1: Calculate the total cost of buying each item individually from the best store for that item
    let totalIndividualCost = 0;
    if (bestIndividualDeals && bestIndividualDeals.length !== 0) {
        for (let itemName in bestIndividualDeals) {
            let bestDeal = bestIndividualDeals[itemName][0]; // Get the best deal for the item
            totalIndividualCost += bestDeal.total_price_plus_delivery;
        }
    }

    // Step 2: Get the best cumulative deal (all items from the same store)
    let bestCumulativeCost = 0;
    let bestCumulativeDeal = {};
    if (bestCumulativeDeals && bestCumulativeDeals.length !== 0) {
        bestCumulativeDeal = bestCumulativeDeals[0]; // Get the best cumulative deal
        bestCumulativeCost = Object.values(bestCumulativeDeal)[0].cumulativePricePlusDelivery;
    }

    // Step 3: Compare the total costs and determine the best overall deal
    let bestOverallDeal = {};
    if (bestCumulativeCost < totalIndividualCost) {
        bestOverallDeal = {
            best_deal_type: 'cumulative',
            best_total_price: bestCumulativeCost
        };
    } else {
        bestOverallDeal = {
            best_deal_type: 'individual',
            best_total_price: totalIndividualCost
        };
    }
    return bestOverallDeal;
}

