# Description

An extension that helps you to find the best deals on trovaprezzi.it, a web search engine for purchasing goods of any kind from Italian e-commerce sellers.

# Permissions

## activeTab

When you add items to your virtual basket, the extension will scrape the html content of the active tab to save the deals (prices + shipping) for each seller selling an item

## scripting

After you add 1+ items to your virtual basket, the extension will use scripts to identify best individual deals (i.e., deals for which quantity * price unlocks free shipping) and best cumulative deals (i.e., find sellers that sell all the items in your basket and sort the deals by prices). 

## host

The scripts only require host permissions for these two urls patterns: "https://www.trovaprezzi.it/*" and "https://trovaprezzi.it/*"