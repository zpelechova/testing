const Apify = require('apify');

const { utils: { log } } = Apify;

exports.handleStart = async ({ request, page }, requestQueue, zip, originalUrl, PTCData) => {
    const dataset = await Apify.openDataset('powermatrix');
    await page.waitForSelector("footer.l-footer");
    await page.waitFor(2000);
    const results = []
    let Util;
    if (originalUrl != undefined) {
        const distributors = await page.$$eval("ul.result-list > li > a", elems => elems.map(elem => elem.getAttribute("id")));
        let currentUrl = originalUrl.replace("{zip}", zip);
        for (let distributor of distributors) {
            await requestQueue.addRequest({
                url: `${currentUrl}&distributor=${distributor}`
            });
        }
        if (distributors.length !== 0) {
            return;
        }
    }
    const tables = await page.$$("#find-a-rate-suppliers div > div.views-field.views-field-nothing.wrapper");
    for (let tid in tables) {
        let table = tables[tid];
        if (tid == 0) continue;
        let Supplier = await table.$eval("div.supplier-name > span.name", el => el.innerText);
        let RateType = await table.$eval("div.copy > div.left > span", el => el.innerText);
        let Term = await table.$eval("div.left > span.term-length", el => el.innerText);
        let Rate = await table.$eval("div.supplier-rate > span.rate", el => el.innerText);
        let Unit = await table.$eval("div.supplier-rate > span.unit #unit", el => el.innerText);
        let CancellationFee = await table.$eval("div.middle > span.cancellation", el => el.innerText);
        let FeeType = await table.$eval("div.middle > span.monthly-fee", el => el.innerText);
        let Utility = await page.$eval("div.distributor-name > span.name", el => el.innerText);
        let PTCRate = await page.$eval("div.distributor-rate > span.rate", el => el.innerText);
        let PTCUnit = await page.$eval("div.distributor-rate > span.unit", el => el.innerText);
        let Additional = "";
        try {
            await page.click("div.right > span.additional-information > a");
            await page.waitForSelector("div.views-field.views-field-nothing.wrapper > span > div.more-info");
            Additional = await table.$eval("div.views-field.views-field-nothing.wrapper > span > div.more-info", el => el.innerText)
        } catch (error) {"The element didn't appear."};
        let CustomerType;
        if (request.loadedUrl.indexOf("shop-for-your-small-business") != -1) CustomerType = "Small business";
        else CustomerType = "Residential";
        results.push({
            "Date": (new Date()).toLocaleDateString("ISO"),
            "Commodity": "Gas",
            "State": "PA",
            "Customer Class": CustomerType,
            "Utility": Utility,
            "Supplier": Supplier.trim(),
            "Rate Type": RateType.match(/.*\:(.*)/)[1].trim(),
            "Rate": Rate.replace("$", ""),
            "Rate Units": Unit.trim(),
            "Term": Term.match(/.*\:(.*)/)[1].replace(/\D/g, '').trim(),
            "Cancellation Fee": CancellationFee.replace(/\D/g, '').trim(),
            "Additional Products & Services": Additional.trim().replace(/\n/g, ""),
            "Fee Type": FeeType,
            "Termination Notes": CancellationFee,
        });
        const pagePTCObject = {
            PTCRate: PTCRate.replace("$", ""),
            PTCUnit: PTCUnit.trim(),
            utilityName: Utility,
            CustomerType: CustomerType,
        };
    
        const found = PTCData.find(e => e.PTCRate === pagePTCObject.PTCRate && e.PTCTerm === pagePTCObject.PTCTerm && e.utilityName === pagePTCObject.utilityName);
    
        if (!found) PTCData.push(pagePTCObject);
    
        await Apify.setValue('ptc', PTCData);
    }

    //console.log(results);
    await dataset.pushData(results);
    await Apify.pushData(results);


};

exports.handleList = async ({ request, page }) => {
    // Handle pagination
};

exports.handleDetail = async ({ request, page }, PTCData) => {
    // Handle details
};
