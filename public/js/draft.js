const socket = io();
const patch = "15.2.1";
const baseUrl = `https://ddragon.leagueoflegends.com/cdn/${patch}`;
let championsV2 = null;
let currPick = 0;
let matchNumber = 1;
let usedChamps = new Set();
let fearlessChamps = new Set();
const timerInterval = null;
const timeLeft = 30;
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

function getCurrSlot() {
	//get current pick in draft
	if (currPick <= 6) {
		return currPick % 2 === 1
			? `BB${Math.ceil(currPick / 2)}`
			: `RB${Math.ceil(currPick / 2)}`;
	} else if (currPick <= 12) {
		switch (currPick) {
			case 7:
				return "BP1";
			case 8:
				return "RP1";
			case 9:
				return "RP2";
			case 10:
				return "BP2";
			case 11:
				return "BP3";
			case 12:
				return "RP3";
		}
	} else if (currPick <= 16) {
		return currPick % 2 === 0
			? `BB${Math.ceil(currPick / 2) - 3}`
			: `RB${Math.ceil(currPick / 2) - 3}`;
	} else if (currPick <= 20) {
		switch (currPick) {
			case 17:
				return "RP4";
			case 18:
				return "BP4";
			case 19:
				return "BP5";
			case 20:
				return "RP5";
		}
	} else {
		return "done";
	}
}

function displayChampions(champions) {
	//display champion grid
	championGrid.innerHTML = "";
	Object.values(champions).forEach((champion) => {
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
				const currSlot = getCurrSlot();
				if (currSlot === "done") {
					return;
				}
				if (currSlot[0] != side) {
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
	});
}

function filterChampions() {
	//filter champions based on search and role
	const searchTerm = searchInput.value.toLowerCase();
	const filteredChampions = Object.values(championsV2)
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

roleIcons.forEach((icon) => {
	icon.addEventListener("click", () => {
		const role = icon.getAttribute("data-role");
		if (selectedRole === role) {
			selectedRole = "";
			icon.classList.remove("active");
		} else {
			selectedRole = role;
			roleIcons.forEach((icon) => icon.classList.remove("active"));
			icon.classList.add("active");
		}
		filterChampions();
	});
});

searchInput.addEventListener("input", filterChampions);

confirmButton.addEventListener("click", () => {
	//lock in/ready button
	if (viewingPreviousDraft) {
		return;
	}

	if (currPick === 0) {
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
	const currSlot = getCurrSlot();
	if (currSlot === "done") {
		return;
	}
	// Reset the border for all side headers and slots
	document.querySelectorAll(".side-header").forEach((header) => {
		header.style.border = headerDefaultOutline;
	});
	document.querySelectorAll(".pick-slot, .ban-slot").forEach((slot) => {
		slot.style.outline = "none"; // Reset the border of all slots
	});

	if (currPick == 0) {
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
	const currSlot = getCurrSlot();
	if (currSlot[0] != side) {
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
	roleIcons.forEach((icon) => icon.classList.remove("active"));
	filterChampions();
	if (currPick <= 19) {
		colorBorder();
		startTimer();
	} else {
		confirmButton.textContent = "Ready Next Game";
		confirmButton.disabled = false;
		currPick = 0;
		endDraft();
	}
	setTimeout(() => {
		isLocking = false;
	}, 100);
}

function startDraft() {
	currPick = 1;
	document
		.querySelectorAll(".ban-slot img")
		.forEach((img) => (img.src = "/img/placeholder.png"));
	document
		.querySelectorAll(".pick-slot img")
		.forEach((img) => (img.src = "/img/placeholder.png"));
	document
		.querySelectorAll(".champion-name")
		.forEach((label) => (label.textContent = ""));
	confirmButton.textContent = "Lock In";
	switchSidesButton.style.display = "none";
	finishSeriesButton.style.display = "none";
	displayChampions(championsV2);
	colorBorder();
	startTimer();
}

function fearlessBan(champions) {
	let fearlessBanSlot = 0;
	blueCounter = 1;
	redCounter = 1;
	champions.forEach((pick, index) => {
		if (pick == "placeholder") {
			//TODO remove this later, currently here for backward compatibility
			pick = "none";
		}
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
				banImage.src = pick.iconLink;
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
				banImage.src = pick.iconLink;
				redCounter++;
				break;
			default:
				break;
		}
	});
}

function hover(pick) {
	const slot = getCurrSlot(currPick);
	if (slot[1] === "B") {
		const banSlot = document.querySelector(
			`#${slot[0] === "B" ? "blue" : "red"}-bans .ban-slot:nth-child(${slot[0] === "B" ? slot[2] : 6 - slot[2]})`,
		);
		const banImage = banSlot.querySelector("img");
		banImage.src = championsV2[pick].iconLink;
	} else {
		const pickSlot = document.querySelector(
			`#${slot[0] === "B" ? "blue" : "red"}-picks .pick-slot:nth-child(${slot[2]})`,
		);
		const pickImage = pickSlot.querySelector("img");
		pickImage.src = championsV2[pick].iconLink;
		addChampionNameText(pickSlot, pick);
	}
}

function addChampionNameText(pickSlot, pick) {
	const championName = pickSlot.querySelector(".champion-name");
	championName.textContent = championsV2[pick].name;
}

function newPick(picks) {
	picks.forEach((pick, index) => {
		if (pick == "placeholder") {
			//TODO remove this later, currently here for backward compatibility
			pick = "none";
		}

		currPick = index + 1;
		const slot = getCurrSlot(currPick);
		if (slot[1] === "B") {
			const banSlot = document.querySelector(
				`#${slot[0] === "B" ? "blue" : "red"}-bans .ban-slot:nth-child(${slot[0] === "B" ? slot[2] : 6 - slot[2]})`,
			);
			const banImage = banSlot.querySelector("img");
			banImage.src = championsV2[pick].iconLink;
		} else {
			const pickSlot = document.querySelector(
				`#${slot[0] === "B" ? "blue" : "red"}-picks .pick-slot:nth-child(${slot[2]})`,
			);
			const pickImage = pickSlot.querySelector("img");
			pickImage.src = championsV2[pick].splashArtLink;
			//text that shows champion name
			addChampionNameText(pickSlot, pick);
		}
		usedChamps.add(pick);
		currPick++;
	});
	if (draftStarted && picks.length == 0) {
		currPick = 1;
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
	document.getElementById("blue-team-name").textContent = blueName;
	document.getElementById("red-team-name").textContent = redName;
	if (!sideSwapped) {
		if (!initialLoad)
			if (side !== "S") {
				if (side === "B") alert("You are now on Blue Side");
				else if (side === "R") alert("You are now on Red Side");
			} else alert(`Sides Swapped`);
		return;
	}
	if (side === "B") {
		side = "R";
		if (!initialLoad) alert("You are now on Red Side");
	} else if (side === "R") {
		side = "B";
		if (!initialLoad) alert("You are now on Blue Side");
	}
	document.getElementById("blue-team-name").textContent = blueName;
	document.getElementById("red-team-name").textContent = redName;
}

function endDraft() {
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
		currPick = 0;
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
	currPick = 0;
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
	document.getElementById("blue-team-name").textContent = blueTeamName;
	document.getElementById("red-team-name").textContent = redTeamName;
	draftStarted = false;
	updateFearlessBanSlots();
	fearlessBan(data.fearlessBans);
	newPick(picks);
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

document.addEventListener("DOMContentLoaded", async () => {
	championsV2 = await loadChampionsV2();
	displayChampions(championsV2);
	socket.emit("joinDraft", draftId);
	socket.emit("getData", draftId);
	if (side === "S") {
		confirmButton.style.display = "none";
		switchSidesButton.style.display = "none";
	}
});
