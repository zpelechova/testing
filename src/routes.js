const Apify = require('apify');

exports.handleStart = async ({ $ }) =>
{
    const requestQueue = await Apify.openRequestQueue();

    const links = $( "ul.menu li a" ).map( function() {  return $(this).attr('href'); }).get();

    for (i in links)
    {   
        links[i] = `https://potravinydomov.itesco.sk${links[i].replace('?include-children=true', '/all')}`
        await requestQueue.addRequest({
        url: links[i],
        userData: { label: 'DETAIL' }
        });
    }
};

exports.handleDetail = async ({ request, $ }) => {

    let result = {};
    result.itemUrl = request.url;
    result.category = $('h1').text();
    result.productCount = $('.items-count').text().replace(/\D/g, "");

    Apify.pushData(result)
};
