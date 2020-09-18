const { parseFromElement, saveData } = require('../common');
const { log } = require('apify').utils;

const parseModal = async (page, plan, modalTrigger) => {
    await plan.$(modalTrigger).then(t => t.click());
    const data = {};
    try {
        await page.waitFor('#modal-tos .modal-body table', {visible: true, timeout: 10000});

        const rows = await page.$$('#modal-tos .modal-body > table:first-of-type tbody tr');
        for (const row of rows) {
            const header = await row.$('td:first-child').then(td => td.evaluate(e => e.innerText));
            const body = await row.$('td:last-child').then(td => td.evaluate(e => e.innerText));

            if (header.match(/Price Structure/)) {
                data['Rate Type'] = body.match(/^[a-zA-Z]+/)[0];
            } else if (header.match(/Cancellation.*Fees/)) {
                const match = body.match(/\$([0-9.]+)/);
                if (match !== null && 1 in match) {
                    data['Cancellation Fee'] = match[1];
                } else {
                    data['Cancellation Fee'] = 0;
                }
            }
        }
    } catch (e) {
        log.info("NRG: Modal opening failed, ignoring");
    }

    await page.click('#modal-tos a.btn-close');
    return data;
};

const parsePlanList = async (context, utility, commodity) => {
    const { page, request } = context;

    const list = await page.$$('.plan-list .plan');
    for (const plan of list) {
        const priceP = parseFromElement(
            plan,
            '.pricing p.price',
            /[0-9.]+/
        ).then(text => parseFloat(text));
        const unitP = parseFromElement(
            plan,
            '.pricing .md-grey span'
        );
        const nameP = parseFromElement(plan, 'h3');
        const termP = parseFromElement(
            plan,
            '.details span.description',
            /([0-9]+) mo(\.|nth)/, 1
        );
        const typeP = parseFromElement(
            plan,
            '.details span.description',
            /([Ff]ixed|[Vv]ariable)/, 1
        );
        const greenP = parseFromElement(
            plan,
            '.details .green strong',
            /([0-9]+)%/, 1
        );

        const modalDataP = parseModal(page, plan, 'a.modal-tos');
        const [price, name, unit, term, type, green, modalData] = await Promise.all([
            priceP, nameP, unitP, termP, typeP, greenP, modalDataP
        ]);

        await saveData({
            'Rate': price/100,
            'Rate Category': name,
            'Commodity': commodity,
            'Rate Units': unit,
            'Utility': utility,
            'Term': term,
            'Rate Type': type,
            'Renewable Blend': green,
            ...modalData
        }, request.userData.site, request.userData.zipCode);
    }

};

const scrapeType = async (context, planType, commodity) => {
    const { page, request } = context;

    await page.evaluate(() => window.scrollBy(0, -window.innerHeight));

    const planSelector = `#show-${planType}-plans`;
    await page.click(planSelector);

    const utilitySelector = `#plan-utility-header-${planType}`;
    const notFound = planType === 'electric' ? 'elec' : planType;
    const result = await Promise.race([
        page.waitFor(utilitySelector, { visible: true }).then(() => true),
        page.waitFor(`#no-${notFound}-plans-state`).then(() => false)
    ]);
    if (!result) {
        log.info(`NRG: No ${planType} plans found for zip ${request.userData.zipCode.zip}`);
        return;
    }

    let utilityList = await page.$$(`${utilitySelector} .utility-select-widget > div a`);
    const utilityWidgetSelector = `${utilitySelector} .utility-select-widget`;
    for (let i = 0; i < utilityList.length; i++) {
        // Selector is hidden
        if (await page.$eval(utilityWidgetSelector, (el) => el.offsetParent === null)) {
            await page.click(`#utility-message.plan-utility-message-${planType} > a`);
            await page.waitFor(utilitySelector, { visible: true });

            utilityList = await page.$$(`${utilitySelector} .utility-select-widget > div a`);
        }
        const utilityOption = utilityList[i];

        await page.click(utilityWidgetSelector);
        await page.waitFor((widget) => document.querySelector(widget).classList.contains('expanded'), {}, utilityWidgetSelector);

        await utilityOption.click();
        await page.waitFor(utilitySelector, { hidden: false });

        const utilityName = await utilityOption.evaluate((e) => e.innerText);
        await parsePlanList(context, utilityName, commodity);
    }
};

exports.handleSite = async (context) => {
    const { page, request } = context;

    const plans = await page.$('#main-plan-wrapper');

    if (!plans) {
        log.info(`NRG: No plans found for zip ${request.userData.zipCode.zip}`);
        return;
    }

    await scrapeType(context, 'electric', 'Power');
    await scrapeType(context, 'gas', 'Gas');
};

exports.data = {
    name: "NRG",
    url: "https://www.nrghomepower.com/plans/?zipcode=%zipCode%",
    data: {
        "RateType": "Residential",
        "Supplier": "NRG Home"
    }
};