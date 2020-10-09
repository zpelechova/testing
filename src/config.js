const LABEL = {
    BASE: "BASE",
    UTILITY: "UTILITY"
}

const SELECTOR = {
    MORE_OPENER: "div.provider-list a[onclick]",
    UTILITIES_FIRST: "div.utility-option.utility-electric > ul > li:nth-child(1) div.provider-list a:not([onclick])",
    UTILITIES_SECOND: "div.utility-option.utility-electric > ul > li:nth-child(2) div.provider-list a",
    UTILITIES: "div.utility-option.utility-electric > ul > li div.provider-list a:not([onclick])",
    HOVER_TYPE_FIRST: "div.utility-option.utility-electric > ul > li:nth-child(1) > a",
    HOVER_TYPE_SECOND: "div.utility-option.utility-electric > ul > li:nth-child(2) > a",
    EXPORT_CSV: "#ctl00_ContentPlaceHolder1_lnkExportToCSV"
}

const BLOCK_RESOURCES = {
    patterns: [".jpg", ".jpeg", ".png", ".svg", ".gif", ".pdf", ".zip", ".woff", ".webm", ".webp", "data:image/"],
    analytics: [
        'adobedtm',
        'analytics.yahoo',
        'bing',
        'branch.io',
        'doubleclick',
        'connect.facebook',
        'google-analytics',
        'iponweb',
        'mathtag',
        'newrelic',
        'optimizely',
        'perimeterx',
        'sitelabweb',
        'tapad',
        'tr.snapchat.com',
        'zendesk',
    ]
};


module.exports = {
    LABEL,
    SELECTOR,
    BLOCK_RESOURCES
}
