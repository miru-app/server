/*
	ANIMEHEAVEN IS NOW DEAD
	UNSURE IF THIS WILL WORK ON THE REHOST SITES AND CLONES
	KEEPING JUST IN CASE A CLONE SITE POPS UP FOR THE ORIGINAL COMES BACK
*/

/*
	THIS SCRAPER WILL BREAK OFTEN.
	ANIMEHEAVEN BANS BOTS AND SCRAPERS QUICKLY
*/

const crypto = require('crypto'); // Node crypto module
const got = require('got'); // Promise-based HTTP request module
const querystring = require('querystring'); // Node module for building/parsing URL query strings

const URL_BASE = 'http://animeheaven.eu/watch.php';

const ENCRYPTION_KEY = 'ysdgetcfc'; // Seems to be static? It works for all the series I've tried

// Each video seems to have 3 different sources, possibly different qualities?
// Each one seems to use a static variable name, so they can easily be found with a RegEx
const STREAM_1_REGEX = /var soienfu="(.*)";/;
const STREAM_2_REGEX = /var iusfdb="(.*)";/;
const STREAM_3_REGEX = /var ufbjhse="(.*)";/;

const BASE64_SEED_REGEX = /\(\/\\\|\/g,"(.*)"\);/; // There seems to be some seed that the base64 uses

// https://stackoverflow.com/a/4209150
String.prototype.decodeEscapeSequence = function() {
	return this.replace(/\\x([0-9A-Fa-f]{2})/g, function() {
		return String.fromCharCode(parseInt(arguments[1], 16));
	});
};

// atob. Node does not have a native atob function, it's sugar added by the browser
function base64Decode(base64) {
	return Buffer.from(base64, 'base64').toString('binary');
}

// Just RC4 cryption
function decrypt(key, crypted) {
	const decipher = crypto.createDecipheriv('rc4', key, '');	
	const decrypted = decipher.update(crypted, 'binary', 'utf8');
	return decrypted + decipher.final('utf8');
}

async function scrape(title, episodeNumber=1, dubbed=false) {
	const streams = []; // All the streams will be placed in here

	// Building the query string
	const query = querystring.stringify({
		a: (dubbed ? `${title} Dubbed` : title), // Check if the user wants dubbed or not, and set the title accordingly
		e: episodeNumber
	});

	// Request the page and get the page content/body
	const response = await got(`${URL_BASE}?${query}`);
	const body = response.body;

	// The base64 used by the site has a certain seed character replaced with a pipe ('|')
	// This RegEx will look for the seed
	const BASE64_SEED_REGEX_DATA = BASE64_SEED_REGEX.exec(body);
	if (!BASE64_SEED_REGEX_DATA || !BASE64_SEED_REGEX_DATA[1]) {
		return null;
	}

	// Store the seed if found
	const BASE64_SEED = BASE64_SEED_REGEX_DATA[1];

	// Search for the stream base64 string
	let STREAM_REGEX_DATA = STREAM_1_REGEX.exec(body);
	if (STREAM_REGEX_DATA) {
		let encoded = STREAM_REGEX_DATA[1].decodeEscapeSequence(); // The string returned by the RegEx is NOT formatted and is still escaped, so first it must be decoded
		encoded = encoded.replace(/\|/g, BASE64_SEED); // Replace the pipe with the seed
		const encrypted = base64Decode(encoded); // Decode the base64 string
		streams.push(decrypt(ENCRYPTION_KEY, encrypted)); // And finally decrypt the content with RC4 and push to the array
	}

	// The above is then repeated for the remaining 2 streams

	STREAM_REGEX_DATA = STREAM_2_REGEX.exec(body);
	if (STREAM_REGEX_DATA) {
		let encoded = STREAM_REGEX_DATA[1].decodeEscapeSequence();
		encoded = encoded.replace(/\|/g, BASE64_SEED);
		const encrypted = base64Decode(encoded);
		streams.push(decrypt(ENCRYPTION_KEY, encrypted));
	}

	STREAM_REGEX_DATA = STREAM_3_REGEX.exec(body);
	if (STREAM_REGEX_DATA) {
		let encoded = STREAM_REGEX_DATA[1].decodeEscapeSequence();
		encoded = encoded.replace(/\|/g, BASE64_SEED);
		const encrypted = base64Decode(encoded);
		streams.push(decrypt(ENCRYPTION_KEY, encrypted));
	}

	// Profit
	return streams;
}

module.exports = scrape;