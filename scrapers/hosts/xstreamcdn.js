const got = require('got');
const async = require('async');

async function scrape(embedURL) {
	const streams = [];
	
	const id = embedURL.split('/').pop();

	const response = await got.post(`https://xstreamcdn.com/api/source/${id}`, {
		body: 'r=&d=xstreamcdn.com'
	});
	const body = JSON.parse(response.body);

	const qualities = body.data;

	return new Promise(resolve => {
		async.each(qualities, (quality, callback) => {
			const {file, label} = quality;
			got.head(file).then(head => {

				streams.push({
					file: head.url,
					quality: label
				});

				callback();
			});
		}, () => {
			return resolve(streams);
		});
	});
}

/*
(async () => {
	const stream = await scrape('https://xstreamcdn.com/v/p6og2q-8x9j');
	console.log(stream);
})();
*/

module.exports = {
	scrape
};