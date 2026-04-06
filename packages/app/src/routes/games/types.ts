export interface Game {
	name: string;
	description?: string;
	tags?: string;
	decks: ComponentFileStructure[];
}

export interface ComponentFileStructure {
	name: string;
}
