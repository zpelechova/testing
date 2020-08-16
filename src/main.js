/**
 * This template is a production ready boilerplate for developing with `CheerioCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

const Apify = require('apify');
const { handleBase, handleDetail } = require('./routes');

const { utils: { log } } = Apify;

Apify.main(async () => {
    const  startUrls = [
        {
          "url": "https://www.icc.illinois.gov/ags/products.aspx?said=1&mid=S",
          "userData": {
            "label": "BASE"
          }
        },
        {
          "url": "https://www.icc.illinois.gov/ags/products.aspx?said=2&mid=S",
          "userData": {
            "label": "BASE"
          }
        },
        {
          "url": "https://www.icc.illinois.gov/ags/products.aspx?said=3&mid=S",
          "userData": {
            "label": "BASE"
          }
        },
        {
          "url": "https://www.icc.illinois.gov/ags/products.aspx?said=1&mid=R",
          "userData": {
            "label": "BASE"
          }
        },
        {
          "url": "https://www.icc.illinois.gov/ags/products.aspx?said=2&mid=R",
          "userData": {
            "label": "BASE"
          }
        },
        {
          "url": "https://www.icc.illinois.gov/ags/products.aspx?said=3&mid=R",
          "userData": {
            "label": "BASE"
          }
        }
      ]

    const requestList = await Apify.openRequestList('start-urls', startUrls);
    const requestQueue = await Apify.openRequestQueue();

    const crawler = new Apify.CheerioCrawler({
        requestList,
        requestQueue,
        useApifyProxy: false,
        useSessionPool: true,
        persistCookiesPerSession: true,
        // Be nice to the websites.
        // Remove to unleash full power.
        maxConcurrency: 50,
        // You can remove this if you won't
        // be scraping any JSON endpoints.
        additionalMimeTypes: [
            'application/json',
        ],
        handlePageFunction: async (context) => {
            const { url, userData: { label } } = context.request;
            log.info('Page opened.', { label, url });
            switch (label) {
                case 'BASE':
                    return handleBase(context, requestQueue, url);
                case 'DETAIL':
                    return handleDetail(context);
                default:
                    throw new Error("Unexpected label");
            }
        },
    });

    log.info('Starting the crawl.');
    await crawler.run();
    log.info('Crawl finished.');
});
