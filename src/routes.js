const Apify = require('apify');

const { utils: { log } } = Apify;

exports.handleStart = async ({ request, page }, requestQueue, zip, originalUrl, PTCData) => {
    const dataset = await Apify.openDataset('powermatrix');
    await page.waitForSelector("footer.l-footer");
    const results = []
    if (originalUrl != undefined)
    {const distributors = await page.$$eval("a.multi-distributor-home", elems => elems.map(elem => elem.getAttribute("data-id")));
    console.log(originalUrl);
    let currentUrl = originalUrl.replace("{zip}", zip);
    for (let distributor of distributors) {
        await requestQueue.addRequest({
            url: `${currentUrl}&distributor=${distributor}`
        });
    }}
    const tables = await page.$$("div.rate-item");
    for (let tid in tables) {
        let table = tables[tid];
        if (await table.$eval("div.supplier-name.enrollmentNo > span.name", el => el.innerText) == "%distributor%") continue;
        let Supplier = await table.$eval("div.supplier-name.enrollmentNo > span.name", el => el.innerText);
        let RateType = await table.$eval("div.copy > div.left > span", el => el.innerText);
        let Term = await table.$eval("div.middle > span.term-length", el => el.innerText);
        let Rate = await table.$eval("div.supplier-rate > span.rate", el => el.innerText);
        let CancellationFee = await table.$eval("div.middle > span.cancellation", el => el.innerText);
        let RenewableBlend = await table.$eval("div.left > span.renewable", el => el.innerText);
        let Fee = await table.$eval("div.middle > span.enrollment-fee", el => el.innerText);
        let FeeType = await table.$eval("div.middle > span.monthly-fee", el => el.innerText);
        let Utility = await page.$eval("div.ratetype-result > div.distributor-name > span.name", el => el.innerText);
        let PTCRate = await page.$eval("div.distributor-rate > span.rate", el => el.innerText);
        let PTCName = await page.$eval("div.distributor-name > span.name", el => el.innerText);
        let Additional = await table.$eval("div.more-info", el => el.innerText);
        let CustomerType;
        if (request.loadedUrl.indexOf("shop-for-your-home") != -1) CustomerType = "Residential";
        else CustomerType = "Small business";
        results.push({
            "Date": (new Date()).toLocaleDateString("ISO"),
            "Commodity": "Power",
            "State": "PA",
            "Customer Type": CustomerType,
            "Utility": Utility,
            "Supplier": Supplier.trim(),
            "Rate Category" : "",
            "Rate Type": RateType.match(/.*\:(.*)/)[1].trim(),
            "Rate": Rate.replace("$", ""),
            "Term": Term.match(/.*\:(.*)/)[1].trim(),
            "Cancellation Fee": CancellationFee.match(/.*\:(.*)/)[1].trim(),
            "Offer Notes": "",
            "Renewable Blend": RenewableBlend.match(/.*\:(.*)/)[1].replace("%", "").trim(),
            "Additional Products & Services": Additional.trim().replace(/\n/g, ""),
            "Fee": Fee.match(/.*\:(.*)/)[1].trim(),
            "Fee Type": FeeType,
            "Fee Notes": "",
            "Other Notes": "",
            "Additional Products & Services": "",
            "Rate units": "$/kWh",
            "Termination Notes": "",
            // "zzPTC Rate": PTCRate.replace("$", ""),
            // "zzPTC Name": PTCName,
        });
        
        const pagePTCObject = {
            PTCRate: PTCRate,
            PTCName: PTCName,
            CustomerType: CustomerType,
            FeeType: FeeType
        };
    
        const found = PTCData.find(e => e.PTCRate === pagePTCObject.PTCRate && e.PTCName === pagePTCObject.PTCName);
    
        if (!found) PTCData.push(pagePTCObject);
    
        await Apify.setValue('ptc', PTCData);
    }

    //console.log(results);
    await dataset.pushData(results);
    await Apify.pushData(results);

    
 
};
