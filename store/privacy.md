# Description

An extension that helps you to find the best deals on trovaprezzi.it, a web search engine for purchasing goods of any kind from Italian e-commerce sellers.

# Motivation permissions

## activeTab

When you add items to your virtual basket, the extension will scrape the html content of the active tab to save the deals (prices + shipping) for each seller selling an item

## scripting

After you add 1+ items to your virtual basket, the extension will use scripts to identify best individual deals (i.e., deals for which quantity * price unlocks free shipping) and best cumulative deals (i.e., find sellers that sell all the items in your basked and sort the deals by prices). 

## storage

Once deals are found for the items currently in the basket, the deals are stored in the local storage. Thus, when you return to the extension and show the popup, the basket content and the best items will be retrieved from the storage without the need to execute the scraping and deal-finding scripts again.

## host

The scripts only require host permissions for these two urls patterns: "https://www.trovaprezzi.it/*" and "https://trovaprezzi.it/*"