var browser = window.msBrowser || window.browser || window.chrome;
console.log('popup.js loaded');

// ---------------- Listeners ----------------

document.addEventListener('DOMContentLoaded', function () {
    var addButton = document.getElementById('add');
    var clearButton = document.getElementById('clear');
    var itemsList = document.getElementById('items');

    // Load items from local storage
    var selectedItems = JSON.parse(localStorage.getItem('selectedItems')) || {};

    // Populate list
    for (var key in selectedItems) {
        addItemToList(key, selectedItems[key].url, selectedItems[key].quantity);
    }

    browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var url = tabs[0].url;
        var title = tabs[0].title.split('|')[0];
        var parsedUrl = new URL(url);
        if (parsedUrl.hostname === 'www.trovaprezzi.it' && parsedUrl.pathname !== '/' && parsedUrl.pathname !== '') {
            document.getElementById('title').textContent = title;
        }

        addButton.addEventListener('click', function () {
            var parsedUrl = new URL(url);
            if (parsedUrl.hostname === 'www.trovaprezzi.it' && parsedUrl.pathname !== '/' && parsedUrl.pathname !== '') {
                var quantity = document.getElementById('quantity').value;
                selectedItems[title] = { url: url, quantity: quantity };
                localStorage.setItem('selectedItems', JSON.stringify(selectedItems));
                addItemToList(title, url, quantity);
            }
        });

        clearButton.addEventListener('click', function() {
            selectedItems = {};
            localStorage.setItem('selectedItems', JSON.stringify(selectedItems));
            let rows = itemsList.getElementsByTagName('tr');
            for(let i = rows.length - 1; i > 0; i--) {
                rows[i].parentNode.removeChild(rows[i]);
            }
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
});

// ---------------- Functions ----------------

async function updateImageSrc() {
    try {
        let [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab.url.startsWith("https://www.trovaprezzi.it")) {
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