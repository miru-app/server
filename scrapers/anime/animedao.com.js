/*
	THEY HAVE ADDED CLOUDFLARE PROTECTION AND CHANGED HOW REDIRECTS WORK.
	THIS IS NOW BROKEN.
*/

const got = require('got');

// Site URLs
const URL_BASE = 'https://animedao.com';
const WATCH_URL = `${URL_BASE}/watch-online`;


// Pulls the direct
const REGEX = /file: "(\/redirect\/.*)"/gm;

// Options for "got"
const OPTIONS = {
	throwHttpErrors: false // Turns off throwing exceptions for non-2xx HTTP codes
};

async function scrape(kitsuDetails, episodeNumber=1) {
	// animedao seems to have 2 episode link formats, so check which it is
	const URL_1 = `${WATCH_URL}/${kitsuDetails.attributes.slug}-episode-${episodeNumber}`;

	const response = await got(URL_1, OPTIONS);
	const body = response.body;

	console.log(body);
	
	/*
	//const URL_2 = `${WATCH_URL}/${title}-${episodeNumber}`;

	// Check both episode link formats
	const headCheck = await got.head(URL_1, OPTIONS);

	// Pick the one that works
	const url = (headCheck.statusCode === 302 ? URL_1 : URL_2);

	// Request the page
	const response = await got(url, OPTIONS);
	const body = response.body;

	// Rip the stream
	const data = REGEX.exec(body);
	const stream = data[1];
	const direct = `${URL_BASE}${stream}`;

	return [ direct ];
	*/
}

(async () => {
	const streams = await scrape({ // Fake Kitsu response
		attributes: {
			slug: 'tensei-shitara-slime-datta-ken'
		}
	}, 3);

	console.log(streams);
})();

module.exports = scrape;

/*
// Testing stuff for getting around CloudFlare
// It works, but sometimes it throws a captcha which I am unable to bypass
const got = require('got');
const url = require('url');
const querystring = require('querystring');

const URL_BASE = 'https://animedao.com';
const PAGE =`${URL_BASE}/watch-online/tensei-shitara-slime-datta-ken-episode-18/`;
const CF_PAGE =`${URL_BASE}/cdn-cgi/l/chk_jschl`;

const domain = url.parse(URL_BASE).host;

const REGEX = {
	TIMEOUT: /setTimeout[\s\S]*, (\d*)\);/,
	VARIABLE_NAMES: /var s,t,o,p,b,r,e,a,k,i,n,g,f, (\w*)={"(\w*)"/,
	INIT_NUMBER: /var s,t,o,p,b,r,e,a,k,i,n,g,f, \w*={"\w*":(.*)}/,
	OPERATIONS: /;\w*\.\w*([+-/*]=[+!/()[\]]*)/g,
	FORM_DATA: {
		S: /"s" value="(.*)"/,
		JSCHL_VC: /"jschl_vc" value="(.*)"/,
		PASSWORD: /"pass" value="(.*)"/
	}
};

let CODE = 'let num=';

(async () => {
	const response = await got(PAGE, {
		throwHttpErrors: false // Turns off error throwing for 503
	});
	const body = response.body;

	const variableNames = REGEX.VARIABLE_NAMES.exec(body);
	const object = variableNames[1];
	const key = variableNames[2];

	let initNumber = REGEX.INIT_NUMBER.exec(body);
	initNumber = initNumber[1];

	CODE += `${initNumber}`;

	const OPERATIONS = body.match(REGEX.OPERATIONS);

	for (let operation of OPERATIONS) {
		operation = operation.replace(`${object}.${key}`, 'num');
		CODE += operation;
	}

	const s = REGEX.FORM_DATA.S.exec(body)[1];
	const jschl_vc = REGEX.FORM_DATA.JSCHL_VC.exec(body)[1];
	const pass = REGEX.FORM_DATA.PASSWORD.exec(body)[1];
	const jschl_answer = (eval(CODE) + domain.length).toFixed(10);

	const query = querystring.stringify({
		s,
		jschl_vc,
		pass,
		jschl_answer
	});
	const timeout = Number(REGEX.TIMEOUT.exec(body)[1]);

	setTimeout(async () => {
		const response = await got(`${CF_PAGE}?${query}`,  {
			throwHttpErrors: false // Turns off error throwing for 503
		});
		const body = response.body;

		console.log(body);
	}, timeout);
})();
*/