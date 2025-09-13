export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.png","image1.svg","placeholder.svg"]),
	mimeTypes: {".png":"image/png",".svg":"image/svg+xml"},
	_: {
		client: {start:"_app/immutable/entry/start.CEvb2iPk.js",app:"_app/immutable/entry/app.DUxW3mdY.js",imports:["_app/immutable/entry/start.CEvb2iPk.js","_app/immutable/chunks/BOSYInrQ.js","_app/immutable/chunks/DxYQc54M.js","_app/immutable/chunks/CcupEzEf.js","_app/immutable/chunks/cfBV56z_.js","_app/immutable/entry/app.DUxW3mdY.js","_app/immutable/chunks/CcupEzEf.js","_app/immutable/chunks/DxYQc54M.js","_app/immutable/chunks/cfBV56z_.js","_app/immutable/chunks/f00okDMd.js","_app/immutable/chunks/BVPmkM9x.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js')),
			__memo(() => import('./nodes/8.js')),
			__memo(() => import('./nodes/9.js')),
			__memo(() => import('./nodes/10.js')),
			__memo(() => import('./nodes/11.js')),
			__memo(() => import('./nodes/12.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/api/generate-images",
				pattern: /^\/api\/generate-images\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/generate-images/_server.ts.js'))
			},
			{
				id: "/games",
				pattern: /^\/games\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/games/[gameName]",
				pattern: /^\/games\/([^/]+?)\/?$/,
				params: [{"name":"gameName","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/games/[gameName]/decks/[deckName]/data",
				pattern: /^\/games\/([^/]+?)\/decks\/([^/]+?)\/data\/?$/,
				params: [{"name":"gameName","optional":false,"rest":false,"chained":false},{"name":"deckName","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,3,], errors: [1,,,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/games/[gameName]/decks/[deckName]/layout",
				pattern: /^\/games\/([^/]+?)\/decks\/([^/]+?)\/layout\/?$/,
				params: [{"name":"gameName","optional":false,"rest":false,"chained":false},{"name":"deckName","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,3,], errors: [1,,,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/games/[gameName]/export",
				pattern: /^\/games\/([^/]+?)\/export\/?$/,
				params: [{"name":"gameName","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,4,], errors: [1,,,], leaf: 10 },
				endpoint: null
			},
			{
				id: "/games/[gameName]/export/paper",
				pattern: /^\/games\/([^/]+?)\/export\/paper\/?$/,
				params: [{"name":"gameName","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,4,], errors: [1,,,], leaf: 11 },
				endpoint: null
			},
			{
				id: "/games/[gameName]/export/tts",
				pattern: /^\/games\/([^/]+?)\/export\/tts\/?$/,
				params: [{"name":"gameName","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,4,], errors: [1,,,], leaf: 12 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
