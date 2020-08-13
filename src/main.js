const Apify = require("apify");
const {
    utils: { log }
} = Apify;
const { saveData, parseFromElement } = require("./helpers");
const { PendingXHR } = require("pending-xhr-puppeteer");

const SITE_URL = "https://constellationrates.com/compare-plans/%zipCode%";

Apify.main(async () => {
    const input = await Apify.getInput();

    const urls = [];
    for (const zipCode of input) {
        for (const key of ["zip", "zip2"]) {
            if (key in zipCode) {
                const url = SITE_URL.replace("%zipCode%", zipCode[key]);
                const urlData = {
                    url: url,
                    uniqueKey: `${url}:${zipCode[key]}`,
                    userData: {
                        zipCode: {
                            state: zipCode.state,
                            zip: zipCode[key]
                        }
                    }
                };

                urls.push(urlData);
            }
        }
    }

    const requestList = await Apify.openRequestList("start-urls", urls);
    const requestQueue = await Apify.openRequestQueue();

    const crawler = new Apify.PuppeteerCrawler({
        requestList,
        requestQueue,
        useSessionPool: true,
        persistCookiesPerSession: true,
        launchPuppeteerOptions: {
            useApifyProxy: false
        },
        handlePageFunction: async context => {
            const { page } = context;
            const { url, userData } = context.request;

            // Electricity
            await scrapeUtilities({
                additionalData: { Commodity: "energy" },
                ...context
            });

            // Gas
            const gasLink = await page.$("#container>h4>a:first-child");
            if (gasLink) {
                await gasLink.click();
                await page.waitFor(1000);

                await scrapeUtilities({
                    additionalData: { Commodity: "gas" },
                    ...context
                });
            }
        }
    });

    await crawler.run();
});

const scrapeUtilities = async context => {
    const utilitySelector = "#utility";
    const {
        page,
        request: { userData }
    } = context;
    try {
        await page.waitForSelector(utilitySelector);
    } catch (e) {
        log.error(`No utilities for ZIP: ${userData.zipCode.zip}`);
        return;
    }

    const selectItems = await page.$$(`${utilitySelector} option`);
    for (const option of selectItems) {
        const value = await option.evaluate(node => node.value);
        const text = await option.evaluate(node => node.innerText);
        await page.select(utilitySelector, value);

        await scrapePackages(text, context);
    }
};

const scrapePackages = async (utility, context) => {
    const {
        page,
        additionalData: { Commodity },
        request: { userData }
    } = context;

    try {
        await page.waitForSelector('#formContainer', {visible: true, timeout: 1000});
        log.error(`No data for utility: ${utility} for ZIP: ${userData.zipCode.zip}`);
        return;
    }catch (e) {

    }


    let packages = [];
    if (Commodity === "gas") {
        packages = await page.$$(".productRow");
    } else {
        packages = await page.$$("#packages>div");
    }

    for (const offer of packages) {
        await scrapeOne(offer, utility, context);
    }
};

const scrapeOne = async (offer, utility, context) => {
    const { page, request, additionalData } = context;
    const { userData } = request;
    const optionalData = {};
    const rateCostElement = await offer.$(".rateCost");
    const rateSiblings = await rateCostElement.$x("preceding-sibling::*");
    if (rateSiblings.length) {
        const rateText = await rateSiblings[0].evaluate(node => node.innerText);
        const rateMatch = rateText.match(/per (\S+)/);
        if (rateMatch && rateMatch[1]) {
            optionalData["Rate Units"] = rateMatch[1];
        }
    }

    const rateCost = (await rateCostElement.evaluate(
        node => node.innerText
    )).replace("¢", "");
    const term = await parseFromElement(offer, ".termLength", /(\d+)/, 1);
    const planDetailsContent = await offer.$('*[id*="planDetailsContent"]');
    try {
        const offerNotes = await planDetailsContent.$eval(
            "p",
            node => node.innerText
        );
        optionalData["Offer Notes"] = offerNotes;
    } catch (e) {}

    if (optionalData["Offer Notes"]) {
        const rateType = optionalData["Offer Notes"].match(/(\w+) rate plan/);
        if (rateType && rateType[1]) {
            optionalData["Rate Type"] = rateType[1];
        }
    }

    const data = {
        Utility: utility,
        Rate: rateCost,
        Term: parseFloat(term),
        ...additionalData,
        ...optionalData
    };

    await saveData(data, userData.zipCode);
};

const waitForRedraw = async (page, changeFunction, timeout = 500) => {
    const pendingXHR = new PendingXHR(page);
    await changeFunction();
    await pendingXHR.waitForAllXhrFinished();
    await page.waitFor(timeout);
};
