const url = require('url');
const psl = require('psl');
const querystring = require('querystring');
const got = require('got');
const async = require('async');
const { JSDOM } = require('jsdom');
const hostScrapers = require('../hosts');

const MAGIC_KEY = '0a9de5a4';

const URL_BASE = 'https://9anime.to';
const SEARCH_URL = `${URL_BASE}/ajax/film/search`;
const SERVERS_AJAX = `${URL_BASE}/ajax/film/servers`;
const EPISODE_AJAX = `${URL_BASE}/ajax/episode/info`;

// Updated from https://github.com/d3npa/nodeanime/blob/master/nineanime.js#L23-L44
function calculateMagic(_key, metadata) {
	function sum(string) {
		let a = 0;
		for (let i = 0; i < string.length; i++) {
			a += string.charCodeAt(i) + i;
		}
		return a;
	}

	function secret(t, i) {
		let e = 0;
		for (let n = 0; n < Math.max(t.length, i.length); n++) {
			e *= (n < i.length) ? i.charCodeAt(n) : 1;
			e *= (n < t.length) ? t.charCodeAt(n) : 1;
		}
		return Number(e).toString(16);
	}

	let magic = sum(_key);
	for (const [key, value] of Object.entries(metadata)) {
		magic += sum(secret(_key + key, value));
	}
	return magic - 49;
}

async function scrape(kitsuDetails, episodeNumber=1) {
	let streams = [];

	const titleENGUS = kitsuDetails.attributes.titles.en_us;
	const titleENG = kitsuDetails.attributes.titles.en;
	const titleENGJPN = kitsuDetails.attributes.titles.en_jp;
	const titleJPN = kitsuDetails.attributes.titles.jp;
	const title = (titleENGUS || titleENG || titleENGJPN || titleJPN);

	const ts = Date.now();

	const search_ = calculateMagic(MAGIC_KEY, {
		ts,
		sort: 'year:desc',
		keyword: title
	});

	const query = querystring.stringify({
		ts,
		_: search_,
		sort: 'year:desc',
		keyword: title
	});

	const response = await got(`${SEARCH_URL}?${query}`, {
		json: true
	});
	const html = response.body.html;
	const dom = new JSDOM(html);

	const searchResults = [...dom.window.document.querySelectorAll('a.name')]
		.map(element => ({
			title: element.innerHTML,
			href: element.href,
			dubbed: element.innerHTML.includes('(Dub)')
		}));

	const subList = searchResults.filter(({dubbed}) => !dubbed);
	const dubList = searchResults.filter(({dubbed}) => dubbed);
	const subbed = subList.find(anime => anime.title.includes(title));
	const dubbed = dubList.find(anime => anime.title.includes(title));

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

	const {dubbed, href} = link;
	const animeId = href.split('.').pop();

	const ts = Date.now();

	const servers_ = calculateMagic(MAGIC_KEY, {
		ts
	});

	const query = querystring.stringify({
		ts,
		_: servers_
	});

	const episodeUrl = `${SERVERS_AJAX}/${animeId}?${query}`;

	const response = await got(episodeUrl, {
		json: true
	});
	const html = response.body.html;
	const dom = new JSDOM(html);

	const servers = [...dom.window.document.querySelectorAll('div.server')]
		.map(server => {
			const episode = dom.window.document.querySelector(`div[data-id="${server.dataset.id}"] a[data-base="${episodeNumber}"]`);

			return {
				id: server.dataset.id,
				episode: {
					eid: episode.href.split('/').pop(),
					id: episode.dataset.id
				}
			};
		});

	return new Promise(resolve => {
		async.each(servers, (server, callback) => {
			const ts = Date.now();

			const episode_ = calculateMagic(MAGIC_KEY, {
				ts,
				id: server.episode.id,
				server: server.id
			});

			const query = querystring.stringify({
				ts,
				_: episode_,
				id: server.episode.id,
				server: server.id
			});
			
			got(`${EPISODE_AJAX}?${query}`, {
				json: true
			}).then(response => {
				const json = response.body;

				const embedURL = json.target;
				const host = url.parse(embedURL).host;
				const domain = psl.parse(host).domain;

				const metadataBase = {
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
											streams.push(Object.assign({
												file_host: 'OpenLoad',
												file: head.url
											}, metadataBase));

											callback();
										});
								} else {
									callback();
								}
							});
						break;
					case 'mp4upload.com':
						hostScrapers.MP4Upload.scrape(embedURL)
							.then(mp4upload => {
								if (mp4upload) {
									streams.push(Object.assign({
										file_host: 'mp4upload',
										file: mp4upload
									}, metadataBase));
								}

								callback();
							});
						break;
					case 'rapidvideo.com':
						hostScrapers.RapidVideo.scrape(embedURL)
							.then(rapidvideo => {
								if (rapidvideo) {
									for (const stream of rapidvideo) {
										streams.push(Object.assign({
											file_host: 'RapidVideo',
											file: stream.source,
											quality: stream.quality,
										}, metadataBase));
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
											streams.push(Object.assign({
												file_host: 'StreaMango',
												file: response.url,
												quality: stream.quality,
											}, metadataBase));

											cb();
										});
									}, callback);
								} else {
									callback();
								}
							});
						break;
					case 'mcloud.to': // This one was just a pain
						callback();
						break;
					case 'prettyfast.to':
						hostScrapers.PrettyFast.scrape(embedURL, episodeUrl)
							.then(prettyfast => {
								if (prettyfast) {
									streams.push(Object.assign({
										file_host: 'F5',
										file: prettyfast,
										m3u8: true,
									}, metadataBase));
								}

								callback();
							});
						break;
					default:
						console.log(domain);
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
			canonicalTitle: 'Tensei shitara Slime Datta Ken',
			titles: {
				en: 'That Time I Got Reincarnated as a Slime',
				en_jp: 'Tensei shitara Slime Datta Ken',
				ja_jp: '転生したらスライムだった件'
			}
		}
	}, 1);
	console.timeEnd('Scrape Time');
	console.log(streams);
})();
*/