export interface Game {
	name: string;
	description?: string;
	tags?: string;
	decks: Component[];
}

export interface Component {
    name: string;
}
