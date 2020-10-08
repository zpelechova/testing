const Apify = require('apify');

const { utils: { log } } = Apify;

const { LABEL, SELECTOR } = require("./config");

const request_promise = require('request-promise');

const csv = require("csv-string");

const fs = require("fs");

const csvToJson = (csv) => {
    const header = csv[0];
    const data = csv.slice(1);
    var csvJSON = [];
    data.map(line => {
        var lineJSON = {};
        line.map((cval, cid) => {
            lineJSON[header[cid]] = cval;
        });
        csvJSON.push(lineJSON);
    });
    return csvJSON;
}

exports.handleBase = async ({ request, page }, requestQueue) => {
    // open js links
    await page.hover(SELECTOR.HOVER_TYPE_FIRST);
    await page.$$eval(SELECTOR.MORE_OPENER, (el => el.map(e => e.click())));
    await page.hover(SELECTOR.HOVER_TYPE_SECOND);
    await page.$$eval(SELECTOR.MORE_OPENER, (el => el.map(e => e.click())));
    //await page.hover(SELECTOR.HOVER_TYPE_FIRST);
    //const links = await page.$$eval(SELECTOR.UTILITIES, (els => els.map(e => e.href)));
    await Apify.utils.enqueueLinks({
        page,
        requestQueue,
        selector: SELECTOR.UTILITIES,
        transformRequestFunction: request => {
            request.userData.label = LABEL.UTILITY;
            return request;
        }
    });
};

exports.handleUtility = async ({ request, page }) => {
    const dataset = await Apify.openDataset('powermatrix');
    await page.waitForSelector(SELECTOR.EXPORT_CSV);

    const CustomerType = await page.$eval("#ctl00_ContentPlaceHolder1_upOffers > div.search-resultbreadcrumb > strong", e => e.innerText.match(/.?\:(.*)/)[1].trim());
    const utilityName = await page.$eval("div.main-container div.main-left h3", e => e.innerText.trim());
    let PTCInfo = await page.$eval("div.main-container > div.main-left", e => e.innerText.trim().replace(/\n/g, "").text().match(/(.?)rate is\s+\$\d\.\d+(.*)\d+/)[0].trim());
    const PTCTerm = PTCInfo.match(/(.*)\-\sEffective(.*)\,/)[2].trim();
    const PTCRate = PTCInfo.match(/\d\.\d+/)[0].trim();
    const PTCUnit = PTCInfo.match(/per\s[a-zA-Z]+/)[0].trim();

    await page.setRequestInterception(true);
    await page.click(SELECTOR.EXPORT_CSV);
    const xRequest = await new Promise(resolve => {
        page.on('request', interceptedRequest => {
            interceptedRequest.abort();
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

    /* add the cookies */
    const cookies = await page.cookies();
    options.headers.Cookie = cookies.map(ck => ck.name + '=' + ck.value).join(';');

    /* resend the request */
    const response = await request_promise(options);
    
    let response_content = response.toString();
    let csv_content = csv.parse(response_content);
    //fs.writeFileSync("test.csv", response_content, err => console.log(err));
    csvJSON = csvToJson(csv_content);

    for (line of csvJSON) {
        // skip header
        let FeeType;
        if (line.MonthlyFee != 0) { FeeType = "Monthly" } else FeeType = "";
        let result = {
            "Date": (new Date()).toLocaleDateString("ISO"),
            "Commodity": "Gas",
            "State": "OH",
            "Customer Type": CustomerType,
            "Utility": utilityName,
            "Supplier": line.CompanyName,
            "Rate Category" : "",
            "Rate Type": line.RateType,
            "Rate": line.Price,
            "Term": line.TermLength,
            "Cancellation Fee": line.EarlyTerminationFee,
            "Offer Notes": line.OfferDetails,
            "Fee": line.MonthlyFee,
            "Fee Notes": FeeType,
            "Fee Type": line.IntroductoryOfferDetails.trim(),
            "Other Notes": "",
            "Additional Products & Services": line.PromotionalOfferDetails.trim(),
            "Rate units": "$/kWh",
            "Renewable blend": line.Renewable,
            "Termination Notes": ""
        }
        //console.log(result);
        await dataset.pushData(result);
        await Apify.pushData(result);

        const pagePTCObject = {
            PTCRate: PTCRate,
            PTCTerm: PTCTerm,
            PTCUnit: PTCUnit.replace("per ", ""),
            utilityName: utilityName,
            CustomerType: CustomerType,
            FeeType: FeeType
        };

        const found = PTCData.find(e => e.PTCRate === pagePTCObject.PTCRate && e.PTCTerm === pagePTCObject.PTCTerm && e.utilityName === pagePTCObject.utilityName);

        if (!found) PTCData.push(pagePTCObject);

        await Apify.setValue('ptc', PTCData);

    }
};