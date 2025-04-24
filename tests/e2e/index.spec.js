import { expect, test } from "@playwright/test";

test("can create draft", async ({ page }) => {
	await page.goto("/");

	await page.getByRole("button", { name: "create draft" }).click();

	await page.waitForSelector(".copy-all-button");

	const linkLocators = await page.locator(".link-container").all();
	expect(linkLocators).toHaveLength(3);

	for (const locator of linkLocators) {
		const targetUrl =
			(await locator.getByRole("link").getAttribute("href")) || "";
		expect(targetUrl).toBeTruthy();

		const newTabPromise = page.waitForEvent("popup");
		await locator.click();

		const newTab = await newTabPromise;
		await newTab.waitForLoadState();

		await expect(newTab).toHaveURL(targetUrl);
	}
});
