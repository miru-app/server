/*
	RIP
	Keeping this in case clone sites pop up
*/

const got = require('got');
const async = require('async'); // asynchronous utils
const hostScrapers = require('../hosts');

const URL_BASE = 'https://www.masterani.me';
const API_BASE = `${URL_BASE}/api/anime`;
const SEARCH_URL_BASE = `${API_BASE}/search?sb=true`;
const WATCH_URL_BASE = `${URL_BASE}/anime/watch`;

const EPISODES_REGEX = /:mirrors='(.*)'/gm;

const OPTIONS = {
	json: true
};

async function scrape(kitsuDetails, episodeNumber=1) {
	const streams = [];

	const titleENG = kitsuDetails.attributes.titles.en;
	const titleJPN = kitsuDetails.attributes.titles.en_jp;
	const title = (titleENG || titleJPN);
	const titleEncoded = encodeURIComponent(title);

	let response = await got(`${SEARCH_URL_BASE}&search=${titleEncoded}`, OPTIONS);
	const searchResults = response.body;

	if (!searchResults || searchResults.length <= 0) {
		return null;
	}

	const anime = searchResults.find(anime => {
		return (anime.title.includes(titleENG) || anime.title.includes(titleJPN));
	});

	if (!anime) {
		return null;
	}

	const slug = anime.slug;

	response = await got(`${WATCH_URL_BASE}/${slug}/${episodeNumber}`);
	const body = response.body;

	const EPISODES_REGEX_RESULT = EPISODES_REGEX.exec(body);
	if (!EPISODES_REGEX_RESULT) {
		return null;
	}

	const episodes = JSON.parse(EPISODES_REGEX_RESULT[1]);

	return new Promise(resolve => {
		async.each(episodes, (episode, callback) => {
			const dubbed = (episode.type === 2 ? true : false);
			const streamObj = {
				provider: 'MA',
				provider_full: 'Master Anime',
				dubbed: dubbed,
				subbed: !dubbed
			};

			let embedURL = `${episode.host.embed_prefix}${episode.embed_id}`;
			if (episode.host.embed_suffix) {
				embedURL = `${embedURL}${episode.host.embed_suffix}`;
			}

			switch (episode.host.name) {
				case 'MP4Upload':
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
				case 'Rapidvideo':
					hostScrapers.RapidVideo.scrape(embedURL)
						.then(rapidvideo => {
							if (rapidvideo) {
								for (const stream of rapidvideo) {
									streams.push({
										provider: 'MA',
										provider_full: 'Master Anime',
										file_host: 'StreaMango',
										file: stream.source,
										quality: stream.quality,
										dubbed
									});
								}
							}

							callback();
						});
					break;
				case 'Streamango':
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
	
				case 'Openload':
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
				case 'Tiwi.kiwi':
				case 'Mystream':
				default:
					// Ignore for now
					callback();
					break;
			}
		}, () => {
			return resolve(streams);
		});
	});
}

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

module.exports = scrape;