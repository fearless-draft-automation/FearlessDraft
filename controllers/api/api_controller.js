const express = require("express");
const router = express.Router();

const LiveDraftManager = require("../../services/live-draft-manager");
const NodeCache = require("node-cache");

const cache = new NodeCache({ stdTTL: 86400 });

module.exports = router;

router.get("/champions", async (req, res) => {
	const cacheKey = "champions";
	let champions = cache.get(cacheKey);
	if (champions) {
		return res.json(champions);
	}

	try {
		champions = require("../../priv/champions.json");
		cache.set(cacheKey, champions);
		res.json(champions);
	} catch (error) {
		console.log("Error loading champions.json:", error);

		res.status(500).json({
			error: "Failed to load champions list",
		});
	}
});

router.post("/create-draft", (req, res) => {
	try {
		const draftManager = LiveDraftManager.getInstance();
		const draft = draftManager.startDraft(req.body);
		const { id: draftId, blueTeamName, redTeamName } = draft;

		console.log(
			`Draft created: ${draftId} | Blue Team: ${blueTeamName} | Red Team: ${redTeamName}`,
		);

		res.json({
			blueLink: `/draft/${draftId}/team1`,
			redLink: `/draft/${draftId}/team2`,
			spectatorLink: `/draft/${draftId}/spectator`,
		});
	} catch (error) {
		console.log(`Error creating draft: ${error.message}`);
		res.status(500).json({ error: "Failed to create draft" });
	}
});
