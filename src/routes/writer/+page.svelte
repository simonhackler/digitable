<script lang="ts">
	import { onMount } from "svelte";


    async function parse() {
    const svgText = await fetch('image.svg').then(i => i.text());
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const texts   = Array.from(doc.querySelectorAll("text"));
    const images  = Array.from(doc.querySelectorAll("image"));
    console.log(images);
    console.log(texts.map(t => {
        return {
            id: t.id,
            content: t.textContent
        }     
    }
    ))
    }

    onMount(() => {
        parse();
    })
</script>