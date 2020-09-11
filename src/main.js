const Apify = require('apify');
const { handleStart, handleList, handleDetail } = require('./routes');

const { utils: { log } } = Apify;

Apify.main(async () => {
 
    const requestQueue = await Apify.openRequestQueue();
    await requestQueue.addRequest({ url: "https://potravinydomov.itesco.sk/groceries/sk-SK/" });
    // await requestQueue.addRequest({ url: "https://nakup.itesco.cz/groceries/cs-CZ/" });

    const crawler = new Apify.CheerioCrawler({
        requestQueue,
        useApifyProxy: true,
        useSessionPool: true,
        persistCookiesPerSession: true,
        maxConcurrency: 5,
        handlePageTimeoutSecs:600,
       
        handlePageFunction: async (context) => {
            const { url, userData: { label } } = context.request;
            console.log('Page opened.', { label, url });
            log.info('Page opened.', { label, url });
            switch (label) {
                case 'LIST':
                    return handleList(context);
                case 'DETAIL':
                    return handleDetail(context);
                default:
                    return handleStart(context);
            }
        },
    });

    log.info('Starting the crawl.');
    await crawler.run();
    log.info('Crawl finished.');
});
