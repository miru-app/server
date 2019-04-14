const got = require('got'); // HTTP module
const async = require('async'); // asynchronous utils

const scrapers = require('./scrapers'); // all anime scapers

// Data URLS
const KITSU_URL_BASE = 'https://kitsu.io/api';
const ANIME_DETAILS_URL = `${KITSU_URL_BASE}/edge/anime`;

// Required headers for Kitsu
const KITSU_HEADERS = {
	'Accept': 'application/vnd.api+json',
	'Content-Type': 'application/vnd.api+json'
};

async function getStreams(kitsuID, episodeNumber=1) {
	let streams = []; // All streams will end up in here, this will be returned
	
	// Request the anime's data from Kitsu
	const response = await got(`${ANIME_DETAILS_URL}/${kitsuID}`, {
		json: true,
		headers: KITSU_HEADERS
	});
	const body = response.body;
	const details = body.data; // Grab the details

	// Return a promise so that we can `await` this function
	return new Promise(resolve => {
		// Loop over every scraper in parallel
		async.each(scrapers, (scraper, callback) => {
			// Start the async scraping process
			scraper(details, episodeNumber)
				.then(scrapedStreams => {
					// Merge the returned streams with the master list
					if (scrapedStreams) {
						streams = mergeArrays(streams, scrapedStreams);
					}
					callback();
				})
				.catch(() => { // Silently ignore errors for now
					callback();
				});
		}, () => {
			// Resolve the promise to return the streams
			return resolve(streams);
		});
	});
}

module.exports = getStreams; // Export the function

// Tesing
(async () => {
	/*
	console.time('Scrape Time');
	const streams = await getStreams(41024, 1);
	console.timeEnd('Scrape Time');
	console.log(`Scrapers: ${Object.keys(scrapers).length}`);
	console.log(`Total streams: ${streams.length}`);
	console.log(streams);
	*/
})();

// Combine arrays together
function mergeArrays(...arrays) {
	// Black magic
	return [...new Set([].concat(...arrays))];
}