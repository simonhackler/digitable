export interface SvgCard {
    front: SVGSVGElement;
    back: SVGSVGElement;
}

export interface ColumnWithData {
    title: string;
    type: 'text' | 'image';
    data: string[];
}
