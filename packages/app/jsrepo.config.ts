import { defineConfig } from "jsrepo";
import prettier from "@jsrepo/transform-prettier";
    
export default defineConfig({
	registries: [
	"https://github.com/simonhackler/svelte-file-explorer",
	"@ieedan/shadcn-svelte-extras"
],
	paths: {
	"*": '$lib/blocks',
	"ui": '$lib/components/ui',
	"actions": '$lib/actions',
	"hooks": '$lib/hooks',
	"utils": '$lib/utils',
	"file-browser": '$lib/components/file-browser',
		lib: 'src/lib/blocks'
},
	transforms: [prettier()],
});