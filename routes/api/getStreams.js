const router = require('express').Router();
const animeScraper = require('../../scrapers/anime');

router.post('/api/getStreams', async (request, response) => {
	if (
		!request.body ||
		!request.body.id ||
		!request.body.episode ||
		typeof request.body.id !== 'number' ||
		typeof request.body.episode !== 'number' ||
		request.body.episode <= 0
	) {
		return response.status(400).json({
			error: true,
			message: 'Malformed POST data'
		});
	}

	/*
		[TODO]
		- Implement stream storage to cache results
		- Implement CRON job to check the cache every so often and validate the streams still work
		- Implement "scrape queue"
			* If ClientA requests streams that have not been scraped yet, the episode should be marked as "being scraped".
			  When ClientB requests the same streams and they have not finished scraping it should NOT re-start
			  the scraping process. That will waste resources and send unnecessary requests to the stream sites.
			  Instead, the server should send back a response telling the client it doesn’t have streams ready
			  but is scraping them, and the client should then wait X amount of time and then request again
			  (looping until either a timeout or error from the server?)
	*/
	const streams = await animeScraper(request.body.id, request.body.episode);

	return response.status(200).json({
		error: false,
		data: streams
	});
});

// export the router
module.exports = router;