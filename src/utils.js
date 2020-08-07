const Apify = require('apify');

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

module.exports = {
    getProxyUrl
};
