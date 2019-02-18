const got = require('got');
const async = require('async');
const { JSDOM } = require('jsdom');
const hostScrapers = require('../hosts');

const URL_BASE = 'https://gogoanimes.co';

async function scrape(kitsuDetails, episodeNumber=1) {
	let streams = [];

	// Decided to make this sub-only to even things out
	// Plus, doing both sub and dub seemed to add about 3 seconds to scrape time
	const subURL = `${URL_BASE}/${kitsuDetails.attributes.slug}-episode-${episodeNumber}`;
	//const dubURL = `${URL_BASE}/${kitsuDetails.attributes.slug}-dub-episode-${episodeNumber}`;
	const urls = [{link:subURL},/*{link:dubURL,dubbed:true}*/];

	return new Promise(resolve => {
		async.each(urls, (url, callback) => {
			const link = url.link;
			const dubbed = url.dubbed;
			got(link).then(response => {
				const body = response.body;
				const dom = new JSDOM(body);

				const servers = [...dom.window.document.querySelectorAll('.anime_muti_link ul li a')]
					.map(el => ({
						type: el.getAttribute('rel'),
						video: el.dataset.video
					}));

				getEpisodeStreams(servers, dubbed).then(scrapedStreams => {
					streams = mergeArrays(streams, scrapedStreams);
					callback();
				});
			});
		}, () => {
			return resolve(streams);
		});
	});
}

async function getEpisodeStreams(servers, dubbed) {
	const streams = [];
	return new Promise(resolve => {
		async.each(servers, (server, callback) => {
			const type = server.type;
			const embedURL = server.video;

			switch (type) {
				case '16':
				case '5':
					hostScrapers.OpenLoad.scrape(embedURL)
						.then(openload => {
							if (openload) {
								got.head(openload)
									.then(head => {
										streams.push({
											provider: 'GG',
											provider_full: 'Go Go Animes',
											file_host: 'OpenLoad',
											file: head.url,
											dubbed: !!dubbed
										});

										callback();
									});
							} else {
								callback();
							}
						});
					break;
				case '21':
					hostScrapers.RapidVideo.scrape(embedURL)
						.then(rapidvideo => {
							if (rapidvideo) {
								for (const stream of rapidvideo) {
									streams.push({
										provider: 'GG',
										provider_full: 'Go Go Animes',
										file_host: 'RapidVideo',
										file: stream.source,
										quality: stream.quality,
										dubbed: !!dubbed
									});
								}
							}

							callback();
						});
					break;
				case '12':
					hostScrapers.StreaMango.scrape(embedURL)
						.then(streamango => {
							if (streamango) {
								async.each(streamango, (stream, cb) => {
									got.head(stream.source.replace('//', '')).then(response => {
										streams.push({
											provider: 'GG',
											provider_full: 'Go Go Animes',
											file_host: 'StreaMango',
											file: response.url,
											quality: stream.quality,
											dubbed: !!dubbed
										});

										cb();
									});
								}, callback);
							} else {
								callback();
							}
						});
					break;
				case '3':
					hostScrapers.MP4Upload.scrape(embedURL)
						.then(mp4upload => {
							if (mp4upload) {
								streams.push({
									provider: 'GG',
									provider_full: 'Go Go Animes',
									file_host: 'mp4upload',
									file: mp4upload,
									dubbed: !!dubbed
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

function mergeArrays(...arrays) {
	return [...new Set([].concat(...arrays))];
}

/*
(async () => {
	console.time('Scrape Time');
	const streams = await scrape({ // Fake Kitsu response
		attributes: {
			slug: 'tensei-shitara-slime-datta-ken'
		}
	}, 3);
	console.timeEnd('Scrape Time');
	console.log(streams);
})();
*/

module.exports = scrape;