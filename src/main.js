const Apify = require('apify');
const { log } = Apify.utils;

const { getProxyUrl, downloadFile } = require('./utils');

const START_URL = 'http://www.energyswitchma.gov/#/';
const ZIPCODES = [ 
    { utility: 'National Grid', zipcode: '01915', companyId: '1' }, 
    { utility: 'NSTAR', zipcode: '02451', companyId: '2' }, 
    { utility: 'WMECo', zipcode: '01243', companyId: '4' }, 
    { utility: 'Unitil', zipcode: '01469', companyId: '5' } 
];
const SHOP_TYPES = ['1', '2'];


Apify.main(async () => {
	const input = await Apify.getInput();
	const { proxyConfiguration = {} } = input;

	const proxyUrl = getProxyUrl(proxyConfiguration, true);
	const userAgent = proxyUrl ? Apify.utils.getRandomUserAgent() : undefined;

    const requestQueue = await Apify.openRequestQueue();
    for (let i = 0; i < ZIPCODES.length; i++) {
        const { utility, zipcode, companyId } = ZIPCODES[i];

        for (let z = 0; z < SHOP_TYPES.length; z++) {
            const shopType = SHOP_TYPES[z];
            const rateType = shopType === '1' ? 'Residential' : 'Commercial';

            await requestQueue.addRequest({
                url: START_URL,
                uniqueKey: 'k-' + zipcode + 's-' + shopType,
                userData: { label: 'START', utility, zipcode, companyId, shopType }
            });
            console.log('Added:', utility, zipcode, rateType);
        }
    }

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
            const { label, utility, zipcode, companyId, shopType } = request.userData;
            const rateType = shopType === '1' ? 'Residential' : 'Commercial';
            
            if (label === 'START') {
                log.info(`Processing: ${utility} (${zipcode}) - ${rateType}`);
                
                await page.waitForSelector(`input[type=radio]`);

                await page.evaluate((shopType) => {
                    document.querySelector(`input[type=radio][ng-value="${shopType}"]`).click();
                }, shopType);
                await page.type('input.form-control', zipcode, { delay: 100 });

                await Promise.all([
                	page.waitForNavigation({ waitUntil: 'networkidle2' }),
                	page.evaluate(() => document.querySelector('button.btn.btn-warning').click())
                ]);

                await page.waitForSelector('button.btn.btn-default[json-export-excel]', { timeout: 60*1000 });

                log.info('Downloading file...');
                const data = await downloadFile(page, zipcode, companyId);
                log.info('File downloaded successfully.');
                
                for (let i = 0; i < data.length; i++) {
                    const item = data[i];

                    await requestQueue.addRequest({
                        url: 'about:blank',
                        uniqueKey: 'k' + zipcode + 's-' + shopType + 'p-' + i,
                        userData: { label: 'ITEM', utility, zipcode, item, pos: i, shopType }
                    });
                }
                log.info(`All items added for ${utility} (${zipcode}) - ${rateType}`);
            }

            if (label === 'ITEM') {
                const { utility, zipcode, item, pos, shopType } = request.userData;
                const rateType = shopType === '1' ? 'Residential' : 'Commercial';
                log.info(`Processing: ${utility} - ${rateType} - item ${pos}`);

                const data = Object.create(null);
                const d = new Date();

                data.Date = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
                data.State = 'MA';
                data.Utility = utility;
                data.Supplier = pos === 0 ? null : item.supplierName;
                data.Commodity = 'Power';
                data.RateType = rateType;
                data['Rate Type'] = pos === 0 ? 'PTC' : item.pricingStructureDescription;
                data['Rate Category'] = pos === 0 ? 'R1' : 'All';
                const centRateStr = item.pricePerUnit.replace(' ¢/kWh', '').replace('|TBD', '');
                const dollarRate = Number(centRateStr) / 100;
                data.Rate = String(dollarRate);
                data['Rate Units'] = '$/kWh';
                data.Term = item.contractTerm;
                const canc = item.earlyTerminationDetailExport;
                const match = canc ? canc.match(/\d+\.\d+/) : null;
                data['Cancelation Fee'] = match ? match[0]: canc;
                data['Renewable Blend'] = item.renewableEnergyProduct;
                data['Offer Notes']	= item.introductoryPrice;
                data['Additional Products & Services'] = item.otherProductServices;
                data.Fee = item.enrollmentFeeExport || item.enrollmentFee;
                data['Fee Type'] = null;
                data['Fee Notes'] = null;
                data['Termination Notes'] = item.earlyTerminationDetailExport;
                data['Other Notes'] = `zipcode=${zipcode}`;

                dataset.pushData(data);
                log.info(`Data pushed: ${utility} - ${rateType} - item ${pos}`); 
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

// TOT: 5 --