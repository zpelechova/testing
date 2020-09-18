const Apify = require('apify');
const fs = require('fs');
const util = require("util");
const pdfExtract = require('pdf-text-extract');
const requestPromise = require('request-fixed-tunnel-agent');
const tmp = require('tmp');
const { log } = Apify.utils;

exports.fillForm = async (page, formSelector, input, submitClick = null, waitForNavigation = true) => {
    for (const text of input) {
        await page.$(text.selector).then(elem => (elem.evaluate(e => e.value = '')));
        await page.click(text.selector);
        await page.type(text.selector, text.text);
    }

    const form = await page.$(formSelector);

    let submitP = null;
    if (submitClick) {
        submitP = page.click(submitClick);
    } else {
        submitP = form.evaluate(f => f.submit());
    }

    if (waitForNavigation) {
        await Promise.all([submitP, page.waitForNavigation()]);
    } else {
        await submitP;
    }
};

exports.saveData = async (data, site, zip) => {
    const date = new Date();
    const dataset = await Apify.openDataset('powermatrix');
    const merged = {
        "Date": `${(date.getMonth()+1)}/${date.getDate()}/${date.getFullYear()}`,
        ...site.data,
        "State": zip.state,
        ...data
    };
    await Apify.pushData(merged);
    await dataset.pushData(merged);
};

exports.extractPDF = async (url, useProxy = null) => {
    const proxyPassword = process.env.APIFY_PROXY_PASSWORD;
    const options = {
        url,
        encoding: null
    };
    if (useProxy) {
        options['proxy'] = `http://groups-SHADER:${proxyPassword}@proxy.apify.com:8000`;
    }
    log.debug(`Downloading PDF ${url}...`);
    const response = await requestPromise(options);
    log.debug(`PDF downloaded`);
    const buffer = Buffer.from(response);

    const pathToPdf = tmp.tmpNameSync();
    fs.writeFileSync(pathToPdf, buffer);

    const extract = util.promisify(pdfExtract);

    const pagesText = await extract(pathToPdf);

    fs.unlinkSync(pathToPdf);
    return pagesText;
};

exports.parseFromElement = async (elem, selector, regex = null, matchIndex = 0) => {
    const text = await elem.$(selector).then(elem => {
        if (elem) {
            return elem.evaluate(n => n.innerText)
        } else {
            return null;
        }
    });
    if (text && regex) {
        const match = text.match(regex);

        if (match && matchIndex in match) {
            return match[matchIndex];
        } else {
            return null;
        }
    } else {
        return text;
    }
};
