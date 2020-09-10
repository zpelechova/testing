const Apify = require('apify');

const { SELECTORS } = require("./config");

const { utils: { log } } = Apify;

exports.handleBase = async ({ request, page }) => {
    const dataset = await Apify.openDataset('powermatrix');
    await page.waitForSelector(SELECTORS.PLAN_AREA);
    let plans = await page.$$(SELECTORS.PLAN_AREA);
    var results = [];
    for (let plan of plans) {
        const vendor = await plan.$eval(SELECTORS.VENDOR, elem => elem.innerText);
        let term = await plan.$eval(SELECTORS.TERM, elem => elem.innerText);
        term = term.trim().split("\n").join(" ");
        let result = {
            Date: (new Date()).toLocaleDateString("ISO"),
            State: "TX",
            "Customer Type": "Residential",
            Utility: vendor,
            Supplier: vendor,
            Rate: await plan.$eval(SELECTORS.RATE, elem => elem.innerText),
            Term: term,
            "Cancellation Fee": await plan.$eval(SELECTORS.CANCELLATION_FEE, elem => elem.innerText)
        }
        //console.log(result);
        results.push(result);
    }

    await dataset.pushData(results);
    await Apify.pushData(results);
};
