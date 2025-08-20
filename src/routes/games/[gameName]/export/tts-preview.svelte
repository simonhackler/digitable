<script lang="ts">
	import type { Sheet } from './tts-export.svelte';

	let {
		sheet,
		isVisible
	}: {
		sheet: Sheet;
		isVisible: boolean;
	} = $props();

	let containerEl = $state<HTMLDivElement>();
	let svgs = $derived(
		sheet.svgs.map((svg) => {
			const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
			return clonedSvg;
		})
	);

	function attachSVGs() {
		return (element: HTMLElement) => {
			svgs.forEach((svg, index) => {
				element.appendChild(svg);
				svg.removeAttribute('width');
				svg.removeAttribute('height');
				svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
				Object.assign(svg.style, {
					display: 'block',
					width: '100%',
					height: 'auto',
					maxWidth: '100%',
					flex: '1 1 auto',
					opacity: '0',
					transform: 'translateY(20px) scale(0.8)',
					transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
					transitionDelay: `${index * 50}ms`,
					borderRadius: '8px'
				});

				svg.addEventListener('mouseenter', () => {
					Object.assign(svg.style, {
						transform: 'translateY(-8px) scale(1.05)',
						boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
						zIndex: '10',
						transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
					});
				});

				svg.addEventListener('mouseleave', () => {
					Object.assign(svg.style, {
						transform: 'translateY(0) scale(1)',
						boxShadow: 'none',
						zIndex: '1',
						transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
					});
				});

				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						Object.assign(svg.style, {
							opacity: '1',
							transform: 'translateY(0) scale(1)'
						});
					});
				});
			});

			return () => {
				svgs.forEach((svg) => {
					if (element.contains(svg)) {
						element.removeChild(svg);
					}
				});
			};
		};
	}
</script>

{#if isVisible && sheet}
	{#key sheet.name}
		<div
			bind:this={containerEl}
			class="flex items-center justify-center overflow-hidden rounded-lg border bg-white shadow-sm"
		>
			<div class="preview-sheet grid grid-cols-10" {@attach attachSVGs()}></div>
		</div>
	{/key}
{/if}
