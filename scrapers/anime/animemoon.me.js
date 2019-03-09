const got = require('got');
const url = require('url');
const psl = require('psl');
const async = require('async');
const { JSDOM } = require('jsdom');
const hostScrapers = require('../hosts');

const URL_BASE = 'https://animemoon.me';
const SEARCH_URL = `${URL_BASE}/search.php`;
const EPISODE_URL = `${URL_BASE}/watch.php`;

const ANIME_NAME_REGEX = /anime=(.*)"/;
const WATCH_PROXY_REGEX = /watchproxy\.php\?url=(.*)/;

async function scrape(kitsuDetails, episodeNumber=1) {
	let streams = [];

	const titleENGUS = kitsuDetails.attributes.titles.en_us;
	const titleENG = kitsuDetails.attributes.titles.en;
	const titleENGJPN = kitsuDetails.attributes.titles.en_jp;
	const titleJPN = kitsuDetails.attributes.titles.jp;

	const title = (titleENGJPN || titleENG || titleENGUS || titleJPN).toLowerCase();
	const titleEncoded = encodeURIComponent(title);

	const TITLE_JPN_REGEX = new RegExp(titleJPN, 'i');
	const TITLE_ENG_REGEX = new RegExp(titleENG, 'i');

	const response = await got(`${SEARCH_URL}?search=${titleEncoded}`);
	const body = response.body;
	const dom = new JSDOM(body);

	const searchResults = [...dom.window.document.querySelectorAll('div.movie-box')]
		.map(el => ({
			title: el.querySelector('.movie-Name').children[0].innerHTML,
			slug: el.querySelector('script').innerHTML.match(ANIME_NAME_REGEX)[1],
			translation: el.querySelector('.movie-extra-text').innerHTML.toLowerCase()
		}));
		
	const subList = searchResults.filter(({translation}) => translation === 'subbed');
	const dubList = searchResults.filter(({translation}) => translation === 'dubbed');

	const subbed = subList.find(({title}) => TITLE_JPN_REGEX.test(title) || TITLE_ENG_REGEX.test(title));
	const dubbed = dubList.find(({title}) => TITLE_JPN_REGEX.test(title) || TITLE_ENG_REGEX.test(title));

	if (!subbed && !dubbed) {
		return null;
	}

	const links = [subbed, dubbed];

	return new Promise(resolve => {
		async.each(links, (link, callback) => {
			if (!link) {
				return callback();
			}
			
			getEpisodeStreams(link, episodeNumber)
				.then(scrapedStreams => {
					if (scrapedStreams) {
						streams = mergeArrays(streams, scrapedStreams);
					}

					callback();
				});
		}, () => {
			return resolve(streams);
		});
	});
}

async function getEpisodeStreams(link, episodeNumber) {
	const streams = [];
	const dubbed = (link.translation == 'dubbed' ? true : false);

	const response = await got(`${EPISODE_URL}?a=${link.slug}&ep=episode_${episodeNumber}`);
	const body = response.body;
	const dom = new JSDOM(body);

	const embedURLs = [...dom.window.document.querySelectorAll('div.watch-video iframe')].map(el => el.dataset.src.match(WATCH_PROXY_REGEX)[1]);

	return new Promise(resolve => {
		async.each(embedURLs, (embedURL, callback) => {
			const host = url.parse(embedURL).host;
			const domain = psl.parse(host).domain;

			switch (domain) {
				case 'mp4upload.com':
					hostScrapers.MP4Upload.scrape(embedURL)
						.then(mp4upload => {
							if (mp4upload) {
								streams.push({
									provider: 'AM',
									provider_full: 'Anime Moon',
									file_host: 'mp4upload',
									file: mp4upload,
									dubbed: dubbed
								});
							}
							callback();
						});
					break;
				default:
					callback();
					break;
			}
		}, () => {
			return resolve(streams);
		});
	});
}

module.exports = scrape;

function mergeArrays(...arrays) {
	return [...new Set([].concat(...arrays))];
}

/*
(async () => {
	console.time('Scrape Time');
	const streams = await scrape({ // Fake Kitsu response
		attributes: {
			titles: {
				en: 'DARLING in the FRANXX',
				en_jp: 'Darling in the FranXX'
			}
		}
	}, 14);
	console.timeEnd('Scrape Time');

	console.log(streams);
})();
*/