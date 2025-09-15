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

	let canvasContainer: HTMLDivElement;

	const projectName = $derived(page.params.gameName);
	const cardName = $derived(page.params.deckName || 'western');
	const fileSystem = getFileSystemContext();

	async function svgToTexture(svg: SVGSVGElement): Promise<Texture> {
		const svgClone = svg.cloneNode(true) as SVGSVGElement;
		const svgData = new XMLSerializer().serializeToString(svgClone);
		const objectUrl = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml' }));
		return (await Assets.load({
			src: objectUrl,
			format: 'svg',
			parser: 'svg',
			resolution: 3
		})) as Texture;
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
	const room = await createOrJoinRoom(client, 'my_room');
	const s = getStateCallbacks(room);

	let syncCards: Sprite[] = [];

	console.log('Joined room:', room.name, 'with session ID:', room.sessionId);
	console.log(s);

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
				console.log(`Card ${index} position updated:`, card.x, card.y);
				if (syncCards[index]) {
					syncCards[index].x = card.x;
					syncCards[index].y = card.y;
					const sprite = syncCards[index];

					if (card.isFaceUp != sprite.showingFront) {
						console.log('Flipping card', index, 'to', card.isFaceUp ? 'front' : 'back');
						console.log(sprite);
						sprite.texture = card.isFaceUp ? sprite.frontTexture : sprite.spritebackTexture;
						(sprite as any).showingFront = card.isFaceUp;
					}
				}
			});
		});
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
			container: Container;
			startGlobalX: number;
			startGlobalY: number;
			startX: number;
			startY: number;
			clickThreshold: number;
			frontTexture: Texture;
			backTexture: Texture;
			index: number;
		} | null;

		let drag: DragState = null;

		function endDragAndMaybeFlip(e: any) {
			if (!drag) return;
			const dx = e.globalX - drag.startGlobalX;
			const dy = e.globalY - drag.startGlobalY;
			const dist = Math.hypot(dx, dy);

			const { container: sprite, frontTexture, backTexture } = drag;
			drag = null;
			sprite.cursor = 'pointer';

			// Send position update to server for any synced card

			// tiny move counts as a click -> flip
			if (dist < 10) {
				const currentShowingFront = (sprite as any).showingFront;
				const newShowingFront = !currentShowingFront;
				sprite.texture = newShowingFront ? frontTexture : backTexture;
				(sprite as any).showingFront = newShowingFront;
			}

			const cardIndex = syncCards.indexOf(sprite);
			if (cardIndex !== -1) {
				console.log(`Sending updated position for card ${cardIndex}:`, sprite.x, sprite.y);
				room.send('updateCard', {
					cardIndex,
					x: sprite.x,
					y: sprite.y,
					isFaceUp: (sprite as any).showingFront
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
			const cardSpacing = 220;

			// Load all textures in parallel
			const texturePromises = cards.map((card) =>
				Promise.all([
					svgToTexture(card.front),
					svgToTexture(card.back)
				])
			);
			const textures = await Promise.all(texturePromises);

			// Create sprites with loaded textures
			for (let i = 0; i < 2; i++) {
				const [frontTexture, backTexture] = textures[i];

                const cardContainer = new Container();
				const frontSprite = new Sprite(frontTexture);
                const backSprite = new Sprite(backTexture);
                cardContainer.addChild(backSprite);
                cardContainer.addChild(frontSprite);
                backSprite.visible = false;

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
						cardContainer,
						startGlobalX: e.globalX,
						startGlobalY: e.globalY,
						startX: cardContainer.x,
						startY: cardContainer.y,
						clickThreshold: 10,
						frontTexture,
						backTexture,
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
			console.error('Failed to load SVG data, showing demo instead:', error);
		}

		return () => {
			app.destroy(true, { children: true, texture: true });
		};
	});
</script>

<div class="absolute inset-0">
	<div bind:this={canvasContainer} class="h-full w-full" style="pointer-events: auto;"></div>
</div>
