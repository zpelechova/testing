const Apify = require('apify');

const { SELECTORS } = require("./config");

const { utils: { log } } = Apify;

exports.handleBase = async ({ request, page }) => {
    const dataset = await Apify.openDataset('powermatrix');
    await page.waitForSelector(SELECTORS.PLAN_AREA);
    let plans = await page.$$(SELECTORS.PLAN_AREA);
    var results = [];

    var NUMERIC_REGEXP = /[-]{0,1}[\d]*[.]{0,1}[\d]+/g;

    for (let plan of plans) {
        const vendor = await plan.$eval(SELECTORS.VENDOR, elem => elem.innerText);
        let term = await plan.$eval(SELECTORS.TERM, elem => elem.innerText);
        term = term.trim().split("\n").join(" ");
        rate_dirty =  await plan.$eval(SELECTORS.RATE, elem => elem.innerText);
        cancellationFee = await plan.$eval(SELECTORS.CANCELLATION_FEE, elem => elem.innerText);
        let result = {
            "Additional Products & Services": '',
            Commodity: "Power",
            Fee: '',
            "Fee Notes": "",
            "Fee Type" : '',
            "Offer Notes": '',
            "Other Notes": url,
            "Rate Category": '',
            "Rate Type": '',
            "Rate Units": 'kWh',
            "Renewable Blend": '',
            "Termination Notes": '',
            Date: (new Date()).toLocaleDateString("ISO"),
            State: "TX",
            "RateType": "Residential",
            Utility: vendor,
            Supplier: vendor,
            Rate: Number(rate_dirty.match(NUMERIC_REGEXP)) / 100,
            Term: term,
            "Cancellation Fee": cancellationFee.match(NUMERIC_REGEXP)
        }
        //console.log(result);
        results.push(result);
    }

    await dataset.pushData(results);
    await Apify.pushData(results);
};
