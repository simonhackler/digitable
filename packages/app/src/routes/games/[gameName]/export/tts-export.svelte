<script lang="ts">
	import { toBlob } from 'html-to-image';
	import { tick } from 'svelte';
	import { getFileSystemContext } from '../../context';

	export interface Sheet {
		name: string;
		svgs: SVGSVGElement[];
	}

	let {
		sheets,
		gameName,
		onExported
	}: {
		sheets: Sheet[];
		gameName: string;
		onExported: (sheet: Sheet) => void;
	} = $props();

	let index = $state(0);
	let svgs: SVGSVGElement[] = $state(
		sheets[0].svgs.slice(0).map((svg) => { // TODO: Why does this work and with the "normal" svg way it doesn't? Very confusing
			const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
			return clonedSvg;
		})
	);
	let sheetEl: HTMLDivElement;
	const fileSytem = getFileSystemContext();

	$effect(() => {
		svgs.forEach((svg) => {
			svg.removeAttribute('width');
			svg.removeAttribute('height');
			svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
			Object.assign(svg.style, {
				display: 'block',
				width: '100%',
				height: 'auto',
				maxWidth: '100%',
				flex: '1 1 auto'
			});
		});
	});


	async function takeImage() {
		try {
			await tick();
			const height = sheetEl?.getBoundingClientRect().height || 0;
			console.log(
				`Taking image for sheet: ${sheets[index].name}, height: ${height} shetEl:`,
				sheetEl
			);

			// TODO: snapdom?
			const blob = await toBlob(sheetEl, {
				width: 4096,
				height,
				pixelRatio: 1,
				skipFonts: true,
				skipAutoScale: true
			});
			if (!blob) {
				throw new Error('Failed to convert sheet to blob');
			}

			const file = new File([blob], `${sheets[index].name}_sheet.png`, {
				type: 'image/png',
				lastModified: Date.now()
			});

			await fileSytem.upload(file, `${gameName}/tts-export`, true);
			if (index < sheets.length - 1) {
				index += 1;
				const svgsReal = sheets[index].svgs.map((svg) => {
					const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
					return clonedSvg;
				});
                const missing = Math.max(11 - svgsReal.length, 0); //TTS expects 2 rows per sheet, hacky
                console.log('SVGS for next sheet:', svgsReal.length, 'missing:', missing);
                for (let i = 0; i < missing; i++) {
					const clonedSvg = sheets[index].svgs[0].cloneNode(true) as SVGSVGElement;
                    svgsReal.push(clonedSvg);
                }
                svgs = svgsReal;
			}
			onExported(sheets[index]);
		} catch (error) {
			console.error('Error taking image:', error);
			console.error('Sheet element:', sheetEl);
			console.error('Current sheet:', sheets[index]);
			console.error('SVGs in current sheet:', svgs.length);
			// Log more detailed information about the error
			if (error instanceof Error) {
				console.error('Error message:', error.message);
				console.error('Error stack:', error.stack);
			}
		}
	}

	function attachSVGs(): Attachment {
		return (element) => {
			svgs.forEach((svg) => {
				element.appendChild(svg);
			});
			takeImage();
			return () => {
				svgs.forEach((svg) => {
					element.removeChild(svg);
				});
			};
		};
	}
</script>

<div class="sheet grid grid-cols-10" id="sheet" bind:this={sheetEl} {@attach attachSVGs()}></div>

<style>
	.sheet {
		width: 4096px;
	}
</style>
