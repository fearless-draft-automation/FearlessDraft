const mongoose = require("mongoose");

const draftSchema = new mongoose.Schema(
	{
		draftId: String,
		picks: [String],
		fearlessBans: [String],
		matchNumber: Number,
		blueTeamName: String,
		redTeamName: String,
		options: {
			pickTimeout: {
				type: Number,
				default: 30,
			},
			nicknames: {
				type: [String],
				default: [],
			},
		},
	},
	{
		timestamps: {
			currentTime: () => Date.now()
		},
	},
);

draftSchema.index({ createdAt: -1 });
draftSchema.index({ updatedAt: -1 });

const Draft = mongoose.model("Draft", draftSchema);

module.exports = {
	Draft,
};
