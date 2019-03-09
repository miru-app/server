const got = require('got');
const async = require('async');
const { JSDOM } = require('jsdom');
const hostScrapers = require('../hosts');
const VidStreaming = require('../hosts/vidstreaming');

const URL_BASE = 'https://animetv.to';
const SEARCH_URL = `${URL_BASE}/search?keyword`;
const WATCH_URL = `${URL_BASE}/watch`;

const GET_SLUG_REGEX = /\/anime\/(.*)\.html/i;
const HAS_DUB_REGEX = /\(DUB\)/i;
const STREAM_LINK_REGEX = /stream_link = "(.*?)"/;
//const STREAM_LINK2_REGEX = /stream_link_2 = "(.*?)"/; // Seems unused on the website?
//const STREAM_VIDCDN_REGEX = /stream_vidcdn = "(.*?)"/;

async function scrape(kitsuDetails, episodeNumber=1) {
	let streams = [];

	const titleENGJPN = kitsuDetails.attributes.titles.en_jp;
	const titleENGUS = kitsuDetails.attributes.titles.en_us;
	const titleENG = kitsuDetails.attributes.titles.en;
	const titleJPN = kitsuDetails.attributes.titles.jp;
	const title = (titleENGJPN || titleENGUS || titleENG || titleJPN);
	const titleEncoded = encodeURIComponent(title.toLowerCase());

	const response = await got(`${SEARCH_URL}=${titleEncoded}`);
	const body = response.body;
	const dom = new JSDOM(body);

	const searchResults = [...dom.window.document.querySelectorAll('ul.items li a')]
		.map(element => ({
			title: element.getAttribute('title'),
			slug: GET_SLUG_REGEX.exec(element.href)[1],
			dubbed: HAS_DUB_REGEX.test(element.getAttribute('title'))
		}));

	const subbed = searchResults.find(anime => (anime.title.includes(title) && !anime.dubbed));
	const dubbed = searchResults.find(anime => (anime.title.includes(title) && anime.dubbed));

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

	const response = await got(`${WATCH_URL}/${link.slug}-episode-${episodeNumber}.html`);
	const body = response.body;
	const dom = new JSDOM(body);

	const streamLink = body.match(STREAM_LINK_REGEX);
	//const streamLink2 = body.match(STREAM_LINK2_REGEX); // Seems unused?
	//const streamVIDCDN = body.match(STREAM_VIDCDN_REGEX);

	const servers = [...dom.window.document.querySelectorAll('.play-video')]
		.map(element => {
			const embedID = element.dataset.video;
			const playerType = element.classList[1];
			const obj = {
				playerType: playerType,
				dubbed: link.dubbed
			};

			switch (playerType) {
				case 'player':
					obj.embedUrl = streamLink[1];
					break;
				/*case 'vidcdn':
					obj.embedUrl = streamVIDCDN[1];
					break;*/
				case 'mp4upload':
					obj.embedUrl = `https://www.mp4upload.com/embed-${embedID}.html`;
					break;
				case 'openload':
					obj.embedUrl = `https://openload.co/embed/${embedID}`;
					break;
				case 'yourupload':
					obj.embedUrl = `http://www.yourupload.com/embed/${embedID}`;
					break;
				case 'estream':
					obj.embedUrl = `https://estream.to/embed-${embedID}.html`;
					break;
				case 'streamango':
					obj.embedUrl = `https://streamango.com/embed/${embedID}`;
					break;
				case 'kingvid':
					obj.embedUrl = `https://kingvid.tv/embed-${embedID}.html`;
					break;
				case 'vidup':
					obj.embedUrl = `https://vidup.me/embed-${embedID}.html`;
					break;
				case 'vidlox':
					obj.embedUrl = `https://vidlox.tv/embed-${embedID}.html`;
					break;
				case 'rapidvideo':
					obj.embedUrl = `https://www.rapidvideo.com/e/${embedID}`;
					break;
				case 'xstreamcdn':
					obj.embedUrl = `https://xstreamcdn.com/v/${embedID}`;
					break;
			
				default:
					break;
			}

			return obj;
		});

	return new Promise(resolve => {
		async.each(servers, (server, callback) => {
			const {playerType, embedUrl, dubbed} = server;
			if (!embedUrl) {
				return callback();
			}

			switch (playerType) {
				case 'player':
					VidStreaming.scrape(embedUrl)
						.then(vidstreaming => {
							if (vidstreaming) {
								for (const stream of vidstreaming) {
									streams.push({
										provider: 'ATV',
										provider_full: 'Anime TV',
										file_host: 'XStreamCDN',
										file: stream.file,
										quality: stream.quality,
										dubbed: !!dubbed
									});
								}
							}

							callback();
						});
					break;
				case 'xstreamcdn':
					hostScrapers.XStreamCDN.scrape(embedUrl)
						.then(xstreamcdn => {
							if (xstreamcdn) {
								for (const stream of xstreamcdn) {
									streams.push({
										provider: 'ATV',
										provider_full: 'Anime TV',
										file_host: 'XStreamCDN',
										file: stream.file,
										quality: stream.quality,
										dubbed: !!dubbed
									});
								}
							}

							callback();
						});
					break;
				case 'yourupload':
					hostScrapers.YourUpload.scrape(embedUrl)
						.then(yourupload => {
							if (yourupload) {
								streams.push({
									provider: 'ATV',
									provider_full: 'Anime TV',
									file_host: 'YourUpload',
									file: yourupload,
									dubbed: !!dubbed
								});
							}

							callback();
						});
					break;
				case 'mp4upload':
					hostScrapers.MP4Upload.scrape(embedUrl)
						.then(mp4upload => {
							if (mp4upload) {
								streams.push({
									provider: 'ATV',
									provider_full: 'Anime TV',
									file_host: 'mp4upload',
									file: mp4upload,
									dubbed: !!dubbed
								});
							}

							callback();
						});
					break;

				case 'openload':
					hostScrapers.OpenLoad.scrape(embedUrl)
						.then(openload => {
							if (openload) {
								got.head(openload)
									.then(head => {
										streams.push({
											provider: 'ATV',
											provider_full: 'Anime TV',
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

				case 'streamango':
					hostScrapers.StreaMango.scrape(embedUrl)
						.then(streamango => {
							if (streamango) {
								async.each(streamango, (stream, cb) => {
									got.head(stream.source.replace('//', '')).then(response => {
										streams.push({
											provider: 'ATV',
											provider_full: 'Anime TV',
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

				case 'rapidvideo':
					hostScrapers.RapidVideo.scrape(embedUrl)
						.then(rapidvideo => {
							if (rapidvideo) {
								for (const stream of rapidvideo) {
									streams.push({
										provider: 'ATV',
										provider_full: 'Anime TV',
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
			
				default:
					console.log(`Unknown host ${embedUrl}`);
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
				//en: 'That Time I Got Reincarnated as a Slime',
				en_jp: 'Kobayashi-san Chi no Maid Dragon',
			}
		}
	}, 1);
	console.timeEnd('Scrape Time');
	console.log(`Streams: ${streams.length}`);
	console.log(streams);
})();
*/