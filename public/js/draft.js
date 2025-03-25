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
const championGrid = document.getElementById("champion-grid");
const searchInput = document.getElementById("searchInput");
const confirmButton = document.getElementById("confirmButton");
const switchSidesButton = document.getElementById("switchSidesButton");
const finishSeriesButton = document.getElementById("finishSeriesButton");
const roleIcons = document.querySelectorAll(".role-icon");
let selectedRole = "";
let selectedChampion = null;
let viewingPreviousDraft = false;
let isLocking = false;

function startTimer() {
	socket.emit("startTimer", draftId);
}

// biome-ignore format: lines reflect various pick/ban phases
const pickOrder = [
	"BB1", "RB1", "BB2", "RB2", "BB3", "RB3",
	"BP1", "RP1", "RP2", "BP2", "BP3", "RP3",
	"BB4", "RB4", "BB5", "RB5",
	"RP4", "BP4", "BP5", "RP5"
]

function getCurrSlot(currentPick) {
	return pickOrder[currentPick - 1] || "done";
}

function displayChampions(champions) {
	//display champion grid
	championGrid.innerHTML = "";
	for (const champion of Object.values(champions)) {
		const championIcon = document.createElement("img");
		championIcon.src = champion.iconLink;
		championIcon.alt = champion.name;
		championIcon.classList.add("champion-icon");
		championIcon.setAttribute("data-key", champion.key);
		if (champion.key === "none") {
			//placeholder image for none pick
			championIcon.style.objectFit = "cover";
			championIcon.style.objectPosition = "center";
		}

		if (
			champion.key !== "none" &&
			(usedChamps.has(champion.key) || fearlessChamps.has(champion.key))
		) {
			championIcon.classList.add("used");
			championIcon.style.filter = "grayscale(100%)";
			//remove event listener
			championIcon.removeEventListener("click", () => {});
		} else {
			championIcon.addEventListener("click", () => {
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
					addChampionNameText(pickSlot, champion.key);
				}

				if (selectedChampion) {
					selectedChampion.classList.remove("selected");
				}

				// Add the 'selected' class to the clicked champion
				championIcon.classList.add("selected");
				selectedChampion = championIcon;
				socket.emit("hover", { draftId, side: side, champion: champion.key });
				confirmButton.disabled = false;
			});
		}
		championGrid.appendChild(championIcon);
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
			const matchesSearch = champion.key.toLowerCase().includes(searchTerm);
			return matchesRole && matchesSearch;
		})
		.reduce((acc, elem) => {
			acc[elem.key] = elem;
			return acc;
		}, {});

	displayChampions(filteredChampions);
}

for (const iconElem of roleIcons) {
	iconElem.addEventListener("click", () => {
		const role = iconElem.getAttribute("data-role");
		if (selectedRole === role) {
			selectedRole = "";
			iconElem.classList.remove("active");
		} else {
			selectedRole = role;
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
	//controls fearless bans
	const blueFearlessBanSlots = document.querySelectorAll(
		"#blue-fearless-bans .fearless-ban-slot",
	);
	const redFearlessBanSlots = document.querySelectorAll(
		"#red-fearless-bans .fearless-ban-slot",
	);
	const blueFearlessBansDiv = document.querySelector("#blue-fearless-bans");
	const redFearlessBansDiv = document.querySelector("#red-fearless-bans");

	switch (matchNumber) {
		case 1:
			fearlessBansPerSide = 0;
			break;
		case 2:
			fearlessBansPerSide = 5;
			break;
		case 3:
			fearlessBansPerSide = 10;
			break;
		case 4:
			fearlessBansPerSide = 15;
			break;
		case 5:
			fearlessBansPerSide = 20;
			break;
		default:
			fearlessBansPerSide = 0;
			break;
	}
	blueFearlessBanSlots.forEach((slot, index) => {
		slot.style.display = index < fearlessBansPerSide ? "flex" : "none";
	});

	redFearlessBanSlots.forEach((slot, index) => {
		slot.style.display = index < fearlessBansPerSide ? "flex" : "none";
	});
	// blueFearlessBansDiv.style.marginLeft = '0px';
	// redFearlessBansDiv.style.marginRight = `-4px`;
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
		confirmButton.textContent = "Ready Next Game";
		confirmButton.disabled = false;
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

	for (const championLabelElem of document.querySelectorAll(".champion-name")) {
		championLabelElem.textContent = "";
	}
}

function fearlessBan(previousPicks) {
	let fearlessBanSlot = 0;
	blueCounter = 1;
	redCounter = 1;
	previousPicks.forEach((pick, index) => {
		fearlessBanSlot = (index + 1) % 10;
		let banSlot = null;
		let banImage = null;
		switch (fearlessBanSlot) {
			case 1:
			case 4:
			case 5:
			case 8:
			case 9:
				banSlot = document.querySelector(
					`#blue-fearless-bans .fearless-ban-slot:nth-child(${blueCounter})`,
				);
				banImage = banSlot.querySelector("img");
				banImage.src = champions[pick].iconLink;
				blueCounter++;
				break;
			case 2:
			case 3:
			case 6:
			case 7:
			case 0:
				banSlot = document.querySelector(
					`#red-fearless-bans .fearless-ban-slot:nth-child(${redCounter})`,
				);
				banImage = banSlot.querySelector("img");
				banImage.src = champions[pick].iconLink;
				redCounter++;
				break;
			default:
				break;
		}
	});
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
		addChampionNameText(pickSlot, pick);
	}
}

function addChampionNameText(pickSlot, pick) {
	const championName = pickSlot.querySelector(".champion-name");
	championName.textContent = champions[pick].name;
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
			addChampionNameText(pickSlot, pick);
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
		side = "B";
	} else if (sideSelect === "red") {
		side = "R";
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

	maybeFillNicknames(sideSwapped);

	if (!sideSwapped) {
		if (!initialLoad)
			if (side !== "S") {
				if (side === "B") alert("You are now on Blue Side");
				else if (side === "R") alert("You are now on Red Side");
			} else alert("Sides Swapped");
		return;
	}
	if (side === "B") {
		side = "R";
		if (!initialLoad) alert("You are now on Red Side");
	} else if (side === "R") {
		side = "B";
		if (!initialLoad) alert("You are now on Blue Side");
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
	//updates timer
	const { timeLeft } = data;
	const timerElement = document.getElementById("timer");
	timerElement.textContent = timeLeft >= 0 ? timeLeft : 0;
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
				socket.emit("switchSides", draftId);
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
	confirmButton.textContent = "Ready Next Game";
	confirmButton.disabled = false;
	if (side !== "S") {
		switchSidesButton.style.display = "block";
		switchSidesButton.onclick = () => {
			socket.emit("switchSides", draftId);
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

socket.on("switchSidesResponse", (data) => {
	//sides swapped
	blueReady = data.blueReady;
	redReady = data.redReady;
	confirmButton.textContent = "Ready Next Game";
	confirmButton.disabled = false;
	updateSide(data.sideSwapped, data.blueTeamName, data.redTeamName);
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
	maybeFillNicknames();
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

function maybeFillNicknames(sideSwapped = false) {
	if (nicknames?.every((x) => !x)) {
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

	const nicknameElements = document.querySelectorAll(".nickname").entries();
	for (const [index, playerNicknameElem] of nicknameElements) {
		playerNicknameElem.textContent = localNicknames[index];
	}
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
