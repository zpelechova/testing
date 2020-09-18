const constellation = require('./sites/constellation');
const justenergy = require('./sites/justenergy.js');
const nrg = require('./sites/nrg');
const nextera = require('./sites/nextera');
const reliant = require('./sites/reliant');
const directenergy = require('./sites/directenergy');
const igs = require('./sites/igs');

exports.handle = async (site, context) => {
    switch (site) {
        case 'CONSTELLATION':
            return constellation.handleSite(context);

        case 'NRG':
            return await nrg.handleSite(context);

        case 'NEXTERA':
            return await nextera.handleSite(context);

        case 'RELIANT':
            return await reliant.handleSite(context);

        case 'JUSTENERGY':
            return await justenergy.handleSite(context);

        case 'IGS':
            return await igs.handleSite(context);

        case 'DRE':
            return await directenergy.handleSite(context);
    }
}
;

exports.data = [
    constellation.data,
    justenergy.data,
    nextera.data,
    nrg.data,
    reliant.data,
    directenergy.data,
    igs.data
];
