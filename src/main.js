const Apify = require('apify');
const _ = require('underscore');
const { COUNTRY, LABELS, STARTURLS } = require('./consts');
const { flat, ExtractItems, findArraysUrl, formatPrice, getProductImage } = require('./tools');

const stats = {
    offers: 0,
};

const uniqueItems = new Set();

const { log } = Apify.utils;


Apify.main(async () => {
    const { country = COUNTRY.CZ, debugLog = false, test } = await Apify.getInput();
    const requestQueue = await Apify.openRequestQueue();
    const url = country === COUNTRY.CZ ? STARTURLS.CZ : STARTURLS.SK;
    if (debugLog) {
        Apify.utils.log.setLevel(Apify.utils.log.LEVELS.DEBUG);
    }
    await requestQueue.addRequest({
        url,
        userData: {
            label: LABELS.START,
        },
    });

    /*    await requestQueue.addRequest({
        url: 'https://nakup.itesco.cz/groceries/cs-CZ/shop/ovoce-a-zelenina/ovoce/all',
        userData: {
            label: 'PAGINATION',
        },
    }); */

    const persistState = async () => {
        console.log(stats);
    };
    Apify.events.on('persistState', persistState);

    const proxyConfiguration = await Apify.createProxyConfiguration({
        groups: ['CZECH_LUMINATI'],
    });
    const crawler = new Apify.CheerioCrawler({
        requestQueue,
        maxConcurrency: 10,
        maxRequestRetries: 5,
        proxyConfiguration,
        handlePageTimeoutSecs: 60,
        requestOptions: {
            ignoreSslErrors: true,
        },

        handlePageFunction: async ({ $, request }) => {
            log.info(`Processing ${request.url}, ${request.userData.label}`);
            if (request.userData.label === LABELS.START) {
                const script = $('body').attr('data-redux-state');
                const urlsCatHtml = JSON.parse(script);

                const startUrls = await findArraysUrl(urlsCatHtml, country);
                log.debug(`Found ${startUrls.length} on ${request.userData.label}`);
                for (const item of startUrls) {
                    await requestQueue.addRequest({
                        url: item.url,
                        userData: {
                            label: LABELS.PAGE,
                        },
                    });
                }
            } else if (request.userData.label === LABELS.PAGE) {
                try {
                    if ($('.pagination--page-selector-wrapper ul li').eq(-2)) {
                        const lastPage = $('.pagination--page-selector-wrapper ul li').eq(-2).text();
                        const parsedLastPage = parseInt(lastPage);
                        if (parsedLastPage > 1 && request.url.indexOf('?page=') === -1) {
                            const pagesArr = _.range(2, parsedLastPage + 1);
                            for (const page of pagesArr) {
                                const nextPageUrl = `${request.url}?page=${page}`;
                                await requestQueue.addRequest({
                                    url: nextPageUrl,
                                    userData: {
                                        label: LABELS.PAGINATION,
                                    },
                                });
                            }
                        }
                    }
                    const requestQueue = await Apify.openRequestQueue();
                    //add detail pages of all products on the page to requestQueue
                    const links = $(".product-list").map(function () { return $(this).find('a').attr('href'); }).get();
                    for (let link of links) {
                        const absoluteLink = urlClass.resolve(request.url, link);
                        await requestQueue.addRequest({
                            url: absoluteLink,
                            userData: { label: 'DETAIL' },
                        });
                        // const items = await ExtractItems($, country, uniqueItems, stats, request);
                        // log.debug(`Found ${items.length} storing them, ${request.url}`);
                        // await Apify.pushData(items);
                    }
                } catch (e) {
                    // no items on the page check it out
                    log.debug(`Check this url, there are no items ${request.url}`);
                    await Apify.pushData({
                        status: 'Check this url, there are no items',
                        url: request.url,
                    });
                }
            } else if (request.userData.label === LABELS.PAGINATION) {
                try {
                    // const items = await ExtractItems($, country, uniqueItems, stats, request);
                    // log.debug(`Found ${items.length} storing them, ${request.url}`);
                    // await Apify.pushData(items);
                } catch (e) {
                    // no items on the page check it out
                    log.debug(`Check this url, there are no items ${request.url}`);
                    await Apify.pushData({
                        status: 'Check this url, there are no items',
                        url: request.url,
                    });
                }
            }
        },

        handleFailedRequestFunction: async ({ request }) => {
            log.error(`Request ${request.url} failed 4 times`);
        },
    });
    await crawler.run();
    await persistState();

    if (!test) {
        // calling the keboola upload
        try {
            const env = await Apify.getEnv();
            const run = await Apify.call(
                'blackfriday/uploader', {
                    datasetId: env.defaultDatasetId,
                    upload: true,
                    actRunId: env.actorRunId,
                    blackFriday: false,
                    tableName: country === COUNTRY.CZ ? 'itesco' : 'itesco_sk',
                }, {
                    waitSecs: 25,
                },
            );
            console.log(`Keboola upload called: ${run.id}`);
        } catch (e) {
            console.log(e);
        }

        // stats page
        try {
            const env = await Apify.getEnv();
            const run = await Apify.callTask(
                'blackfriday/status-page-store', {
                    datasetId: env.defaultDatasetId,
                    tableName: country === COUNTRY.CZ ? 'itesco' : 'itesco_sk',
                }, {
                    waitSecs: 25,
                },
            );
            console.log(`stats upload called: ${run.id}`);
        } catch (e) {
            console.log(e);
        }
    }
});
