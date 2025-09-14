
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/api" | "/api/generate-images" | "/games" | "/games/[gameName]" | "/games/[gameName]/decks" | "/games/[gameName]/decks/[deckName]" | "/games/[gameName]/decks/[deckName]/data" | "/games/[gameName]/decks/[deckName]/layout" | "/games/[gameName]/export" | "/games/[gameName]/export/paper" | "/games/[gameName]/export/tts" | "/games/[gameName]/play";
		RouteParams(): {
			"/games/[gameName]": { gameName: string };
			"/games/[gameName]/decks": { gameName: string };
			"/games/[gameName]/decks/[deckName]": { gameName: string; deckName: string };
			"/games/[gameName]/decks/[deckName]/data": { gameName: string; deckName: string };
			"/games/[gameName]/decks/[deckName]/layout": { gameName: string; deckName: string };
			"/games/[gameName]/export": { gameName: string };
			"/games/[gameName]/export/paper": { gameName: string };
			"/games/[gameName]/export/tts": { gameName: string };
			"/games/[gameName]/play": { gameName: string }
		};
		LayoutParams(): {
			"/": { gameName?: string; deckName?: string };
			"/api": Record<string, never>;
			"/api/generate-images": Record<string, never>;
			"/games": { gameName?: string; deckName?: string };
			"/games/[gameName]": { gameName: string; deckName?: string };
			"/games/[gameName]/decks": { gameName: string; deckName?: string };
			"/games/[gameName]/decks/[deckName]": { gameName: string; deckName: string };
			"/games/[gameName]/decks/[deckName]/data": { gameName: string; deckName: string };
			"/games/[gameName]/decks/[deckName]/layout": { gameName: string; deckName: string };
			"/games/[gameName]/export": { gameName: string };
			"/games/[gameName]/export/paper": { gameName: string };
			"/games/[gameName]/export/tts": { gameName: string };
			"/games/[gameName]/play": { gameName: string }
		};
		Pathname(): "/" | "/api" | "/api/generate-images" | "/games" | `/games/${string}` & {} | `/games/${string}/decks` & {} | `/games/${string}/decks/${string}` & {} | `/games/${string}/decks/${string}/data` & {} | `/games/${string}/decks/${string}/layout` & {} | `/games/${string}/export` & {} | `/games/${string}/export/paper` & {} | `/games/${string}/export/tts` & {} | `/games/${string}/play` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/favicon.png" | "/image1.svg" | "/placeholder.svg" | string & {};
	}
}