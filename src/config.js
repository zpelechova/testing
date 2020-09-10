exports.BLOCK_RESOURCES = {
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

exports.SELECTORS = {
    PLAN_AREA: "section.plans div.row.ng-scope",
    RATE: "div.rate > h3 span.ng-binding",
    VENDOR: "h4.plan-title > span",
    CANCELLATION_FEE: "span[data-ng-bind-html='plan.CancellationFeeText']",
    TERM: "span[data-ng-bind-html='plan.Term']"
};
