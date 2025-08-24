const _ = require("lodash");
const express = require("express");
const router = express.Router();

const LiveDraftManager = require("../../services/live_draft_manager");

module.exports = router;

router.get(
	"/api/admin/draft/:draftId/live",
	ensureAuth,
	ensureLiveDraft,
	(req, res, _next) => {
		const { draft } = req;
		res.status(200).json(renderDraft(draft));
	},
);

router.patch(
	"/api/admin/draft/:draftId/live",
	ensureAuth,
	ensureLiveDraft,
	(req, res, _next) => {
		const { draft } = req;

		for (const key in req.body) {
			draft[key] = req.body[key];
		}

		res.status(200).json(renderDraft(draft));
	},
);

router.put(
	"/api/admin/draft/:draftId/live/nickname/:index",
	ensureAuth,
	ensureLiveDraft,
	(req, res, _next) => {
		const { draft } = req;
		const { index: nicknameIndexStr } = req.params;
		const index = Number(nicknameIndexStr);

		if (!_.inRange(index, 0, 10)) {
			res
				.status(400)
				.json({ error: "Nickname index should be withing [0, 10) range" });
			return;
		}

		const { nickname } = req.body;
		draft.nicknames[index] = nickname;

		res.status(200).json(renderDraft(draft));
	},
);

router.put(
	"/api/admin/draft/:draftId/live/pick/:index",
	ensureAuth,
	ensureLiveDraft,
	(req, res, _next) => {
		const { draft } = req;
		let { index: pickIndex } = req.params;
		pickIndex = pickIndex.toUpperCase();

		if (!_.includes(pickOrder, pickIndex)) {
			res.status(400).json({ error: "Invalid pick index" });
			return;
		}

		const index = translatePickIndex(pickIndex);
		if (index >= draft.picks.length) {
			res.status(400).json({ error: `Pick ${pickIndex} has not yet happened` });
			return;
		}

		let { pick } = req.body;
		pick = pick.toLowerCase();

		if (_.includes(draft.picks, pick)) {
			res.status(400).json({ error: `Champion ${pick} was already picked` });
			return;
		}

		const champions = require("../../priv/champions.json");
		if (_.findIndex(champions, ["key", pick]) === -1) {
			res.status(400).json({ error: `No champion with key ${pick}` });
			return;
		}

		draft.picks[index] = pick;
		res.status(200).json(renderDraft(draft));
	},
);

function getAdminTokens() {
	const tokenString = process.env.ADMIN_API_TOKENS;
	if (!tokenString) {
		return [];
	}

	return tokenString.split(",");
}

function ensureAuth(req, res, next) {
	const header = req.headers.authorization;
	if (!header) {
		res.status(401).json({ error: "Authorization header not found" });
		return;
	}

	const token = header.split(" ")[1];
	if (!token) {
		res.status(400).json({ error: "Malformed Authorization header" });
		return;
	}

	const adminTokens = getAdminTokens();
	if (!_.includes(adminTokens, token)) {
		res.status(403).json({ error: "You do not have access to this route" });
	}

	next();
}

function ensureLiveDraft(req, res, next) {
	const { draftId } = req.params;

	const draftManager = LiveDraftManager.getInstance();
	const draft = draftManager.getDraft(draftId);
	if (!draft) {
		res.status(404).json({ error: "Live draft not found" });
		return;
	}

	req.draft = draft;
	next();
}

function renderDraft(draft) {
	return _.omit(draft, ["timer"]);
}

// biome-ignore format: lines reflect various pick/ban phases
const pickOrder = [
	"BB1", "RB1", "BB2", "RB2", "BB3", "RB3",
	"BP1", "RP1", "RP2", "BP2", "BP3", "RP3",
	"RB4", "BB4", "RB5", "BB5",
	"RP4", "BP4", "BP5", "RP5"
]
function translatePickIndex(pickIndex) {
	return _.indexOf(pickOrder, pickIndex);
}
