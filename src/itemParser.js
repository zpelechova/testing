function getBreadCrumbs(categoryId, jsonCategories) {
    const breadcrumbs = [];
    while (jsonCategories[categoryId]) {
        const category = jsonCategories[categoryId];
        breadcrumbs.push(category.name);
        categoryId = category.parentId;
    }
    breadcrumbs.reverse();
    return breadcrumbs;
}

                /* Složení - composition - ingredtients or just ingredients
                Kategorie a nadkategorie - categories
                Název výrobce
                gramáž - jednak za produkt - itemAmount
                ale i za kg - pricePerUnit (cena, ne unit), unit
                textualAmount (unit)?
                Země původu - countries.name or countries.code
                
                inStock
                premiouOnly??
                shelfLifeAvg??
                shelfLifeMin??
                deliveryRestrictions ??*/

function getItems(item, jsonCategories) {
    // const results = [];
    // for (const item of items) {
        const result = {
            img: item.imgPath ? item.imgPath : null,
            itemId: item.productId ? item.productId : null,
            itemUrl: item.baseLink ? `https://www.rohlik.cz/${item.baseLink}` : null,
            itemName: item.productName ? item.productName : null,
            discounted: false,
            currentPrice: item.price && item.price.full ? item.price.full : null,
            currentUnitPrice: item.pricePerUnit && item.pricePerUnit.full ? item.pricePerUnit.full : null,
            currency: item.currency ? item.currency : null,
            ingredients: item.ingredients ? item.ingredients : null,
            brand: item.brand ? item.brand : null,
            // itemAmount: item.itemAmount ? item.itemAmount : null,
            // // countries: item.countries.code ? item.countries.code : null,
            // // countries: item.countries.name ? item.countries.name : null,
            // premiumOnly: item.premiumOnly ? item.premiumOnly : null,
            // shelfLifeAvg: item.shelfLifeAvg ? item.shelfLifeAvg : null,
            // shelfLifeMin: item.shelfLifeMin ? item.shelfLifeMin : null,
            // deliveryRestrictions: item.deliveryRestrictions ? item.deliveryRestrictions : null,
            
            
        };
        // if (item.sales.length !== 0) {
        //     for (const sale of item.sales) {
        //         if (sale.type === 'sale') {
        //             result.originalPrice = result.currentPrice;
        //             result.originalUnitPrice = result.currentUnitPrice;
        //             result.currentPrice = sale.price && sale.price.full ? sale.price.full : null;
        //             result.currentUnitPrice = sale.priceForUnit && sale.priceForUnit.full ? sale.priceForUnit.full : null;
        //             result.discounted = true;
        //             /*
        //             console.log('#### DISCOUNTED ####')
        //             console.log(result);
        //             */
        //         }
        //     }
        // } else if (item.goodPrice) {
        //     const { originalPrice } = item;
        //     result.originalPrice = originalPrice.full;
        //     result.discounted = true;

        // }
        result.breadcrumbs = getBreadCrumbs(item.mainCategoryId, jsonCategories);
        results.push(result);
    // }
    return results;
}
module.exports = getItems;
