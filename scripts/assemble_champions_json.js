/*
    Script assembles latest static information into the single lightweight champions.json file
    we can cache.
*/

const path = require("node:path");
const fetch = require("node-fetch");
const fs = require("node:fs/promises");

(async () => {
	let champions = await fetchChampions();
	champions = champions.map((x) => {
		return {
			id: x.id,
			name: x.name,
			key: x.key.toLowerCase(),
		};
	});
	champions = filterWildRift(champions);
	champions = await addPositions(champions);
	champions = addImageLinks(champions);
	champions = await addLocale(champions, "ru_ru");

	await saveFile(champions);
})();

async function fetchChampions() {
	const response = await fetch(
		"https://cdn.communitydragon.org/latest/champions",
	);
	return await response.json();
}

function filterWildRift(champions) {
	const filepath = path.join(__dirname, "../priv/wildrift_ids.json");
	const wildRiftIds = require(filepath);

	return champions.reduce((acc, x) => {
		const key = x.key.toLowerCase();

		if (key === "none") {
			acc.push({ ...x, wrId: null });
		} else if (wildRiftIds[key]) {
			acc.push({ ...x, wrId: wildRiftIds[key] });
		} else {
			console.log(`[WARN] Cannot find champion ${key} in Wild Rift`);
		}

		return acc;
	}, []);
}

async function addPositions(champions) {
	const { data: playRates } = await fetchPlayRates();

	const positionsLookup = Object.entries(playRates).reduce((acc, elem) => {
		const [championId, positionPlayRates] = elem;
		acc[championId] = determinePositions(positionPlayRates);
		return acc;
	}, {});

	return champions.map((x) => {
		x.positions = positionsLookup[x.id] || [];
		return x;
	});
}

async function fetchPlayRates() {
	const response = await fetch(
		"https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/championrates.json",
	);
	return await response.json();
}

function determinePositions(positionPlayRates) {
	return Object.entries(positionPlayRates).reduce((acc, elem) => {
		const [position, playRateObj] = elem;
		if (playRateObj.playRate > 0) {
			acc.push(position.toLowerCase());
		}

		return acc;
	}, []);
}

function communityDragonIconLink(id) {
	return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${id}.png`;
}

function addImageLinks(champions) {
	return champions
		.map((x) => {
			x.iconLink = `https://images.fearless-draft-wr.net/assets/champions/head-icons/${x.wrId}.png`;
			x.splashArtLink = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/characters/${x.key}/skins/base/images/${x.key}_splash_centered_0.jpg`;

			return x;
		})
		.map((x) => {
			switch (x.key) {
				case "none":
					// No Wild Rift id, so no icon in our bucket
					x.iconLink = communityDragonIconLink(x.id);
					x.splashArtLink = "/img/placeholder.png";
					break;
				case "xinzhao":
					x.splashArtLink =
						"https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/characters/xinzhao/skins/base/images/xinzhaorework_splash_centered_0.jpg";
					break;
			}

			return x;
		});
}

// Expects two-segment lowercase locale code (e.g. ru_ru, en_us, etc.)
async function addLocale(champions, locale) {
	const stringTable = await fetchStringTable(locale);

	const [localeCode, _] = locale.split("_");
	const localKey = `name_${localeCode}`;

	return champions.map((x) => {
		x[localKey] =
			stringTable.entries[`game_character_displayname_${x.key}`] || "";
		return x;
	});
}

async function fetchStringTable(locale) {
	const response = await fetch(
		`https://raw.communitydragon.org/latest/game/${locale}/data/menu/en_us/lol.stringtable.json`,
	);

	return await response.json();
}

async function saveFile(champions) {
	const filepath = path.join(__dirname, "../priv/champions.json");
	await fs.writeFile(filepath, JSON.stringify(champions, null, 4));
}
