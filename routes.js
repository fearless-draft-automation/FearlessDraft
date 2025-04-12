function connect(app) {
	return connectWeb(app);
}

function connectWeb(app) {
	app.use(require("./controllers/web/index_controller"));
	app.use(require("./controllers/web/draft_controller"));

	return app;
}

module.exports = {
	connect: connect,
};
