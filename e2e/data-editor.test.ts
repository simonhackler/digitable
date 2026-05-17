import { expect, test, type Page } from '@playwright/test';
import { opfsEntryExists, readOpfsText, seedProjects, writeOpfsText } from './helpers/opfs';

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

function cardPreview(page: Page, name: string) {
	return page.locator('main svg').filter({ hasText: name }).first();
}

test('insert rows in spreadsheet editor', async ({ page }) => {
	await openWesternDataEditor(page);
	await page.locator('tbody > tr > td:nth-child(8)').first().dblclick();
	await page.getByRole('textbox').fill('wow!');
	await expect(cardPreview(page, 'wow!')).toBeVisible();
	await page.getByRole('cell', { name: '1', exact: true }).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Delete selected rows' }).click();
	await expect(cardPreview(page, 'wow!')).not.toBeVisible();

	await page.getByRole('cell', { name: '1', exact: true }).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Insert a new row after' }).click();

	await page.getByRole('cell', { name: '1', exact: true }).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Insert a new row before' }).click();
});

test('go to spreadsheet editor', async ({ page }) => {
	await seedProjects(page);
	await expect(page.locator('h1')).toBeVisible();
});

test('spreadsheet editor toolbar opens layout editor', async ({ page }) => {
	await openWesternDataEditor(page);

	const toolbar = page.getByRole('toolbar', { name: 'Spreadsheet editor toolbar' });
	await toolbar.getByRole('button', { name: 'Back' }).click();
	await expect(toolbar.getByRole('button', { name: 'Front' })).toBeVisible();

	await page.getByRole('link', { name: 'Layout' }).click();
	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/western\/editor/);
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
	await page.getByRole('link', { name: 'Spreadsheet' }).click();

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
	await expect(cardPreview(page, 'persisted e2e value')).toBeVisible();

	await page.goto('/app/games/western-cards/decks/western/editor');
	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/western\/editor/);
	await page.goto('/app/games/western-cards/decks/western/data');
	await expect(cardPreview(page, 'persisted e2e value')).toBeVisible();
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

test('creates a pre-made French playing card deck', async ({ page }) => {
	await seedProjects(page);
	await page.getByRole('main').getByText('western-cards').click();
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.locator('[data-sidebar="menu-sub-button"]').filter({ hasText: 'New' }).click();

	await page.getByRole('button', { name: 'Blank deck' }).click();
	await page.getByRole('option', { name: 'Pre-made deck' }).click();
	await page.getByPlaceholder('deck name').fill('french_builtin');
	await page.getByRole('button', { name: 'Create new deck' }).click();

	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/french_builtin\/data/);
	await expect(page.getByRole('link', { name: 'french_builtin', exact: true })).toBeVisible();

	await expect
		.poll(() => opfsEntryExists(page, '/western-cards/system/french_builtin/front.svg'))
		.toBe(true);
	await expect
		.poll(() =>
			opfsEntryExists(
				page,
				'/western-cards/files/premade-decks/french-playing-cards/ace_of_spades.png'
			)
		)
		.toBe(true);

	const data = await readOpfsText(page, '/western-cards/system/french_builtin/data.csv');
	expect(data).toContain('card_face');
	expect(data).toContain('ace_of_spades.png');
	expect(data.split('\n')).toHaveLength(55);
	await expect(page.locator('main svg image').first()).toBeVisible();
});

test('creates a generated number and color deck', async ({ page }) => {
	await seedProjects(page);
	await page.getByRole('main').getByText('western-cards').click();
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.locator('[data-sidebar="menu-sub-button"]').filter({ hasText: 'New' }).click();

	await page.getByRole('button', { name: 'Blank deck' }).click();
	await page.getByRole('option', { name: 'Pre-made deck' }).click();
	await page.getByRole('button', { name: 'French playing cards' }).click();
	await page.getByRole('option', { name: 'Number and color deck' }).click();
	await page.getByPlaceholder('deck name').fill('numbers_builtin');
	await page.getByRole('button', { name: 'Create new deck' }).click();

	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/numbers_builtin\/data/);
	await expect
		.poll(() => opfsEntryExists(page, '/western-cards/files/premade-decks/number-color/red_1.svg'))
		.toBe(true);

	const data = await readOpfsText(page, '/western-cards/system/numbers_builtin/data.csv');
	expect(data).toContain('Red 1');
	expect(data).toContain('Yellow 13');
	expect(data.split('\n')).toHaveLength(53);
	await expect(page.locator('main svg image').first()).toBeVisible();
});

test('creates a pre-made French Tarot deck', async ({ page }) => {
	await seedProjects(page);
	await page.getByRole('main').getByText('western-cards').click();
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.locator('[data-sidebar="menu-sub-button"]').filter({ hasText: 'New' }).click();

	await page.getByRole('button', { name: 'Blank deck' }).click();
	await page.getByRole('option', { name: 'Pre-made deck' }).click();
	await page.getByRole('button', { name: 'French playing cards' }).click();
	await page.getByRole('option', { name: 'French Tarot' }).click();
	await page.getByPlaceholder('deck name').fill('tarot_builtin');
	await page.getByRole('button', { name: 'Create new deck' }).click();

	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/tarot_builtin\/data/);
	await expect
		.poll(() =>
			opfsEntryExists(page, '/western-cards/files/premade-decks/french-tarot/tarot_trump_21.svg')
		)
		.toBe(true);

	const data = await readOpfsText(page, '/western-cards/system/tarot_builtin/data.csv');
	expect(data).toContain('tarot_group');
	expect(data).toContain('tarot_fool.svg');
	expect(data.split('\n')).toHaveLength(79);
	await expect(page.locator('main svg image').first()).toBeVisible();
});
