const express = require("express");
const http = require("node:http");
require("dotenv").config();
const socketIO = require("socket.io");
const mongoose = require("mongoose");

const LiveDraftManager = require("./services/live-draft-manager");

const draftManager = LiveDraftManager.getInstance();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.json());

app.use(require("./controllers/api/api_controller"));

app.use(require("./controllers/web/index_controller"));
app.use(require("./controllers/web/draft_controller"));

io.on("connection", (socket) => {
	require("./controllers/ws/web_socket_controller").attach(io, socket);
});

function log(message) {
	const timestamp = new Date().toISOString();
	console.log(`[${timestamp}] ${message}`);
}

const protocol = process.env.MONGO_HOST?.includes("localhost")
	? "mongodb"
	: "mongodb+srv";
const uri = `${protocol}://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}/?retryWrites=true&w=majority&appName=FearlessDraft`;
const clientOptions = {
	serverApi: {
		version: "1",
		strict: true,
		deprecationErrors: true,
	},
};
async function run() {
	try {
		// Create a Mongoose client with a MongoClientOptions object to set the Stable API version
		await mongoose.connect(uri, clientOptions);
		await mongoose.connection.db.admin().command({
			ping: 1,
		});
		log("Connected To MongoDB");
	} catch (error) {
		// Ensures that the client will close when you finish/error
		log("Error connecting to MongoDB", error);
	}
}
run().catch(console.dir);

// Clean finished drafts every 5 minutes
setInterval(
	() => {
		draftManager.cleanFinishedDrafts();
	},
	5 * 1000 * 60,
);

const port = process.env.PORT || 3333;
server.listen(port, () => {
	log(`Server is running on port ${port}`);
});
