const Apify = require('apify');
const { log, sleep } = Apify.utils;

const { getProxyUrl } = require('./utils');

const START_URL = 'https://www.mdelectricchoice.com/shop/';
const BASE_RES_URL = 'https://www.mdelectricchoice.com/shop/?kwh=&utility=';


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
		maxConcurrency: 1,
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
                await page.waitForSelector('#selectutility', { timeout: 60*1000 });

                const utilities = await page.evaluate(() => {
                    const options = Array.from(document.querySelector('#selectutility').options);

                    const utilities = options.filter(opt => opt.value !== '').map((opt) => {
                        return {
                            value: opt.value, 
                            text: opt.textContent
                        }
                    });

                    return utilities;
                });

                for (let i = 0; i < utilities.length; i++) {
                    const utility = utilities[i];
                    const url = BASE_RES_URL + utility.value;

                    await requestQueue.addRequest({
                        url,
                        userData: { label: 'RESULT-PAGE', utility: utility.text }
                    });
                }
            }

            if (label === 'RESULT-PAGE') {
                const { utility } = request.userData;
                log.info(`Current utility: ${utility}`);

                await page.waitForSelector('div#shop-results');

                const results = await page.evaluate((utility) => {
                    const shopResults = document.querySelector('div#shop-results');

                    const results = [];
                    const d = new Date();
                    const scrapeDate = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

                    // scrape PTC
                    const currentSupply = shopResults.querySelector('div.current-supply-service');
                    const ptcData = Object.create(null);
                    
					ptcData.Date = scrapeDate;
					ptcData.State = 'MD';
                    ptcData.Utility = utility;
                    ptcData.Supplier = null;
                    ptcData.Commodity = 'Power';
                    ptcData.RateType = 'Residential';
                    ptcData['Rate Type'] = 'PTC';
                    ptcData['Rate Category'] = 'R1';
                    ptcData.Rate = currentSupply.querySelector('div.current-rate').textContent.trim().match(/\$\d+\.\d+/)[0];
                    ptcData['Rate Units'] = '$/kWh';
                    ptcData.Term = currentSupply.querySelector('p.future-rate') 
                        ? currentSupply.querySelector('p.future-rate').textContent.replace('Months', '')
                        : null;
                    ptcData['Cancelation Fee'] = null;
                    ptcData['Renewable Blend'] = null;
                    ptcData['Offer Notes'] = null;
                    ptcData['Additional Products & Services'] = null;
                    ptcData.Fee = null;
                    ptcData['Fee Type'] = null;
                    ptcData['Fee Notes'] = null;
                    ptcData['Termination Notes'] = null;
                    ptcData['Other Notes'] = 'zipcode=';

                    results.push(ptcData);
                    
                    // scrape offers
                    const offers = Array.from(shopResults.querySelectorAll('div.row.no-gutters.offer'));

                    // return if no results
                    if (offers.length === 1 && offers[0].innerText.includes('Sorry')) return results;

                    for (let i = 0; i < offers.length; i++) {
                        const offer = offers[i];
                        const data = Object.create(null);

                        const rows = offer.querySelectorAll('div.row.no-gutters');
                        const row1 = rows[0];
                        const row2 = rows[1];
                        const row3 = rows[2];
                        const cols = row2.querySelectorAll('div');
                        const col1 = cols[0];
                        const col2 = cols[1];

                        data.Date = scrapeDate;
                        data.State = 'MD';
                        data.Utility = utility;
                        data.Supplier = row1.querySelector('h2').textContent;
                        data.Commodity = 'Power';
                        data.RateType = 'Residential';
                        const ratetype_term = col1 
                            ? col1.textContent.trim().split('\t').filter(item => item.includes('Type of Plan') || item.includes('Term Duration'))
                            : null;
                        data['Rate Type'] = ratetype_term ? ratetype_term[0].split(':')[1].trim() : null;
                        data['Rate Category'] = 'all';
                        data.Rate = row1.querySelector('.current-rate').textContent.trim().replace('Price/kWh', '').replace('$', '');
                        data['Rate Units'] = '$/kWh';
                        data.Term = ratetype_term ? ratetype_term[1].split(':')[1].replace('Months', '').trim() : null;
                        const ren_canc_month = col2.textContent.trim().split('\t').filter(item => item !== '');
                        data['Cancelation Fee'] = ren_canc_month[0].split(':')[1].trim();
                        data['Renewable Blend'] = ren_canc_month[1].split(':')[1].trim();
                        data['Offer Notes'] = row3 ? row3.querySelector('.additional-info').textContent.trim() : null;
                        data['Additional Products & Services'] = row3 ? row3.querySelector('.additional-info').textContent.trim() : null;
                        data.Fee = ren_canc_month[2].split(':')[1].trim();
                        data['Fee Type'] = null;
                        data['Fee Notes'] = null;
                        data['Termination Notes'] = null;
                        data['Other Notes'] = 'zipcode=';

                        results.push(data);
                    }

                    return results;
                }, utility);

                await dataset.pushData(results);
                log.info(`Data pushed: ${utility}`);
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

// TOT: 3