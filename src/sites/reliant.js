const { fillForm, parseFromElement, saveData, extractPDF } = require('../common');
const { log } = require('apify').utils;
const { URL } = require('url');

const DOMAIN = "https://www.reliant.com";

const parsePdfFacts = async (result) => {
    const utilityRegex = /([a-zA-Z_\- ]+) Delivery Charges:/;
    const renewableRegex = /This product is ([0-9]+)% renewable./;
    const data = {};

    const href = await result.$('.planPdfLinks li:first-child a')
        .then(a => a.evaluate(e => e.getAttribute('href')));
    const pdfUrl = new URL(href, DOMAIN);
    const pdfText = (await extractPDF(pdfUrl)).join(' ');

    let m = pdfText.match(utilityRegex);
    if (m) {
        data['Utility'] = m[1].trim();
    }
    m = pdfText.match(renewableRegex);
    if (m) {
        data['Renewable Blend'] = m[1];
    }

    return data;
};

const parseResults = async (context) => {
    const { page, request } = context;

    const results = await page.$$('.sort-list .alloffers.offerPlanCommon');
    for (const result of results) {
        const nameP = parseFromElement(
            result,
            '.planNameDiv'
        );
        const termP = parseFromElement(
            result,
            '.termvalue span.hidden'
        ).then(text => parseInt(text));
        const typeP = parseFromElement(
            result,
            '.termRType .effra .left:last-child'
        ).then(text => text.trim());
        const cancelFeeP = parseFromElement(
            result,
            '.div_months_fee .term_months.stndcancelfee',
            /\$([0-9]+)/, 1
        );
        const unitP = parseFromElement(
            result,
            '.avgprice_new .effra',
            /per\s([a-zA-Z]+)/, 1
        );


        const pdfDataP = parsePdfFacts(result);

        const [name, term, type, cancelFee, unit, pdfData] = await Promise.all([
            nameP, termP, typeP, cancelFeeP, unitP, pdfDataP
        ]);
        const usages = await result.$$('table.allPlanTable tbody tr');
        for (const usageRow of usages) {
            const usageP = parseFromElement(
                usageRow,
                'td:first-child',
                /([0-9]+)\skWh/, 1
            );
            const priceP = parseFromElement(
                usageRow,
                'td:nth-child(2)',
                /[0-9.]+/
            ).then(text => parseFloat(text));

            const [usage, price] = await Promise.all([usageP, priceP]);
            if (usage && price) {
                await saveData(
                    {
                        "Rate Type": type,
                        "Rate Category": name,
                        "Rate": price / 100,
                        "Monthly Usage": usage,
                        "Rate Units": unit,
                        "Term": term,
                        "Cancellation Fee": cancelFee,
                        ...pdfData
                    },
                    request.userData.site, request.userData.zipCode
                );
            }
        }
    }
};

const scrapeSite = async (context) => {
    const { page } = context;

    const filters = await page.$$('.visualFilterDiv .filterTileDiv');
    for (let i = 0; i < filters.length; i++) {
        const filter = await page.$(`.visualFilterDiv .filterTileDiv:nth-child(${i + 1})`)
        if (!await filter.evaluate(e => e.classList.contains('activeTile'))) {
            await Promise.all([
                filter.click(),
                page.waitForNavigation()
            ]);
        }

        await parseResults(context);
    }
};

exports.handleSite = async (context) => {
    const { page, request } = context;

    await fillForm(
        page,
        '#changeaddressfrm',
        [
            {
                selector: '#zipcode',
                text: request.userData.zipCode.zip
            }
        ],
        '#changeaddressbtn'
    );

    const content = await page.$('#tablebox');
    if (!content) {
        log.info(`RELIANT: No plans found for zip ${request.userData.zipCode.zip}`);
        return;
    }

    return scrapeSite(context);
};

exports.data = {
    name: 'RELIANT',
    url: 'https://www.reliant.com/en/public/reliant-pick-your-free.jsp',
    data: {
        "RateType": "Residential",
        "Commodity": "Power",
        "Supplier": "Reliant Energy Retail Services"
    }
};