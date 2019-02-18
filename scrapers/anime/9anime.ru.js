/*
	Based on https://github.com/graberzz/dubsubchecker
	except gets direct stream links
*/

const url = require('url');
const psl = require('psl');
const got = require('got');
const async = require('async'); // asynchronous utils
const { JSDOM } = require('jsdom');
const hostScrapers = require('../hosts');

const URL_BASE = 'https://9anime.ru';
const SEARCH_URL = `${URL_BASE}/search?keyword`;
// I am almost certainly going to get banned for doing this
// There are several query params that I am not sending
// The API seems to allow this but I have no idea if 9anime will issue bans or not
const SERVERS_AJAX = `${URL_BASE}/ajax/film/servers`;
const EPISODE_AJAX = `${URL_BASE}/ajax/episode/info`;

// Options for "got"
const OPTIONS = {
	throwHttpErrors: false // Turns off throwing exceptions for non-2xx HTTP codes
};

async function scrape(kitsuDetails, episodeNumber=1) {
	let streams = [];

	const titleENG = kitsuDetails.attributes.titles.en;
	const titleJPN = kitsuDetails.attributes.titles.en_jp;
	const title = (titleJPN || titleENG).toLowerCase();
	const titleEncoded = encodeURIComponent(title);

	const response = await got(`${SEARCH_URL}=${titleEncoded}`, OPTIONS);
	const body = response.body;
	const dom = new JSDOM(body);

	const searchResults = [...dom.window.document.querySelectorAll('a[data-jtitle]')]
		.map(el => ({
			title: el.dataset.jtitle.toLowerCase(),
			link: el.href
		}));
	const subList = searchResults.filter(({title}) => !title.includes('dub'));
	const dubList = searchResults.filter(({title}) => title.includes('dub'));
	const subbed = subList.find(anime => anime.title.includes(title));
	const dubbed = dubList.find(anime => anime.title.includes(title));

	if (!subbed && !dubbed) {
		return null;
	}

	const links = [];

	if (subbed) {
		const animeURL = subbed.link;
		const animeID = animeURL.split('.')[2];

		links.push({
			id: animeID,
			episodeNumber
		});
	}

	if (dubbed) {
		const animeURL = dubbed.link;
		const animeID = animeURL.split('.')[2];

		links.push({
			id: animeID,
			episodeNumber,
			dubbed: true
		});
	}

	return new Promise(resolve => {
		async.each(links, (link, callback) => {
			getEpisodeStreams(link.id, link.episodeNumber, link.dubbed)
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

async function getEpisodeStreams(animeID, episodeNumber, dubbed) {
	const streams = [];

	const response = await got(`${SERVERS_AJAX}/${animeID}`, {
		json: true
	});
	const html = response.body.html;
	const dom = new JSDOM(html);

	const episodeLinks = [...dom.window.document.querySelectorAll(`a[data-base="${episodeNumber}"]`)];

	return new Promise(resolve => {
		async.each(episodeLinks, (episodeLink, callback) => {
			const episodeID = episodeLink.dataset.id;

			got(`${EPISODE_AJAX}?id=${episodeID}`, {
				json: true
			}).then(response => {
				const embedURL = response.body.target;

				const host = url.parse(embedURL).host;
				const domain = psl.parse(host).domain;
	
				const streamObj = {
					provider: '9A',
					provider_full: '9anime',
					dubbed
				};
	
				switch (domain) {
					case 'openload.co':
					case 'openload.io':
					case 'openload.link':
					case 'oload.tv':
					case 'oload.stream':
					case 'oload.site':
					case 'oload.xyz':
					case 'oload.win':
					case 'oload.download':
					case 'oload.cloud':
					case 'oload.cc':
					case 'oload.icu':
					case 'oload.fun':
						hostScrapers.OpenLoad.scrape(embedURL)
							.then(openload => {
								if (openload) {
									got.head(openload)
										.then(head => {
											streamObj.file_host = 'OpenLoad';
											streamObj.file = head.url;
						
											streams.push(streamObj);
	
											callback();
										});
								} else {
									callback();
								}
							});
						break;
					case 'rapidvideo.com':
						hostScrapers.RapidVideo.scrape(embedURL)
							.then(rapidvideo => {
								if (rapidvideo) {
									for (const stream of rapidvideo) {
										streams.push({
											provider: '9A',
											provider_full: '9anime',
											file_host: 'RapidVideo',
											file: stream.source,
											quality: stream.quality,
											dubbed
										});
									}
								}
	
								callback();
							});
						break;
					case 'streamango.com':
						hostScrapers.StreaMango.scrape(embedURL)
							.then(streamango => {
								if (streamango) {
									async.each(streamango, (stream, cb) => {
										got.head(stream.source.replace('//', '')).then(response => {
											streams.push({
												provider: '9A',
												provider_full: '9anime',
												file_host: 'StreaMango',
												file: response.url,
												quality: stream.quality,
												dubbed
											});

											cb();
										});
									}, callback);
								} else {
									callback();
								}
							});
						break;
					case 'mp4upload.com':
						hostScrapers.MP4Upload.scrape(embedURL)
							.then(mp4upload => {
								if (mp4upload) {
									streamObj.file_host = 'mp4upload';
									streamObj.file = mp4upload;
									streams.push(streamObj);
								}
	
								callback();
							});
						break;
					case 'mcloud.to': // This one was just a pain
						callback();
						break;
					default:
						console.warn(`FOUND UNIMPLEMENTED DOMAIN '${embedURL}'`);
						callback();
						break;
				}
			});
		}, () => {
			return resolve(streams);
		});
	});
}

function mergeArrays(...arrays) {
	return [...new Set([].concat(...arrays))];
}

module.exports = scrape;

/*
(async () => {
	console.time('Scrape Time');
	const streams = await scrape({ // Fake Kitsu response
		attributes: {
			titles: {
				en: 'That Time I Got Reincarnated as a Slime',
				en_jp: 'Tensei shitara Slime Datta Ken',
			}
		}
	}, 1);
	console.timeEnd('Scrape Time');
	console.log(streams);
})();
*/