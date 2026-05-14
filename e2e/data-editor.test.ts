import { expect, test, type Page } from '@playwright/test';
import { readOpfsText, seedProjects, writeOpfsText } from './helpers/opfs';

async function openWesternDataEditor(page: Page) {
	await seedProjects(page);
	await page.goto('/app/games/western-cards/decks/western/data');
	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/western\/data/);
}

async function spreadsheetHeaders(page: Page) {
	return page.locator('#spreadsheet').evaluate((root) =>
		Array.from(root.querySelectorAll('thead td'))
			.map((cell) => cell.textContent?.trim() ?? '')
			.filter(Boolean)
	);
}

test('insert rows in data editor', async ({ page }) => {
	await openWesternDataEditor(page);
	await page.locator('tbody > tr > td:nth-child(8)').first().dblclick();
	await page.getByRole('textbox').fill('wow!');
	await expect(page.locator('.flex.w-screen > div:nth-child(1)').getByText('wow!')).toBeVisible();
	await page.getByRole('cell', { name: '1', exact: true }).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Delete selected rows' }).click();
	await expect(
		page.locator('.flex.w-screen > div:nth-child(1)').getByText('wow!')
	).not.toBeVisible();

	await page.getByRole('cell', { name: '1', exact: true }).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Insert a new row after' }).click();

	await page.getByRole('cell', { name: '1', exact: true }).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Insert a new row before' }).click();
});

test('go to data editor', async ({ page }) => {
	await seedProjects(page);
	await expect(page.locator('h1')).toBeVisible();
});

test('appends missing svg columns after csv columns', async ({ page }) => {
	await seedProjects(page);
	const frontSvg = await readOpfsText(page, '/western-cards/system/western/front.svg');
	const svgWithExtraField = frontSvg.replace(
		'</g>\n </g>\n</svg>',
		'<text id="late_svg_field" x="5" y="5">Late Field</text>\n  </g>\n </g>\n</svg>'
	);
	await writeOpfsText(page, '/western-cards/system/western/front.svg', svgWithExtraField);

	await page.getByRole('main').getByText('western-cards').click();
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.getByRole('link', { name: 'western', exact: true }).click();
	await page.getByRole('link', { name: 'Data' }).click();

	await expect.poll(() => spreadsheetHeaders(page)).toContain('late_svg_field');
	const headers = await spreadsheetHeaders(page);
	expect(headers.at(-1)).toBe('late_svg_field');
});

test('editing data shows save state and persists after navigation', async ({ page }) => {
	await openWesternDataEditor(page);

	await page.locator('tbody > tr > td:nth-child(8)').first().dblclick();
	await page.getByRole('textbox').fill('persisted e2e value');
	await page.keyboard.press('Enter');

	await expect(page.getByText('Saving')).toBeVisible();
	await expect(page.getByText('Saved')).toBeVisible();
	await expect(
		page.locator('.flex.w-screen > div:nth-child(1)').getByText('persisted e2e value')
	).toBeVisible();

	await page.goto('/app/games/western-cards/decks/western/editor');
	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/western\/editor/);
	await page.goto('/app/games/western-cards/decks/western/data');
	await expect(
		page.locator('.flex.w-screen > div:nth-child(1)').getByText('persisted e2e value')
	).toBeVisible();
});

test('append buttons add one row and one column', async ({ page }) => {
	await openWesternDataEditor(page);

	await expect(page.locator('#spreadsheet tbody tr').first()).toBeVisible();
	const rowsBefore = await page.locator('#spreadsheet tbody tr').count();
	const headersBefore = await spreadsheetHeaders(page);

	await page.getByRole('button', { name: 'Append row' }).click();
	await expect(page.locator('#spreadsheet tbody tr')).toHaveCount(rowsBefore + 1);

	await page.getByRole('button', { name: 'Append column' }).click();
	await expect.poll(() => spreadsheetHeaders(page)).toHaveLength(headersBefore.length + 1);
});

test('creating decks resets the form and accepts decimal comma dimensions', async ({ page }) => {
	await seedProjects(page);
	await page.getByRole('main').getByText('western-cards').click();
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.locator('[data-sidebar="menu-sub-button"]').filter({ hasText: 'New' }).click();

	await page.getByPlaceholder('deck name').fill('comma_one');
	await page.getByPlaceholder('width').fill('55,9');
	await page.getByPlaceholder('height').fill('87,1');
	await page.getByRole('button', { name: 'Create new deck' }).click();
	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/comma_one\/editor/);

	await page.locator('[data-sidebar="menu-sub-button"]').filter({ hasText: 'New' }).click();
	await expect(page.getByPlaceholder('deck name')).toHaveValue('');
	await page.getByPlaceholder('deck name').fill('comma_two');
	await page.getByPlaceholder('width').fill('41');
	await page.getByPlaceholder('height').fill('63');
	await page.getByRole('button', { name: 'Create new deck' }).click();
	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/comma_two\/editor/);

	const firstFront = await readOpfsText(page, '/western-cards/system/comma_one/front.svg');
	expect(firstFront).toContain('viewBox="0 0 55.9 87.1"');
	const secondFront = await readOpfsText(page, '/western-cards/system/comma_two/front.svg');
	expect(secondFront).toContain('viewBox="0 0 41 63"');
});
