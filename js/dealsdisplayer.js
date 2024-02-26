console.log('dealsdisplayer.js loaded');

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('selected'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('selected');
            document.getElementById('content-' + tab.id.split('-')[1]).classList.add('active');
        });
    });


    document.getElementById("export").addEventListener('click', function() {
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace('T', '_').split('.')[0];
        var wb = XLSX.utils.table_to_book(document.getElementById("bii"), { sheet: "Best individual deals" });
        var ws = XLSX.utils.table_to_sheet(document.getElementById("bcd"));
        XLSX.utils.book_append_sheet(wb, ws, "Best cumulative deals");
        XLSX.writeFile(wb, "TPscanner_best-deals_" + timestamp + ".xlsx");
    });


    // Select the first tab by default
    document.getElementById('tab-bii').click();

    loadBestDeals();
});

function loadBestDeals() {
    // Load the best deals from local storage
    var bII = JSON.parse(localStorage.getItem('bestIndividualDeals')) || {};
    var bCD = JSON.parse(localStorage.getItem('bestCumulativeDeals')) || {};

    // Populate the tables
    if (Object.keys(bII).length > 0 || Object.keys(bCD).length > 0) {
        populatebBestInividualDealsTable(bII);
        populateBestCumulativeDealsTable(bCD);
    }
}

function populatebBestInividualDealsTable(bII) {
    var table = document.getElementById('bii');
    for (var itemName in bII) {
        var itemDeals = bII[itemName];
        for (let i = 0; i < itemDeals.length; i++) {
            var row = table.insertRow(-1);          
            var cellProduct= row.insertCell(0);
            // add item url as link of product name
            var link = document.createElement('a');
            link.href = itemDeals[i].link;
            link.textContent = itemName;
            link.target = '_blank';
            cellProduct.appendChild(link);
            // add quantity cell
            var cellQty = row.insertCell(1);
            cellQty.textContent = itemDeals[i].quantity;
            // add price cell
            var cellPrice = row.insertCell(2);
            cellPrice.textContent = itemDeals[i].price.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
            // add total price cell
            var cellTotalPrice = row.insertCell(3);
            cellTotalPrice.textContent = itemDeals[i].total_price.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
            // add delivery cell
            var cellDelivery = row.insertCell(4);
            cellDelivery.textContent = itemDeals[i].delivery_price.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
            // add free delivery from cell
            var cellFreeDelivery = row.insertCell(5);
            var temp = itemDeals[i].free_delivery ? itemDeals[i].free_delivery : 0.0;
            cellFreeDelivery.textContent = temp.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
            // add total price + delivery cell
            var cellTotalPricePlusDelivery = row.insertCell(6);
            cellTotalPricePlusDelivery.textContent = itemDeals[i].total_price_plus_delivery.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
            // add availability cell
            var cellAvailability = row.insertCell(7);
            let text = document.createTextNode(itemDeals[i].availability ? 'Yes ' : 'No ');
            let symbol = document.createElement('span');
            symbol.innerHTML = itemDeals[i].availability ? '&#10003;' : '&#10007;';
            cellAvailability.innerHTML = '';
            cellAvailability.appendChild(text);
            cellAvailability.appendChild(symbol);
            // add seller cell
            var cellSeller = row.insertCell(8);
            var linkSeller = document.createElement('a');
            linkSeller.href = itemDeals[i].seller_link;
            linkSeller.textContent = itemDeals[i].seller;
            linkSeller.target = '_blank';
            cellSeller.appendChild(linkSeller);
            cellSeller.appendChild(document.createTextNode(' ('));
            var linkSellerReviews = document.createElement('a');
            linkSellerReviews.href = itemDeals[i].seller_reviews_link;
            linkSellerReviews.textContent = itemDeals[i].seller_reviews;
            linkSellerReviews.target = '_blank';
            cellSeller.appendChild(linkSellerReviews);
            cellSeller.appendChild(document.createTextNode(')'));
            // add seller rating cell
            var cellSellerRating = row.insertCell(9);
            var ratingText = itemDeals[i].seller_rating ? itemDeals[i].seller_rating.toFixed(1) + ' / 5 \u2605' : 'N/A';
            cellSellerRating.appendChild(document.createTextNode(ratingText));
        }
    }
}

function populateBestCumulativeDealsTable(bCD) {
    var table = document.getElementById('bcd');
    for (let i=0; i < bCD.length; i++) {
        var cumulativeDeal = bCD[i];
        for (let seller in cumulativeDeal) {
            var itemDeal = cumulativeDeal[seller];
            var row = table.insertRow(-1);          
            // add seller cell
            var cellSeller = row.insertCell(0);
            var linkSeller = document.createElement('a');
            linkSeller.href = itemDeal.sellerLink;
            linkSeller.textContent = seller;
            linkSeller.target = '_blank';
            cellSeller.appendChild(linkSeller);
            cellSeller.appendChild(document.createTextNode(' ('));
            var linkSellerReviews = document.createElement('a');
            linkSellerReviews.href = itemDeal.sellerReviewsLink;
            linkSellerReviews.textContent = itemDeal.sellerReviews;
            linkSellerReviews.target = '_blank';
            cellSeller.appendChild(linkSellerReviews);
            cellSeller.appendChild(document.createTextNode(')'));
            // add rating cell
            var cellRating = row.insertCell(1);
            var ratingText = itemDeal.sellerRating ? itemDeal.sellerRating.toFixed(1) + ' / 5 \u2605' : 'N/A';
            cellRating.textContent = ratingText;
            // add cumulative price cell
            var cellCumulativePrice = row.insertCell(2);
            cellCumulativePrice.textContent = itemDeal.cumulativePrice.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
            // add delivery cell
            var cellDelivery = row.insertCell(3);
            cellDelivery.textContent = itemDeal.deliveryPrice.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
            // add free delivery from cell
            var cellFreeDelivery = row.insertCell(4);
            var temp = itemDeal.freeDelivery? itemDeal.freeDelivery : 0.0;
            cellFreeDelivery.textContent = temp.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
            // add cumulative price + delivery cell
            var cellCumulativePricePlusDelivery = row.insertCell(5);
            cellCumulativePricePlusDelivery.textContent = itemDeal.cumulativePricePlusDelivery.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
            // add availability cell
            var cellAvailability = row.insertCell(6);
            let text = document.createTextNode(itemDeal.availability ? 'Yes ' : 'No ');
            let symbol = document.createElement('span');
            symbol.innerHTML = itemDeal.availability ? '&#10003;' : '&#10007;';
            cellAvailability.innerHTML = '';
            cellAvailability.appendChild(text);
            cellAvailability.appendChild(symbol);
        }
    }
}