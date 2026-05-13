<script lang="ts">
	import { onDestroy } from 'svelte';

	const diePips = {
		1: ['pip-center'],
		2: ['pip-top-left', 'pip-bottom-right'],
		3: ['pip-top-left', 'pip-center', 'pip-bottom-right'],
		4: ['pip-top-left', 'pip-top-right', 'pip-bottom-left', 'pip-bottom-right'],
		5: ['pip-top-left', 'pip-top-right', 'pip-center', 'pip-bottom-left', 'pip-bottom-right'],
		6: [
			'pip-top-left',
			'pip-middle-left',
			'pip-bottom-left',
			'pip-top-right',
			'pip-middle-right',
			'pip-bottom-right'
		]
	} as const;

	type DieValue = keyof typeof diePips;
	type DieId = 'one' | 'two';

	let dieOne = $state<DieValue>(5);
	let dieTwo = $state<DieValue>(3);
	let rollingOne = $state(false);
	let rollingTwo = $state(false);
	let dieOneTimer: ReturnType<typeof setTimeout> | undefined;
	let dieTwoTimer: ReturnType<typeof setTimeout> | undefined;

	function nextDieValue(): DieValue {
		return (Math.floor(Math.random() * 6) + 1) as DieValue;
	}

	function rollDie(die: DieId) {
		if (die === 'one') {
			dieOne = nextDieValue();
			rollingOne = false;
			clearTimeout(dieOneTimer);
			requestAnimationFrame(() => {
				rollingOne = true;
				dieOneTimer = setTimeout(() => {
					rollingOne = false;
				}, 280);
			});
			return;
		}

		dieTwo = nextDieValue();
		rollingTwo = false;
		clearTimeout(dieTwoTimer);
		requestAnimationFrame(() => {
			rollingTwo = true;
			dieTwoTimer = setTimeout(() => {
				rollingTwo = false;
			}, 280);
		});
	}

	onDestroy(() => {
		clearTimeout(dieOneTimer);
		clearTimeout(dieTwoTimer);
	});
</script>

<div class="auth-board absolute inset-0 overflow-hidden">
	<div class="card card-one" aria-hidden="true">
		<span></span>
		<span></span>
		<span></span>
	</div>
	<div class="card card-two" aria-hidden="true">
		<span></span>
		<span></span>
	</div>
	<div class="card card-three" aria-hidden="true">
		<span></span>
		<span></span>
		<span></span>
	</div>
	<button
		type="button"
		class={`die die-one ${rollingOne ? 'rolling' : ''}`}
		aria-label={`Roll background die showing ${dieOne}`}
		tabindex="-1"
		onclick={() => rollDie('one')}
	>
		{#each diePips[dieOne] as pip, index (`one-${dieOne}-${index}`)}
			<span class={pip}></span>
		{/each}
	</button>
	<button
		type="button"
		class={`die die-two ${rollingTwo ? 'rolling' : ''}`}
		aria-label={`Roll background die showing ${dieTwo}`}
		tabindex="-1"
		onclick={() => rollDie('two')}
	>
		{#each diePips[dieTwo] as pip, index (`two-${dieTwo}-${index}`)}
			<span class={pip}></span>
		{/each}
	</button>
</div>

<style>
	.auth-board {
		background-color: #737d91;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 18 18'%3E%3Cpath d='M18 0H0v18' fill='none' stroke='%23d5d9e2' stroke-opacity='.18' stroke-width='1'/%3E%3C/svg%3E");
	}

	.auth-board::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 0;
		background: rgba(26, 31, 43, 0.18);
	}

	.card,
	.die {
		position: absolute;
		z-index: 1;
		margin: 0;
		border: 1px solid rgba(255, 255, 255, 0.22);
		background: rgba(245, 248, 255, 0.1);
		box-shadow: 0 24px 60px rgba(16, 20, 32, 0.2);
		backdrop-filter: blur(1px);
		transform: rotate(var(--rotate));
		transition:
			transform 220ms ease,
			background-color 220ms ease,
			border-color 220ms ease,
			box-shadow 220ms ease;
	}

	.card {
		display: grid;
		gap: 10px;
		align-content: start;
		width: 92px;
		height: 128px;
		padding: 16px;
		border-radius: 14px;
	}

	.card span {
		height: 10px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.22);
	}

	.card span:nth-child(2) {
		width: 68%;
	}

	.card span:nth-child(3) {
		width: 82%;
	}

	.card-one {
		top: 17%;
		left: 11%;
		--rotate: 7deg;
		width: 84px;
		height: 116px;
	}

	.card-two {
		right: 8%;
		bottom: 12%;
		--rotate: -12deg;
	}

	.card-three {
		right: 21%;
		top: 9%;
		--rotate: 13deg;
		width: 104px;
		height: 144px;
	}

	.card-two,
	.card-three {
		background: rgba(168, 219, 205, 0.12);
	}

	.die {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
		width: 76px;
		height: 76px;
		padding: 13px;
		appearance: none;
		cursor: pointer;
		border-radius: 16px;
	}

	.die span {
		width: 9px;
		height: 9px;
		align-self: center;
		justify-self: center;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.55);
	}

	.pip-top-left {
		grid-area: 1 / 1;
	}

	.pip-top-right {
		grid-area: 1 / 3;
	}

	.pip-middle-left {
		grid-area: 2 / 1;
	}

	.pip-center {
		grid-area: 2 / 2;
	}

	.pip-middle-right {
		grid-area: 2 / 3;
	}

	.pip-bottom-left {
		grid-area: 3 / 1;
	}

	.pip-bottom-right {
		grid-area: 3 / 3;
	}

	.die-one {
		left: 8%;
		bottom: 18%;
		--rotate: -10deg;
		width: 86px;
		height: 86px;
	}

	.die-two {
		right: 12%;
		top: 18%;
		--rotate: 9deg;
	}

	.card:hover,
	.die:hover {
		border-color: rgba(255, 255, 255, 0.38);
		background: rgba(255, 255, 255, 0.16);
		box-shadow: 0 30px 76px rgba(16, 20, 32, 0.28);
		transform: translateY(-10px) rotate(var(--rotate)) scale(1.04);
	}

	.die:hover span {
		animation: pip-pop 520ms ease both;
	}

	.die:hover span:nth-child(2) {
		animation-delay: 45ms;
	}

	.die:hover span:nth-child(3) {
		animation-delay: 90ms;
	}

	.die:hover span:nth-child(4) {
		animation-delay: 135ms;
	}

	.die:hover span:nth-child(5) {
		animation-delay: 180ms;
	}

	.die:hover span:nth-child(6) {
		animation-delay: 225ms;
	}

	.die.rolling {
		animation: die-roll 280ms ease-out both;
	}

	.die.rolling span {
		animation: pip-pop 280ms ease both;
	}

	@media (max-width: 768px) {
		.card-three,
		.die-two {
			display: none;
		}

		.card-one {
			left: -20px;
			top: 12%;
		}

		.card-two {
			right: -22px;
			bottom: 9%;
		}

		.die-one {
			left: auto;
			right: 22px;
			bottom: 11%;
		}
	}

	@keyframes pip-pop {
		0%,
		100% {
			transform: scale(1);
			background: rgba(255, 255, 255, 0.55);
		}

		45% {
			transform: scale(1.35);
			background: rgba(255, 255, 255, 0.85);
		}
	}

	@keyframes die-roll {
		0% {
			transform: translateY(0) rotate(var(--rotate)) scale(1);
		}

		50% {
			transform: translateY(-8px) rotate(calc(var(--rotate) + 180deg)) scale(1.04);
		}

		100% {
			transform: translateY(0) rotate(calc(var(--rotate) + 360deg)) scale(1);
		}
	}
</style>
