const { saveData, parseFromElement, extractPDF } = require('../common');
const { URL } = require('url');
const { log } = require('apify').utils;

const DOMAIN = "https://www.constellation.com";

const scrapeResultList = async (list, utility, commodity, request) => {
    const terminationFeeRegex = /early termination fee of \$([0-9.]+)/;

    for (const elem of list) {
        const cost = parseFloat(await parseFromElement(
            elem,
            '.individual-cost',
            /[0-9.]+/
        ));
        const term = await parseFromElement(
            elem,
            '.name-above-plan',
            /([0-9]+) Month/, 1
        );
        const unit = await parseFromElement(
            elem,
            '.individual-cost-per',
            /per\s([a-zA-Z]+)/, 1
        );
        const renewable = await parseFromElement(
            elem,
            '.individual-options-short-list',
            /([0-9]+)% Wind Power/, 1
        );

        let fee = null;
        const pdfTermsHref = await elem.$('.individual-plan-doc').then(elem => elem.evaluate(e => e.getAttribute('href')));
        const pdfUrl = new URL(pdfTermsHref, DOMAIN);
        const pdfText = await extractPDF(pdfUrl.toString());
        const match = pdfText[0].match(terminationFeeRegex);
        if (match) {
            fee = parseFloat(match[1]);
        }

        await saveData({
            'Utility': utility,
            'Rate': cost / 100,
            'Term': term,
            'Commodity': commodity,
            'Rate Units': unit,
            'Cancellation Fee': fee,
            'Renewable Blend': renewable
        }, request.userData.site, request.userData.zipCode);
    }

};

const scrapeType = async (context, planType, commodity) => {
    const { page } = context;

    const utilityList = await page.$$(`#${planType}-provider option.ng-scope`);
    for (const utility of utilityList) {
        const value = await utility.evaluate(o => o.value);
        await page.select(`#${planType}-provider`, value);


        const nextStepForm = await page.$('#signUpFormStepOneSubmit');
        await page.waitFor(200);
        await nextStepForm.click();
        await page.waitFor('.res-pg-2', { visible: true });

        const utilityName = await utility.evaluate(e => e.innerText);
        await handleScrape(context, planType, utilityName.trim(), commodity);

        await page.click('button.btn-back.btn-nav-previous');
        await page.waitFor('.res-pg-1', { visible: true });
    }
};

const handleScrape = async ({ request, page }, planType, utility, commodity) => {
    await page.click('a[href="#plan-individual"]');
    await page.waitFor('#plan-individual', { visible: true });

    const list = await page.$$(`#individual-${planType}-options > ul > li`);
    await scrapeResultList(list, utility, commodity, request);
};

exports.handleSite = async (context) => {
    const { page, request } = context;
    const numPlans = Math.min(
        (await page.$$("#electricity-provider option.ng-scope")).length,
        (await page.$$("#gas-provider option.ng-scope")).length,
    );
    if (numPlans < 1) {
        log.info(`CONSTELLATION: No plans found for zip ${request.userData.zipCode.zip}`);
        return;
    }
    await scrapeType(context, 'electricity', 'Power');
    await scrapeType(context, 'gas', 'Gas');
};

exports.data = {
    name: "CONSTELLATION",
    url: "https://www.constellation.com/content/constellation/en/solutions/for-your-home/residential-signup.html?zip=%zipCode%",
    data: {
        "Rate Type": "Fixed",
        "RateType": "Residential",
        "Supplier": "Constellation"
    }
};

