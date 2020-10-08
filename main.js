const Apify = require('apify');

const { log } = Apify.utils;
const BASE_URL = 'https://www.kosik.cz/';
const BF = 'BF';
const LABELS = {
    START: 'START',
    NAV_URLS: 'NAV_URLS',
    PAGE: 'PAGE',
};

async function enqueuRequests(requestQ, items) {
    for (const item of items) {
        await requestQ.addRequest(item);
    }
}

async function addPagination($, requestQueue, request) {
    if (request.url.search(/\/listy\/black-friday\//g) === -1) {
        if ($('[data-tid="product-list"] .product-box').length !== 0) {
            const pageNumber = request.userData.page + 1;
            const paginationUrl = `${request.userData.rawUrl}/${pageNumber}`;
            console.log(`Adding to the queue ${paginationUrl}`);
            await requestQueue.addRequest({
                url: paginationUrl,
                userData: {
                    label: LABELS.PAGE,
                    rawUrl: request.userData.rawUrl,
                    page: pageNumber,
                },
            });
        } else {
            log.info(`No more items on the site ${request.url}`);
        }
    }
}

async function extractItems($) {
    let products = 0;
    const breadcrumbs = [];

    try {
        $('.breadcrumps > a').each(function () {
            breadcrumbs.push($(this).text().trim());
        });
    } catch (error) {
        log.error('Could not get breadcrumbs');
    }
    // console.log(breadcrumbs);
    const resultItems = [];

    try {
        $('[data-tid="product-list"] .product-box').each(function () {
            const result = {
                itemId: null,
                itemUrl: null,
                itemName: null,
                discounted: false,
                currentPrice: null,
                originalPrice: null,
                category: breadcrumbs, // array of breadcrumbs
            };
            // console.log($(this).attr('data-product-id'));
            const id = parseInt($(this).attr('data-product-id'));
            const title = $(this).find('h3').text().trim();
            const path = $(this).find('a.js-product__detail').attr('href');
            const discountedName = $(this).find('.a-product-label--sale')
                .text()
                .trim()
                .slice(0, -1);
            const pricePerUnit = $(this).find('.price__unit-per-price').text();
            const currentPrice = parseFloat($(this).find('[itemprop="price"]').attr('content'));
            const originalPrice = $(this).find('.price__old-price').eq(0).text().length !== 0 ? parseFloat($(this).find('.price__old-price').eq(0).text().replace(/(Kč|\s)/g, '')
                .replace(',', '.')
                .trim()) : null;
            if (id) {
                result.itemId = id;
            }
            if (pricePerUnit) {
                result.pricePerUnit = pricePerUnit;
            }
            if (title) {
                result.itemName = title;
            }
            if (path) {
                result.itemUrl = path.indexOf('https') === -1 ? `${BASE_URL}${path}` : path;
            }
            if (originalPrice > currentPrice) {
                result.discounted = true;
                result.currentPrice = currentPrice;
                result.originalPrice = originalPrice;
            } else {
                result.currentPrice = currentPrice;
            }
            if ($(this).find('.product-box__head img') !== 0) {
                const src = $(this).find('.product-box__head img').data('srcset');
                const images = src.split(' ');
                if (images.length > 0) {
                    result.img = images[0];
                }
            }

            result.discountedName = discountedName;
            // Apify.pushData(RESULTS);
            resultItems.push(result);
            products += 1;
        });
        await Apify.pushData(resultItems);
    } catch (error) {
        log.error('Product Item Disabled');
    }

    const title = $('title').text().split('|')[0].trim();
    log.info(`Found ${products} on ${title}`);
}

Apify.main(async () => {
    const { type } = await Apify.getInput();
    // Declare base Url
    const requestQueue = await Apify.openRequestQueue();
    if (type === BF) {
        await requestQueue.addRequest({
            url: 'https://www.kosik.cz/listy/black-friday',
            userData: {
                label: LABELS.NAV_URLS,
            },
        });
    } else {
        await requestQueue.addRequest({
            url: BASE_URL,
            userData: {
                label: LABELS.START,
            },
        });
    }

    // Create Crawler
    const crawler = new Apify.CheerioCrawler({
        requestQueue,
        useApifyProxy: true,
        apifyProxyGroups: ['CZECH_LUMINATI'],
        maxConcurrency: 10,
        handlePageFunction: async ({ $, request }) => {
            if (request.userData.label === LABELS.START) {
                console.log(`Evaluating ${request.url}`);
                const navUrls = [];
                $('.a-nav-top__item a').each(function () {
                    const link = BASE_URL.slice(0, -1) + $(this).attr('href');
                    navUrls.push({
                        url: link,
                        userData: {
                            label: LABELS.NAV_URLS,
                            page: 1,
                            rawUrl: link,
                        },
                    });
                });
                log.info(`Found ${navUrls.length} on START`);
                await enqueuRequests(requestQueue, navUrls);
            } else if (request.userData.label === LABELS.NAV_URLS) {
                const menuItems = [];
                if ($('.header-navigation__subcategory__button').length !== 0) {
                    $('.header-navigation__subcategory__button').each(function () {
                        const sourceCategory = $(this).text().trim();
                        const urlProp = $(this).attr('href') ? $(this).attr('href') : null;
                        if (urlProp) {
                            const menuItem = {
                                sourceCategory,
                            };
                            if (urlProp.indexOf('https://kosik.cz') === -1) {
                                menuItem.url = `${BASE_URL}${urlProp}`;
                            } else {
                                menuItem.url = urlProp;
                            }
                            menuItems.push({
                                url: menuItem.url,
                                userData: {
                                    label: LABELS.NAV_URLS,
                                    category: menuItem.sourceCategory,
                                    page: 1,
                                    rawUrl: menuItem.url,
                                },
                            });
                        }
                        // console.log(sourceCategory,$(this).attr('href'));
                    });

                    log.info(`Found ${menuItems.length} Sub categories on ${request.url}`);
                    await enqueuRequests(requestQueue, menuItems);
                } else {
                    await extractItems($);
                    await addPagination($, requestQueue, request);
                }
            } else if (request.userData.label === LABELS.PAGE) {
                await extractItems($);
                await addPagination($, requestQueue, request);
            }
        },
        // If request failed 4 times then this function is executed.
        handleFailedRequestFunction: async ({ request }) => {
            log.error(`Request ${request.url} failed 4 times`);
        },
    });

    await crawler.run();

    // stats page
    try {
        const env = await Apify.getEnv();
        const run = await Apify.callTask(
            'blackfriday/status-page-store', {
                datasetId: env.defaultDatasetId,
                name: type !== 'FULL' ? 'kosik-cz-bf' : 'kosik-cz',
            }, {
                waitSecs: 25,
            },
        );
        console.log(`Keboola upload called: ${run.id}`);
    } catch (e) {
        console.log(e);
    }

    try {
        const env = await Apify.getEnv();
        const run = await Apify.call(
            'blackfriday/uploader', {
                datasetId: env.defaultDatasetId,
                upload: true,
                actRunId: env.actorRunId,
                blackFriday: type !== 'FULL',
                tableName: type !== 'FULL' ? 'kosik_bf' : 'kosik',
            }, {
                waitSecs: 25,
            },
        );
        console.log(`Keboola upload called: ${run.id}`);
    } catch (e) {
        console.log(e);
    }
    console.log('Finished.');
});
