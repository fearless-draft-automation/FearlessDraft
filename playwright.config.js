import { defineConfig, devices } from "@playwright/test";

import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, ".env") });

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: "list",
	use: {
		trace: "on-first-retry",
		baseURL: "http://127.0.0.1:3333",
	},

	projects: [
		{
			name: "Google Chrome",
			use: { ...devices["Desktop Chrome"], channel: "chrome" },
		},
	],

	webServer: {
		command: "npm run start",
		url: "http://127.0.0.1:3333",
		reuseExistingServer: !process.env.CI,
	},
});
