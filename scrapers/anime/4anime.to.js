const got = require('got');
const cheerio = require('cheerio');

const URL_BASE = 'https://4anime.to';

const SOURCE_REGEX = /<source src="(.*)" type=".*" \/>/;

// Options for "got"
const OPTIONS = {
	throwHttpErrors: false // Turns off throwing exceptions for non-2xx HTTP codes
};

async function scrape(kitsuDetails, episodeNumber=1) {
	episodeNumber--; // Arrays start at 0

	let response = await got(`${URL_BASE}/${kitsuDetails.attributes.slug}`, OPTIONS);
	let body = response.body;

	if (response.statusCode !== 200) {
		return null;
	}

	const $ = cheerio.load(body);
	const episodes = $('ul.episodes').children().get().reverse();
	const episode = episodes[episodeNumber];
	const episodeURL = episode.children[0].attribs.href;

	response = await got(episodeURL);
	body = response.body;

	const SOURCE_DATA = SOURCE_REGEX.exec(body);
	if (!SOURCE_DATA || !SOURCE_DATA[1]) {
		return null;
	}

	return [{
		provider: '4A',
		provider_full: '4anime',
		file_host: '4A',
		file: SOURCE_DATA[1]
	}];
}

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

module.exports = scrape;