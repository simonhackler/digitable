<script lang="ts">
	const tabIds = ['design', 'playtest', 'publish'] as const;
	type TabId = (typeof tabIds)[number];

	const tabCopy: Record<
		TabId,
		{
			title: string;
			subtitle: string;
			cta: string;
			bullets: string[];
		}
	> = {
		design: {
			title: 'Design with intent',
			subtitle: 'Build components, boards, decks, and rules with a visual editor.',
			cta: 'Create now',
			bullets: ['Snap-to-grid layouts', 'Card and token builders', 'Reusable components']
		},
		playtest: {
			title: 'Playtest fast',
			subtitle: 'Run sessions in minutes and capture feedback in-context.',
			cta: 'Start a playtest',
			bullets: ['Live turn tracking', 'Session notes', 'Instant reset']
		},
		publish: {
			title: 'Publish everywhere',
			subtitle: 'Package your game for web, print, or tabletop simulators.',
			cta: 'Prepare a release',
			bullets: ['Print-ready exports', 'Rulebook generator', 'Shareable links']
		}
	};

	let activeTab = $state<TabId>('design');
	const current = $derived(tabCopy[activeTab]);
</script>

<svelte:head>
	<title>Digitable Studio</title>
</svelte:head>

<main class="page">
	<header class="site-header">
		<div class="header-inner container">
			<div class="brand">
				<div class="logo-mark" aria-hidden="true"></div>
				<div>
					<p class="brand-name">Digitable</p>
					<p class="brand-tag">A free and open source boardgame engine</p>
				</div>
			</div>
			<nav class="header-actions">
				<a class="header-link" href="#design">Design</a>
				<a class="header-link" href="#playtest">Playtest</a>
				<a class="header-link" href="#publish">Publish</a>
			</nav>
		</div>
	</header>

	<section class="hero">
		<div class="hero-stack container">
			<div class="hero-header reveal">
				<p class="eyebrow">Primary actions</p>
				<h1 class="hero-title">Design, playtest, and publish your next boardgame.</h1>
				<p class="hero-subtitle">
					Digitable keeps your prototype, rules, and feedback in one place so you can iterate
					quickly.
				</p>
			</div>

			<div class="hero-preview reveal">
				<div class="tabs" role="tablist" aria-label="Primary actions">
					{#each tabIds as tab (tab)}
						<button
							type="button"
							class={`tab ${activeTab === tab ? 'tab-active' : ''}`}
							role="tab"
							aria-selected={activeTab === tab}
							onclick={() => (activeTab = tab)}
						>
							{tab === 'design' ? '1. Design' : tab === 'playtest' ? '2. Playtest' : '3. Publish'}
						</button>
					{/each}
				</div>

				<div class={`preview-surface preview-${activeTab}`}>
					<div class="preview-grid">
						<div class="preview-card">
							<p class="preview-label">{activeTab} panel</p>
							<div class="preview-line"></div>
							<div class="preview-line short"></div>
							<div class="preview-line"></div>
							<div class="preview-line short"></div>
						</div>
						<div class="preview-card tall">
							<p class="preview-label">Board</p>
							<div class="token-grid">
								<span></span><span></span><span></span><span></span>
								<span></span><span></span><span></span><span></span>
								<span></span><span></span><span></span><span></span>
							</div>
						</div>
						<div class="preview-card">
							<p class="preview-label">Cards</p>
							<div class="card-stack">
								<div></div>
								<div></div>
								<div></div>
							</div>
						</div>
					</div>
					<div class="preview-glow" aria-hidden="true"></div>
				</div>
			</div>

			<div class="hero-support reveal">
				<p class="hero-copy">{current.subtitle}</p>
				<ul class="hero-bullets">
					{#each current.bullets as bullet (bullet)}
						<li>{bullet}</li>
					{/each}
				</ul>
				<div class="hero-actions">
					<button class="primary-btn" type="button">{current.cta}</button>
					<button class="ghost-btn" type="button">Learn more</button>
				</div>
			</div>
		</div>
	</section>

	<section id="design" class="feature-block">
		<div class="feature-grid container">
			<div class="feature-media reveal">
				<div class="preview-surface preview-design">
					<div class="feature-badge">Design preview</div>
					<div class="preview-grid">
						<div class="preview-card"></div>
						<div class="preview-card tall"></div>
						<div class="preview-card"></div>
					</div>
				</div>
			</div>
			<div class="feature-copy reveal">
				<h2>Design</h2>
				<p>Create modular components, snap pieces into place, and prototype rules in minutes.</p>
				<ul>
					<li>Component library with quick duplication</li>
					<li>Token, board, and card templates</li>
					<li>Live rule annotations alongside layout</li>
				</ul>
			</div>
		</div>
	</section>

	<section id="playtest" class="feature-block alt">
		<div class="feature-grid container">
			<div class="feature-copy reveal">
				<h2>Playtest</h2>
				<p>Bring your table online, invite testers, and record outcomes with every turn.</p>
				<ul>
					<li>Shared state for remote sessions</li>
					<li>Quick restart and scenario presets</li>
					<li>Feedback tied to components</li>
				</ul>
			</div>
			<div class="feature-media reveal">
				<div class="preview-surface preview-playtest">
					<div class="feature-badge">Playtest preview</div>
					<div class="preview-grid">
						<div class="preview-card"></div>
						<div class="preview-card tall"></div>
						<div class="preview-card"></div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section id="publish" class="feature-block">
		<div class="feature-grid container">
			<div class="feature-media reveal">
				<div class="preview-surface preview-publish">
					<div class="feature-badge">Publish preview</div>
					<div class="preview-grid">
						<div class="preview-card"></div>
						<div class="preview-card tall"></div>
						<div class="preview-card"></div>
					</div>
				</div>
			</div>
			<div class="feature-copy reveal">
				<h2>Publish</h2>
				<p>Export production-ready assets and publish updates with a single click.</p>
				<ul>
					<li>Print, web, and tabletop simulator outputs</li>
					<li>Versioned changelogs for testers</li>
					<li>Shareable build links</li>
				</ul>
			</div>
		</div>
	</section>
</main>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap');

	:global(body) {
		font-family: 'Space Grotesk', 'Trebuchet MS', sans-serif;
	}

	.page {
		min-height: 100vh;
		background:
			radial-gradient(circle at top right, rgba(120, 141, 255, 0.18), transparent 55%),
			radial-gradient(circle at 20% 10%, rgba(255, 214, 153, 0.35), transparent 45%),
			linear-gradient(180deg, #f7f4ef 0%, #f2f2f8 45%, #ffffff 100%);
		color: #151515;
	}

	.container {
		max-width: 1120px;
		margin: 0 auto;
		padding: 0 1.5rem;
	}

	.site-header {
		padding: 1.75rem 0 1.25rem;
	}

	.header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.logo-mark {
		width: 44px;
		height: 44px;
		border-radius: 14px;
		background: linear-gradient(135deg, #111 0%, #4b5674 55%, #f2b04f 100%);
		box-shadow: 0 12px 24px rgba(17, 17, 17, 0.18);
	}

	.brand-name {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.brand-tag {
		margin: 0.2rem 0 0;
		font-size: 0.9rem;
		color: #5a5a63;
	}

	.header-actions {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.header-link {
		text-decoration: none;
		color: #202024;
		font-weight: 600;
		font-size: 0.95rem;
		padding: 0.35rem 0.8rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.65);
		box-shadow: inset 0 0 0 1px rgba(32, 32, 36, 0.08);
	}

	.hero {
		padding: 3rem 0 4rem;
	}

	.hero-stack {
		display: grid;
		gap: 2.5rem;
	}

	.hero-header {
		text-align: center;
		max-width: 720px;
		margin: 0 auto;
		display: grid;
		gap: 1rem;
	}

	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.2em;
		font-size: 0.75rem;
		color: #61616b;
	}

	.hero-title {
		font-family: 'Newsreader', 'Times New Roman', serif;
		font-size: clamp(2.4rem, 5vw, 3.8rem);
		margin: 0;
	}

	.hero-subtitle {
		margin: 0;
		font-size: 1.05rem;
		color: #4b4b57;
	}

	.hero-preview {
		display: grid;
		gap: 1rem;
	}

	.tabs {
		display: inline-flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		padding: 0.4rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.8);
		box-shadow: inset 0 0 0 1px rgba(36, 36, 42, 0.1);
		justify-self: center;
	}

	.tab {
		border: none;
		background: transparent;
		padding: 0.5rem 1.2rem;
		font-weight: 600;
		border-radius: 999px;
		cursor: pointer;
		color: #33363f;
	}

	.tab-active {
		background: #121212;
		color: #f6f6f6;
		box-shadow: 0 8px 18px rgba(0, 0, 0, 0.2);
	}

	.hero-support {
		display: grid;
		gap: 1.5rem;
		max-width: 720px;
		margin: 0 auto;
		text-align: center;
	}

	.hero-copy {
		margin: 0;
		font-size: 1.05rem;
		color: #4b4b57;
	}

	.hero-bullets {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem 1.6rem;
		justify-content: center;
		color: #2d2d36;
		font-size: 0.95rem;
	}

	.hero-bullets li::before {
		content: '';
		display: inline-block;
		width: 10px;
		height: 10px;
		margin-right: 0.6rem;
		border-radius: 50%;
		background: #f2b04f;
	}

	.hero-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.primary-btn,
	.ghost-btn {
		border: none;
		border-radius: 999px;
		padding: 0.85rem 1.7rem;
		font-weight: 600;
		cursor: pointer;
	}

	.primary-btn {
		background: #151515;
		color: #f8f8f8;
		box-shadow: 0 12px 24px rgba(0, 0, 0, 0.18);
	}

	.ghost-btn {
		background: rgba(255, 255, 255, 0.8);
		color: #1d1d22;
		box-shadow: inset 0 0 0 1px rgba(29, 29, 34, 0.15);
	}

	.preview-surface {
		position: relative;
		padding: 2.5rem;
		border-radius: 26px;
		background: #14161d;
		color: #f5f5f5;
		overflow: hidden;
		box-shadow: 0 30px 60px rgba(12, 12, 20, 0.25);
	}

	.preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1.25rem;
		position: relative;
		z-index: 1;
	}

	.preview-card {
		background: rgba(255, 255, 255, 0.08);
		border-radius: 16px;
		padding: 1rem;
		min-height: 150px;
	}

	.preview-card.tall {
		min-height: 240px;
	}

	.preview-label {
		font-size: 0.7rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.7);
	}

	.preview-line {
		height: 6px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.2);
		margin-top: 0.5rem;
	}

	.preview-line.short {
		width: 70%;
	}

	.token-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.4rem;
		margin-top: 1rem;
	}

	.token-grid span {
		display: block;
		aspect-ratio: 1;
		border-radius: 8px;
		background: rgba(242, 176, 79, 0.8);
	}

	.card-stack {
		display: grid;
		gap: 0.35rem;
		margin-top: 1rem;
	}

	.card-stack div {
		height: 12px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.25);
	}

	.preview-glow {
		position: absolute;
		inset: -40% 20% 20% -30%;
		background: radial-gradient(circle, rgba(255, 255, 255, 0.35), transparent 60%);
		filter: blur(12px);
	}

	.preview-design {
		background: linear-gradient(130deg, #0c0f1a 0%, #2d3554 45%, #f2b04f 120%);
	}

	.preview-playtest {
		background: linear-gradient(130deg, #0d1220 0%, #27465f 50%, #9fe1c2 120%);
	}

	.preview-publish {
		background: linear-gradient(130deg, #1a1015 0%, #5b2a3a 50%, #f7c26c 120%);
	}

	.feature-block {
		padding: 4rem 0;
	}

	.feature-block.alt {
		background: #f6f3ee;
	}

	.feature-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 2.5rem;
		align-items: center;
	}

	.feature-copy h2 {
		margin: 0 0 1rem;
		font-size: 2rem;
	}

	.feature-copy p {
		margin: 0 0 1rem;
		color: #4b4b57;
	}

	.feature-copy ul {
		margin: 0;
		padding-left: 1.2rem;
		color: #2d2d36;
		display: grid;
		gap: 0.5rem;
	}

	.feature-media .preview-surface {
		color: #ffffff;
	}

	.feature-badge {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		margin-bottom: 1rem;
		color: rgba(255, 255, 255, 0.75);
	}

	.reveal {
		opacity: 0;
		transform: translateY(18px);
		animation: rise 0.7s ease forwards;
	}

	.reveal:nth-child(2) {
		animation-delay: 0.1s;
	}

	.reveal:nth-child(3) {
		animation-delay: 0.2s;
	}

	@keyframes rise {
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 768px) {
		.hero-header {
			text-align: left;
		}

		.hero-support {
			text-align: left;
			align-items: flex-start;
		}

		.hero-bullets {
			justify-content: flex-start;
		}

		.hero-actions {
			justify-content: flex-start;
		}
	}

	@media (max-width: 640px) {
		.header-actions {
			width: 100%;
			justify-content: flex-start;
		}

		.preview-surface {
			padding: 1.5rem;
		}

		.preview-grid {
			grid-template-columns: 1fr;
		}

		.tabs {
			justify-content: flex-start;
		}
	}
</style>
