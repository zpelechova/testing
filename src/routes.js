const Apify = require('apify');

const {utils: {log}} = Apify;
const results = [];

exports.handleBase = async ({request, $}, requestQueue, url) => {
    const dataset = await Apify.openDataset('powermatrix');
    $("#Form200>table>tbody>tr").each(async function (index) {
        if (url.slice(-1) == "R") {
            var CustomerType = "Residential"
        } else {
            var CustomerType = "Commercial"
        }

        if (index > 0) {
            var RT = $(this).find("td:nth-child(3)").text().trim();
            if (RT.match(/[a-zA-Z]+\ [a-zA-Z]+/)) {
                var RateType = RT.match(/[a-zA-Z]+\ [a-zA-Z]+/)[0]
            }
            else if (RT.match(/[a-zA-Z]+\/[a-zA-Z]+/)) {
                var RateType = RT.match(/[a-zA-Z]+\/[a-zA-Z]+/)[0]
            }
            else var RateType = RT;
            var rate = $(this).find("td:nth-child(3)").text().trim();
            if (rate.match(/(\d?\.\d+)/)) {
                var RateUpp = rate.match(/(\d?\.\d+)/)[0].replace(/\$/g, "")
            }
            else {
                var RateUpp = rate;
            }
            const cancellationFee = parseInt($(this).find("td:nth-child(7)").text()
                .trim().replace(/\r\n\   +/g, "").replace('$', '')) || 0;
            const offerNotes = $(this).find("td:nth-child(4)").text().trim();
            let rateUnit = 'therm';
            if(offerNotes.match(/per([-]|\s)(\w+)/)) {
                rateUnit = offerNotes.match(/per([-]|\s)(\w+)/)[2];
            }
            const termText = $(this).find("td:nth-child(6)").text().trim();
            let term  = termText.match(/(\d+)/) && parseInt(termText.match(/(\d+)/)[1]);
            if(termText.match(/Year/i)) {
                term = term * 12;
            }
            if(!term) {
                term = termText;
            }
            const fees = $(this).find("td:nth-child(5)").text().trim();
            let feeAmount;
            let feeType;
            if(fees.match(/(\d+[.]?\d+)/)) {
                feeAmount = fees.match(/(\d+[.]?\d+)/) && parseFloat(fees.match(/(\d+[.]?\d+)/)[1]);
            }
            if(fees.match(/(monthly|daily)/i)) {
                feeType = fees.match(/(monthly|daily)/i) && fees.match(/(monthly|daily)/i)[1];
            }

            results.push({
                "Date": (new Date()).toLocaleDateString("ISO"),
                "Commodity": "Gas",
                "State": "IL",
                "RateType": CustomerType,
                "Utility": $("#ctl00_content_PGAListView_ctrl0_Label1").text().trim(),
                "Supplier": $(this).find("td:nth-child(2)").text().trim().split("\r\n")[0],
                "Rate Type": RateType,
                "Rate": parseFloat(RateUpp),
                "Term": term,
                "Cancelation Fee": cancellationFee,
                "Offer Notes": offerNotes.replace(/\r\n\   +/g, ""),
                "Fee": feeAmount,
                "Rate Category": "",
                "Rate Units": "",
                "Renewable Blend": 0,
                "Fee Type": feeType,
                "Fee Notes": fees,
                "Termination Notes": "",
                "Other Notes": "",

            })
        }

    });
    await dataset.pushData(results);

    await Apify.pushData(results);

    //await Apify.utils.enqueueLinks({
    //  selector: "table.table-ags tbody tr td:nth-child(1) a",
    // $,
    //baseUrl: request.loadedUrl,
    //requestQueue,
    //transformRequestFunction: (request) => {
    //  request.userData.label = "DETAIL";
    //return request;
    //}
    //});
};

exports.handleDetail = async ({request, $}) => {
    //console.log(request.loadedUrl);
};
