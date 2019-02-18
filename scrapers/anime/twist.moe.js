const crypto = require('crypto-js');
const got = require('got');

const URL_BASE = 'https://twist.moe/api/anime';
const ACCESS_TOKEN = '1rj2vRtegS8Y60B3w3qNZm5T2Q0TN2NR';
const AES_KEY = 'k8B$B@0L8D$tDYHGmRg98sQ7!%GOEGOX27T';

async function scrape(kitsuDetails, episodeNumber=1) {
	episodeNumber--; // Arrays start at 0

	const response = await got(`${URL_BASE}/${kitsuDetails.attributes.slug}/sources`, {
		json: true,
		headers: {
			'x-access-token': ACCESS_TOKEN
		}
	});

	const data = response.body;

	const episode = data[episodeNumber];
	const source = episode.source;
		
	const decrypted = crypto.enc.Utf8.stringify(
		crypto.AES.decrypt(source, AES_KEY)
	);

	return [{
		provider: 'Twist',
		provider_full: 'Twist Moe',
		file_host: 'Twist',
		file: `https://twist.moe${decrypted}`
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