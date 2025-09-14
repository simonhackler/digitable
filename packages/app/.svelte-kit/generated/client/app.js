export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13')
];

export const server_loads = [];

export const dictionary = {
		"/": [5],
		"/games": [6,[2]],
		"/games/[gameName]": [7,[2]],
		"/games/[gameName]/decks/[deckName]/data": [8,[2,3]],
		"/games/[gameName]/decks/[deckName]/layout": [9,[2,3]],
		"/games/[gameName]/export": [10,[2,4]],
		"/games/[gameName]/export/paper": [11,[2,4]],
		"/games/[gameName]/export/tts": [12,[2,4]],
		"/games/[gameName]/play": [13,[2]]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';