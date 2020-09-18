const { saveData, parseFromElement } = require("../common");
const { URL } = require("url");
const { log } = require("apify").utils;
const DOMAIN = "https://www.directenergy.com/";
const BUTTON_SELECTOR =
    ".my-5 .button-yellow.button-large.font-size-100.text-center";

/**
 *
 * @param list
 * @param commodity
 * @param request
 * @param page
 * @returns {Promise<Array>}
 */
const scrapeResultList = async (list, commodity, request, page, utility) => {
    const data = [];
    for (const elem of list) {
        const cost = parseFloat(
            await parseFromElement(elem, ".rate_amount", /[0-9.]+/)
        );

        const term = await parseFromElement(
            elem,
            ".grid-month",
            /([0-9]+) Month/,
            1
        );
        const rateType = await parseFromElement(
            elem,
            ".grid-card-body .text-center:first-child .caption",
            /([a-zA-Z]+) Rate/, 1
        );
        let unit = await parseFromElement(elem, ".rate_units", /(\D+)/, 1);
        if (unit.includes("Per")) {
            const splittedUnit = unit.split(" ");
            unit = splittedUnit[1];
        }

        const greenElement = await elem.$(".supportGreen");
        const renewable = !!greenElement;

        const detail = await elem.$eval(".plan-details", node => node.href);

        data.push({
            Rate: cost,
            Term: term,
            Commodity: commodity,
            "Rate Units": unit,
            Supplier: "Direct Energy",
            Utility: utility,
            "Rate Type": rateType,
            detail
        });
    }

    return data;
};

/**
 *
 * @param page
 * @param request
 * @param count {number}
 * @returns {Promise<Array>}
 */
const scrapeUtilities = async ({ page, request }, count) => {
    const data = [];
    for (let x = 2; x <= count; x++) {
        const addressLink = await page.$(`${BUTTON_SELECTOR} a`);
        if (!addressLink) return;
        await addressLink.click();

        await page.waitForSelector("#popup-window-overlay", {
            visible: true
        });
        const submitButton = await page.$("#popup-window-overlay form button");
        await submitButton.click();
        await page.waitForSelector(".tab-card", { visible: true });

        const supplier = await page.$(`#tab-0 .list-group a:nth-child(${x})`);
        if (!supplier) continue;
        await supplier.click();
        await page.waitForNavigation();
        const utility = await page.$eval(
            `${BUTTON_SELECTOR} strong`,
            node => node.innerText
        );

        const powerList = await page.$$(".grid-card > div");
        const supplierData = await scrapeResultList(
            powerList,
            "Power",
            request,
            page,
            utility
        );
        data.push(...supplierData);
    }
    return data;
};

/**
 *
 * @param context
 * @param counts
 * @returns {Promise<void>}
 */
const handleScrape = async (context, counts) => {
    const { page, requestQueue, request } = context;
    const { electricity: electricityCount, gas: gasCount } = counts;

    await page.waitForSelector(".plans_load_msg", { hidden: true });

    const powerList = await page.$$(".grid-card > div");

    const powerUtilityElement = await page.$(`${BUTTON_SELECTOR} strong`);
    let powerUtility = "";
    if (powerUtilityElement) {
        powerUtility = await powerUtilityElement.evaluate(
            node => node.innerText
        );
    }
    const powerData = await scrapeResultList(
        powerList,
        "Power",
        request,
        page,
        powerUtility
    ) || [];

    if (electricityCount > 1) {
        const elUtilities = await scrapeUtilities(context, electricityCount);
        powerData.push(...elUtilities);
    }

    const gasTab = await page.$(".fauxTab:nth-child(2)");
    await gasTab.click();
    await page.waitForNavigation();

    const gasUtility = await page.$eval(
        `${BUTTON_SELECTOR} strong`,
        node => node.innerText
    );
    await page.waitForSelector(".plans_load_msg", { hidden: true });
    const gasList = await page.$$(".grid-card > div");
    const gasData = await scrapeResultList(
        gasList,
        "Gas",
        request,
        page,
        gasUtility
    );

    if (counts.gas > 1) {
        const gasUtilities = await scrapeUtilities(context, gasCount);
        gasData.push(...gasUtilities);
    }

    const allData = [...powerData, ...gasData];

    //detail pages
    for (const single of allData) {
        const { detail, ...restData } = single;

        if (detail) {
            await requestQueue.addRequest({
                url: detail,
                userData: {
                    ...request.userData,
                    detail: true,
                    data: restData
                }
            });
        }
    }
};

/**
 *
 * @param context
 * @returns {Promise<void>}
 */
const scrapeDetail = async context => {
    const { page, request } = context;
    const data = request.userData.data;

    try {
        await page.waitForSelector('#page_content_primary .plan-page-header ul');
    } catch (e) {
        log.info(
            `DirectEnergy: Detail not working ${request.userData.zipCode.zip} ${JSON.stringify(data)}`
        );
        return
    }

    const list = await page.$("#page_content_primary .plan-page-header ul");
    const listItems = await list.$$("li");
    let fee = "";
    let rate;
    let offerNotes = "";

    for (const item of listItems) {
        const innerText = await item.evaluate(node => node.innerText);
        if (innerText.includes("fee")) {
            fee = innerText;
        } else if (innerText.match(/^([a-zA-Z]+) rate([*]?)$/)) {
            const rateMatch = innerText.match(/^([a-zA-Z]+) rate([*]?)$/);
            rate = rateMatch[0];
        } else {
            if (offerNotes) offerNotes += "; ";
            offerNotes += innerText;
        }
    }

    await saveData(
        {
            ...data,
            "Cancellation Fee": fee,
            "Offer Notes": offerNotes
        },
        request.userData.site,
        request.userData.zipCode
    );
};

/**
 *
 * @param context
 * @returns {Promise<boolean>}
 */
exports.handleSite = async context => {
    const { page, request, requestQueue } = context;

    if (request.userData.detail) {
        await scrapeDetail(context);
        return true;
    }

    await page.waitFor(500); // waiting for feedback modal to show
    //feedback modal
    const modalShowed = await page.$("#fsrInvite");
    if (modalShowed) {
        const closeButton = await page.$(".fsrInvite__closeWrapper");
        if (closeButton) {
            await closeButton.click();
        }
    }

    const textSelector = '#left-hero input[id*="addressZipaddressLookup"]';
    const formSelector = "#left-hero .zip-form-group form";

    await page.$(textSelector).then(elem => elem.evaluate(e => (e.value = "")));
    await page.type(textSelector, request.userData.zipCode.zip);

    const form = await page.$(formSelector);
    const submit = await form.$('[type="submit"], button');
    await submit.click();


    if (request.url !== DOMAIN) {
        await scrapeDetail(context);
        return true;
    }

    try {
        await page.waitForSelector("#popup-window-overlay", { visible: true });
    } catch (e) {
        const { id, ...restRequest } = request;
        log.info(
            `DirectEnergy: Request failed retrying ${request.userData.zipCode.zip}`
        );
        await requestQueue.addRequest(restRequest);
        return false;
    }

    const electricitySellers = await page.$$(
        "#popup-window #myTabContent #tab-0 a"
    );
    const gasSellers = await page.$$("#popup-window #myTabContent #tab-1 a");
    const counts = {
        electricity: electricitySellers.length,
        gas: gasSellers.length
    };

    const seller = await page.$("#popup-window #myTabContent #tab-0 a");
    if (seller) {
        await seller.click();
    } else {
        log.info(
            `DirectEnergy: No plans found for zip ${request.userData.zipCode.zip}`
        );
        return false;
    }

    try {
        await page.waitForNavigation();
    } catch (e) {
        // handling weirdly behaving zips, e.q. 12601
        try {
            const continueButton = await page.$(".continue_button");
            if (continueButton) {
                await continueButton.click();
            }
            await page.waitForNavigation();
        } catch (e) {
            log.info(
                `DirectEnergy: Error happened, zip ${request.userData.zipCode.zip}`
            );
        }
    }

    await handleScrape(context, counts);
    return true;
};

exports.data = {
    name: "DRE",
    url: DOMAIN,
    data: {
        RateType: "Residential"
    }
};
