const Apify = require('apify');
const { log, sleep } = Apify.utils;

const START_URL = 'https://www.eversource.com/content/ema-c/residential/my-account/billing-payments/about-your-bill/rates-tariffs/cost-of-gas';
const PROXY_DEFAULT_COUNTRY = 'US';

const getProxyUrl = (proxyConfiguration, addSession) => {
	let { useApifyProxy = true, proxyUrl, apifyProxyGroups = ["SHADER"] } = proxyConfiguration;

	// if no custom proxy is provided, set proxyUrl
	if (!proxyUrl) {
		if (!useApifyProxy) return undefined;

		proxyUrl = Apify.getApifyProxyUrl({
			password: process.env.APIFY_PROXY_PASSWORD,
			groups: apifyProxyGroups,
			session: addSession ? Date.now().toString() : undefined,
			country: PROXY_DEFAULT_COUNTRY,
		});
	}

	return proxyUrl;
};


Apify.main(async () => {
	const input = await Apify.getInput();
	const { proxyConfiguration = {} } = input;

	const proxyUrl = getProxyUrl(proxyConfiguration, true);
	const userAgent = proxyUrl ? Apify.utils.getRandomUserAgent() : undefined;

    const requestQueue = await Apify.openRequestQueue();
    await requestQueue.addRequest({
        url: START_URL,
        userData: { label: 'START' },
    });

    const dataset = await Apify.openDataset('powermatrix');

	const crawler = new Apify.PuppeteerCrawler({
		requestQueue,
		maxRequestRetries: 3,
		handlePageTimeoutSecs: 240,
		maxConcurrency: 20,
		launchPuppeteerOptions: {
			proxyUrl: proxyUrl,
			userAgent: userAgent,
			timeout: 120 * 1000,
			headless: true,
		},

		gotoFunction: async ({ request, page }) => {
			return page.goto(request.url, {
				timeout: 180 * 1000,
				waitUntil: 'networkidle2',
			});
		},

		handlePageFunction: async ({ request, page }) => {
            const { label } = request.userData;
            log.info(`Processing: ${request.url}`);
            
            if (label === 'START') {
                await page.waitForSelector('.article-content');

                const data = await page.evaluate(() => {
                    const content = document.querySelector('.article-content');

                    const p = Array.from(content.querySelectorAll('p')).filter(p => p.textContent.includes('$'))[0];

                    const cost = p.textContent.match(/\$\d+\.\d+/)[0].replace('$', '');
                    const term = p.textContent.match(/\w+\W\d+\,\W2020/)[0];

                    const data = Object.create(null);
                    const d = new Date();

                    data.Date = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
                    data.State = 'MA';
                    data.Utility = 'Eversource';
                    data.Supplier = null;
                    data.Commodity = 'Gas';
                    data.RateType = 'Residential';
                    data['Rate Type'] = 'PTC';
                    data['Rate Category'] = 'R1';
                    data.Rate = cost;
                    data['Rate Units'] = '$/kWh'; 
                    data.Term = term;
                    data['Cancelation Fee'] = null;
                    data['Renewable Blend'] = null;
                    data['Offer Notes'] = null;
                    data['Additional Products & Services'] = null;
                    data.Fee = null;
                    data['Fee Type'] = null;
                    data['Fee Notes'] = null;
                    data['Termination Notes'] = null;
                    data['Other Notes'] = 'zipcode=';

                    return data;
                });

				await dataset.pushData(data);
            }
		},

		handleFailedRequestFunction: async ({ request }) => {
			console.log(`Request ${request.url} failed too many times`);
			await dataset.pushData({
				'#debug': Apify.utils.createRequestDebugInfo(request),
			});
		},
	});

	await crawler.run();
});
