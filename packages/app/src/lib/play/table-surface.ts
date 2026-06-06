import type { Application, Container, Graphics, Point, Renderer } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { defineErrors, extractErrorMessage, type InferErrors } from 'wellcrafted/error';
import { Err, Ok, trySync, type Result } from 'wellcrafted/result';
import { joinFsPath, type FsDir } from '$lib/components/file-browser/adapters/adapter';
import type { BoardGameItemNew } from '$lib/pixi/item';
import {
	createDefaultTable,
	TABLE_SVG_PATH,
	svgToTable,
	type TableSlot,
	type Table
} from '../../routes/games/[gameName]/setup/table';
import {
	clampTableItemPose as clampTableItemPoseBySize,
	tableSlotCellRect,
	type TableItemPose,
	type TableItemSize
} from './table-geometry';

export type LocalTable = {
	table: Table;
	customTableSvg: string | null;
};

const TABLE_VIEWPORT_PADDING = 260;

const TableLoadError = defineErrors({
	TableSvgMissing: ({ path }: { path: string }) => ({
		message:
			'This game needs setup/table.svg before it can be played. Open the table editor and save the table first.',
		path
	}),
	TableSvgReadFailed: ({ path, cause }: { path: string; cause: unknown }) => ({
		message: 'Could not load setup/table.svg. Open the table editor and save the table again.',
		path,
		cause,
		details: extractErrorMessage(cause)
	}),
	TableSvgParseFailed: ({ path, cause }: { path: string; cause: unknown }) => ({
		message: 'Could not parse setup/table.svg. Open the table editor and save the table again.',
		path,
		cause,
		details: extractErrorMessage(cause)
	})
});
export type TableLoadError = InferErrors<typeof TableLoadError>;
export type TableLoad = Result<LocalTable, TableLoadError>;

async function readRequiredTableSvg({
	fileSystem,
	projectName
}: {
	fileSystem: FsDir;
	projectName: string;
}): Promise<Result<string, TableLoadError>> {
	const path = joinFsPath(projectName, TABLE_SVG_PATH);
	const svgFile = await fileSystem.readText(path);
	if (!svgFile.error) return Ok(svgFile.data);

	if (svgFile.error.name === 'NotFoundError') {
		return TableLoadError.TableSvgMissing({ path });
	}

	return TableLoadError.TableSvgReadFailed({ path, cause: svgFile.error });
}

function parseLocalTable(svg: string, path: string): Result<LocalTable, TableLoadError> {
	return trySync({
		try: () => ({
			table: svgToTable(svg, createDefaultTable()),
			customTableSvg: svg
		}),
		catch: (cause) => TableLoadError.TableSvgParseFailed({ path, cause })
	});
}

export async function loadRequiredTable({
	fileSystem,
	projectName
}: {
	fileSystem: FsDir;
	projectName: string;
}): Promise<TableLoad> {
	const path = joinFsPath(projectName, TABLE_SVG_PATH);
	const svgFile = await readRequiredTableSvg({ fileSystem, projectName });
	if (svgFile.error) return Err(svgFile.error);

	const localTable = parseLocalTable(svgFile.data, path);
	if (localTable.error) return Err(localTable.error);

	return Ok(localTable.data);
}

export function normalizeRotation(value: number) {
	return ((value % 360) + 360) % 360;
}

export function tableItemRotation(item: BoardGameItemNew) {
	return normalizeRotation(
		item.clientPosition?.clientPositionState.rotation ?? item.visualRotationDegrees
	);
}

export function setTableItemRotation(item: BoardGameItemNew, rotation: number) {
	const nextRotation = normalizeRotation(rotation);
	if (item.clientPosition) {
		item.clientPosition.clientPositionState.rotation = nextRotation;
	}
	item.setDisplayedRotation(nextRotation);
}

export function configureTableItem(item: BoardGameItemNew) {
	if (!item.isInHand) {
		const rect = item.contentLocalBounds();
		if (rect.width <= 0 || rect.height <= 0) return;
		item.resetLayoutTransform({
			width: rect.width,
			height: rect.height,
			aspectRatio: rect.width / rect.height
		});
		item.pivot.set(rect.x, rect.y);
		item.scale.set(1);
	}
	item.setDisplayedRotation(tableItemRotation(item));
}

function tableItemSize(item: BoardGameItemNew): TableItemSize {
	const rect = item.contentLocalBounds();
	return {
		width: rect.width * item.scale.x,
		height: rect.height * item.scale.y
	};
}

function tableItemCenterOffset(item: BoardGameItemNew) {
	const rect = item.contentLocalBounds();
	return {
		x: (rect.x + rect.width / 2 - item.pivot.x) * item.scale.x,
		y: (rect.y + rect.height / 2 - item.pivot.y) * item.scale.y
	};
}

export function tableItemPose(item: BoardGameItemNew): TableItemPose {
	const offset = tableItemCenterOffset(item);
	return {
		centerX: item.x + offset.x,
		centerY: item.y + offset.y,
		rotation: tableItemRotation(item)
	};
}

export function tableItemCenter(item: BoardGameItemNew) {
	const pose = tableItemPose(item);
	return { x: pose.centerX, y: pose.centerY };
}

export function clampTableItemPose(
	table: Table,
	item: BoardGameItemNew,
	pose: TableItemPose
): TableItemPose {
	return clampTableItemPoseBySize(table, pose, tableItemSize(item));
}

export function tableItemVisualBoundsGlobal(app: Application<Renderer>, item: BoardGameItemNew) {
	app.render();
	const rect = item.contentWorldBounds();
	if (rect.width <= 0 || rect.height <= 0) return null;
	return rect;
}

function clampRatio(value: number) {
	return Math.max(0, Math.min(1, value));
}

function tableItemAabbSize(item: BoardGameItemNew, rotation: number) {
	const rect = item.contentLocalBounds();
	const radians = normalizeRotation(rotation) * (Math.PI / 180);
	const cos = Math.abs(Math.cos(radians));
	const sin = Math.abs(Math.sin(radians));
	const width = rect.width * item.scale.x;
	const height = rect.height * item.scale.y;
	return {
		width: width * cos + height * sin,
		height: width * sin + height * cos
	};
}

export function visualPointerRatio(
	app: Application<Renderer>,
	item: BoardGameItemNew,
	pointer: Point
) {
	const bounds = tableItemVisualBoundsGlobal(app, item);
	if (!bounds) return { x: 0.5, y: 0.5 };
	return {
		x: clampRatio((pointer.x - bounds.x) / bounds.width),
		y: clampRatio((pointer.y - bounds.y) / bounds.height)
	};
}

export function setTableItemPose(item: BoardGameItemNew, pose: TableItemPose) {
	setTableItemRotation(item, pose.rotation);
	const offset = tableItemCenterOffset(item);
	item.position.set(pose.centerX - offset.x, pose.centerY - offset.y);
}

export function setTableItemVisualPointUnderPointer({
	boardContainer,
	table,
	item,
	pointer,
	ratio
}: {
	boardContainer: Container;
	table: Table;
	item: BoardGameItemNew;
	pointer: Point;
	ratio: { x: number; y: number };
}) {
	const pointerTable = boardContainer.toLocal(pointer);
	const rotation = tableItemRotation(item);
	const visualSize = tableItemAabbSize(item, rotation);
	const pose = clampTableItemPose(table, item, {
		centerX: pointerTable.x - visualSize.width * (ratio.x - 0.5),
		centerY: pointerTable.y - visualSize.height * (ratio.y - 0.5),
		rotation
	});
	setTableItemPose(item, pose);
}

function rotatedTableSize(table: Table, cameraRotation: number) {
	const normalizedRotation = normalizeRotation(cameraRotation);
	if (normalizedRotation === 90 || normalizedRotation === 270) {
		return { width: table.table.height, height: table.table.width };
	}
	return { width: table.table.width, height: table.table.height };
}

function tableFitScale(app: Application<Renderer>, table: Table, cameraRotation: number) {
	const tableSize = rotatedTableSize(table, cameraRotation);
	const usableWidth = Math.max(320, app.screen.width - 96);
	const usableHeight = Math.max(240, app.screen.height - 260);
	return Math.max(0.2, Math.min(1, usableWidth / tableSize.width, usableHeight / tableSize.height));
}

export function applyTableCameraTransform({
	table,
	cameraRotation,
	tableWorldOffset,
	containers
}: {
	table: Table;
	cameraRotation: number;
	tableWorldOffset: { x: number; y: number };
	containers: Array<Container | Graphics | null | undefined>;
}) {
	const centerX = table.table.width / 2;
	const centerY = table.table.height / 2;
	const rotation = (cameraRotation * Math.PI) / 180;

	for (const container of containers) {
		if (!container) continue;
		container.pivot.set(centerX, centerY);
		container.position.set(tableWorldOffset.x + centerX, tableWorldOffset.y + centerY);
		container.rotation = rotation;
	}
}

export function configureTableViewport({
	app,
	viewport,
	table,
	cameraRotation,
	containers
}: {
	app: Application<Renderer>;
	viewport: Viewport;
	table: Table;
	cameraRotation: number;
	containers: Array<Container | Graphics | null | undefined>;
}) {
	const scale = tableFitScale(app, table, cameraRotation);
	const cameraPadding = TABLE_VIEWPORT_PADDING / scale;
	const tableSize = rotatedTableSize(table, cameraRotation);
	const tableWorldOffset = {
		x: cameraPadding + tableSize.width / 2 - table.table.width / 2,
		y: cameraPadding + tableSize.height / 2 - table.table.height / 2
	};
	const worldWidth = tableSize.width + cameraPadding * 2;
	const worldHeight = tableSize.height + cameraPadding * 2;
	viewport.resize(app.screen.width, app.screen.height, worldWidth, worldHeight);
	viewport.setZoom(scale, false);
	viewport.clamp({
		left: 0,
		right: worldWidth,
		top: 0,
		bottom: worldHeight,
		underflow: 'center'
	});
	applyTableCameraTransform({ table, cameraRotation, tableWorldOffset, containers });
	viewport.moveCenter(
		tableWorldOffset.x + table.table.width / 2,
		tableWorldOffset.y + table.table.height / 2
	);
	return tableWorldOffset;
}

export function tableDropPreviewRect(
	slot: TableSlot,
	itemId: string,
	occupants: string[],
	cellIndex: number | null = null
) {
	if (slot.layout?.mode === 'grid') {
		return cellIndex === null ? null : tableSlotCellRect(slot, cellIndex);
	}
	if (slot.layout?.mode !== 'horizontal-flex') {
		return {
			x: slot.x,
			y: slot.y,
			width: slot.width,
			height: slot.height,
			rotation: slot.rotation ?? 0
		};
	}

	const existingIndex = occupants.indexOf(itemId);
	const index = existingIndex >= 0 ? existingIndex : occupants.length;
	return tableSlotCellRect(slot, index);
}

function rotatedRectPoints(rect: {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}) {
	const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
	const radians = (rect.rotation * Math.PI) / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	return [
		{ x: rect.x, y: rect.y },
		{ x: rect.x + rect.width, y: rect.y },
		{ x: rect.x + rect.width, y: rect.y + rect.height },
		{ x: rect.x, y: rect.y + rect.height }
	].map((point) => {
		const dx = point.x - center.x;
		const dy = point.y - center.y;
		return {
			x: center.x + dx * cos - dy * sin,
			y: center.y + dx * sin + dy * cos
		};
	});
}

export function drawPreviewRect(
	graphics: Graphics,
	rect: { x: number; y: number; width: number; height: number; rotation: number },
	accepted: boolean
) {
	const fill = { color: accepted ? 0x22c55e : 0xef4444, alpha: 0.16 };
	const stroke = { color: accepted ? 0x16a34a : 0xdc2626, width: 4, alpha: 0.88 };
	if (!rect.rotation) {
		graphics.roundRect(rect.x, rect.y, rect.width, rect.height, 8).fill(fill).stroke(stroke);
		return;
	}
	const points = rotatedRectPoints(rect);
	graphics
		.moveTo(points[0].x, points[0].y)
		.lineTo(points[1].x, points[1].y)
		.lineTo(points[2].x, points[2].y)
		.lineTo(points[3].x, points[3].y)
		.closePath()
		.fill(fill)
		.stroke(stroke);
}
