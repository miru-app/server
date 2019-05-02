// imports
const cron = require('node-cron');
const express = require('express');
const morgan = require('morgan');
const db = require('./db');
const middleware = require('./middleware');
const {validate_streams} = require('./tasks');
const logger = require('./logger');
const {cron_schedule, http: {port}} = require('./config');

// setup console colors
require('colors');

// setup express middleware
const app = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({
	extended: true
}));
app.use('/api/*', middleware.validateSignature);

// routes setup
const ROUTES = {
	API: {
		getStreams: require('./routes/api/getStreams'),
	}
};

// page map
app.use(ROUTES.API.getStreams);

// 4 parameters required to read the error, cant help the eslint error
app.use((error, request, response, next) => { // eslint-disable-line no-unused-vars
	logger.error(error.stack);
	return response.status(500).send('Something broke!');
});

// startup
db.connect(() => {
	validate_streams();
	cron.schedule(cron_schedule, validate_streams);

	app.listen(port, () => {
		logger.success(`started the server on port: ${port}`);
	});
});
