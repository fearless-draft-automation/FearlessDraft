const socket = io();
let champions = null;
let currentPick = 0;
let matchNumber = 1;
let usedChamps = new Set();
let fearlessChamps = new Set();
const timerInterval = null;
const timeLeft = pickTimeout;
let side = null;
let blueReady = false;
let redReady = false;
const searchInput = document.getElementById("searchInput");
const confirmButton = document.getElementById("confirmButton");
const switchSidesButton = document.getElementById("switchSidesButton");
const finishSeriesButton = document.getElementById("finishSeriesButton");
const roleIcons = document.querySelectorAll(".role-icon");
let selectedRole = "";
let selectedChampion = null;
let viewingPreviousDraft = false;
let isLocking = false;
let sideSwapped = false;

function startTimer() {
	socket.emit("startTimer", draftId);
}

// TODO: Inject via pre-processors?
// biome-ignore format: lines reflect various pick/ban phases
const pickOrder = [
	"BB1", "RB1", "BB2", "RB2", "BB3", "RB3",
	"BP1", "RP1", "RP2", "BP2", "BP3", "RP3",
	"RB4", "BB4", "RB5", "BB5",
	"RP4", "BP4", "BP5", "RP5"
]

function getCurrSlot(currentPick) {
	return pickOrder[currentPick - 1] || "done";
}

function displayChampions(champions) {
	const gridEl = document.getElementById("champion-grid");
	gridEl.innerHTML = "";

	championsList = Object.values(champions).sort(championNameComparator("ru"));
	for (const champion of championsList) {
		const championIconEl = document.createElement("img");
		championIconEl.src = champion.iconLink;
		championIconEl.alt = champion.name;
		championIconEl.classList.add("champion-icon");
		championIconEl.setAttribute("data-key", champion.key);

		if (champion.key === "none") {
			//placeholder image for none pick
			championIconEl.style.objectFit = "cover";
			championIconEl.style.objectPosition = "center";
		}

		if (
			champion.key !== "none" &&
			(usedChamps.has(champion.key) || fearlessChamps.has(champion.key))
		) {
			championIconEl.classList.add("used");
			championIconEl.style.filter = "grayscale(100%)";
			championIconEl.removeEventListener("click", () => {});
		} else {
			championIconEl.addEventListener("click", () => {
				const currSlot = getCurrSlot(currentPick);
				if (currSlot === "done") {
					return;
				}

				if (currSlot[0] !== side) {
					return;
				}

				if (currSlot[1] === "B") {
					//ban
					let banSlot = document.querySelector(
						`#blue-bans .ban-slot:nth-child(${currSlot[2]})`,
					);
					if (currSlot[0] === "R") {
						//red side ban
						banSlot = document.querySelector(
							`#red-bans .ban-slot:nth-child(${6 - currSlot[2]})`,
						);
					}
					const banImage = banSlot.querySelector("img");
					banImage.src = champion.iconLink;
				} else {
					//pick
					let pickSlot = document.querySelector(
						`#blue-picks .pick-slot:nth-child(${currSlot[2]})`,
					);
					if (currSlot[0] === "R") {
						//red side ban
						pickSlot = document.querySelector(
							`#red-picks .pick-slot:nth-child(${currSlot[2]})`,
						);
					}
					const pickImage = pickSlot.querySelector("img");
					pickImage.src = champion.splashArtLink;
					maybeRenderChampionName(pickSlot, champion.key);
				}

				if (selectedChampion) {
					selectedChampion.classList.remove("selected");
				}

				// Add the 'selected' class to the clicked champion
				championIconEl.classList.add("selected");
				selectedChampion = championIconEl;
				socket.emit("hover", { draftId, side: side, champion: champion.key });
				confirmButton.disabled = false;
			});
		}

		gridEl.appendChild(championIconEl);
	}
}

function filterChampions() {
	//filter champions based on search and role
	const searchTerm = searchInput.value.toLowerCase();
	const filteredChampions = Object.values(champions)
		.filter((champion) => {
			const matchesRole =
				selectedRole === "" ||
				champion.positions.includes(selectedRole.toLowerCase());
			const matchesSearch =
				champion.key.toLowerCase().startsWith(searchTerm) ||
				champion.name.toLowerCase().startsWith(searchTerm) ||
				champion.name_ru.toLowerCase().startsWith(searchTerm);
			return matchesRole && matchesSearch;
		})
		.reduce((acc, elem) => {
			acc[elem.key] = elem;
			return acc;
		}, {});

	displayChampions(filteredChampions);
}

function championNameComparator(locale = "en") {
	let localKey = "name";
	if (locale !== "en") {
		localKey = `name_${locale}`;
	}

	return (a, b) => {
		const name_a = a[localKey].toLowerCase();
		const name_b = b[localKey].toLowerCase();
		if (name_a < name_b) {
			return -1;
		}

		if (name_a > name_b) {
			return 1;
		}

		return 0;
	};
}

for (const iconElem of roleIcons) {
	iconElem.addEventListener("click", () => {
		const role = iconElem.getAttribute("data-role");
		if (selectedRole === role) {
			selectedRole = "";
			iconElem.classList.remove("active");
			roleIcons[0].classList.add("active");
		} else {
			selectedRole = role === "all" ? "" : role;
			// TODO I do not like that "click" even have to access to all other icons
			resetSelectedRoles();
			iconElem.classList.add("active");
		}

		filterChampions();
	});
}

function resetSelectedRoles() {
	for (const iconElem of roleIcons) {
		iconElem.classList.remove("active");
	}
}

searchInput.addEventListener("input", filterChampions);

confirmButton.addEventListener("click", () => {
	//lock in/ready button
	if (viewingPreviousDraft) {
		return;
	}

	if (currentPick === 0) {
		if (side === "S") {
			return;
		}
		if (side === "B") {
			blueReady = true;
			confirmButton.textContent = "Waiting for Red...";
			confirmButton.disabled = true;
			socket.emit("playerReady", {
				draftId,
				side: "blue",
			});
		} else if (side === "R") {
			redReady = true;
			confirmButton.textContent = "Waiting for Blue...";
			confirmButton.disabled = true;
			socket.emit("playerReady", {
				draftId,
				side: "red",
			});
		}
	} else {
		lockChamp();
	}
});

const tempElement = document.createElement("div");
document.body.appendChild(tempElement); // Append temporarily to get computed styles
function fetchOutlineTempElement(className) {
	//Returns the CSS outline string from a CSS className in draft.css
	//Dynamically fetching the CSS style for the hover and selection borders from draft.css
	//by instantiating a dummy div, assigning it a CSS style, then grabbing the border data as a
	//string for use in colorBorder()
	tempElement.classList.value = ""; //clear all currently attached classes
	tempElement.classList.add(className);
	return getComputedStyle(tempElement).outline;
}

function colorBorder() {
	//shows who is picking currently
	document.body.appendChild(tempElement);
	const headerSelectOutline = fetchOutlineTempElement("header-select-outline");
	const headerDefaultOutline = fetchOutlineTempElement(
		"header-default-outline",
	);
	const pickChampOutline = fetchOutlineTempElement("pick-champ-outline");
	document.body.removeChild(tempElement);

	if (viewingPreviousDraft) {
		return;
	}
	const currSlot = getCurrSlot(currentPick);
	if (currSlot === "done") {
		return;
	}

	resetBorders();

	if (currentPick === 0) {
		// color border based on side
		if (side === "B") {
			document.querySelector("#blue-side-header").style.border =
				headerSelectOutline;
			document.querySelector("#red-side-header").style.border =
				headerDefaultOutline;
		} else if (side === "R") {
			document.querySelector("#red-side-header").style.border =
				headerSelectOutline;
			document.querySelector("#blue-side-header").style.border =
				headerDefaultOutline;
		}
		return;
	}
	// Apply a golden border to the current side's header
	if (currSlot[0] === "B") {
		document.querySelector("#blue-side-header").style.border =
			headerSelectOutline;
		document.querySelector("#red-side-header").style.border =
			headerDefaultOutline;
	} else {
		document.querySelector("#red-side-header").style.border =
			headerSelectOutline;
		document.querySelector("#blue-side-header").style.border =
			headerDefaultOutline;
	}

	// Highlight the current pick/ban slot
	let pickOrBanSlot = null;
	if (currSlot[1] === "B") {
		//ban
		pickOrBanSlot = document.querySelector(
			`#blue-bans .ban-slot:nth-child(${currSlot[2]})`,
		);
		if (currSlot[0] === "R") {
			//red side ban
			pickOrBanSlot = document.querySelector(
				`#red-bans .ban-slot:nth-child(${6 - currSlot[2]})`,
			);
		}
	} else {
		//pick
		pickOrBanSlot = document.querySelector(
			`#blue-picks .pick-slot:nth-child(${currSlot[2]})`,
		);
		if (currSlot[0] === "R") {
			//red side ban
			pickOrBanSlot = document.querySelector(
				`#red-picks .pick-slot:nth-child(${currSlot[2]})`,
			);
		}
	}
	if (pickOrBanSlot) {
		pickOrBanSlot.style.outline = pickChampOutline; // Golden outline for the current pick or ban slot
	}
}

function resetBorders() {
	for (const headerElem of document.querySelectorAll(".side-header")) {
		headerElem.style.border = headerDefaultOutline;
	}

	for (const slotElem of document.querySelectorAll(".pick-slot, .ban-slot")) {
		slotElem.style.outline = "none"; // Reset the border of all slots
	}
}

function updateFearlessBanSlots() {
	for (let i = 1; i < 5; i++) {
		const gameFearlessBansRowEl = document.querySelector(
			`.fearless-bans-container .fearless-bans-row:nth-child(${i})`,
		);

		gameFearlessBansRowEl.style.display = i < matchNumber ? "flex" : "none";
	}
}

function lockChamp() {
	//lock in champ
	if (isLocking) {
		return;
	}
	isLocking = true;
	const currSlot = getCurrSlot(currentPick);
	if (currSlot[0] !== side) {
		isLocking = false;
		return;
	}
	if (selectedChampion) {
		const key = selectedChampion.getAttribute("data-key");
		confirmButton.disabled = true;
		usedChamps.add(key);
		socket.emit("pickSelection", {
			draftId,
			pick: key,
		});
		selectedChampion = null;
	} else {
		socket.emit("pickSelection", {
			draftId,
			pick: "none",
		});
		confirmButton.disabled = true;
	}
	searchInput.value = "";
	selectedRole = "";
	resetSelectedRoles();
	filterChampions();
	if (currentPick <= 19) {
		colorBorder();
		startTimer();
	} else {
		resetConfirmButton();
		currentPick = 0;
		endDraft(draftId);
	}
	setTimeout(() => {
		isLocking = false;
	}, 100);
}

function startDraft() {
	currentPick = 1;
	resetPickBanVisuals();
	confirmButton.textContent = "Lock In";
	switchSidesButton.style.display = "none";
	finishSeriesButton.style.display = "none";
	displayChampions(champions);
	maybeRenderNicknames(sideSwapped);
	colorBorder();
	startTimer();
}

function resetPickBanVisuals() {
	for (const banImageElem of document.querySelectorAll(".ban-slot img")) {
		banImageElem.src = "/img/placeholder.png";
	}

	for (const pickImageElem of document.querySelectorAll(".pick-slot img")) {
		pickImageElem.src = "/img/placeholder.png";
	}

	for (const pickLabelElem of document.querySelectorAll(".pick-label")) {
		pickLabelElem.textContent = "";
	}
}

/*
	previousPicks = array of all previous picks (in order) from games before current
*/
function fearlessBan(previousPicks) {
	const gamesFinished = Math.ceil(previousPicks.length / 10);
	const linearIndicies = pickOrder
		// Exclude bans from order
		.filter((x) => x[1] === "P")
		// Remember original index
		.map((x, index) => {
			return [x, index];
		})
		// Sort pick order by sides
		.sort((a, b) => {
			if (a[0] < b[0]) {
				return -1;
			}

			if (a[0] > b[0]) {
				return 1;
			}

			return 0;
		});

	for (let i = 1; i <= gamesFinished; i++) {
		const gameFearlessBansRowEl = document.querySelector(
			`.fearless-bans-container .fearless-bans-row:nth-child(${i})`,
		);

		gameFearlessBansRowEl
			.querySelectorAll(".fearless-ban-slot img")
			.forEach((imgEl, index) => {
				const [_pickSlotId, pickIndex] = linearIndicies[index];
				pick = previousPicks[(i - 1) * 10 + pickIndex];
				imgEl.src = champions[pick].iconLink;
			});
	}
}

function hover(pick) {
	const slot = getCurrSlot(currentPick);
	if (slot[1] === "B") {
		const banSlot = document.querySelector(
			`#${slot[0] === "B" ? "blue" : "red"}-bans .ban-slot:nth-child(${slot[0] === "B" ? slot[2] : 6 - slot[2]})`,
		);
		const banImage = banSlot.querySelector("img");
		banImage.src = champions[pick].iconLink;
	} else {
		const pickSlot = document.querySelector(
			`#${slot[0] === "B" ? "blue" : "red"}-picks .pick-slot:nth-child(${slot[2]})`,
		);
		const pickImage = pickSlot.querySelector("img");
		pickImage.src = champions[pick].iconLink;
		maybeRenderChampionName(pickSlot, pick);
	}
}

function maybeRenderChampionName(pickSlot, pick) {
	if (shouldRenderNicknames()) {
		return;
	}

	const championNameEl = pickSlot.querySelector(".pick-label");
	championNameEl.textContent = champions[pick].name_ru;
}

function newPick(picks) {
	picks.forEach((pick, index) => {
		currentPick = index + 1;
		const slot = getCurrSlot(currentPick);
		if (slot[1] === "B") {
			const banSlot = document.querySelector(
				`#${slot[0] === "B" ? "blue" : "red"}-bans .ban-slot:nth-child(${slot[0] === "B" ? slot[2] : 6 - slot[2]})`,
			);
			const banImage = banSlot.querySelector("img");
			banImage.src = champions[pick].iconLink;
		} else {
			const pickSlot = document.querySelector(
				`#${slot[0] === "B" ? "blue" : "red"}-picks .pick-slot:nth-child(${slot[2]})`,
			);
			const pickImage = pickSlot.querySelector("img");
			pickImage.src = champions[pick].splashArtLink;
			//text that shows champion name
			maybeRenderChampionName(pickSlot, pick);
		}
		usedChamps.add(pick);
		currentPick++;
	});
	if (draftStarted && picks.length === 0) {
		currentPick = 1;
	}
	colorBorder();
	filterChampions();
}

function updateSide(sideSwapped, blueName, redName, initialLoad = false) {
	if (sideSelect === "blue") {
		side = sideSwapped ? "R" : "B";
	} else if (sideSelect === "red") {
		side = sideSwapped ? "B" : "R";
	} else {
		side = "S";
	}

	if (sideSwapped) {
		document.getElementById("blue-team-name").textContent = redName;
		document.getElementById("red-team-name").textContent = blueName;
	} else {
		document.getElementById("blue-team-name").textContent = blueName;
		document.getElementById("red-team-name").textContent = redName;
	}

	maybeRenderNicknames(sideSwapped);

	if (initialLoad) {
		return;
	}

	switch (side) {
		case "B":
			alert("You are now on Blue Side");
			break;
		case "R":
			alert("You are now on Red Side");
			break;
		case "S":
			alert("Sides Swapped");
			break;
	}
}

function endDraft(draftId) {
	socket.emit("endDraft", draftId);
}

socket.on("startDraft", (data) => {
	//starts draft
	picks = data.picks;
	draftStarted = data.started;
	blueReady = data.blueReady;
	redReady = data.redReady;
	fearlessChamps = new Set(data.fearlessBans);
	matchNumber = data.matchNumber;
	usedChamps = new Set();
	updateFearlessBanSlots();
	fearlessBan(data.fearlessBans);
	startDraft();
});

socket.on("timerUpdate", (data) => {
	const { timeLeft } = data;
	const timerElement = document.getElementById("timer");
	timerElement.textContent = Math.max(timeLeft, 0);
});

socket.on("draftState", (data) => {
	//updates screen when page loaded with draft state
	if (data.finished) {
		viewingPreviousDraft = true;
		socket.emit("showDraft", draftId, 1);
		return;
	}
	blueReady = data.blueReady;
	redReady = data.redReady;
	draftStarted = data.started;
	picks = data.picks;
	fearlessChamps = new Set(data.fearlessBans);
	matchNumber = data.matchNumber;
	sideSwapped = data.sideSwapped;
	updateSide(sideSwapped, data.blueTeamName, data.redTeamName, true);
	updateFearlessBanSlots();
	fearlessBan(data.fearlessBans);
	newPick(picks);
	if (picks.length === 20) {
		currentPick = 0;
		if (side !== "S") {
			switchSidesButton.style.display = "block";
			switchSidesButton.onclick = () => {
				requestSidesSwitch(socket, draftId, side);
			};
			finishSeriesButton.style.display = "block";
			finishSeriesButton.onclick = () => {
				viewingPreviousDraft = true;
				socket.emit("endSeries", draftId);
				finishSeriesButton.style.display = "none";
				switchSidesButton.style.display = "none";
			};
		}
	}
	if (blueReady && redReady) {
		confirmButton.textContent = "Lock In";
		confirmButton.disabled = true;
	} else {
		if (blueReady && side === "B") {
			confirmButton.textContent = "Waiting for Red...";
			confirmButton.disabled = true;
		} else if (redReady && side === "R") {
			confirmButton.textContent = "Waiting for Blue...";
			confirmButton.disabled = true;
		}
	}
	if (side === "S") {
		confirmButton.style.display = "none";
		switchSidesButton.style.display = "none";
		finishSeriesButton.style.display = "none";
	}
});

socket.on("lockChamp", () => {
	//locks in champ
	lockChamp();
});

socket.on("hover", (champion) => {
	//hovering over champ
	hover(champion);
});

socket.on("pickUpdate", (picks) => {
	//new pick was locked
	newPick(picks);
});

socket.on("showNextGameButton", (data) => {
	//draft ended
	if (data.finished) {
		viewingPreviousDraft = true;
		confirmButton.textContent = "View Previous Games";
		confirmButton.style.display = "block";
		confirmButton.disabled = false;
		confirmButton.onclick = () => {
			location.reload();
		};
		switchSidesButton.style.display = "none";
		finishSeriesButton.style.display = "none";
		return;
	}
	currentPick = 0;
	resetConfirmButton();
	if (side !== "S") {
		switchSidesButton.style.display = "block";
		switchSidesButton.onclick = () => {
			requestSidesSwitch(socket, draftId, side);
		};
		finishSeriesButton.style.display = "block";
		finishSeriesButton.onclick = () => {
			viewingPreviousDraft = true;
			socket.emit("endSeries", draftId);
			finishSeriesButton.style.display = "none";
			switchSidesButton.style.display = "none";
		};
	}
	blueReady = data.blueReady;
	redReady = data.redReady;
	draftStarted = data.started;
});

socket.on("server.switch_sides.init", (params) => {
	const { requesterSide } = params;
	if (side === "S" || side === requesterSide) {
		return;
	}

	socket.emit("client.switch_sides.accept", draftId, side);
});

socket.on("server.switch_sides.commit", (draft) => {
	blueReady = draft.blueReady;
	redReady = draft.redReady;
	sideSwapped = draft.sideSwapped;

	resetConfirmButton();
	updateSide(draft.sideSwapped, draft.blueTeamName, draft.redTeamName);
});

socket.on("server.switch_sides.rollback", () => {
	// TODO
});

socket.on("draftNotAvailable", () => {
	alert("Draft not available please make a new one.");
	window.location.href = "/";
});

socket.on("showDraftResponse", (data) => {
	if (!data) {
		alert("No more games to show!");
		matchNumber--;
		return;
	}
	picks = data.picks;
	fearlessBans = data.fearlessBans;
	matchNumber = data.matchNumber;
	blueTeamName = data.blueTeamName;
	redTeamName = data.redTeamName;
	pickTimeout = data.pickTimeout;
	nicknames = data.nicknames;

	document.getElementById("blue-team-name").textContent = blueTeamName;
	document.getElementById("red-team-name").textContent = redTeamName;
	draftStarted = false;
	updateFearlessBanSlots();
	fearlessBan(data.fearlessBans);
	newPick(picks);
	maybeRenderNicknames(sideSwapped);
	confirmButton.style.display = "block";
	confirmButton.textContent = "Show Next Game";
	confirmButton.disabled = false;
	confirmButton.onclick = () => {
		matchNumber++;
		socket.emit("showDraft", draftId, matchNumber);
	};
});

async function loadChampionsV2() {
	const response = await fetch("/champions");
	const champions = await response.json();
	return champions.reduce((acc, elem) => {
		acc[elem.key] = elem;
		return acc;
	}, {});
}

function maybeRenderNicknames(sideSwapped) {
	if (!shouldRenderNicknames()) {
		return;
	}

	let localNicknames = nicknames.map((x, index) => {
		return x || `Player ${index + 1}`;
	});
	if (sideSwapped) {
		const teamRedNicknames = localNicknames;
		const teamBlueNicknames = teamRedNicknames.splice(0, 5);

		localNicknames = [...teamRedNicknames, ...teamBlueNicknames];
	}

	const pickLabelElements = document.querySelectorAll(".pick-label").entries();
	for (const [index, element] of pickLabelElements) {
		element.textContent = localNicknames[index];
	}
}

function shouldRenderNicknames() {
	// List has at least one truthy value
	return nicknames?.some((x) => x);
}

document.addEventListener("DOMContentLoaded", async () => {
	champions = await loadChampionsV2();
	displayChampions(champions);
	socket.emit("joinDraft", draftId);
	socket.emit("getData", draftId);
	if (side === "S") {
		confirmButton.style.display = "none";
		switchSidesButton.style.display = "none";
	}
});

function getConfirmButton() {
	return document.getElementById("confirmButton");
}

function resetConfirmButton() {
	const confirmButton = getConfirmButton();

	confirmButton.textContent = "Ready Next Game";
	confirmButton.disabled = false;
}

function requestSidesSwitch(socket, draftId, currentSide) {
	socket.emit("client.switch_sides.init", {
		draftId: draftId,
		clientSide: currentSide,
	});
}
