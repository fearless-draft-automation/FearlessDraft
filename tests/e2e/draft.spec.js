import { expect, test } from "@playwright/test";
import { createDraft, fillGame, startDraft } from "./utilities";

test("can start draft", async ({ page, context }) => {
	const [blueSideUrl, redSideUrl, _spectatorUrl] = await createDraft(page);

	const blueSidePage = page;
	await blueSidePage.goto(blueSideUrl);

	const redSidePage = await context.newPage();
	await redSidePage.goto(redSideUrl);

	for (const page of [blueSidePage, redSidePage]) {
		await expect(page.getByRole("button", { name: "Ready" })).toBeVisible();
	}

	await blueSidePage.getByRole("button", { name: "Ready" }).click();
	await expect(
		blueSidePage.getByRole("button", { name: "Waiting for Red..." }),
	).toBeVisible();

	await redSidePage.getByRole("button", { name: "Ready" }).click();
	// TODO: Wait for visual confirmation instead
	await redSidePage.waitForTimeout(100);

	for (const page of [blueSidePage, redSidePage]) {
		await expect(page.getByRole("button", { name: "Lock In" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Lock In" })).toBeDisabled();
		await expect(page.locator("#timer")).toBeVisible();
	}
});

test("hover state is broadcasted to all participants", async ({
	page,
	context,
}) => {
	const pages = await startDraft(page, context);
	const [blueSidePage, _redSidePage, _spectatorPage] = pages;

	for (const page of pages) {
		const iconSrc = await page.getByAltText("BB1").getAttribute("src");
		expect(iconSrc).toContain("placeholder.png");
	}

	await blueSidePage.locator("#champion-grid").getByAltText("Annie").click();

	for (const page of pages) {
		const iconSrc = await page.getByAltText("BB1").getAttribute("src");
		expect(iconSrc).toContain("1.png");
	}
});

test("can switch sides", async ({ page, context }) => {
	const pages = await startDraft(page, context);

	const [blueSidePage, redSidePage, _spectatorPage] = pages;

	for (const page of pages) {
		await expect(page.locator("#blue-team-name")).toHaveText("Team 1");
		await expect(page.locator("#red-team-name")).toHaveText("Team 2");
	}

	// biome-ignore format: lines reflect various pick/ban phases
	await fillGame(blueSidePage, redSidePage, [
		"Annie", "Olaf", "Galio", "Twisted Fate", "Xin Zhao", "Urgot",
		"Vladimir", "Fiddlesticks", "Kayle", "Master Yi", "Alistar", "Sivir",
		"Soraka", "Teemo", "Tristana", "Warwick",
		"Nunu & Willump", "Miss Fortune", "Ashe", "Tryndamere"
	]);

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
