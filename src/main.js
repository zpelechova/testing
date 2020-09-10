/**
 * This template is a production ready boilerplate for developing with `PuppeteerCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

const Apify = require('apify');
const { handleBase } = require('./routes');

const {BLOCK_RESOURCES} = require("./config");

const { utils: { log } } = Apify;

Apify.main(async () => {
    const { baseUrl, zipCodes, customerClass } = {
        "baseUrl": "https://www.txu.com/view-plans.aspx?customerclassification=residential&cint=5&dwel={customerClass}&prom=PS&zip={zipCode}&tdsp=ER_AEPTNC&eLease=false",
        "zipCodes": [
          "78045",
          "76908",
          "77029",
          "75001",
          "75003",
          "78572"
        ],
        "customerClass": "home"
    };

    const requestQueue = await Apify.openRequestQueue();
    const customerClassVal = (customerClass == "home" ? "01" : "02");

    for (let zipCode of zipCodes) {
        let url = baseUrl.replace("{zipCode}", zipCode).replace("{customerClass}", customerClassVal);
        await requestQueue.addRequest({
            url,
            userData: {
                label: "BASE"
            }
        });
    }

    const crawler = new Apify.PuppeteerCrawler({
        requestQueue,
        useSessionPool: true,
        persistCookiesPerSession: true,
        launchPuppeteerOptions: {
            useApifyProxy: true,
            // Chrome with stealth should work for most websites.
            // If it doesn't, feel free to remove this.
            useChrome: true,
            stealth: true
        },
        gotoFunction: async ({request, page}) => {
            await Apify.utils.puppeteer.blockRequests(page, {
                urlPatterns: [
                    ...BLOCK_RESOURCES.analytics,
                    ...BLOCK_RESOURCES.patterns
                ]
            });
            return page.goto(request.url, {
                waitUntil: "domcontentloaded"
            });
        },
        handlePageFunction: async (context) => {
            const { url, userData: { label } } = context.request;
            log.info('Page opened.', { label, url });
            switch (label) {
                case 'BASE':
                    return handleBase(context);
                default:
                    throw new Error("Don't know how to process this");
            }
        },
    });

    log.info('Starting the crawl.');
    await crawler.run();
    log.info('Crawl finished.');
});
