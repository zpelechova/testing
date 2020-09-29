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
    let PTCInfo = await page.$eval("div.main-container > div.main-left", e => e.innerText.trim().replace(/\n/g, "").match(/(.?)“Price to Compare” for the generation(.*)\/kWh.?\.\s+/)[0].trim());
    const PTCTerm = PTCInfo.match(/(.*)period of(.*)is/)[2].trim();
    const PTCRate = PTCInfo.match(/\.\d+/)[0].trim();

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
    // Header
    //SupplierCompanyName,CompanyName,SupplierAddress,SupplierAddress2,SupplierCity,SupplierState,SupplierZip,SupplierPhone,SupplierWebSiteUrl,TermsOfServiceURL,SignUpNowURL,Price,RateType,Renewable,IsIntroductoryOffer,IntroductoryOfferDetails,TermLength,EarlyTerminationFee,MonthlyFee,IsPromotionalOffer,PromotionalOfferDetails,OfferDetails
    /*[
  0 'SupplierCompanyName',
  1 'CompanyName',
  2 'SupplierAddress',
  3 'SupplierAddress2',
  4 'SupplierCity',
  5 'SupplierState',
  6 'SupplierZip',
  7 'SupplierPhone',
  8 'SupplierWebSiteUrl',
  9 'SignUpNowURL',
  10'Price',
  11'RateType',
  12'Renewable',
  13'IsIntroductoryOffer',
  14'IntroductoryOfferDetails',
  15'TermLength',
  16'EarlyTerminationFee',
  17'MonthlyFee',
  18'IsPromotionalOffer',
  19'PromotionalOfferDetails',
  20'OfferDetails'
]*/
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
            "Commodity": "Power",
            "State": "OH",
            "Customer Class": CustomerType,
            "Utility": utilityName,
            "Supplier": line.CompanyName,
            "Rate Category" : "",
            "Rate Type": line.RateType,
            "Rate": line.Price,
            "Term": line.TermLength,
            "Cancellation Fee": line.EarlyTerminationFee,
            "Offer Notes": line.OfferDetails.trim(),
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

        await dataset.pushData(
            {
                    "Date": (new Date()).toLocaleDateString("ISO"),
                    "Commodity": "Power",
                    "State": "OH",
                    "Customer Class": CustomerType,
                    "Utility": utilityName,
                    "Supplier": "",
                    "Rate Category" : "",
                    "Rate Type": "PTC",
                    "Rate": PTCRate,
                    "Term": PTCTerm,
                    "Cancellation Fee": "",
                    "Offer Notes": "",
                    "Fee": "",
                    "Fee Notes": FeeType,
                    "Fee Type": "",
                    "Other Notes": "",
                    "Additional Products & Services": "",
                    "Rate units": "$/kWh",
                    "Renewable blend": "",
                    "Termination Notes": ""
                }
        );

        await Apify.pushData(
            {
                    "Date": (new Date()).toLocaleDateString("ISO"),
                    "Commodity": "Power",
                    "State": "OH",
                    "Customer Class": CustomerType,
                    "Utility": utilityName,
                    "Supplier": "",
                    "Rate Category" : "",
                    "Rate Type": "PTC",
                    "Rate": PTCRate,
                    "Term": PTCTerm,
                    "Cancellation Fee": "",
                    "Offer Notes": "",
                    "Fee": "",
                    "Fee Notes": FeeType,
                    "Fee Type": "",
                    "Other Notes": "",
                    "Additional Products & Services": "",
                    "Rate units": "$/kWh",
                    "Renewable blend": "",
                    "Termination Notes": ""
                }
        )
    }
};

