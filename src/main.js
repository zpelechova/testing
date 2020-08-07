const Apify = require('apify');
const { log } = Apify.utils;

const { getProxyUrl } = require('./utils');

const START_URL = 'https://www.maine.gov/meopa/electricity/electricity-supply';

Apify.main(async () => {
	const input = await Apify.getInput();
	const { proxyConfiguration = {} } = input;

	const proxyUrl = getProxyUrl(proxyConfiguration, true);
	const userAgent = proxyUrl ? Apify.utils.getRandomUserAgent() : undefined;

    const requestQueue = await Apify.openRequestQueue();
    await requestQueue.addRequest({
        url: START_URL,
        userData: { label: 'START' }
    });

    const dataset = await Apify.openDataset('powermatrix');

	const crawler = new Apify.PuppeteerCrawler({
		requestQueue,
		maxRequestRetries: 3,
		handlePageTimeoutSecs: 240,
		maxConcurrency: 1, //20
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
            log.info(`Processing ${request.url}`);
            const { label } = request.userData;

            if (label === 'START') {
                await page.waitForSelector('table > tbody');
                const results = await page.evaluate(() => {
                    const tbody = document.querySelector('table > tbody');
                    const trs = Array.from(tbody.querySelectorAll('tr'));

                    const d = new Date();
                    const scrapeDate = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
                    const usState = 'ME';
                    // const utility = 'CMP of Emera Maine';
                    let utility = '';
                    const commodity = 'Power';
                    const rateType = 'Residential';

                    const results = [];

                    for (let i = 0; i < trs.length; i++) {
                        const tr = trs[i];
                        const tds = Array.from(tr.querySelectorAll('td'));
                        const isSingleMainRow = tds[0].querySelector('a');

                        if (isSingleMainRow) {
                            const data = Object.create(null);

                            data.Date = scrapeDate;
                            data.State = usState;
                            data.Utility = utility;
                            data.Supplier = i === 0 ? null : tds[0].textContent.trim().split('\n')[0];
                            data.Commodity = commodity;
                            data.RateType = rateType;
                            data['Rate Type'] = i === 0 ? 'PTC' : tds[3].textContent.trim();
                            data['Rate Category'] = i === 0 ? 'R1' : 'all';
                            // data.Rate = tds[1].textContent.trim() + '/' + tds[2].textContent.trim();
                            data.Rate = {
                                CMP: String(Number(tds[1].textContent.trim().match(/\d+(\.\d+)/)[0]) / 100),
                                Emera: String(Number(tds[2].textContent.trim().match(/\d+(\.\d+)/)[0]) / 100)
                            },
                            data['Rate Units'] = '$/kWh'; 
                            data.Term = tds[3].textContent.trim();
                            data['Cancelation Fee'] = tds[4].textContent.trim().replace(/\n/, ' ').replace(/\n/g, '').replace(/\t/g, '');
                            const renewableMatch = tds[2].textContent.trim().match(/\((\d+\%)/);
                            data['Renewable Blend'] = renewableMatch ? renewableMatch[1] : null;
                            data['Offer Notes'] = null;
                            data['Additional Products & Services'] = null;
                            data.Fee = null;
                            data['Fee Type'] = null;
                            data['Fee Notes'] = null;
                            data['Termination Notes'] = tds[4].textContent.trim().replace(/\n/, ' ').replace(/\n/g, '').replace(/\t/g, '');
                            data['Other Notes'] = 'zipcode=';

                            // split CMP and Emera
                            for (let z = 0; z < 2; z++) {
                                const newData = Object.assign({}, data);

                                if (z === 0) {
                                    newData.Utility = 'CMP';
                                    newData.Rate = data.Rate.CMP;

                                    results.push(newData);
                                }

                                if (z === 1) {
                                    newData.Utility = 'Emera';
                                    newData.Rate = data.Rate.Emera;

                                    results.push(newData);
                                }
                            }

                            // results.push(data);
                        }
                        else {
                            // copy from previous result
                            const data = Object.assign({}, results[results.length - 1]);
                            // update it
                            data['Rate Type'] = tds[2].textContent.trim();
                            data.Rate = {
                                CMP: String(Number(tds[0].textContent.trim().match(/\d+(\.\d+)/)[0]) / 100),
                                Emera: String(Number(tds[1].textContent.trim().match(/\d+(\.\d+)/)[0]) / 100)
                            },
                            data.Term = tds[2].textContent.trim();

                            // split CMP and Emera
                            for (let z = 0; z < 2; z++) {
                                const newData = Object.assign({}, data);

                                if (z === 0) {
                                    newData.Utility = 'CMP';
                                    newData.Rate = data.Rate.CMP;

                                    results.push(newData);
                                }

                                if (z === 1) {
                                    newData.Utility = 'Emera';
                                    newData.Rate = data.Rate.Emera;

                                    results.push(newData);
                                }
                            }

                            // results.push(data);
                        }
                    }

                    return results;
                });

                dataset.pushData(results);
                log.info('Data pushed.');
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

// TOT: 4 --