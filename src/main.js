const Apify = require('apify');
const { utils: { log } } = Apify;

Apify.main(async () => {
    const startUrls = [
        {
            "url": "https://www.socalgas.com/for-your-business/energy-market-services/gas-prices",
            "userData": {
                "state": "CA",
            }
        }
    ]
    const requestList = await Apify.openRequestList('start-urls', startUrls);
    const dataset = await Apify.openDataset('powermatrix');
    const proxyConfiguration = await Apify.createProxyConfiguration({
        groups: ['SHADER'],
        countryCode: 'US',
    });

    const crawler = new Apify.CheerioCrawler({
        requestList,
        proxyConfiguration,
        useSessionPool: true,
        persistCookiesPerSession: true,
        handlePageFunction: async ({ request, $ }) => {
            const { url, userData: { label } } = request;
            log.info('Page opened.', { label, url });

            var outputData = {};

            outputData.rate = parseFloat($('article table > tbody > tr:first-child > td:last-child').text().trim()) / 100;

            outputData.offerNotes = $('article.node--components').first().find('.content .paragraph').text().replace('.  ', '.').trim();

            const now = new Date();
            outputData.date = new Intl.DateTimeFormat('en-US').format(now);

            outputData.utility = 'Southern California Gas Company (SoCalGas)';
            outputData.commodity = 'Gas';
            outputData.rateUnits = '$/therm';
            outputData.rateType = 'PTC';
            outputData.serviceType = 'Business';

            await dataset.pushData({
                "Date": outputData.date ? outputData.date : '',
                "State": request.userData.state ? request.userData.state : '',
                "Utility": outputData.utility ? outputData.utility : '',
                "Supplier": outputData.supplier ? outputData.supplier : '',
                "Rate Type": outputData.rateType ? outputData.rateType : '',
                "Rate Category": outputData.rateCategory ? outputData.rateCategory : '',
                "Rate": outputData.rate ? outputData.rate : '',
                "Rate Units": outputData.rateUnits ? outputData.rateUnits : '',
                "Term": outputData.term ? outputData.term : '',
                "Cancelation Fee": outputData.cancelationFee ? outputData.cancelationFee : '',
                "Renewable Blend": outputData.renewableBlend ? outputData.renewableBlend : '',
                "Offer Notes": outputData.offerNotes ? outputData.offerNotes : '',
                "Additional Products & Services": outputData.additionalPS ? outputData.additionalPS : '',
                "Fee": outputData.fee ? outputData.fee : '',
                "Fee Type": outputData.feeType ? outputData.feeType : '',
                "Fee Notes": outputData.feeNotes ? outputData.feeNotes : '',
                "Termination Notes": outputData.terminationNotes ? outputData.terminationNotes : '',
                "Other Notes": outputData.otherNotes ? outputData.otherNotes : '',
                "RateType": outputData.serviceType ? outputData.serviceType : '',
                "Commodity": outputData.commodity ? outputData.commodity : '',
            });
        }
    });

    log.info('Starting the crawl.');
    await crawler.run();
    log.info('Crawl finished.');
});