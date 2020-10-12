/**
 * This template is a production ready boilerplate for developing with `PuppeteerCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

const Apify = require('apify');
const { handleStart } = require('./routes');

const { utils: { log } } = Apify;

const PTCData = [];

Apify.main(async () => {
    const { startUrls, zip } = {
        "startUrls": [
          {
            "url": "https://www.papowerswitch.com/shop-for-electricity/shop-for-your-home?type=all&zip={zip}"
          },
          {
            "url": "https://www.papowerswitch.com/shop-for-electricity/shop-for-your-small-business?type=all&zip={zip}"
          }
        ],
        "zip": [
          "15212",
          "19601",
          "19019",
          "15521",
          "15237",
          "17501",
          "17320"
        ]
    };
    //const requestList = await Apify.openRequestList('start-urls', startUrls);
    const requestQueue = await Apify.openRequestQueue();
    for (let url of startUrls) {
        if (url.url.indexOf("{zip}") == -1) {
            throw new Error(`${url.url}: Nowhere to put ZIP code to`);
        }
        for (let zipCode of zip) {
            requestQueue.addRequest({
                url: url.url.replace("{zip}", zipCode),
                userData: {
                    zip: zipCode,
                    originalUrl: url.url
                }
            });
        }

    }

    const crawler = new Apify.PuppeteerCrawler({
        //requestList,
        requestQueue,
        useSessionPool: true,
        persistCookiesPerSession: true,
        launchPuppeteerOptions: {
            useApifyProxy: false,
            // Chrome with stealth should work for most websites.
            // If it doesn't, feel free to remove this.
            useChrome: true,
            stealth: true,
        },

        handlePageFunction: async (context, PTCData) => {
            const { url, userData: { label, zip, originalUrl } } = context.request;
            log.info('Page opened.', { label, url });
            await handleStart(context, requestQueue, zip, originalUrl);
        },
    });

    log.info('Starting the crawl.');
    await crawler.run();

    for (const ptc of PTCData) {
        const {PTCRate, PTCName, CustomerType, FeeType} = ptc;
        await Apify.pushData({
            "Date": (new Date()).toLocaleDateString("ISO"),
            "Commodity": "Power",
            "State": "OH",
            "Customer Class": CustomerType || "",
            "Utility": PTCName || "",
            "Supplier": "",
            "Rate Category": "",
            "Rate Type": "PTC",
            "Rate": PTCRate || "",
            "Term": "",
            "Cancellation Fee": "",
            "Offer Notes": "",
            "Fee": "",
            "Fee Notes": FeeType || "",
            "Fee Type": "",
            "Other Notes": "",
            "Additional Products & Services": "",
            "Rate units": "$/kWh",
            "Renewable blend": "",
            "Termination Notes": ""
        })};

    log.info('Crawl finished.');
});
