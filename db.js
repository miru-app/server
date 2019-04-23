const MongoClient = require('mongodb').MongoClient;
const {mongo_uri, mongo_db} = require('./config');
const logger = require('./logger');
let mongodb;

function connect(callback) {
	MongoClient.connect(mongo_uri, (error, client) => {
		if (error) {
			logger.error(error);
		}

		mongodb = client.db(mongo_db);

		callback();
	});
}
function get() {
	return mongodb;
}

function close() {
	mongodb.close();
}

module.exports = {
	connect,
	get,
	close
};