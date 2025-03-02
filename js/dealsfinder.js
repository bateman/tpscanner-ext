console.log('dealsfinder.js loaded');

export function removeUnavailableItems(deals) {
    let count = 0;
    const newDeals = [];
    
    for (const currentDeal of deals) {
        if (currentDeal && typeof currentDeal === 'object') {
            // Remove the deal if it's not available unless seller contains "Amazon"
            if (currentDeal.availability === false && 
                currentDeal.seller && 
                !currentDeal.seller.toLowerCase().includes('amazon')) {
                count++;
                // Skip this deal from the final array
            } else {
                newDeals.push(currentDeal);
            }
        } else {
            newDeals.push(currentDeal);
        }
    }
    
    // Update the original array
    deals.length = 0;
    deals.push(...newDeals);
    
    return [count, deals];
}

export function findBestIndividualDeals(itemName, itemDeals, itemQuantity) {
    let bestIndividualDeals = [];
    for (let deal of itemDeals) {
        if (deal.free_delivery && deal.price * itemQuantity >= deal.free_delivery) {
            deal.name = itemName;
            deal.total_price = deal.price * itemQuantity;
            deal.total_price_plus_delivery = deal.free_delivery && deal.total_price >= deal.free_delivery ? deal.total_price : deal.total_price + deal.delivery_price;
            deal.quantity = itemQuantity;
            bestIndividualDeals.push(deal);
        }
    }
    // sort best deals by total price plus delivery
    bestIndividualDeals.sort((a, b) => a.total_price_plus_delivery - b.total_price_plus_delivery);
    return bestIndividualDeals;
}

export function findBestCumulativeDeals(individualDeals) {
    // Extract dictionary of sellers for each product
    const itemsDict = createItemSellersDictionary(individualDeals);
    
    // Find common sellers across all items
    const commonSellers = findCommonSellers(itemsDict);
    console.log(commonSellers.length + ' common seller(s) found');

    // For each common seller, calculate cumulative price
    let bestCumulativeDeals = calculateDealsForCommonSellers(individualDeals, commonSellers);

    // Add delivery costs to cumulative prices
    bestCumulativeDeals = addDeliveryPrices(bestCumulativeDeals);

    // Sort and format the results
    return sortAndFormatDeals(bestCumulativeDeals);
}

// Create a dictionary mapping items to their sellers
function createItemSellersDictionary(individualDeals) {
    let itemsDict = {};
    for (let itemName in individualDeals) {
        let itemDeals = individualDeals[itemName].deals;
        let itemSellers = [];
        for (const deal of itemDeals) {
            itemSellers.push(deal.seller);
        }
        itemsDict[itemName] = itemSellers;
    }
    return itemsDict;
}

// Find sellers common to all items
function findCommonSellers(itemsDict) {
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
    return Array.from(firstItemSellers);
}

// Calculate deals for all common sellers
function calculateDealsForCommonSellers(individualDeals, commonSellers) {
    let bestCumulativeDeals = {};
    
    for (let seller of commonSellers) {
        bestCumulativeDeals[seller] = processSellerDeals(individualDeals, seller);
    }
    
    return bestCumulativeDeals;
}

// Helper function to process deals for a specific seller
function processSellerDeals(individualDeals, seller) {
    let bestDealItems = {
        cumulativePrice: 0
    };
    
    // Use Object.keys() for safe iteration over keys
    const itemNames = Object.keys(individualDeals);
    
    for (const itemName of itemNames) {
        const item = individualDeals[itemName];
        if (!isValidItem(item)) continue;
        
        const sellerDeal = findSellerDealForItem(item.deals, seller);
        if (sellerDeal) {
            updateBestDealItems(bestDealItems, sellerDeal, itemName, item.quantity);
        }
    }
    
    return bestDealItems;
}

// Check if item is valid and has required properties
function isValidItem(item) {
    return item && 
           typeof item === 'object' && 
           item.deals && 
           Array.isArray(item.deals) && 
           'quantity' in item;
}

// Find deal from specific seller for an item
function findSellerDealForItem(itemDeals, seller) {
    return itemDeals.find(deal => deal && deal.seller === seller);
}

// Update best deal items with data from found deal
function updateBestDealItems(bestDealItems, deal, itemName, itemQuantity) {
    bestDealItems.name = itemName;
    bestDealItems.sellerLink = deal.seller_link;
    bestDealItems.sellerReviews = deal.seller_reviews;
    bestDealItems.sellerReviewsLink = deal.seller_reviews_link;
    bestDealItems.sellerRating = deal.seller_rating;
    bestDealItems.deliveryPrice = deal.delivery_price;
    bestDealItems.freeDelivery = deal.free_delivery;
    bestDealItems.availability = deal.availability;
    bestDealItems.cumulativePrice += (deal.price * itemQuantity);
}

// Add delivery prices to cumulative prices
function addDeliveryPrices(bestCumulativeDeals) {
    for (let seller in bestCumulativeDeals) {
        let item = bestCumulativeDeals[seller];
        if (item.freeDelivery && item.cumulativePrice >= item.freeDelivery) {
            item.cumulativePricePlusDelivery = item.cumulativePrice;
        } else {
            item.cumulativePricePlusDelivery = item.cumulativePrice + item.deliveryPrice;
        }
        bestCumulativeDeals[seller] = item;
    }
    
    return bestCumulativeDeals;
}

// Sort deals by price and format for return
function sortAndFormatDeals(bestCumulativeDeals) {
    // Sort best deals by price
    let sortedBestCumulativeDeals = {};
    Object.keys(bestCumulativeDeals)
        .sort((a, b) => bestCumulativeDeals[a].cumulativePricePlusDelivery - bestCumulativeDeals[b].cumulativePricePlusDelivery)
        .forEach(key => {
            sortedBestCumulativeDeals[key] = bestCumulativeDeals[key];
        });
    
    // Convert to array of objects for return
    let arrayBestCumulativeDeals = Object.keys(sortedBestCumulativeDeals).map(key => {
        return { [key]: sortedBestCumulativeDeals[key] };
    });
    
    return arrayBestCumulativeDeals;
}

// Find the best overall deal by comparing the total amount spent by buying the best individual offer
// for each item (i.e., each item from different stores) to the best cumulative offer (i.e., all items 
// from the same store).
export function findBestOverallDeal(bestIndividualDeals, bestCumulativeDeals) {
    let notAllItemsAvailable = false;
    // Step 1: Calculate the total cost of buying each item individually from the best store for that item
    let totalIndividualCost = 0;
    if (bestIndividualDeals) {
        let n = 0;
        for (var itemName in bestIndividualDeals) {
            n += Object.prototype.hasOwnProperty.call(bestIndividualDeals, itemName) && 
                (bestIndividualDeals[itemName] && Array.isArray(bestIndividualDeals[itemName])) ? 
                bestIndividualDeals[itemName].length : 0;
        }
        if (n > 0) {
            for (let itemName in bestIndividualDeals) {
                let bestDeal = Object.prototype.hasOwnProperty.call(bestIndividualDeals, itemName) ?
                    bestIndividualDeals[itemName][0] : null; // Get the best deal for the item
                if (bestDeal)
                    totalIndividualCost += bestDeal.total_price_plus_delivery;
                else {
                    console.log('No best deal found for ' + itemName);
                    notAllItemsAvailable = true;
                }
            }
        }
    }

    // Step 2: Get the best cumulative deal (all items from the same store)
    let bestCumulativeCost = 0;
    let bestCumulativeDeal = {};
    if (bestCumulativeDeals && Object.keys(bestCumulativeDeals).length !== 0) {
        bestCumulativeDeal = bestCumulativeDeals[0]; // Get the best cumulative deal
        bestCumulativeCost = Object.values(bestCumulativeDeal)[0].cumulativePricePlusDelivery;
    }

    // Step 3: Compare the total costs and determine the best overall deal
    const chooseCumulative =
        totalIndividualCost === 0 ||
        (notAllItemsAvailable && bestCumulativeCost > 0 && bestCumulativeCost < totalIndividualCost);

    return {
        best_deal_type: chooseCumulative ? 'cumulative' : 'individual',
        best_total_price: parseFloat((chooseCumulative ? bestCumulativeCost : totalIndividualCost).toFixed(2))
    };
}

