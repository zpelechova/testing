// This is the main Node.js source code file of your actor.
// It is referenced from the "scripts" section of the package.json file,
// so that it can be started by running "npm start".

// Import Apify SDK. For more information, see https://sdk.apify.com/
const Apify = require('apify');
const request = require("request-promise");

const SELECTOR = {
    ELECTRIC: "offer-summary-popup > div > div > div.incumbent-utility-selector > div:nth-child(1) > button",
    DATASET: "div.footer-container a.dataset",
    ACTIVE_OFFERS: "div.offers table.table.dataset button.btn-activeoffers"
};

Apify.main(async () => {
    // Get input of the actor (here only for demonstration purposes).
    // If you'd like to have your input checked and have Apify display
    // a user interface for it, add INPUT_SCHEMA.json file to your actor.
    // For more information, see https://apify.com/docs/actor/input-schema
    const input = {
        "url": "http://documents.dps.ny.gov/PTC/zipcode/14646"
    };
    console.log('Input:');
    console.dir(input);

    if (!input || !input.url) throw new Error('Input must be a JSON object with the "url" field!');

    const dataset = await Apify.openDataset('powermatrix');
    const store = await Apify.openKeyValueStore();

    console.log('Launching Puppeteer...');
    const browser = await Apify.launchPuppeteer();

    console.log(`Opening page ${input.url}...`);
    const page = await browser.newPage();
    await page.goto(input.url);
    await page.waitForSelector("#acceptOverlay");
    await page.click("#acceptOverlay");
    await page.waitForSelector("#scrollDown");
    await page.click("#scrollDown");
    await page.waitFor(2000);
    await page.click("#acceptOverlay");
    await page.waitForSelector(SELECTOR.ELECTRIC);
    await page.click(SELECTOR.ELECTRIC);
    await page.waitForSelector(SELECTOR.DATASET);
    await page.click(SELECTOR.DATASET);
    await page.waitFor(2000);
    await page.waitForSelector(SELECTOR.ACTIVE_OFFERS);
    await page.setRequestInterception(true);
    page.click(SELECTOR.ACTIVE_OFFERS);
    const xRequest = await new Promise(resolve => {
        page.on('request', interceptedRequest => {
            interceptedRequest.abort();     //stop intercepting requests
            resolve(interceptedRequest);
        });
    });

    const options = {
        encoding: null,
        method: xRequest._method,
        uri: xRequest._url,
        body: xRequest._postData,
        headers: xRequest._headers
    }
    const cookies = await page.cookies();
    options.headers.Cookie = cookies.map(ck => `${ck.name}=${ck.value}`).join(";");

    const response = await request(options);
    const json_content = JSON.parse(response.toString());
    const csv = objToCsv(json_content)
    await store.setValue('14646.csv', csv, {contentType: 'text/csv'});
    const results = [];
    for (const line of json_content) {
        const rate = line.RATE.split(' ');
        const term = parseInt(line.MINIMUM_TERM.replace(' Month(s)', ''));
        const cancFee = line.CANCELLATION_FEE ? line.CANCELLATION_FEE.match(/\$([0-9]+\.?[0-9]*)/) : null;
        let result = {
            "Date": (new Date()).toLocaleDateString("ISO"),
            "State": "NY",
            "Utility": line.UTILITY,
            "Supplier": line.ESCO,
            "Rate Type": line.OFFER_TYPE,
            "Commodity": line.COMMODITY === 'ELECTRIC' ? 'Power' : 'Gas',
            "Rate Category": null,
            "Rate": parseFloat(rate[0]),
            "Rate Unit": rate[1],
            "Term": term,
            "Cancellation Fee": cancFee ? parseInt(cancFee[1]) : null,
            "Renewable Blend": Number(line.PERCENTAGE_RENEWABLE) * 100,
            "Offer Notes": line.COMMENTS,
            "Additional Products & Services": null,
            "Fee": null,
            "Fee Type": line.CANCELLATION_FEE,
            "Fee Notes": null,
            "Termination Notes": line.CANCELLATION_FEE,
            "Other": line.LOAD_ZONE,
            // "Csv copy": await store.getPublicUrl('14646.csv')
        }

        results.push(result);
    }

    await dataset.pushData(results);
    await Apify.pushData(results);
    console.log('Closing Puppeteer...');
    await browser.close();

    console.log('Done.');
});

function objToCsv(obj) {
    const replacer = (key, value) => value === null ? '' : value
    const header = Object.keys(obj[0])
    let csv = obj.map(row => header.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(','))
    csv.unshift(header.join(','))
    csv = csv.join('\r\n');
    return csv
}
