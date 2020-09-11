# Okay.sk scraper

The actor will scrape all products from [Okay.sk](https://www.okay.sk/). It is going through the whole categories and pagination, gets the link to the product details and gets data in format as shown below.

Example item:
``` 
{
  "itemUrl": "https://www.okay.sk/televizor-strong-srt32hb4003-2019-32-80-cm/",
  "itemId": 591963,
  "itemName": "Televízor Strong SRT32HB4003 (2019) / 32\" (80 cm)",
  "currentPrice": 199,
  "originalPrice": 199,
  "discounted": false,
  "breadcrumb": "ELEKTRO »Televízory »Uhlopriečka TV »TV s uhlopriečkou 32\" (81 cm) »Televízor Strong SRT32HB4003 (2019) / 32\" (80 cm)",
  "currency": "EUR",
  "inStock": true,
  "img": "https://img.okay.sk/gal/tv-s-uhloprieckou-32-81-cm-televizor-strong-srt32hb4003-2019-32-80-cm-original-1356882.jpg"
}
```
