const got = require('got');
const async = require('async');

const URL_BASE = 'https://www.wonderfulsubs.com/api/media';
const SEARCH_URL = `${URL_BASE}/search?q`;
const SERIES_URL = `${URL_BASE}/series?series`;
const STREAM_URL = `${URL_BASE}/stream?code`;

// Options for "got"
const OPTIONS = {
	json: true
};

async function scrape(kitsuDetails, episodeNumber=1) {
	let streams = [];

	const titleENG = kitsuDetails.attributes.titles.en;
	const titleJPN = kitsuDetails.attributes.titles.en_jp;
	const title = (titleENG || titleJPN);
	const titleEncoded = encodeURIComponent(title);

	let response = await got(`${SEARCH_URL}=${titleEncoded}`, OPTIONS);
	let body = response.body;

	const searchResults = body.json.series;
	const anime = searchResults.find(anime => (anime.aliases.includes(titleENG) || anime.aliases.includes(titleJPN)));

	const animeID = anime.url.split('/').pop();

	response = await got(`${SERIES_URL}=${animeID}`, OPTIONS);
	body = response.body;

	// Why in gods name is this designed this way. Why not just split the seasons like a normal site
	const seasons = body.json.seasons.ws.media;
	const season = seasons.find(season => (season.type === 'episodes' && (season.title === title || season.japanese_title === title)));

	const episodes = season.episodes;
	const episode = episodes.find(episode => episode.episode_number === episodeNumber);
	const sources = episode.sources;

	return new Promise(resolve => {
		async.each(sources, (source, callback) => {
			getEpisodeStreams(source)
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

async function getEpisodeStreams(source) {
	const streams = [];
	const dubbed = source.language === 'dubs';
	let fileHost = source.source;

	function addStream(stream) {
		const obj = {
			provider: 'WS',
			provider_full: 'Wonderful Subs',
			file_host: fileHost,
			file: stream.src,
			dubbed
		};

		if (stream.label === 'Auto (HLS)') {
			obj.m3u8 = true;
			if (stream.captions) {
				obj.subtitles_file = stream.captions.src;
			}
		}

		streams.push(obj);
	}

	switch (source.source) {
		case 'cr':
			fileHost = 'CrunchyRoll';
			break;
		case 'ka':
			fileHost = 'Kissanime';
			break;
		case 'fa': // What are these?
		case 'na': // What are these?
		default:
			break;
	}

	return new Promise(resolve => {
		if (typeof source.retrieve_url === 'string') {
			got(`${STREAM_URL}=${source.retrieve_url}`, OPTIONS)
				.then(response => {
					const body = response.body.urls;
					for (const stream of body) {
						addStream(stream);
					}
					
					return resolve(streams);
				});
		} else {
			const urls = source.retrieve_url;
			async.each(urls, (url, callback) => {
				got(`${STREAM_URL}=${url}`, OPTIONS)
					.then(response => {
						const body = response.body.urls;
						for (const stream in body) {
							addStream(stream);
						}
						
						callback();
					});
			}, () => {
				return resolve(streams);
			});
		}
	});

	
	/*

	return new Promise(resolve => {
		async.each(episodeLinks, (episodeLink, callback) => {
			callback();
		}, () => {
			return resolve(streams);
		});
	});*/
}


module.exports = scrape;

function mergeArrays(...arrays) {
	return [...new Set([].concat(...arrays))];
}

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