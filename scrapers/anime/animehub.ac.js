/*
	THEY HAVE ADDED CLOUDFLARE PROTECTION.
	THIS IS NOW BROKEN.
*/

const got = require('got');

const SERVER_TYPES = [
	'oserver',
	'fserver',
	'ptserver',
];

const URL_BASE = 'https://animehub.ac';
const DETAIL_URL_BASE = `${URL_BASE}/detail`;
const AJAX_URL = `${URL_BASE}/ajax/anime/load_episodes_v2`;

const EPISODE_ID_REGEX = /\?ep=(\d*)/;

async function scrape(kitsuDetails, episodeNumber=1) {
	const detailURL = `${DETAIL_URL_BASE}/${kitsuDetails.attributes.slug}`;

	const subbedResponse = await got(`${detailURL}-sub`);
	const dubbedResponse = await got(`${detailURL}-dub`);

	const subbedStreams = parse(subbedResponse.body, episodeNumber);
	const dubbedStreams = parse(dubbedResponse.body, episodeNumber);
	
	return mergeArrays(subbedStreams, dubbedStreams);
}

async function parse(body, episodeNumber) {
	const streams = [];

	const EPISODE_NUMBER_PADDED = episodeNumber.toString().padStart(3, '0');
	const EPISODE_URL_REGEX = new RegExp(`<a href="(\/watch\/.*)" title=".* - Episode ${EPISODE_NUMBER_PADDED}">Episode ${EPISODE_NUMBER_PADDED}<\/a>`); // eslint-disable-line no-useless-escape

	const EPISODE_URL_DATA = EPISODE_URL_REGEX.exec(body);

	if (!EPISODE_URL_DATA || !EPISODE_URL_DATA[1]) {
		return null;
	}

	const EPISODE_ID_DATA = EPISODE_ID_REGEX.exec(EPISODE_URL_DATA[1]);

	if (!EPISODE_ID_DATA || !EPISODE_ID_DATA[1]) {
		return null;
	}

	const EPISODE_ID = EPISODE_ID_DATA[1];
	const EPISODE_URL = `${URL_BASE}${EPISODE_URL_DATA[1]}`;
	
	for (const server of SERVER_TYPES) {
		let response = await got.post(`${AJAX_URL}?s=${server}`, {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				Referer: `${EPISODE_URL}&s=${server}`
			},
			body: `episode_id=${EPISODE_ID}`
		});
		body = JSON.parse(response.body);

		if (!body.value || body.value.trim() === '') {
			continue;
		}

		response = await got(body.value, {
			json: true,
			headers: {
				Referer: `${AJAX_URL}?s=${server}`
			}
		});
		body = response.body;

		if (!body || !body.playlist || body.playlist.length <= 0) {
			continue;
		}

		for (const playlist of body.playlist) {
			if (playlist.file) {
				if (!playlist.label) {
					// this means it's an m3u8 stream (I think this is always true?)
					// not sure if I want to handle these or not?
					continue;
				}

				streams.push(playlist.file);
			}

			if (playlist.sources) {
				for (const source of playlist.sources) {
					streams.push(source.file);
				}
			}
		}
	}

	return streams;
}

module.exports = scrape;

function mergeArrays(...arrays) {
	return [...new Set([].concat(...arrays))];
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