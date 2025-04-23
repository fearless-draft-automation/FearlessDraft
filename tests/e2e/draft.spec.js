// @ts-check
import { expect, test } from "@playwright/test";
import { createDraft, startDraft } from "./utilities";

test("can start draft", async ({ page, context }) => {
	const [blueSideUrl, redSideUrl, _spectatorUrl] = await createDraft(page);

	const blueSidePage = page;
	await blueSidePage.goto(blueSideUrl);

	expect(await confirmButtonState(blueSidePage)).toBe(
		"awaits_ready_confirmation",
	);

	const redSidePage = await context.newPage();
	await redSidePage.goto(redSideUrl);

	expect(await confirmButtonState(redSidePage)).toBe(
		"awaits_ready_confirmation",
	);

	const blueSideConfirmButtonLocator =
		await getConfirmButtonLocator(blueSidePage);
	await blueSideConfirmButtonLocator.click();
	expect(await confirmButtonState(blueSidePage)).toBe(
		"awaits_red_confirmation",
	);

	const redSideConfirmButtonLocator =
		await getConfirmButtonLocator(redSidePage);
	await redSideConfirmButtonLocator.click();

	// TODO: Wait for visual confirmation instead
	await redSidePage.waitForTimeout(100);

	expect(await confirmButtonState(redSidePage)).toBe("awaits_champion_lock");
	await expect(redSideConfirmButtonLocator).toBeDisabled();

	expect(await confirmButtonState(blueSidePage)).toBe("awaits_champion_lock");
	await expect(blueSideConfirmButtonLocator).toBeDisabled();

	await expect(page.locator("#timer")).toBeVisible();
});

test("hover state is broadcasted to all participants", async ({
	page,
	context,
}) => {
	const [blueSidePage, redSidePage, spectatorPage] = await startDraft(
		page,
		context,
	);

	expect(await blueSidePage.getByAltText("BB1").getAttribute("src")).toContain(
		"placeholder.png",
	);
	expect(await redSidePage.getByAltText("BB1").getAttribute("src")).toContain(
		"placeholder.png",
	);
	expect(await spectatorPage.getByAltText("BB1").getAttribute("src")).toContain(
		"placeholder.png",
	);

	await blueSidePage.locator("#champion-grid").getByAltText("Annie").click();

	expect(await blueSidePage.getByAltText("BB1").getAttribute("src")).toContain(
		"1.png",
	);
	expect(await redSidePage.getByAltText("BB1").getAttribute("src")).toContain(
		"1.png",
	);

	expect(await spectatorPage.getByAltText("BB1").getAttribute("src")).toContain(
		"1.png",
	);
});

test("can switch sides", async ({ page, context }) => {
	const pages = await startDraft(page, context);

	const [blueSidePage, redSidePage, spectatorPage] = pages;

	for (const page of pages) {
		await expect(page.locator("#blue-team-name")).toHaveText("Team 1");
		await expect(page.locator("#red-team-name")).toHaveText("Team 2");
	}

	await lockChampion(blueSidePage, "Annie");
	await lockChampion(redSidePage, "Olaf");
	await lockChampion(blueSidePage, "Galio");
	await lockChampion(redSidePage, "Twisted Fate");
	await lockChampion(blueSidePage, "Xin Zhao");
	await lockChampion(redSidePage, "Urgot");

	await lockChampion(blueSidePage, "Vladimir");
	await lockChampion(redSidePage, "Fiddlesticks");
	await lockChampion(redSidePage, "Kayle");
	await lockChampion(blueSidePage, "Master Yi");
	await lockChampion(blueSidePage, "Alistar");
	await lockChampion(redSidePage, "Sivir");

	await lockChampion(redSidePage, "Soraka");
	await lockChampion(blueSidePage, "Teemo");
	await lockChampion(redSidePage, "Tristana");
	await lockChampion(blueSidePage, "Warwick");

	await lockChampion(redSidePage, "Nunu & Willump");
	await lockChampion(blueSidePage, "Miss Fortune");
	await lockChampion(blueSidePage, "Ashe");
	await lockChampion(redSidePage, "Tryndamere");

	for (const page of [blueSidePage, redSidePage]) {
		await expect(
			page.getByRole("button", { name: "Ready Next Game" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Switch Sides?" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Finish Series" }),
		).toBeVisible();
	}

	blueSidePage.on("dialog", async (dialog) => {
		expect(dialog.type()).toContain("alert");
		expect(dialog.message()).toContain("You are now on Red Side");
		await dialog.accept();
	});

	redSidePage.on("dialog", async (dialog) => {
		expect(dialog.type()).toContain("alert");
		expect(dialog.message()).toContain("You are now on Blue Side");
		await dialog.accept();
	});

	await blueSidePage.getByRole("button", { name: "Switch Sides?" }).click();

	for (const page of pages) {
		await expect(page.locator("#blue-team-name")).toHaveText("Team 2");
		await expect(page.locator("#red-team-name")).toHaveText("Team 1");
	}
});

async function getConfirmButtonLocator(page) {
	return await page.locator("#confirmButton");
}

async function lockChampion(page, championName) {
	await page.locator("#champion-grid").getByAltText(championName).click();

	// We expect button to already be visible. No need to wait for default timeout
	await page.locator("#confirmButton").click({ timeout: 1000 });

	// Server needs some time to process pick/ban
	// TODO: Wait for visual confirmation instead
	await page.waitForTimeout(50);
}

async function confirmButtonState(page) {
	const confirmButtonLocator = await getConfirmButtonLocator(page);

	const buttonLabel = await confirmButtonLocator.textContent();

	switch (buttonLabel.toLowerCase()) {
		case "ready":
			return "awaits_ready_confirmation";
		case "waiting for red...":
			return "awaits_red_confirmation";
		case "waiting for blue...":
			return "awaits_blue_confirmation";
		case "lock in":
			return "awaits_champion_lock";
		default:
			return "unknown";
	}
}
