const got = require('got');
const { JSDOM } = require('jsdom');

const API_BASE = 'https://api.mangarockhd.com';
const API_SEARCH = `${API_BASE}/query/web401/mrs_quick_search`;
const API_META = `${API_BASE}/meta`;
const API_CHAPTER_PAGES = `${API_BASE}/query/web401/pagesv2?oid`;

class MangaRockClient {
	async search(query) {
		let response = await got.post(API_SEARCH, {
			body: query
		});
		let body = JSON.parse(response.body);
	
		response = await got.post(API_META, {
			json: true,
			body: body.data.series
		});
		body = response.body;
	
		return body.data;
	}

	async getManga(title) {
		const mangaSearch = await this.search(title);
		const mangaList = Object.values(mangaSearch);
		const manga = mangaList.find(({name}) => name === title);

		return manga;
	}

	async listChapters(oid) {
		const response = await got(`https://mangarock.com/manga/${oid}`);
		const body = response.body;

		const dom = new JSDOM(body);

		const chapters = [...dom.window.document.querySelectorAll('tr._2_j2_ td a')]
			.map(chapter => ({
				title: chapter.innerHTML,
				link: `https://mangarock.com${chapter.href}`,
				oid: chapter.href.split('/').pop()
			}));

		return chapters;
	}

	async getChapterPages(oid) {
		const response = await got(`${API_CHAPTER_PAGES}=${oid}`, {
			json: true
		});
		const body = response.body;

		return body.data;
	}

	async getPage(page) {
		const response = await got(page.url, {
			encoding: null
		});
		const body = response.body;

		return mri2webp(body);
	}
}

function mri2webp(mriBuffer) {
	const mriSize = mriBuffer.length;
	const webpSize = mriSize + 7;

	let webpBuffer = Buffer.alloc(15);

	webpBuffer.write('RIFF');
	webpBuffer.writeUInt32LE(webpSize, 4);
	webpBuffer.write('WEBPVP8', 8);

	for (let i = 0; i < mriSize; i++) {
		mriBuffer[i] ^= 0x65;
	}

	webpBuffer = Buffer.concat([
		webpBuffer, mriBuffer
	]);

	return webpBuffer;
}

(async () => {
	const kitsuDetails = { // Fake Kitsu response
		attributes: {
			titles: {
				en: 'Please don\'t bully me, Nagatoro',
				en_jp: 'Ijiranaide, Nagatoro-san',
				ja_jp: 'イジらないで、長瀞さん'
			}
		}
	};

	const client = new MangaRockClient(); // New Manga client scraper instance

	// Getting the title from the Kitsu data
	const titleENG = kitsuDetails.attributes.titles.en;
	const titleENGJPN = kitsuDetails.attributes.titles.en_jp;
	const titleJPN = kitsuDetails.attributes.titles.jp;
	const title = (titleENG || titleENGJPN || titleJPN);

	const manga = await client.getManga(title); // get the manga by title

	// Grab the chapters
	const chapters = await client.listChapters(manga.oid);
	const chapter = chapters[0]; // for testing purposes, manually getting the latest chapter
	const chapterID = chapter.oid;

	// Grab the pages
	const pages = await client.getChapterPages(chapterID);
	const page = pages[0]; // for testing purposes, manually getting the first page

	const pageImage = await client.getPage(page); // Get the page needed, converts MRI to WEBP

	// Write the page to the file system to verify the conversion (testing purposes)
	const fs = require('fs');
	fs.writeFileSync('./page2.webp', pageImage);
})();

module.exports = MangaRockClient;