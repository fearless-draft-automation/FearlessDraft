const express = require("express");
const http = require("node:http");
require("dotenv").config();
const socketIO = require("socket.io");
const mongoose = require("mongoose");

const { Draft } = require("./models");
const LiveDraftManager = require("./services/live-draft-manager");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const draftManager = LiveDraftManager.getInstance();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.json());

app.use(require("./controllers/api/api_controller"));

app.use(require("./controllers/web/index_controller"));
app.use(require("./controllers/web/draft_controller"));

function log(message) {
	const timestamp = new Date().toISOString();
	console.log(`[${timestamp}] ${message}`);
}

const protocol = process.env.MONGO_HOST?.includes("localhost")
	? "mongodb"
	: "mongodb+srv";
const uri = `${protocol}://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}/?retryWrites=true&w=majority&appName=FearlessDraft`;
const clientOptions = {
	serverApi: {
		version: "1",
		strict: true,
		deprecationErrors: true,
	},
};
async function run() {
	try {
		// Create a Mongoose client with a MongoClientOptions object to set the Stable API version
		await mongoose.connect(uri, clientOptions);
		await mongoose.connection.db.admin().command({
			ping: 1,
		});
		log("Connected To MongoDB");
	} catch (error) {
		// Ensures that the client will close when you finish/error
		log("Error connecting to MongoDB", error);
	}
}
run().catch(console.dir);

// Clean finished drafts every 5 minutes
setInterval(
	() => {
		draftManager.cleanFinishedDrafts();
	},
	5 * 1000 * 60,
);

io.on("connection", (socket) => {
	socket.on("joinDraft", (draftId) => {
		try {
			socket.join(draftId);
		} catch (error) {
			log("Error joining draft:", error);
		}
	});

	socket.on("playerReady", (data) => {
		try {
			const { draftId, side } = data;
			const draft = draftManager.getDraft(draftId);
			if (!draft) {
				io.to(draftId).emit("draftNotAvailable");
				return;
			}

			if (side === "blue") {
				draft.blueReady = true;
			} else if (side === "red") {
				draft.redReady = true;
			}

			draft.lastActivity = Date.now();
			if (draft.blueReady && draft.redReady) {
				if (!draft.fearlessBans) {
					draft.fearlessBans = [];
				}

				draft.fearlessBans = draft.fearlessBans
					.concat(draft.picks.slice(6, 12))
					.concat(draft.picks.slice(16, 20));
				draft.picks = [];
				draft.started = true;

				io.to(draftId).emit("startDraft", draft);
			}
		} catch (error) {
			log(`Error setting player ready: ${error.message}`);
		}
	});

	socket.on("startTimer", (draftId) => {
		try {
			const draft = draftManager.getDraft(draftId);
			if (!draft) {
				return;
			}

			draft.started = true;
			draft.lastActivity = Date.now();
			if (draft.timer) {
				clearInterval(draft.timer);
				draft.timer = null;
			}

			let timeLeft = draft.pickTimeout || 30;
			draft.timer = setInterval(() => {
				timeLeft--;
				io.to(draftId).emit("timerUpdate", {
					timeLeft,
				});
				if (timeLeft <= -3) {
					clearInterval(draft.timer);
					draft.timer = null;
					setTimeout(() => {
						if (!draft.isLocking) {
							io.to(draftId).emit("lockChamp");
						}
					}, 100);
				}
			}, 1000);
		} catch (error) {
			log(`Error starting timer: ${error.message}`);
		}
	});

	socket.on("getData", (draftId) => {
		try {
			const draft = draftManager.getDraft(draftId);
			if (!draft || draft.finished) {
				socket.emit("draftState", {
					finished: true,
				});

				return;
			}

			data = {
				blueReady: draft.blueReady,
				redReady: draft.redReady,
				picks: draft.picks,
				started: draft.started,
				fearlessBans: draft.fearlessBans,
				matchNumber: draft.matchNumber,
				sideSwapped: draft.sideSwapped,
				blueTeamName: draft.blueTeamName,
				redTeamName: draft.redTeamName,
				pickTimeout: draft.pickTimeout,
				nicknames: draft.nicknames,
			};

			socket.emit("draftState", data);
		} catch (error) {
			log(`Error getting data: ${error.message}`);
		}
	});

	socket.on("hover", (data) => {
		//hovering over champ
		try {
			socket.to(data.draftId).emit("hover", data.champion);
		} catch (error) {
			log(`Error hovering over champ: ${error.message}`);
		}
	});

	socket.on("pickSelection", (data) => {
		//new pick made
		const { draftId, pick } = data;
		try {
			const draft = draftManager.getDraft(draftId);
			if (!draft || draft.isLocking) {
				return;
			}

			draft.isLocking = true;
			draft.lastActivity = Date.now();
			draft.picks.push(pick);
			io.to(draftId).emit("pickUpdate", draft.picks);
			setTimeout(() => {
				draft.isLocking = false;
			}, 100);
		} catch (error) {
			log("Pick selection error:", draft, error);
			return;
		}
	});

	socket.on("endDraft", async (draftId) => {
		//ends draft
		try {
			const draft = draftManager.getDraft(draftId);
			if (!draft) {
				return;
			}

			if (draft.timer) {
				clearInterval(draft.timer);
				draft.timer = null;
			}
			draft.blueReady = false;
			draft.redReady = false;
			draft.started = false;

			const dbDraft = new Draft({
				draftId: draftId,
				picks: draft.picks,
				fearlessBans: draft.fearlessBans,
				matchNumber: draft.matchNumber,
				blueTeamName: draft.blueTeamName,
				redTeamName: draft.redTeamName,
				options: {
					pickTimeout: draft.pickTimeout,
					nicknames: draft.nicknames,
				},
			});

			await dbDraft.save();

			draft.matchNumber++;
			draft.lastActivity = Date.now();
			if (draft.matchNumber > 5) {
				//5 games total
				draft.finished = true;
			}

			io.to(draftId).emit("showNextGameButton", draft);
		} catch (error) {
			log(`Error ending draft: ${error.message}`);
		}
	});

	socket.on("switchSides", (draftId) => {
		//switches sides
		try {
			const draft = draftManager.getDraft(draftId);
			if (!draft) {
				return;
			}

			draft.sideSwapped = !draft.sideSwapped;
			draft.blueReady = false;
			draft.redReady = false;

			io.to(draftId).emit("switchSidesResponse", draft);
		} catch (error) {
			log(`Error switching sides: ${error.message}`);
		}
	});

	socket.on("endSeries", (draftId) => {
		//ends draft
		try {
			const draft = draftManager.getDraft(draftId);
			if (!draft) {
				return;
			}

			draft.finished = true;
			io.to(draftId).emit("showNextGameButton", draft);
		} catch (error) {
			log(`Error ending series: ${error.message}`);
		}
	});

	socket.on("showDraft", async (draftId, gameNum) => {
		//shows draft
		try {
			const draft = await Draft.findOne({
				draftId: draftId,
				matchNumber: gameNum,
			});
			if (!draft) {
				socket.emit("showDraftResponse", null);
				return;
			}

			socket.emit("showDraftResponse", {
				picks: draft.picks,
				fearlessBans: draft.fearlessBans,
				matchNumber: draft.matchNumber,
				blueTeamName: draft.blueTeamName,
				redTeamName: draft.redTeamName,
				pickTimeout: draft.options.pickTimeout,
				nicknames: draft.options.nicknames,
			});
		} catch (error) {
			log("Error showing draft:", error);
		}
	});
});

const port = process.env.PORT || 3333;
server.listen(port, () => {
	log(`Server is running on port ${port}`);
});
