const Apify = require('apify');
const { URL } = require('url');
const LABELS = {
    START: 'START',
    PAGE: 'PAGE',
}
const COUNTRY_TYPE = {
    CZ: 'CZ',
    SK: 'SK',
}

const { log } = Apify.utils;

// I'm using mobile version as it's more thin than normal one.
const ROOT_URL = 'https://aaaauto.cz/ojete-vozy';
const ROOT_URL_SK = 'https://www.aaaauto.sk/ojazdene-vozidla/';
const PAGINATION_SELECTOR = 'nav.pagenav li';
const OFFER_SELECTOR = '.card';
const CAR_NAME_SELECTOR = 'h2 a';
const FINAL_PRICE_SELECTOR = '.carPrice h3:not(.error,.primary)';
const ACTION_PRICE_SELECTOR = '.carPrice h3.error';
const STRIKE_PRICE_SELECTOR = '.carPrice .darkGreyAlt';
const DESCRIPTION_SELECTOR = '.carFeatures p';
const CAR_FEATURES_SELECTOR = '.carFeaturesList li';
const LIMIT = '50';

Apify.main(async () => {
    log.info('Starting AAAAuto prices scraper');

    const input = await Apify.getInput();
    const { country = COUNTRY_TYPE.CZ } = input;
    const requestQueue = await Apify.openRequestQueue();
    const rootUrl = country === COUNTRY_TYPE.CZ ? ROOT_URL : ROOT_URL_SK;
    await requestQueue.addRequest({
        url: `${rootUrl}?limit=${LIMIT}`,
        userData: {
            label: LABELS.START,
        }
    })
    const proxyConfiguration = await Apify.createProxyConfiguration({ groups: ['CZECH_LUMINATI'] });

    const crawler = new Apify.CheerioCrawler({
        requestQueue,
        proxyConfiguration,
        maxConcurrency : 1,
        handlePageFunction: async ({ request, $ }) => {
            log.info(`Scraping ${request.url}`);
            const { label } = request.userData;

            if (label === LABELS.START) {
                const pages = $(PAGINATION_SELECTOR);
                const lastPage = pages.eq(pages.length - 2).find('a').text().trim();
                await Array.from({ length: lastPage }, (_value, index) => index + 1)
                  .map(async pageNumber => { await requestQueue.addRequest({ url: `${rootUrl}?page=${pageNumber}&limit=${LIMIT}`, userData: { label: LABELS.PAGE, pageNumber } }) });

            } else if (label === LABELS.PAGE) {
                const offers = $(OFFER_SELECTOR).toArray();
                const data = [];
                for (const offer of offers) {
                    const $offer = $(offer);
                    const link = $offer.find('a.fullSizeLink').attr('href');
                    const figure = $offer.find('figure');
                    const url = new URL(link, rootUrl);
                    const itemId = url.searchParams.get('id');
                    const itemUrl = `${rootUrl}${url.pathname}?id=${itemId}`;
                    const itemName = $offer.find(CAR_NAME_SELECTOR).text().trim();
                    const arr = itemName.split(',');

                    const currentPrice = extractPrice($offer.find(FINAL_PRICE_SELECTOR).text());
                    const actionPrice = extractPrice($offer.find(ACTION_PRICE_SELECTOR).text());
                    const originalPrice = extractPrice($offer.find(STRIKE_PRICE_SELECTOR).text());

                    const description = $offer.find(DESCRIPTION_SELECTOR).text().trim();
                    const carFeatures = $offer.find(CAR_FEATURES_SELECTOR).toArray().map((feature) => {
                        return $(feature).text();
                    });

                    const [km, transmission, fuelType, engine] = carFeatures;

                    data.push({
                        itemUrl,
                        itemId,
                        description,
                        img: figure.length > 0 ? figure.find('img').attr('src') : null,
                        itemName: arr[0],
                        currentPrice,
                        originalPrice,
                        currency: country === COUNTRY_TYPE.CZ ? 'Kč' : 'Eur',
                        actionPrice,
                        discounted: !!originalPrice,
                        year: arr[1] ? arr[1] : undefined,
                        km, transmission, fuelType, engine
                    });

                }

                await Apify.pushData(data);

            }
        },
    });
    await crawler.run();

    log.info('Crawler finished.');
    const env = await Apify.getEnv();
    try {
        const run = await Apify.call(
            'blackfriday/uploader', {
                datasetId: env.defaultDatasetId,
                upload: true,
                actRunId: env.actorRunId,
                blackFriday: false,
                tableName: country !== 'CZ' ? 'aaaauto_sk' : 'aaaauto_cz'
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
        const run = await Apify.callTask(
            'blackfriday/status-page-store', {
                datasetId: env.defaultDatasetId,
                name: 'aaaauto_cz',
            }, {
                waitSecs: 25,
            },
        );
        console.log(`Status page called: ${run.id}`);
    } catch (e) {
        console.log(e);
    }
});


/**
 *
 * @param {String} string
 * @returns {undefined|number}
 */
function extractPrice(string) {
    const match = string.match(/[\d*\s]*\s[\Kč|€]/g);
    if (match && match.length > 0){
        const value = match[0]
          .replace(/\s/g, '')
          .replace('Kč', '')
          .replace('€', '')
          .replace('Cena', '');
        return parseInt(value);
    }
    return undefined;
}
