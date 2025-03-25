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

	await saveFile(champions);
})();

async function fetchChampions() {
	const response = await fetch(
		"https://cdn.communitydragon.org/latest/champions",
	);
	return await response.json();
}

function filterWildRift(champions) {
	const filepath = path.join(
		__dirname,
		"../priv/non_wild_rift_champtions.json",
	);
	const nonWRChampionsSet = new Set(require(filepath));

	return champions.filter((x) => {
		const key = x.key.toLowerCase();
		return !nonWRChampionsSet.has(key);
	});
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

function addImageLinks(champions) {
	return champions
		.map((x) => {
			x.iconLink = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${x.id}.png`;
			x.splashArtLink = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/characters/${x.key}/skins/base/images/${x.key}_splash_centered_0.jpg`;

			return x;
		})
		.map((x) => {
			switch (x.key) {
				case "none":
					x.splashArtLink = "/img/placeholder.png";
					break;
				case "teemo":
					x.splashArtLink =
						"https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/characters/teemo/skins/base/images/teemo_splash_centered_0.asu_teemo.jpg";
					break;
			}

			return x;
		});
}

async function saveFile(champions) {
	const filepath = path.join(__dirname, "../priv/champions.json");
	await fs.writeFile(filepath, JSON.stringify(champions, null, 4));
}
