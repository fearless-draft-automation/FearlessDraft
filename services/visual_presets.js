const NO_PRESET = {
	hideFilters: false,
	hideScrollbar: false,
	backgroundColor: null,
};

const PRESETS = {
	bmt: {
		hideFilters: true,
		hideScrollbar: true,
		backgroundColor: "#090808",
	},
};

function getVisualPreset(name) {
	return PRESETS[name] || NO_PRESET;
}

module.exports = { getVisualPreset };
