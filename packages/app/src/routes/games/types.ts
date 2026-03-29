export interface Game {
	name: string;
	description?: string;
	tags?: string;
	decks: { name: string }[];
}
