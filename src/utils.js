const Apify = require('apify');
const rp = require('request-promise-native');

const PROXY_DEFAULT_COUNTRY = 'US';

function getProxyUrl(proxyConfiguration, addSession) {
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
}

async function downloadFile(page, zipcode, companyId) {
    const options = {
		encoding: null,
		method: 'POST',
		uri: 'http://www.energyswitchma.gov/consumers/compare',
		body: `{"customerClassId":"1","distributionCompanyId":"${companyId}","distributionCompanyName":"","zipCode":"${zipcode}","monthlyUsage":600}`,
		headers: {
			accept: 'application/json, text/plain, */*',
			referer: 'http://www.energyswitchma.gov/',
			origin: 'http://www.energyswitchma.gov',
			'user-agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 YaBrowser/18.11.1.805 Yowser/2.5 Safari/537.36',
			'content-type': 'application/json;charset=UTF-8',
		},
    };
    
    // add the cookies
    const cookies = await page.cookies();
    options.headers.Cookie = cookies.map(ck => ck.name + '=' + ck.value).join(';');
    
    // send the request
    const buffer = await rp(options);
    // convert
    const fileStr = await buffer.toString();
    const data = await JSON.parse(fileStr);

    return data;
}

module.exports = {
    getProxyUrl,
    downloadFile
};
