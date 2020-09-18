const { fillForm, parseFromElement, saveData } = require('../common');
const { log } = require('apify').utils;

const parseModal = async (page, plan) => {
    await plan.$('.learn_more span.learnMoreDetails').then(a => a.click());
    await page.waitFor(1000);
    await page.waitFor('.active_lightbox .modal-body .plan_features_list', { visible: true });

    const details = await page.$$('.active_lightbox .modal-body .plan_feature_item');
    const data = {};
    for (const detail of details) {
        const text = await detail.evaluate(d => d.innerText);
        if (text.match(/Term:/)) {
            const m = text.match(/Term: ([0-9]+) Months/);
            data['Term'] = m[1];
        } else if (text.match(/Cancellation Fee/)) {
            const m = text.match(/Fee: \$([0-9]+)/);
            data['Cancellation Fee'] = m[1];
        }
    }

    await page.click('.active_lightbox .modal-header button.close');

    return data;
};

const scrapeList = async (context, utility) => {
    const { page, request } = context;

    const list = await page.$$('.pricing_content .pricing_plan_item');
    for (const plan of list) {
        const nameP = parseFromElement(
            plan,
            '.plan_head_text h3'
        ).then(text => text.trim());
        const priceP = parseFromElement(
            plan,
            '.plan_price_value'
        );
        const unitP = parseFromElement(
            plan,
            '.plan_price_measure',
            /\/([a-zA-Z]+)/, 1
        );

        const modalDataP = parseModal(page, plan);
        const [name, price, unit, modalData] = await Promise.all([
            nameP, priceP, unitP, modalDataP
        ]);

        await saveData({
            'Rate': parseFloat(price) / 100,
            'Rate Category': name,
            'Rate Units': unit,
            'Utility': utility,
            ...modalData
        }, request.userData.site, request.userData.zipCode);
    }
};

exports.handleSite = async (context) => {
    const { page, request } = context;

    await page.waitFor('#Zipcode', { visible: true });
    await fillForm(
        page,
        'form[action="/Plans/ViewPlans"]',
        [
            {
                selector: '#Zipcode',
                text: request.userData.zipCode.zip
            }
        ],
        '#btnZipCode',
        false,
    );

    const successP = page.waitForSelector('#result label', { visible: true, timeout: 10000 }).then(() => true);
    const errorP = page.waitForSelector('#zipCodeInvalid', { visible: true, timeout: 10000 }).then(() => false);

    const result = await Promise.race([successP, errorP]);
    if (!result) {
        log.info(`NEXTERA: No plans found for zip ${request.userData.zipCode.zip}`);
        return;
    }

    let resultId = 'result';
    const utilityList = await page.$$('#result label');
    for (let i = 0; i < utilityList.length; i++) {
        const label = await page.$(`#${resultId} > div:nth-child(${i + 1}) label`);
        await label.click();
        const labelName = await label.evaluate(l => l.innerText);

        await Promise.all([
            page.waitForNavigation(),
            page.click('#btnSubmit'),
        ]);

        await scrapeList(context, labelName);

        try {
            await page.waitForSelector('.location_update_action', { timeout: 3000 });
        } catch (e) {
            log.info(`NEXTERA: No plans found for zip ${request.userData.zipCode.zip} and utility ${labelName}`);
            await page.goto(request.userData.site.url);
            await page.waitFor('#Zipcode', { visible: true });
            await fillForm(
                page,
                'form[action="/Plans/ViewPlans"]',
                [
                    {
                        selector: '#Zipcode',
                        text: request.userData.zipCode.zip
                    }
                ],
                '#btnZipCode',
                false
            );
            await page.waitFor('#result label', { visible: true });
            continue;
        }

        await page.click('.location_update_action');
        await page.waitFor('#Zipcode', { visible: true });
        await fillForm(
            page,
            'form[action="/Plans/ViewPlans"]',
            [
                {
                    selector: '#Zipcode',
                    text: request.userData.zipCode.zip
                }
            ],
            '#btnZipCode',
            false
        );
        resultId = 'ldcresult';
        await page.waitFor(`#${resultId} label`, { visible: true });
    }
};

exports.data = {
    name: "NEXTERA",
    url: "https://signup.nexteraenergyservices.com/",
    data: {
        "RateType": "Residential",
        "Supplier": "NextEra Energy Services",
        "Rate Type": "Fixed",
        "Commodity": "Power",
    }
};