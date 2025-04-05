const express = require("express");
const router = express.Router();

const { Draft } = require("../../models");
const LiveDraftManager = require("../../services/live-draft-manager");

module.exports = router;

router.get("/draft/:draftId/:side", async (req, res) => {
	try {
		const { draftId, side: teamId } = req.params;

		const draft = await loadDraft(draftId);
		if (!draft) {
			res.status(404).json({ error: "Draft not found" });
			return;
		}

		res.render("draft", {
			draftId: draftId,
			side: getSideId(teamId),
			blueTeamName: draft.blueTeamName,
			redTeamName: draft.redTeamName,
			pickTimeout: draft.options?.pickTimeout || draft.pickTimeout,
			nicknames: draft.options?.nicknames  || draft.nicknames,
		});
	} catch (error) {
		console.log(`Error rendering draft: ${error.message}`);
		res.status(500).json({ error: "Failed to render draft" });
	}
});

async function loadDraft(draftId) {
	let draft = LiveDraftManager.getInstance().getDraft(draftId);
	if (!draft) {
		draft = await Draft.findOne({
			draftId: draftId,
			matchNumber: 1,
		});
	}

	return draft;
}

function getSideId(teamId) {
	switch (teamId) {
		case "team1":
			return "blue";
		case "team2":
			return "red";
		default:
			return "spectator";
	}
}
