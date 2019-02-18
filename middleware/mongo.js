const {MongoClient} = require('mongodb');
const {mongo_uri, mongo_database_name} = require('../config');
let database;

function mongo(request, response, next) {

	if (!database) {
		MongoClient.connect(mongo_uri, (error, client) => {
			if (error) {
				console.log(error);
				return next(error);
			}

			database = client.db(mongo_database_name);
			request.mongoDatabase = database;
			
			return next();
		});
	} else {
		request.mongoDatabase = database;
		return next();
	}
}

module.exports = mongo;