const { fillForm, parseFromElement, extractPDF, saveData } = require('../common');
const { log } = require('apify').utils;

const parsePdf = async (url) => {
    const data = {};

    try {
        const text = await extractPDF(url, true).then(array => array.join(' '));

        let m = text.match(/Price Plan\s+([a-zA-Z]+) Rate/);
        if (m) {
            data['Rate Type'] = m[1];
        }

        m = text.match(/[Ee]arly [Tt]ermination [Ff]ee\s+\$([0-9]+)/);
        if (m) {
            data['Cancellation Fee'] = m[1];
        }
    } catch (e) {
        log.error("Scraping PDF failed", { error: e })
    }

    return data;
};

const parseOffers = async function (page, container, request, commodity, utility) {
    const parse = async () => {
        const offers = await container.$$('.offer-container .product-box-wrapper');
        for (const offer of offers) {
            const priceP = parseFromElement(
                offer,
                '.offer-price .price'
            ).then(text => parseFloat(text));
            const unitP = parseFromElement(
                offer,
                '.offer-price .uom',
                /per\s+([a-zA-Z]+)/, 1
            );
            const termP = parseFromElement(
                offer,
                '.offer-title .term-type',
                /([0-9]+).Month/, 1
            );
            const rateTypeP = parseFromElement(
                offer,
                '.offer-title .term-type',
                /[0-9]+.Month\s+([a-zA-Z]+) Rate/, 1
            );

            const url = await offer.$('.terms-links a.tos-link').then(a => a.evaluate(e => e.getAttribute('href')));
            const pdfDataP = parsePdf(url);

            const [price, unit, term, rateType, pdfData] = await Promise.all([
                priceP, unitP, termP, rateTypeP, pdfDataP
            ]);

            await saveData({
                'Rate': price / 100,
                'Rate Type': rateType,
                'Commodity': commodity,
                'Rate Units': unit,
                'Term': term,
                'Utility': utility,
                ...pdfData
            }, request.userData.site, request.userData.zipCode);
        }
    };

    const greenSwitch = await container.$('.green-switch .toggle-switch');
    await parse();

    if (greenSwitch) {
        await greenSwitch.click();
        await page.waitFor(500);
        await parse();
    }
};

const scrapeType = async (context, planType, commodity) => {
    const { page, request } = context;

    const section = await page.$(`.lob-section.${planType.toUpperCase()}`);
    if (!section) return;

    const utility = async (page, planType) => {
        const header = await page.$(`.lob-section.${planType.toUpperCase()} h2.lob-header-text`);
        return await parseFromElement(
            header,
            '.header-text',
            /Plans for (.*)$/, 1
        );
    };

    const utilityChanger = await page.$(`.offers .lob-section.${planType.toUpperCase()} .offer-container .utility-selector`);
    if (utilityChanger) {
        let utilitySelect = await utilityChanger.$('select');
        const values = await utilitySelect.$$eval('option', nodes => nodes.map(n => n.value));
        for (const val of values) {
            // skip disabled option
            if (!val) continue;
            const changeUtilityBtn = await page.$(`.offers .lob-section.${planType.toUpperCase()} .offer-container .change-ulob`);
            if (changeUtilityBtn) {
                await changeUtilityBtn.hover();
                await changeUtilityBtn.click();
                utilitySelect = await page.$(`.offers .lob-section.${planType.toUpperCase()} .offer-container .utility-selector select`);
            }
            await utilitySelect.select(val);
            await page.waitFor(`.offers .lob-section.${planType.toUpperCase()} .change-ulob`);
            const container = await page.waitFor(`.offers .lob-section.${planType.toUpperCase()} .lob-card-container`);
            const util = await utility(page, planType);
            await parseOffers(page, container, request, commodity, util);
        }
    } else {
        const container = await page.$(`.offers .lob-section.${planType.toUpperCase()} .lob-card-container`);
        const util = await utility(page, planType);
        await parseOffers(page, container, request, commodity, util);
    }

};

exports.handleSite = async (context) => {
    const { page, request } = context;

    await fillForm(
        page,
        'form.call-to-action',
        [
            {
                selector: 'input[name="code"]',
                text: request.userData.zipCode.zip
            }
        ],
        'form.call-to-action button[type="submit"]',
        true
    );

    const noOffers = page.waitForSelector('.no-offers-found').then(() => false);
    const found = page.waitForSelector('.offers').then(() => true);
    const result = await Promise.race([noOffers, found]);

    if (!result) {
        log.info(`IGS: No plans found for zip ${request.userData.zipCode.zip}`);
        return;
    }
    await scrapeType(context, 'electric', 'Power');
    await scrapeType(context, 'gas', 'Gas');
};

exports.data = {
    name: 'IGS',
    url: 'https://www.igs.com/residential',
    data: {
        "RateType": "Residential",
        "Supplier": "IGS Energy"
    },
    usesProxy: true
};
