import type { SvgString } from './types';

export type ApplyExternalValueArgs = {
	value: string;
	lastExternalValue: string | null;
	lastUserValue: string | null;
	normalize: (value: string) => SvgString;
	load: (svg: SvgString) => boolean;
};

export type ApplyExternalValueResult = {
	applied: boolean;
	ok: boolean;
	normalizedValue: SvgString;
};

export const applyExternalValue = ({
	value,
	lastExternalValue,
	lastUserValue,
	normalize,
	load
}: ApplyExternalValueArgs): ApplyExternalValueResult => {
	const normalizedValue = normalize(value);

	if (normalizedValue === lastExternalValue || normalizedValue === lastUserValue) {
		return { applied: false, ok: true, normalizedValue };
	}

	const ok = load(normalizedValue);
	return { applied: true, ok, normalizedValue };
};
