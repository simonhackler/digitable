<!--
	Installed from github/simonhackler/svelte-file-explorer
-->

<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';

	let { ref = $bindable(null), ...restProps }: DialogPrimitive.CloseProps = $props();
</script>

<DialogPrimitive.Close bind:ref data-slot="dialog-close" {...restProps} />
