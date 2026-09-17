declare const positionIdBrand: unique symbol;

/** A dense, totally ordered identifier. Its components are exact rational numbers. */
export type PositionId = string & { readonly [positionIdBrand]: true };

type Fraction = { numerator: bigint; denominator: bigint };

const PREFIX = 'p1:';

const greatestCommonDivisor = (left: bigint, right: bigint): bigint => {
	let a = left < 0n ? -left : left;
	let b = right < 0n ? -right : right;
	while (b !== 0n) {
		const remainder = a % b;
		a = b;
		b = remainder;
	}
	return a;
};

const fraction = (numerator: bigint, denominator = 1n): Fraction => {
	if (denominator === 0n) throw new RangeError('A PositionId denominator cannot be zero.');
	const sign = denominator < 0n ? -1n : 1n;
	const divisor = greatestCommonDivisor(numerator, denominator);
	return {
		numerator: (numerator * sign) / divisor,
		denominator: (denominator * sign) / divisor
	};
};

const compareFraction = (left: Fraction, right: Fraction): number => {
	const difference = left.numerator * right.denominator - right.numerator * left.denominator;
	return difference < 0n ? -1 : difference > 0n ? 1 : 0;
};

const parsePosition = (value: string): Fraction[] => {
	if (!value.startsWith(PREFIX)) throw new TypeError(`Invalid PositionId: ${value}`);
	const encoded = value.slice(PREFIX.length);
	if (!encoded) throw new TypeError(`Invalid PositionId: ${value}`);
	return encoded.split(',').map((component) => {
		const separator = component.indexOf('/');
		if (separator < 1 || separator === component.length - 1)
			throw new TypeError(`Invalid PositionId: ${value}`);
		const numerator = component.slice(0, separator);
		const denominator = component.slice(separator + 1);
		if (!/^-?(0|[1-9]\d*)$/.test(numerator) || !/^[1-9]\d*$/.test(denominator))
			throw new TypeError(`Invalid PositionId: ${value}`);
		const parsed = fraction(BigInt(numerator), BigInt(denominator));
		if (`${parsed.numerator}/${parsed.denominator}` !== component)
			throw new TypeError(`PositionId is not canonical: ${value}`);
		return parsed;
	});
};

const encodePosition = (components: Fraction[]): PositionId =>
	`${PREFIX}${components
		.map((component) => `${component.numerator}/${component.denominator}`)
		.join(',')}` as PositionId;

const identifierInteger = (identifier: string): bigint => {
	const bytes = new TextEncoder().encode(identifier);
	let value = 1n;
	for (const byte of bytes) value = value * 257n + BigInt(byte + 1);
	return value;
};

const randomIdentifier = (): string => {
	if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
	if (typeof globalThis.crypto?.getRandomValues === 'function') {
		const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
		return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

export const isPositionId = (value: unknown): value is PositionId => {
	if (typeof value !== 'string') return false;
	try {
		parsePosition(value);
		return true;
	} catch {
		return false;
	}
};

export const comparePosition = (left: PositionId, right: PositionId): number => {
	if (left === right) return 0;
	const leftComponents = parsePosition(left);
	const rightComponents = parsePosition(right);
	const length = Math.min(leftComponents.length, rightComponents.length);
	for (let index = 0; index < length; index += 1) {
		const comparison = compareFraction(leftComponents[index], rightComponents[index]);
		if (comparison !== 0) return comparison;
	}
	return leftComponents.length < rightComponents.length ? -1 : 1;
};

export const compare = comparePosition;

/**
 * Creates an identifier strictly between its bounds. The optional discriminator must be
 * globally unique when deterministic IDs are needed; otherwise a browser-safe random value is used.
 */
export const positionBetween = (
	before: PositionId | null,
	after: PositionId | null,
	discriminator = randomIdentifier()
): PositionId => {
	if (!discriminator) throw new TypeError('A PositionId discriminator cannot be empty.');
	if (before && after && comparePosition(before, after) >= 0)
		throw new RangeError('The before PositionId must sort before the after PositionId.');

	const left = before ? parsePosition(before) : null;
	const right = after ? parsePosition(after) : null;
	let components: Fraction[];

	if (!left && !right) components = [fraction(0n)];
	else if (!left && right)
		components = [fraction(right[0].numerator - right[0].denominator, right[0].denominator)];
	else if (left && !right)
		components = [fraction(left[0].numerator + left[0].denominator, left[0].denominator)];
	else {
		const lower = left as Fraction[];
		const upper = right as Fraction[];
		let index = 0;
		while (
			index < lower.length &&
			index < upper.length &&
			compareFraction(lower[index], upper[index]) === 0
		)
			index += 1;
		const prefix = lower.slice(0, index);
		if (index === lower.length) {
			const next = upper[index];
			components = [...prefix, fraction(next.numerator - next.denominator, next.denominator)];
		} else {
			const lowerPart = lower[index];
			const upperPart = upper[index];
			components = [
				...prefix,
				fraction(
					lowerPart.numerator * upperPart.denominator + upperPart.numerator * lowerPart.denominator,
					2n * lowerPart.denominator * upperPart.denominator
				)
			];
		}
	}

	return encodePosition([...components, fraction(identifierInteger(discriminator))]);
};
