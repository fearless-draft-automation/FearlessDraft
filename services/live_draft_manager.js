const { nanoid } = require("nanoid");

class LiveDraftManager {
	static #isInternalConstructing = false;
	static #instance = null;

	#state = {};

	static getInstance() {
		if (!LiveDraftManager.#instance) {
			LiveDraftManager.#isInternalConstructing = true;
			LiveDraftManager.#instance = new LiveDraftManager();
		}

		return LiveDraftManager.#instance;
	}

	constructor() {
		if (!LiveDraftManager.#isInternalConstructing) {
			throw new TypeError("LiveDraftManager is not constructable");
		}

		LiveDraftManager.#isInternalConstructing = false;
	}

	startDraft(params) {
		const { blueTeamName, redTeamName } = params;
		const pickTimeout = Number(params.pickTimeout || 30);
		const nicknames = params.nicknames || Array(10).fill("");

		const draftId = nanoid(8);
		if (draftId in this.#state) {
			throw new Error("Draft ID collision");
		}

		this.#state[draftId] = {
			id: draftId,
			blueTeamName: blueTeamName,
			redTeamName: redTeamName,
			blueReady: false,
			redReady: false,
			picks: [],
			fearlessBans: [],
			timer: null,
			started: false,
			matchNumber: 1,
			sideSwapped: false,
			finished: false,
			lastActivity: Date.now(),
			isLocking: false,
			nicknames: nicknames,
			pickTimeout: pickTimeout,
		};

		return this.getDraft(draftId);
	}

	getDraft(draftId) {
		return this.#state[draftId];
	}

	cleanFinishedDrafts() {
		for (const [draftId, draft] of Object.entries(this.#state)) {
			if (this.#isDraftFinished(draft)) {
				delete this.#state[draftId];
			}
		}
	}

	#isDraftFinished(draft) {
		const { lastActivity } = draft;

		const inactivityDuration = 3 * 1000 * 60 * 60; // 3 hours
		const currentTime = Date.now();

		return currentTime - lastActivity >= inactivityDuration;
	}
}

module.exports = LiveDraftManager;
