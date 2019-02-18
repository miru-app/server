const got = require('got');
const async = require('async');
const { JSDOM } = require('jsdom');
const hostScrapers = require('../hosts');

const URL_BASE = 'https://animesimple.com';
const SEARCH_URL = `${URL_BASE}/search`;

const EMBED_REGEX = /var json = (.*);/gm;

// Options for "got"
const OPTIONS = {
	throwHttpErrors: false // Turns off throwing exceptions for non-2xx HTTP codes
};

async function scrape(kitsuDetails, episodeNumber=1) {
	const streams = [];

	const titleENG = kitsuDetails.attributes.titles.en;
	const titleJPN = kitsuDetails.attributes.titles.en_jp;
	const title = (titleJPN || titleENG).toLowerCase();
	const titleEncoded = encodeURIComponent(title);

	let response = await got(`${SEARCH_URL}?q=${titleEncoded}`, OPTIONS);
	let body = response.body;
	let dom = new JSDOM(body);

	const searchResults = [...dom.window.document.querySelectorAll('h4.media-heading a')]
		.map(el => ({
			title: el.innerHTML,
			link: el.href
		}));

	const anime = searchResults.find(anime => (anime.title.includes(titleENG) || anime.title.includes(titleJPN)));

	response = await got(anime.link, OPTIONS);
	body = response.body;
	dom = new JSDOM(body);

	const episodeElement = dom.window.document.getElementById(`ep-${episodeNumber}`);

	response = await got(episodeElement.href, OPTIONS);
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
									dubbed: dubbed,
									subbed: !dubbed
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
			titles: {
				en: 'That Time I Got Reincarnated as a Slime',
				en_jp: 'Tensei shitara Slime Datta Ken'
			}
		}
	}, 14);

	console.log(streams);
})();
*/