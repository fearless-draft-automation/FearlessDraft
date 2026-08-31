/*
    Script takes every link from the local champions.json and checks that it
    resolves with 200. Exits with a non-zero code if at least one link fails.
*/

const path = require("node:path");
const fetch = require("node-fetch");

const CONCURRENCY = 10;
const TIMEOUT_MS = 15000;

(async () => {
	const links = collectLinks();
	console.log(`Checking ${links.length} links...`);

	const results = await checkAll(links);
	const failures = results.filter((x) => !x.ok);

	for (const failure of failures) {
		console.log(
			`[FAIL] ${failure.champion} (${failure.field}) ${failure.url} — ${failure.reason}`,
		);
	}

	console.log(`\n${results.length - failures.length}/${results.length} OK`);

	if (failures.length > 0) {
		process.exitCode = 1;
	}
})();

function collectLinks() {
	const filepath = path.join(__dirname, "../priv/champions.json");
	const champions = require(filepath);

	return champions.reduce((acc, x) => {
		for (const field of ["iconLink", "splashArtLink"]) {
			const url = x[field];

			if (!url) {
				continue;
			}

			if (!url.startsWith("http")) {
				console.log(`[SKIP] ${x.key} (${field}) ${url} — not an absolute URL`);
				continue;
			}

			acc.push({ champion: x.key, field, url });
		}

		return acc;
	}, []);
}

async function checkAll(links) {
	const queue = [...links];
	const results = [];

	const workers = Array.from({ length: CONCURRENCY }, async () => {
		while (queue.length > 0) {
			const link = queue.shift();
			results.push(await check(link));
		}
	});

	await Promise.all(workers);

	return results;
}

async function check(link) {
	try {
		let response = await request(link.url, "HEAD");

		// Some CDNs do not answer HEAD requests, retry those with a GET.
		if (response.status === 403 || response.status === 405) {
			response = await request(link.url, "GET");
		}

		return {
			...link,
			ok: response.status === 200,
			reason: `HTTP ${response.status}`,
		};
	} catch (error) {
		return { ...link, ok: false, reason: error.message };
	}
}

async function request(url, method) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		return await fetch(url, { method, signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
}
