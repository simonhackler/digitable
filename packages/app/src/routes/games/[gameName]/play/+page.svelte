<script lang="ts">
	import { Client, Room, getStateCallbacks } from 'colyseus.js';
	import { Application, Assets, Container, Sprite, Texture } from 'pixi.js';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { getFileSystemContext } from '../../context';
	import { loadSvgsAndData } from '../data-loader';
	import { generateSvg, loadSvgTemplate } from '../svg-helpers';
	import { error } from '@sveltejs/kit';
	import { BoardgameRoomState } from 'boardgame-server/src/rooms/schema/MyRoomState';
	import { BoardGameItem } from '$lib/pixi/item';


    // TODO: Simple data driven design. Server should sync the data to the clients.
    // Then clients update components based on the data.
    // How to send updates to the server?
    // Players probably need to "own" components so they will not be updated by the server, except if the owner changes
    // Client functions will have to update data on the client and send the changes to the server
    // Create a small query based system. Server is authorative.

    // The data layout is tricky here. Players can have cards in hand, moving or on their own board, where they should not be interactable
    // Should this all be maps, each player has a map of their own cards? What about cards that might be owned by 2 players? Then they
    // would have to be moved from array to array etc. How to handle timeouts? E.g locks for cards that are on the board
    // should be released. However locks for cards in hand should not be released.


	interface ImageInfo {
		element: SVGImageElement;
		x: number;
		y: number;
		width: number;
		height: number;
		href: string;
		transform?: string;
	}

	function extractImagesFromSvg(svg: SVGSVGElement): ImageInfo[] {
		const images = svg.querySelectorAll('image');
		const imageInfos: ImageInfo[] = [];

		images.forEach(img => {
			const x = parseFloat(img.getAttribute('x') || '0');
			const y = parseFloat(img.getAttribute('y') || '0');
			const width = parseFloat(img.getAttribute('width') || '0');
			const height = parseFloat(img.getAttribute('height') || '0');
			const href = img.getAttribute('href') || img.getAttribute('xlink:href') || '';
			const transform = img.getAttribute('transform') || undefined;

			imageInfos.push({
				element: img,
				x,
				y,
				width,
				height,
				href,
				transform
			});
		});

		return imageInfos;
	}

	function stripImagesFromSvg(svg: SVGSVGElement): SVGSVGElement {
		const svgClone = svg.cloneNode(true) as SVGSVGElement;
		const images = svgClone.querySelectorAll('image');
		images.forEach(img => img.remove());
		return svgClone;
	}

	async function createImageSprites(imageInfos: ImageInfo[]): Promise<Sprite[]> {
		const sprites: Sprite[] = [];

		for (const imageInfo of imageInfos) {
			try {
				const texture = await Assets.load(imageInfo.href);
				const sprite = new Sprite(texture);

				sprite.x = imageInfo.x;
				sprite.y = imageInfo.y;
				sprite.width = imageInfo.width;
				sprite.height = imageInfo.height;

				if (imageInfo.transform) {
					// Apply transform if present (basic support)
					// You might need to extend this for complex transforms
					const transformMatch = imageInfo.transform.match(/translate\(([^)]+)\)/);
					if (transformMatch) {
						const [tx, ty] = transformMatch[1].split(',').map(v => parseFloat(v.trim()));
						sprite.x += tx;
						sprite.y += ty;
					}
				}

				sprites.push(sprite);
			} catch (error) {
				console.warn('Failed to load image:', imageInfo.href, error);
			}
		}

		return sprites;
	}

	async function createHybridContainer(
		svg: SVGSVGElement
	): Promise<{
		container: Container;
		svgTexture: Texture;
		imageSprites: Sprite[];
	}> {
		const imageInfos = extractImagesFromSvg(svg);
		const strippedSvg = stripImagesFromSvg(svg);

		const svgTexture = await svgToTexture(strippedSvg);
		const imageSprites = await createImageSprites(imageInfos);

		const container = new Container();
		const svgSprite = new Sprite(svgTexture);

        const imageContainer = new Container();
		imageSprites.forEach(sprite => {
			imageContainer.addChild(sprite);
		});
        // WARN! This is hacky. It assumes all text is layed above all images. This should be mostly true
        container.addChild(imageContainer);
		container.addChild(svgSprite);
        imageContainer.scale = svgSprite.width / imageContainer.width;

		return {
			container,
			svgTexture: svgTexture,
			imageSprites
		};
	}

	let canvasContainer: HTMLDivElement;

	const projectName = $derived(page.params.gameName);
	const cardName = $derived(page.params.deckName || 'western');
	const fileSystem = getFileSystemContext();

	async function svgToTexture(
		svg: SVGSVGElement,
		cardIndex?: number
	)
	{
		const svgClone = svg.cloneNode(true) as SVGSVGElement;
		const svgData = new XMLSerializer().serializeToString(svgClone);
		const objectUrl = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml' }));
		const texture = (await Assets.load({
			src: objectUrl,
			format: 'svg',
			parser: 'svg',
			resolution: 1
		})) as Texture;

		if (cardIndex !== undefined) {
			console.log(`Card ${cardIndex} texture timing:`);
		}

		URL.revokeObjectURL(objectUrl);

		return texture;
	}

	async function createOrJoinRoom(client: Client, roomName: string) {
		try {
			return await client.joinOrCreate<BoardgameRoomState>(roomName);
		} catch (e) {
			console.error('Failed to join or create room:', e);
			error(500, 'Could not join or create room');
		}
	}

	const client = new Client('ws://localhost:2567');
    console.log(client);
	const room = await createOrJoinRoom(client, 'my_room');
    console.log(room);

	const s = getStateCallbacks(room);

	let syncCards: BoardGameItem[] = [];

	console.log('Joined room:', room.name, 'with session ID:', room.sessionId);

	onMount(async () => {
		// Listen for card array changes
		s(room.state).cards.onAdd((card, index) => {
			console.log(`Card ${index} added to state`);
			if (syncCards[index]) {
				syncCards[index].x = card.x;
				syncCards[index].y = card.y;
			}

			// Listen to individual card changes
			s(card).onChange(() => {
                const cardContainer = syncCards[index];
				if (syncCards[index]) {
					cardContainer.x = card.x;
					cardContainer.y = card.y;

					if (cardContainer.isFrontShowing() !== card.isFaceUp) {
                        cardContainer.flip();
					}
				}
			});
		});
        //s(room.state).Players
        console.log(room)
		const app = new Application();
		await app.init({
			background: '#2c3e50',
			resizeTo: window,
			antialias: true,
			resolution: window.devicePixelRatio || 1,
			autoDensity: true
		});

		canvasContainer.appendChild(app.canvas);

		// allow the stage itself to catch pointer events anywhere
		app.stage.eventMode = 'static';
		app.stage.hitArea = app.screen;

		const container = new Container();
		app.stage.addChild(container);

		// ---- robust drag state managed at stage level ----
		type DragState = {
			container: BoardGameItem;
			startGlobalX: number;
			startGlobalY: number;
			startX: number;
			startY: number;
			clickThreshold: number;
			index: number;
		} | null;

		let drag: DragState = null;

		function endDragAndMaybeFlip(e: any) {
			if (!drag) return;
			const dx = e.globalX - drag.startGlobalX;
			const dy = e.globalY - drag.startGlobalY;
			const dist = Math.hypot(dx, dy);

			const { container: cardContainer } = drag;
			drag = null;
			cardContainer.cursor = 'pointer';

			// This is ugly and does not work properly
			if (dist < 10) {
                cardContainer.flip();
			}

			const cardIndex = syncCards.indexOf(cardContainer);
			if (cardIndex !== -1) {
				console.log(`Sending updated position for card ${cardIndex}:`, cardContainer.x, cardContainer.y);
				room.send('updateCard', {
					cardIndex,
					x: cardContainer.x,
					y: cardContainer.y,
					isFaceUp: cardContainer.isFrontShowing()
				});
			}
		}

		app.stage.on('pointermove', (e) => {
			if (!drag) return;
			const dx = e.globalX - drag.startGlobalX;
			const dy = e.globalY - drag.startGlobalY;
			drag.container.x = drag.startX + dx;
			drag.container.y = drag.startY + dy;
			room.send('updateCard', {
				cardIndex: drag.index,
				x: drag.container.x,
				y: drag.container.y
			});
		});

		app.stage.on('pointerup', endDragAndMaybeFlip);
		app.stage.on('pointerupoutside', endDragAndMaybeFlip);

		try {
			const fullFolderPath = `/${projectName}/system/${cardName}`;
			const [frontFile, backFile] = await fileSystem.download([
				`${fullFolderPath}/front.svg`,
				`${fullFolderPath}/back.svg`
			]);

			const svgTextFront = await frontFile.result?.data.text();
			const svgTextBack = await backFile.result?.data.text();
			if (!svgTextFront || !svgTextBack) throw new Error('Could not load SVG template files');

			const svgTemplateFront = loadSvgTemplate(svgTextFront);
			const svgTemplateBack = loadSvgTemplate(svgTextBack);

			const { svgData, spreadsheetData, imagePaths } = await loadSvgsAndData(
				projectName,
				cardName,
				fileSystem,
				svgTemplateFront,
				svgTemplateBack
			);

			console.log('Loaded SVG Data:', svgData);
			console.log('Spreadsheet Data:', spreadsheetData);

			const cards = spreadsheetData.data.map((row) => ({
				front: generateSvg(
					svgTemplateFront,
					spreadsheetData.cols.map((c) => c.title as string),
					row,
					imagePaths
				),
				back: generateSvg(
					svgTemplateBack,
					spreadsheetData.cols.map((c) => c.title as string),
					row,
					imagePaths
				)
			}));

			let x = 50;
			const y = 50;
			const cardSpacing = 150;

			const hybridPromises = cards.map(async (card, index) => {
				const [frontContainer, backContainer] = await Promise.all([
					createHybridContainer(card.front),
					createHybridContainer(card.back)
				]);
				return { front: frontContainer, back: backContainer, index };
			});
			const hybridResults = await Promise.all(hybridPromises);


			// Create card containers with hybrid rendering
			for (let i = 0; i < hybridResults.length; i++) {
				const { front, back } = hybridResults[i];

				const cardContainer = new BoardGameItem(front.container, back.container);

				cardContainer.x = x;
				cardContainer.y = y;

				syncCards.push(cardContainer);

				cardContainer.scale.set(0.5);

				cardContainer.eventMode = 'static';
				cardContainer.cursor = 'pointer';

				cardContainer.on('pointerover', () => {
					if (!drag) cardContainer.tint = 0xcccccc;
				});
				cardContainer.on('pointerout', () => {
					cardContainer.tint = 0xffffff;
				});
				cardContainer.on('pointerdown', (e: any) => {
					drag = {
						container: cardContainer,
						startGlobalX: e.globalX,
						startGlobalY: e.globalY,
						startX: cardContainer.x,
						startY: cardContainer.y,
						clickThreshold: 10,
						index: i
					};
					cardContainer.cursor = 'grabbing';
				});

				container.addChild(cardContainer);
				x += cardSpacing;
			}

			room.send('initializeGame', {
				cardCount: cards.length
			});
		} catch (error) {
			console.error('Failed to load SVG data:', error);
		}

		return () => {
			app.destroy(true, { children: true, texture: true });
		};
	});
</script>

<div class="absolute inset-0">
	<div bind:this={canvasContainer} class="h-full w-full" style="pointer-events: auto;"></div>
</div>

