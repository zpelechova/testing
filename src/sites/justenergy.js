const { fillForm, saveData, parseFromElement, extractPDF } = require('../common');
const { URL } = require('url');
const { log } = require('apify').utils;

const allNodes = [];
let currentZip = null;

const extractInfoFromItem = async function (item, provider) {
    const info = {};
    const title = await item.$('.mt-0 p:first-child').then(elem => (elem.evaluate(n => n.innerText)));
    const isElectricity = title.includes('Electricity');
    info['Term'] = parseInt(await parseFromElement(
        item,
        '.mt-0 p:nth-child(3)',
        /([0-9]+) Months/, 1
    ));

    const cost = await parseFromElement(
        item,
        '.mt-0 p.disclaimer + p span',
        /\$?([0-9]+\.[0-9]+)¢?\sper\s([a-zA-Z]+)/, 1
    );
    const unit = await parseFromElement(
        item,
        '.mt-0 p.disclaimer + p span',
        /\$?([0-9]+\.[0-9]+)¢?\sper\s([a-zA-Z]+)/, 2
    );
    const isInCents = await parseFromElement(
        item,
        '.mt-0 p.disclaimer + p span',
        /\$?[0-9]+\.[0-9]+(¢?)\sper\s[a-zA-Z]+/, 1
    );
    if (isInCents) {
        const inDollars = cost / 100;
        info['Rate'] = parseFloat(inDollars).toFixed(4);
    }
    else {
        info['Rate'] = parseFloat(cost).toFixed(4);
    }
    info['Rate Units'] = unit;

    info['Cancellation Fee'] = parseInt(await parseFromElement(
        item,
        '.mt-4 + .mt-4 p span',
        /\$([0-9]+)/, 1
    ));
    info['Commodity'] = isElectricity ? 'power' : 'gas';
    info['Renewable Blend'] = null;
    info["Utility"] = provider || 'unknown';
    return info;
}

const pushNodes = async function (item, page, provider) {
    await item.hover();
    await item.click();
    await page.waitFor('.modal', { visible: true });
    const info = await page.$('.modal-body .row + .row .modal-right');
    allNodes.push(await extractInfoFromItem(info, provider));
    const closeBtn = await page.waitFor('.modal button.close', { visible: true, timeout: 10000 });
    await page.waitFor(500);
    await closeBtn.click();
    await page.waitFor('.modal', { hidden: true });
};

const collectProviderNodes = async function (page) {
    let nodes = null;
    let selector = null;
    try {
        await page.waitFor('.product-rows', { visible: true, timeout: 10000 });
        nodes = await page.$$('.product-list-item-v2 .column-button .btn-link2');
        selector = '.product-list-item-v2 .column-button .btn-link2';
    }
    catch (e) {
    }
    if (!nodes) {
        try {
            await page.waitFor('.owl-carousel', { visible: true, timeout: 10000 });
            nodes = await page.$$('.owl-item .btn-link');
            selector = '.owl-item .btn-link';
        }
        catch (e) {
        }
    }
    const provider = await page.$('.div-utilitydisplay a').then(elem => {
        if (elem) {
            return elem.evaluate(n => n.innerText)
        } else {
            return null;
        }
    });
    if (!nodes) return log.info(`JUSTENERGY: ${currentZip} NOT AVAILABLE`);
    const nodeLength = nodes.length - 1;
    for (let i = 0; i <= nodeLength; i++) {
        const nodes = await page.$$(selector);
        await pushNodes(nodes[i], page, provider);
    }
}

const goToAllPlans = async function (page, select) {
    const values = await select.$$eval('option', nodes => nodes.map(n => n.value));
    for (const val of values) {
        // skip disabled option
        if (val.includes('null')) continue;
        await page.select('select.form-control', val);
        await page.click('#utility-selector-next-button');
        await page.waitFor('#btn-viewalloptions', { visible: true, timeout: 10000 });
        const [response] = await Promise.all([
            page.waitForNavigation(),
            page.click('#btn-viewalloptions')
        ]);
        const changeProviderBtn = await page.waitFor('#a-utilitydisplay-ELE', { visible: true });
        await page.waitFor(1000);
        if (changeProviderBtn) await changeProviderBtn.click();
        return;
    }
}

const handleResourceType = async function (page, select) {
    const values = await select.$$eval('option', nodes => nodes.map(n => n.value));
    for (const val of values) {
        // skip disabled option
        if (val.includes('null')) continue;
        const changeProviderBtn = await page.$('#a-utilitydisplay-ELE');
        if (changeProviderBtn) {
            await page.click('#a-utilitydisplay-ELE')
        }
        await page.waitFor('select.form-control', { visible: true });
        await page.select('select.form-control', val);
        await page.click('#utility-selector-next-button')
        await collectProviderNodes(page);
    }
}

exports.handleSite = async (context) => {
    const { page, request } = context;
    currentZip = request.userData.zipCode.zip;
    await page.type('#zip', request.userData.zipCode.zip);
    const submit = await page.$('.css-16bd106');
    await submit.click()
    await page.waitForNavigation();


    // power
    let powerSelect = null;
    try {
        powerSelect = await page.waitFor('#utilitySelector', { visible: true, timeout: 10000 });
    }
    catch (e) {
        // not available
        const notAvailable = await page.$('#no-product-title');
        if (notAvailable) {
            return log.info(`JUSTENERGY: ${request.userData.zipCode.zip} NOT AVAILABLE`);
        }
    }

    if (powerSelect) {
        await goToAllPlans(page, powerSelect);
        powerSelect = await page.waitFor('#utilitySelector', { visible: true, timeout: 10000 });
        await handleResourceType(page, powerSelect)
    }
    else {
        try {
            await page.waitFor('#btn-viewalloptions', { visible: true, timeout: 10000 });
            const showAllBtn = await page.$('#btn-viewalloptions');
            const [response] = await Promise.all([
                page.waitForNavigation(),
                showAllBtn.click()
            ]);
        }
        catch (e) {
        }
        await collectProviderNodes(page);
    }

    // gas
    const gasBtn = await page.$('a.natural-gas');
    if (gasBtn) {
        await gasBtn.click();
        try {
            const gasSelect = await page.$('select.form-control');
            await handleResourceType(page, gasSelect);
        }
        catch (e) {
            await collectProviderNodes(page);
        }
    }

    for (const item of allNodes) {
        await saveData(item, request.userData.site, request.userData.zipCode);
    }

};

exports.data = {
    "name": "JUSTENERGY",
    "url": "https://www.justenergy.com/",
    "data": {
        "Rate Type": "Fixed",
        "RateType": "Residential",
        "Supplier": "Just Energy Inc."
    }
}


