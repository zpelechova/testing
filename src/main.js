/**
 * This template is a production ready boilerplate for developing with `PuppeteerCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

const Apify = require('apify');
const { handleBase, handleUtility } = require('./routes');

const { utils: { log } } = Apify;

const { LABEL, BLOCK_RESOURCES } = require("./config");

const PTCData = [];

Apify.main(async () => {
    const { startUrls } = {
        "startUrls": [
          {
            "url": "http://www.energychoice.ohio.gov/ApplesToApplesCategory.aspx?Category=NaturalGas",
            "method": "GET",
            "userData": {
              "label": "BASE"
            }
          }
        ]
    };

    const requestList = await Apify.openRequestList('start-urls', startUrls);
    const requestQueue = await Apify.openRequestQueue();¨
    const proxyConfiguration = await Apify.createProxyConfiguration(
        {
            groups: ['SHADER'],
            countryCode: 'US'
        }
    );

    const crawler = new Apify.PuppeteerCrawler({
        requestList,
        proxyConfiguration,
        requestQueue,
        useSessionPool: true,
        persistCookiesPerSession: true,
        launchPuppeteerOptions: {
            // useApifyProxy: true,
            // Chrome with stealth should work for most websites.
            // If it doesn't, feel free to remove this.
            useChrome: true,
            stealth: true,
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
                case LABEL.BASE:
                    return handleBase(context, requestQueue);
                case LABEL.UTILITY:
                    return handleUtility(context);
                default:
                    throw new Error("Don't know what to do with this");
            }
        },
    });

    log.info('Starting the crawl.');
    await crawler.run();
    for (const ptc of PTCData) {
        const {PTCRate, PTCTerm, PTCUnit, utilityName, CustomerType, FeeType} = ptc;
        await Apify.pushData({
            "Date": (new Date()).toLocaleDateString("ISO"),
            "Commodity": "Power",
            "State": "OH",
            "Customer Class": CustomerType || "",
            "Utility": utilityName || "",
            "Supplier": "",
            "Rate Category": "",
            "Rate Type": "PTC",
            "Rate": PTCRate || "",
            "Term": PTCTerm || "",
            "Cancellation Fee": "",
            "Offer Notes": "",
            "Fee": "",
            "Fee Notes": FeeType || "",
            "Fee Type": "",
            "Other Notes": "",
            "Additional Products & Services": "",
            "Rate units": PTCUnit,
            "Renewable blend": "",
            "Termination Notes": ""
        })};
    log.info('Crawl finished.');
});
