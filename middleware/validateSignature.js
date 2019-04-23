const crypto = require('crypto');
const {signature_secret} = require('../config');
const responseCodes = require('../response_codes');

function validateSignature(request, response, next) {
	if (request.method !== 'POST') {
		return next();
	}
	
	const {data, signature} = request.body;

	const hmac = crypto.createHmac('sha1', signature_secret).update(data).digest('hex');

	if (hmac !== signature) {
		return response.status(400).json({
			error: true,
			response_code: 0x1,
			message: responseCodes[0x1]
		});
	}

	request.body = JSON.parse(data);

	return next();
}

module.exports = validateSignature;