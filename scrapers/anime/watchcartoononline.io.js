const got = require('got');

const LANGUAGE = 'english'; // I dunno if it can be other languages but here ya go anyway

// Site URLs
const URL_BASE = 'https://www.watchcartoononline.io';

// There's a lot of searching going on here, because the data is dynamic and I want only direct streams
const ARRAY_REGEX = /\w{3} = (\[.*\])/;
const SEED_REGEX = / - (\d*)\);/;
const EMBED_REGEX = /src="(.*?)"/;
const SOURCES_REGEX = /getvidlink\.php\?(.*?)"/;

// Options for 'got'
const OPTIONS = {
	throwHttpErrors: false // Turns off throwing exceptions for non-2xx HTTP codes
};

function base64Decode(base64) {
	return Buffer.from(base64, 'base64').toString('binary');
}

async function scrape(kitsuDetails, episodeNumber=1) {
	const streams = [];

	let URL_EPISODE_BASE;
	let PAGE_URL;
	if (kitsuDetails.attributes.showType === 'movie') {
		PAGE_URL = `${URL_BASE}/${kitsuDetails.attributes.canonicalTitle.replace(' ', '-').toLowerCase()}`;
	} else {
		URL_EPISODE_BASE = `${URL_BASE}/${kitsuDetails.attributes.slug}-episode-${episodeNumber}-${LANGUAGE}`;
		PAGE_URL = `${URL_EPISODE_BASE}-subbed`;
	}

	// Request the first page
	let response = await got(PAGE_URL, OPTIONS);
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

	const GET_SOURCES_URL_DATA = SOURCES_REGEX.exec(body);
	if (!GET_SOURCES_URL_DATA) {
		return null;
	}

	const getSourcesUrl = `${URL_BASE}/inc/embed/getvidlink.php?${GET_SOURCES_URL_DATA[1]}`;


	response = await got(getSourcesUrl, {
		json: true,
		headers: {
			'X-Requested-With': 'XMLHttpRequest'
		}
	});
	const sources = response.body;

	const {enc: sd, hd, server} = sources;

	if (sd && sd.trim() !== '') {
		streams.push({
			provider: 'WCO',
			provider_full: 'Watch Cartoons Online',
			file_host: 'WCO',
			file: `${server}/getvid?evid=${sd}`
		});
	}

	if (hd && hd.trim() !== '') {
		streams.push({
			provider: 'WCO',
			provider_full: 'Watch Cartoons Online',
			file_host: 'WCO',
			file: `${server}/getvid?evid=${hd}`
		});
	}

	return streams; // Profit
}

module.exports = scrape;

/*
(async () => {
	console.time('Scrape Time');
	const streams = await scrape({ // Fake Kitsu response
		attributes: {
			canonicalTitle: 'Spirited Away',
			showType: 'movie'
		}
	}, 1);
	console.timeEnd('Scrape Time');
	console.log(streams);
})();
*/