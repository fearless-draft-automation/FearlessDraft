const mongoose = require("mongoose");

const Draft = mongoose.model(
	"Draft",
	new mongoose.Schema({
		draftId: String,
		picks: [String],
		fearlessBans: [String],
		matchNumber: Number,
		blueTeamName: String,
		redTeamName: String,
		date: {
			type: Date,
			default: Date.now,
		},
		options: {
			pickTimeout: {
				type: Number,
				default: 30,
			},
			nicknames: {
				type: [{ String }],
				default: [],
			},
		},
	}),
);

module.exports = {
	Draft,
};
