const got = require('got');

const URL_BASE = 'https://api.animefever.tv/api/anime';
const SEARCH_URL = `${URL_BASE}/filter?hasVideos=true&page=1`;
const EPISODES_URL = `${URL_BASE}/details/episodes`;
const EPISODE_URL = `${URL_BASE}/episode`;

const OPTIONS = {
	json: true
};

async function scrape(kitsuDetails, episodeNumber=1) {
	episodeNumber--;

	const titleENGUS = kitsuDetails.attributes.titles.en_us;
	const titleENG = kitsuDetails.attributes.titles.en;
	const titleENGJPN = kitsuDetails.attributes.titles.en_jp;
	const titleJPN = kitsuDetails.attributes.titles.jp;

	const title = (titleENGJPN || titleENG || titleENGUS || titleJPN);

	let response = await got(`${SEARCH_URL}&search=${title}`, OPTIONS);
	const searchResults = response.body.data;

	const anime = searchResults.find(anime => (anime.name.includes(title) || anime.alt_name.includes(title)));
	const animeID = anime.id;

	response = await got(`${EPISODES_URL}?id=${animeID}`, OPTIONS);
	const episodes = response.body.data;
	const episode = episodes[episodeNumber];
	const episodeID = episode.id;

	response = await got(`${EPISODE_URL}/${episodeID}`, OPTIONS);
	const episodeDetails = response.body;

	return [{
		provider: 'AF',
		provider_full: 'animefever',
		file_host: 'AF',
		file: episodeDetails.stream,
		m3u8: true,
		subtitles_file: episodeDetails.subtitles[0].file
	}];
}

/*
(async () => {
	const streams = await scrape({ // Fake Kitsu response
		attributes: {
			titles: {
				en: 'That Time I Got Reincarnated as a Slime',
				en_jp: 'Tensei shitara Slime Datta Ken'
			}
		}
	}, 3);

	console.log(streams);
})();
*/

module.exports = scrape;