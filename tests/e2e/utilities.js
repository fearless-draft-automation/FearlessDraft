export async function createDraft(page) {
	await page.goto("/");

	await page.getByRole("button", { name: "create draft" }).click();

	await page.waitForSelector(".copy-all-button");

	const linkLocators = await page.locator(".link-container").all();
	return await Promise.all(linkLocators.map(getDraftUrl));
}

export async function startDraft(page, context) {
	const [blueSideUrl, redSideUrl, spectatorUrl] = await createDraft(page);
	const blueSidePage = page;
	await blueSidePage.goto(blueSideUrl);

	const redSidePage = await context.newPage();
	await redSidePage.goto(redSideUrl);

	const spectatorPage = await context.newPage();
	await spectatorPage.goto(spectatorUrl);

	await blueSidePage.locator("#confirmButton").click();
	await redSidePage.locator("#confirmButton").click();

	return [blueSidePage, redSidePage, spectatorPage];
}

// biome-ignore format: lines reflect various pick/ban phases
const pickOrder = [
	"BB1", "RB1", "BB2", "RB2", "BB3", "RB3",
	"BP1", "RP1", "RP2", "BP2", "BP3", "RP3",
	"RB4", "BB4", "RB5", "BB5",
	"RP4", "BP4", "BP5", "RP5"
]

export async function fillGame(blueSidePage, redSidePage, picksBans) {
	for (let i = 0; i < picksBans.length; i++) {
		let page = blueSidePage;
		if (pickOrder[i][0] === "R") {
			page = redSidePage;
		}

		await lockChampion(page, picksBans[i]);
	}
}

export async function lockChampion(page, championName) {
	await page.locator("#champion-grid").getByAltText(championName).click();

	// We expect button to already be visible. No need to wait for default timeout
	await page.locator("#confirmButton").click({ timeout: 1000 });

	// Server needs some time to process pick/ban
	// TODO: Wait for visual confirmation instead
	await page.waitForTimeout(50);
}

async function getDraftUrl(linkContainerLocator) {
	return await linkContainerLocator.getByRole("link").getAttribute("href");
}
