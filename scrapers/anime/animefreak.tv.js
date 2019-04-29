const got = require('got');

const URL_BASE = 'https://www.animefreak.tv';
const WATCH_URL = `${URL_BASE}/watch`;

const GET_STREAM_REGEX = /file:"(.*?)"/;

async function scrape(kitsuDetails, episodeNumber=1) {
	const {slug, showType} = kitsuDetails.attributes;
	const slug2 = (showType === 'movie' ? 'movie' : `episode-${episodeNumber}`);

	const response = await got(`${WATCH_URL}/${slug}/episode/${slug2}`);
	const body = response.body;

	const stream = GET_STREAM_REGEX.exec(body);
	if (!stream || !stream[1]) {
		return null;
	}

	return [{
		provider: 'AFK',
		provider_full: 'Anime Freak',
		file_host: 'A1',
		file: stream[1]
	}];
}

module.exports = scrape;

/*
(async () => {
	console.time('Scrape Time');
	const streams = await scrape({ // Fake Kitsu response
		attributes: {
			slug: 'spirited-away',
			showType: 'movie'
		}
	}, 3);
	console.timeEnd('Scrape Time');
	console.log(streams);
})();
*/