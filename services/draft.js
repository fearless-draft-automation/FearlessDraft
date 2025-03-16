const { Draft } = require("../models")

async function get(draftId, matchNumber) {
    return await Draft.findOne({
        draftId,
        matchNumber
    });
}

module.exports = {
    get
}