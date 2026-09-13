const PRESETS = ["bmt"];

function getPresetClass(name) {
	return PRESETS.includes(name) ? `preset-${name}` : "";
}

module.exports = { getPresetClass };
