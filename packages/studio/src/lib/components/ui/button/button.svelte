<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { type VariantProps, tv } from 'tailwind-variants';

	export const buttonVariants = tv({
		base: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs',
				destructive:
					'bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 text-white shadow-xs',
				outline:
					'bg-background hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 border shadow-xs',
				secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-xs',
				ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
				link: 'text-primary underline-offset-4 hover:underline',
				nav: 'rounded-full bg-transparent px-3.5 py-1.5 text-lg font-semibold text-[#1c1c20] transition hover:-translate-y-0.5 hover:bg-black/10 hover:text-[#0d0d0f] aria-[current=page]:bg-black/10 aria-[current=page]:text-[#0d0d0f]',
				tab: 'rounded-full bg-transparent px-5 py-2 text-xl font-semibold text-[#33363f] transition-colors hover:bg-black/10 aria-[selected=true]:bg-[#121212] aria-[selected=true]:text-[#f6f6f6] aria-[selected=true]:shadow-[0_8px_18px_rgba(0,0,0,0.2)] aria-[selected=true]:hover:bg-[#121212]',
				hero: 'rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-[0_12px_24px_rgba(0,0,0,0.18)]',
				'pill-outline':
					'rounded-full border border-black/10 bg-white/80 text-[#1c1c20] font-semibold hover:bg-white shadow-[0_12px_24px_rgba(15,15,15,0.08)]',
				'pill-dark':
					'rounded-full bg-[#151515] text-[#f8f8f8] font-semibold hover:bg-black/90 shadow-[0_12px_24px_rgba(15,15,15,0.08)]'
			},
			size: {
				default: 'h-9 px-4 py-2 text-sm has-[>svg]:px-3',
				sm: 'h-8 gap-1.5 rounded-md px-3 text-sm has-[>svg]:px-2.5',
				lg: 'h-11 rounded-md px-6 text-lg has-[>svg]:px-4',
				xl: 'h-12 rounded-md px-7 text-xl has-[>svg]:px-5',
				icon: 'size-9',
				'icon-sm': 'size-8',
				'icon-lg': 'size-10',
				unset: ''
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();

	const attachRef = (node: HTMLElement) => {
		ref = node;
		return () => {
			if (ref === node) {
				ref = null;
			}
		};
	};

	const anchorProps = $derived.by(() => ({
		href: disabled || !href ? undefined : href
	}));
</script>

{#if href}
	<a
		{@attach attachRef}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{...anchorProps}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		{@attach attachRef}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
