const db = require('../db');
const {mongo_collection} = require('../config');

function validateStreams() {
	const date = Date.now();
	const collection = db.get().collection(mongo_collection);

	collection.find({}).forEach(async ({key, createdAt}) => {
		const distance = date - createdAt;
		if (distance >= (60*60*4)*1000) { // check if the document is 4 hours old or older
			await collection.deleteOne({
				key
			});
		}
	});
}

module.exports = validateStreams;