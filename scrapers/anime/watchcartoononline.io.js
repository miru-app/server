const got = require('got');
const JSON5 = require('json5');

const LANGUAGE = 'english'; // I dunno if it can be other languages but here ya go anyway

// Site URLs
const URL_BASE = 'https://www.watchcartoononline.io';

// There's a lot of searching going on here, because the data is dynamic and I want only direct streams
const ARRAY_REGEX = /\w{3} = (\[.*\])/;
const SEED_REGEX = / - (\d*)\);/;
const EMBED_REGEX = /src="(.*?)"/;
const SOURCES_REGEX = /sources: \[((?:\s|.)*?)\]/mg;
const SOURCE_REGEX = /this.src\((.*)\);/;

// Options for 'got'
const OPTIONS = {
	throwHttpErrors: false // Turns off throwing exceptions for non-2xx HTTP codes
};

function base64Decode(base64) {
	return Buffer.from(base64, 'base64').toString('binary');
}

async function scrape(kitsuDetails, episodeNumber=1) {
	const streams = [];

	const URL_EPISODE_BASE = `${URL_BASE}/${kitsuDetails.attributes.slug}-episode-${episodeNumber}-${LANGUAGE}`;
	const URL_SUBBED = `${URL_EPISODE_BASE}-subbed`;
	//const URL_DUBBED = `${URL_EPISODE_BASE}-dubbed`;

	// Request the first page
	let response = await got(URL_SUBBED, OPTIONS);
	let body = response.body;

	// Find the encoded encoded chunk array
	const encodedArrayData = ARRAY_REGEX.exec(body);
	const encodedArray = JSON.parse(encodedArrayData[1]);

	// Find the seed
	const seedData = SEED_REGEX.exec(body);
	const seed = seedData[1];
		
	// Build the iframe string
	let iframeString = '';

	// I stole this directly from the site, bite me
	for (const item of encodedArray) {
		iframeString += String.fromCharCode(parseInt(base64Decode(item).replace(/\D/g,'')) - seed);
	}

	// Build the embed URL
	const embedURLData = EMBED_REGEX.exec(iframeString);
	const embedURL = embedURLData[1];

	const IFRAME_URL = `${URL_BASE}${embedURL}`;

	// Request the second page
	response = await got(IFRAME_URL, OPTIONS);
	body = response.body;

	// This page keeps the sources neatly stored in JavaScript
	let sourcesData = SOURCES_REGEX.exec(body);
	let sources;

	if (sourcesData) {
		sources = JSON5.parse(`[${sourcesData[1]}]`); // Using JSON5 to parse this lazy-JSON string
	} else {
		// the episode probably doesn't have multiple qualities, so lets just try to pull the only source
		sourcesData = SOURCE_REGEX.exec(body);
		if (sourcesData) {
			sources = JSON5.parse(sourcesData[1]); // Using JSON5 to parse this lazy-JSON string
		}
	}

	for (const source of sources) {
		streams.push({
			provider: 'WCO',
			provider_full: 'Watch Cartoons Online',
			file_host: 'WCO',
			file: source.src,
			subbed: true
		});
	}

	return streams; // Profit
}

module.exports = scrape;

/*
(async () => {
	const streams = await scrape({ // Fake Kitsu response
		attributes: {
			slug: 'tensei-shitara-slime-datta-ken'
		}
	}, 3);

	console.log(streams);
})();
*/