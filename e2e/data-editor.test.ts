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

function cardPreview(page: Page, name: string) {
	return page.locator('main svg').filter({ hasText: name }).first();
}

async function dataCell(page: Page, header: string, row = 0) {
	const headers = await spreadsheetHeaders(page);
	const index = headers.indexOf(header);
	expect(index, `Missing spreadsheet header: ${header}`).toBeGreaterThanOrEqual(0);
	return page.locator(`#spreadsheet tbody tr:nth-child(${row + 1}) > td:nth-child(${index + 2})`);
}

async function imageHref(page: Page, id: string) {
	return page
		.locator(`main svg image#${id}`)
		.first()
		.evaluate((image) => {
			const svgImage = image as SVGImageElement;
			return svgImage.getAttribute('href') ?? svgImage.getAttribute('xlink:href') ?? '';
		});
}

async function imageHrefText(page: Page, id: string) {
	const href = await imageHref(page, id);
	return page.evaluate(async (href) => fetch(href).then((response) => response.text()), href);
}

async function seedProjectImageColumn(page: Page) {
	await seedProjects(page);
	const frontPath = '/western-cards/system/western/front.svg';
	const frontSvg = await readOpfsText(page, frontPath);
	const svgWithImageField = frontSvg.replace(
		'<text data-svgedit-line-height',
		'<image id="portrait" href="../../files/portrait.svg" x="2" y="2" width="10" height="10"/>\n   <text data-svgedit-line-height'
	);
	await writeOpfsText(page, frontPath, svgWithImageField);
	await writeOpfsText(
		page,
		'/western-cards/files/portrait.svg',
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/></svg>'
	);
	await writeOpfsText(page, '/western-cards/files/notes.txt', 'not an image');
	await page.goto('/app/games/western-cards/decks/western/data');
	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/western\/data/);
	await expect.poll(() => spreadsheetHeaders(page)).toContain('portrait');
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
	const layoutToolbar = page.getByRole('toolbar', { name: 'Layout editor toolbar' });
	await expect(layoutToolbar.getByRole('button', { name: 'Front' })).toBeVisible();

	await page.getByRole('link', { name: 'Spreadsheet' }).click();
	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/western\/data/);
	await expect(toolbar.getByRole('button', { name: 'Front' })).toBeVisible();
});

test('appends missing svg columns after csv columns', async ({ page }) => {
	await seedProjects(page);
	const frontSvg = await readOpfsText(page, '/western-cards/system/western/front.svg');
	const svgWithExtraField = frontSvg.replace(
		'</svg>',
		'<text id="late_svg_field" x="5" y="5">Late Field</text>\n</svg>'
	);
	await writeOpfsText(page, '/western-cards/system/western/front.svg', svgWithExtraField);

	await page.getByRole('main').getByText('western-cards').click();
	await page.getByRole('button', { name: 'Decks' }).click();
	await page.getByRole('link', { name: 'western', exact: true }).click();
	await page.getByRole('link', { name: 'Spreadsheet' }).click();

	await expect.poll(() => spreadsheetHeaders(page)).toContain('late_svg_field');
	const headers = await spreadsheetHeaders(page);
	expect(headers.indexOf('late_svg_field')).toBeGreaterThan(headers.indexOf('text1'));
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

test('image column edits update preview and persist after navigation', async ({ page }) => {
	await seedProjectImageColumn(page);

	const headers = await spreadsheetHeaders(page);
	expect(headers).toContain('portrait');

	(await dataCell(page, 'portrait')).dblclick();
	await page.getByRole('textbox').fill('portrait.svg');
	await page.keyboard.press('Enter');

	await expect(page.getByText('Saved')).toBeVisible();
	await expect.poll(() => imageHref(page, 'portrait')).toMatch(/^blob:/);

	await page.goto('/app/games/western-cards/decks/western/editor');
	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/western\/editor/);
	await page.goto('/app/games/western-cards/decks/western/data');

	await expect.poll(() => imageHref(page, 'portrait')).toMatch(/^blob:/);
	const savedCsv = await readOpfsText(page, '/western-cards/system/western/data.csv');
	expect(savedCsv).toContain('portrait.svg');
});

test('image picker lists project images and fills a selected image cell', async ({ page }) => {
	await seedProjectImageColumn(page);

	await (await dataCell(page, 'portrait')).click();
	await page.getByRole('button', { name: 'Select Image' }).click();

	await expect(page.getByRole('button', { name: /portrait\.svg/ })).toBeVisible();
	await expect(page.getByText('notes.txt')).not.toBeVisible();
	await page.getByRole('button', { name: /portrait\.svg/ }).dblclick();

	await expect(await dataCell(page, 'portrait')).toContainText('portrait.svg');
	await expect.poll(() => imageHref(page, 'portrait')).toMatch(/^blob:/);
});

test('image upload writes to files uploads and fills the selected image cell', async ({ page }) => {
	await seedProjectImageColumn(page);

	await (await dataCell(page, 'portrait')).click();
	await page.getByRole('button', { name: 'Select Image' }).click();
	await page.locator('input[type="file"]').setInputFiles({
		name: 'Uploaded Portrait.svg',
		mimeType: 'image/svg+xml',
		buffer: Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="blue"/></svg>'
		)
	});

	await expect(await dataCell(page, 'portrait')).toContainText('uploads/Uploaded-Portrait.svg');
	await expect.poll(() => imageHref(page, 'portrait')).toMatch(/^blob:/);
	const uploaded = await readOpfsText(page, '/western-cards/files/uploads/Uploaded-Portrait.svg');
	expect(uploaded).toContain('<circle');
});

test('flipped cards use back-prefixed image column values', async ({ page }) => {
	await seedProjects(page);
	await writeOpfsText(
		page,
		'/western-cards/files/front-bg.svg',
		'<svg xmlns="http://www.w3.org/2000/svg"><title>front-bg-marker</title></svg>'
	);
	await writeOpfsText(
		page,
		'/western-cards/files/back-bg.svg',
		'<svg xmlns="http://www.w3.org/2000/svg"><title>back-bg-marker</title></svg>'
	);
	const csv = await readOpfsText(page, '/western-cards/system/western/data.csv');
	const [headerLine, firstRowLine, ...rest] = csv.split(/\r?\n/);
	const headers = headerLine.split(',');
	const firstRow = firstRowLine.split(',');
	firstRow[headers.indexOf('background')] = 'front-bg.svg';
	firstRow[headers.indexOf('back_background')] = 'back-bg.svg';
	await writeOpfsText(
		page,
		'/western-cards/system/western/data.csv',
		[headerLine, firstRow.join(','), ...rest].join('\n')
	);

	await page.goto('/app/games/western-cards/decks/western/data');
	await expect(page).toHaveURL(/\/app\/games\/western-cards\/decks\/western\/data/);
	await expect.poll(() => imageHrefText(page, 'background')).toContain('front-bg-marker');

	await page.getByRole('button', { name: 'Back' }).click();
	await expect.poll(() => imageHrefText(page, 'background')).toContain('back-bg-marker');
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
