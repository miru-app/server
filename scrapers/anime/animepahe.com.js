const got = require('got');
const async = require('async');
const url = require('url');
const psl = require('psl');
const hostScrapers = require('../hosts');

const URL_BASE = 'https://animepahe.com/api';
const SEARCH_URL_BASE = `${URL_BASE}?m=search&l=8`;
const EPISODES_URL = `${URL_BASE}?m=release&l=30&sort=episode_desc&page=1`;
const EPISODE_DETAILS_URL = `${URL_BASE}?m=embed`;

const SERVERS = [
	//'kwik', // Kwik uses IP based signatures, can't scrape links on the server and then send them to the client
	'openload',
	'streamango'
];

const OPTIONS = {
	json: true
};

async function scrape(kitsuDetails, episodeNumber=1) {
	const streams = [];

	const titleENGUS = kitsuDetails.attributes.titles.en_us;
	const titleENG = kitsuDetails.attributes.titles.en;
	const titleENGJPN = kitsuDetails.attributes.titles.en_jp;
	const titleJPN = kitsuDetails.attributes.titles.jp;
	const title = (titleENGUS || titleENG || titleENGJPN || titleJPN);
	const titleEncoded = encodeURIComponent(title);

	let response = await got(`${SEARCH_URL_BASE}&q=${titleEncoded}`, OPTIONS);
	const searchResults = response.body.data;

	if (!searchResults || searchResults.length <= 0) {
		return null;
	}

	const anime = searchResults.find(anime => {
		return (anime.title.includes(titleENG) || anime.title.includes(titleJPN));
	});

	if (!anime) {
		return null;
	}

	const animeID = anime.id;

	response = await got(`${EPISODES_URL}&id=${animeID}`, OPTIONS);
	let episodes = response.body.data;

	if (!episodes || episodes.length <= 0) {
		return null;
	}

	episodes = episodes.reverse();

	const episode = episodes[episodeNumber-1];
	const episodeID = episode.id;

	return new Promise(resolve => {
		async.each(SERVERS, (server, serverCallback) => {
			got(`${EPISODE_DETAILS_URL}&id=${episodeID}&p=${server}`, OPTIONS)
				.then(response => {
					const episodeDetails = response.body.data;

					if (!episodeDetails || episodeDetails.length <= 0) {
						return serverCallback();
					}

					const qualities = episodeDetails[episodeID];

					async.each(qualities, (quality, qualityCallback) => {
						const embedURL = quality.url;

						const host = url.parse(embedURL).host;
						const domain = psl.parse(host).domain;

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
													streams.push({
														provider: 'AP',
														provider_full: 'Animepahe',
														file_host: 'OpenLoad',
														file: head.url,
														quality
													});

													qualityCallback();
												});
										} else {
											qualityCallback();
										}
									});
			
								
								break;
							case 'streamango.com':
								hostScrapers.StreaMango.scrape(embedURL)
									.then(streamango => {
										if (streamango) {
											async.each(streamango, (stream, cb) => {
												got.head(stream.source.replace('//', '')).then(response => {
													streams.push({
														provider: 'AP',
														provider_full: 'Animepahe',
														file_host: 'StreaMango',
														file: response.url,
														quality: stream.quality
													});
		
													cb();
												});
											}, qualityCallback);
										} else {
											qualityCallback();
										}
									});
								break;
						}
					}, () => {
						serverCallback();
					});
				});
		}, () => {
			return resolve(streams);
		});
	});
}

/*
(async () => {
	const streams = await scrape({ // Fake Kitsu response
		attributes: {
			titles: {
				en: 'That Time I Got Reincarnated as a Slime',
				en_jp: 'Tensei shitara Slime Datta Ken',
			}
		}
	}, 3);
	console.log(streams);
})();
*/

module.exports = scrape;