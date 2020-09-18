const Apify = require('apify');
const sites = require('./src/sites');

const { log } = Apify.utils;

Apify.main(async () => {
    const input = await Apify.getInput();
    const requestQueue = await Apify.openRequestQueue();

    const urls = [];
    const proxyUrls = [];
    for (const site of sites.data) {
        if ("only" in input && !input["only"].includes(site.name)) {
            continue;
        }

        for (const zipCode of input.zipCodes) {
            for (const key of ["zip", "zip2"]) {
                if (key in zipCode) {
                    const url = site.url.replace('%zipCode%', zipCode[key])
                    const urlData = {
                        url: url,
                        uniqueKey: `${url}:${zipCode[key]}`,
                        userData: {
                            zipCode: {
                                state: zipCode.state,
                                zip: zipCode[key]
                            },
                            site: site
                        }
                    };

                    if (site.usesProxy) {
                        proxyUrls.push(urlData);
                    } else {
                        urls.push(urlData);
                    }
                }
            }
        }
    }

    const handlePage = async (context) => {
        const {userData: {site}} = context.request;

        try {
            return await sites.handle(site.name, {...context, requestQueue});
        } catch (e) {
            log.error(`handleSite failed: ${site.name}, zip: ${context.request.userData.zipCode.zip}`);
            throw e;
        }
    };

    if (urls.length > 0) {
        const requestList = await Apify.openRequestList('site-urls', urls);
        const crawler = new Apify.PuppeteerCrawler({
            requestList,
            requestQueue,
            useSessionPool: true,
            persistCookiesPerSession: true,
            launchPuppeteerOptions: {
                stealth: true,
            },
            handlePageTimeoutSecs: 600,
            handlePageFunction: handlePage,
        });
        await crawler.run();
    }

    // Run sites requiring proxy with different crawler
    if (proxyUrls.length > 0) {
        const requestListProxy = await Apify.openRequestList('site-urls-proxy', proxyUrls);
        const proxyCrawler = new Apify.PuppeteerCrawler({
            requestList: requestListProxy,
            requestQueue,
            useSessionPool: true,
            persistCookiesPerSession: true,
            // maxConcurrency: 1,
            launchPuppeteerOptions: {
                useApifyProxy: true,
                apifyProxyGroups: ['SHADER'],
                stealth: true,
            },
            handlePageTimeoutSecs: 600,
            handlePageFunction: handlePage,
        });
        await proxyCrawler.run();
    }
});
