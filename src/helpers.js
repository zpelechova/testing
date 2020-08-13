const Apify = require("apify");

exports.saveData = async (data, zip) => {
    const date = new Date();
    const merged = {
        Date: `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`,
        State: zip.state,
        Zip: zip.zip,
        Commodity: 'power',
        Supplier: 'Constellation',
        "Rate Category": "digital",
        ...data
    };
    await Apify.pushData(merged);
};

exports.parseFromElement = async (
    elem,
    selector,
    regex = null,
    matchIndex = 0
) => {
    const text = await elem.$(selector).then(elem => {
        if (elem) {
            return elem.evaluate(n => n.innerText);
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
