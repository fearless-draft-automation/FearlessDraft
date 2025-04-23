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

async function getDraftUrl(linkContainerLocator) {
	return await linkContainerLocator.getByRole("link").getAttribute("href");
}
