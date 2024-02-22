var browser = window.msBrowser || window.browser || window.chrome;
console.log('popup.js loaded');

// ---------------- Listeners ----------------

document.addEventListener('DOMContentLoaded', function () {
    // Display extension version in the footer
    fetch('../manifest.json')
        .then(response => response.json())
        .then(data => {
            document.getElementById('version').textContent = data.version;
        });

    var addButton = document.getElementById('add');
    var clearButton = document.getElementById('clear');
    var itemsList = document.getElementById('items');

    // Load items from local storage
    var selectedItems = JSON.parse(localStorage.getItem('selectedItems')) || {};
    // Populate list
    for (var key in selectedItems) {
        addItemToList(key, selectedItems[key].url, selectedItems[key].quantity);
    }
    // Update best deals message
    var bII = JSON.parse(localStorage.getItem('bestIndividualDeals')) || {};
    var bCD = JSON.parse(localStorage.getItem('bestCumulativeDeals')) || {};
    if (Object.keys(bII).length > 0 || Object.keys(bCD).length > 0) {
        updateBestDealsMessage(bII, bCD);
    }

    browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var url = tabs[0].url;
        var title = tabs[0].title;
        if (title) {
            title = title.split('|')[0].trim();
        }
        else {
            return;
        }
        var parsedUrl = new URL(url);
        if (parsedUrl.hostname === 'www.trovaprezzi.it' && parsedUrl.pathname !== '/' && parsedUrl.pathname !== '') {
            document.getElementById('title').textContent = title;
        }

        addButton.addEventListener('click', function () {
            var parsedUrl = new URL(url);
            if (parsedUrl.hostname === 'www.trovaprezzi.it' && parsedUrl.pathname !== '/' && parsedUrl.pathname !== '') {
                var quantity = document.getElementById('quantity').value;
                getDeals().then(deals => {
                    selectedItems[title] = { url: url, quantity: quantity, deals: deals};
                    console.log('Found ', deals.length, ' deals for ', title);
                    localStorage.setItem('selectedItems', JSON.stringify(selectedItems));
                    addItemToList(title, url, quantity);
                }).catch(error => {
                    console.error('An error occurred adding an item to the basket: ', error);
                });                
            }
        });

        clearButton.addEventListener('click', function() {
            // Clear the local storage and the list
            selectedItems = {};
            localStorage.setItem('selectedItems', JSON.stringify(selectedItems));
            let rows = itemsList.getElementsByTagName('tr');
            for(let i = rows.length - 1; i > 0; i--) {
                rows[i].parentNode.removeChild(rows[i]);
            }
            bII = {};
            bCD = {};
            localStorage.setItem('bestIndividualDeals', JSON.stringify(bII));
            localStorage.setItem('bestCumulativeDeals', JSON.stringify(bCD));
            // Clear the box-deals message
            updateBestDealsMessage(null, null);
        });
    });

    function addItemToList(title, url, quantity) {
        var itemsTable = document.getElementById('items').getElementsByTagName('tbody')[0];
        var rowExists = false;

        // Check if a row with the same title already exists
        for (var i = 0; i < itemsTable.rows.length; i++) {
            if (itemsTable.rows[i].cells[0].textContent === title) {
                // Update the quantity
                itemsTable.rows[i].cells[1].getElementsByTagName('input')[0].value = quantity;
                rowExists = true;

                // Add the blink class
                let row = itemsTable.rows[i];
                row.classList.add('blink');
                // Change the background color
                row.style.backgroundColor = '#f4f8fb';

                // Remove the blink class after a short delay
                setTimeout(function () {
                    row.classList.remove('blink');
                    row.style.backgroundColor = '';
                }, 1000);

                break;
            }
        }

        // If no such row exists, append a new row
        if (!rowExists) {
            var row = itemsTable.insertRow();

            var cellTitle = row.insertCell(0);
            var link = document.createElement('a');
            link.href = url;
            link.textContent = title;
            link.target = '_blank';
            cellTitle.appendChild(link);

            var cellQty = row.insertCell(1);
            var qtyInput = document.createElement('input');
            qtyInput.type = 'number';
            qtyInput.value = quantity;
            qtyInput.id = 'quantity';
            qtyInput.addEventListener('change', function() {
                selectedItems[title].quantity = this.value;
                localStorage.setItem('selectedItems', JSON.stringify(selectedItems));
            });
            cellQty.appendChild(qtyInput);

            var cellBtn = row.insertCell(2);
            var removeButton = document.createElement('button');
            removeButton.textContent = 'x';
            removeButton.classList.add('remove');
            removeButton.addEventListener('click', function() {
                delete selectedItems[title];
                localStorage.setItem('selectedItems', JSON.stringify(selectedItems));
                itemsTable.deleteRow(row.rowIndex - 1);
            });
            cellBtn.appendChild(removeButton);
        }
    }

    document.getElementById('find-deals').addEventListener('click', function () {
        let len = Object.keys(selectedItems).length;
        if (len > 0) {
            let bestIndividualDeals = { };
            let bestCumulativeDeals = { };
            // iterate over the selected basket items in the local storage
            for (var itemName in selectedItems) {
                console.log('Finding best deals for ' + itemName);
                let [count, deals] = removeUnavailableItems(selectedItems[itemName].deals);
                selectedItems[itemName].deals = deals;
                console.log('Removed ' + count + ' unavailable item(s) for ' + itemName);
                let bestDeals = findBestIndividualDeals(itemName, selectedItems[itemName].deals, selectedItems[itemName].quantity);
                console.log('Found ' + bestDeals.length + ' best individual deal(s) for ' + itemName + ' (q.ty: ' + selectedItems[itemName].quantity + ')');
                console.log('Best individual deals: ', bestDeals);
                bestIndividualDeals[itemName] = bestDeals;
            }
            len = Object.keys(selectedItems).length;
            if (len > 1) {
                console.log('Finding best cumulative deals for ' + len + ' item(s)');
                bestCumulativeDeals = findBestCumulativeDeals(selectedItems);
                console.log('Found ' + bestCumulativeDeals.length + ' best cumulative deal(s) for ' + len + ' item(s)');
            }
            console.log('Best cumlative deals: ', bestCumulativeDeals);

            // Save the best deals to local storage
            bII = bestIndividualDeals;
            bCD = bestCumulativeDeals;
            localStorage.setItem('bestIndividualDeals', JSON.stringify(bII));
            localStorage.setItem('bestCumulativeDeals', JSON.stringify(bCD));
            // Update the best deals message
            updateBestDealsMessage(bII, bCD);
        }
    });
});

// ---------------- Functions ----------------

function updateBestDealsMessage(individualDeals, cumulativeDeals) {
    const boxDeals = document.getElementById('box-deals');
    let n = 0;
    if(individualDeals) {
        for(var itemName in individualDeals) {
            n += individualDeals[itemName].length;
        }
    } else {
        n = -1;
    }
    const m = cumulativeDeals ? cumulativeDeals.length : -1;
    if (n !== -1 && m !== -1) {
        boxDeals.textContent = 'Found ' + n + ' individual deal(s), ' + m + ' cumulative deal(s)';
    } else {
        boxDeals.textContent = '';
    }
}

async function updateImageSrc() {
    try {
        let [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab.url && tab.url.startsWith("https://www.trovaprezzi.it")) {
            browser.scripting.executeScript({
                target: { tabId: tab.id },
                function: function () {
                    var xpath = './/a[@class="gallery_popup_link first" or @class="suggested_product"]/img';
                    var result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    return result.singleNodeValue ? result.singleNodeValue.src : '';
                }
            }).then(([result] = []) => {
                if (result.result) {
                    document.getElementById('item-image').src = result.result;
                }
            }).catch((error) => {
                console.error(error);
            });
        }
    } catch (error) {
        console.error(error);
    }
}
updateImageSrc();

function getDeals() {
    return new Promise((resolve, reject) => {
        browser.tabs.query({active: true, currentWindow: true}).then((tabs) => {
            let tab = tabs[0]; // Safe to assume there will only be one result
            browser.scripting.executeScript({
                target: {tabId: tab.id},
                function: function() {                    
                    return document.body.innerHTML;
                }
            }).then((results) => {
                const extractedResults = extractPricesPlusShipping(results[0].result);
                resolve(extractedResults);
            }).catch((error) => {
                reject(error);
            });
        }).catch((error) => {
            reject(error);
        });
    });
}
