const got = require('got');
const async = require('async');
const cheerio = require('cheerio');
const hostScrapers = require('../hosts');

const URL_BASE = 'https://animesimple.com';
const SEARCH_URL = `${URL_BASE}/request`;

const EMBED_REGEX = /var json = (.*);/gm;

// Options for "got"
const OPTIONS = {
	throwHttpErrors: false // Turns off throwing exceptions for non-2xx HTTP codes
};

async function scrape(kitsuDetails, episodeNumber=1) {
	const streams = [];

	const title = kitsuDetails.attributes.canonicalTitle.toLowerCase();
	const titleEncoded = encodeURIComponent(title);

	let response = await got(`${SEARCH_URL}?livequery=${titleEncoded}`, {
		json: true
	});
	let body = response.body;

	const {suggestions} = body;
	const anime = suggestions.find(({value}) => value.toLowerCase() === title);
	
	response = await got(anime.data, OPTIONS);
	body = response.body;
	const $ = cheerio.load(body);

	const episodeElement = $(`#ep-${episodeNumber}`);

	response = await got(episodeElement.attr('href'), OPTIONS);
	body = response.body;

	const embedArrayData = EMBED_REGEX.exec(body);
	const embedArray = JSON.parse(embedArrayData[1]);

	return new Promise(resolve => {
		async.each(embedArray, (embed, callback) => {
			const dubbed = (embed.type == 'dubbed' ? true : false);
			switch (embed.host) {
				case 'mp4upload':
					hostScrapers.MP4Upload.scrape(`https://www.mp4upload.com/embed-${embed.id}.html`)
						.then(mp4upload => {
							if (mp4upload) {
								streams.push({
									provider: 'AS',
									provider_full: 'Anime Simple',
									file_host: 'mp4upload',
									file: mp4upload,
									dubbed,
								});
							}

							callback();
						});
					break;
				case 'trollvid':
				default:
					callback();
					break;
			}
		}, () => {
			// Resolve the promise to return the streams
			return resolve(streams);
		});
	});
}

module.exports = scrape;

/*
(async () => {
	const streams = await scrape({ // Fake Kitsu response
		attributes: {
			canonicalTitle: 'Tensei shitara Slime Datta Ken'
		}
	}, 14);

	console.log(streams);
})();
*/