import { InvalidRequestError } from './errors';

export async function parseJsonBody(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch (error) {
		throw new InvalidRequestError('The request body is not valid JSON.', { cause: error });
	}
}

function requireObjectField(body: unknown, field: string): Record<string, unknown> {
	if (typeof body !== 'object' || body === null) {
		throw new InvalidRequestError(
			`The request body must be a JSON object with a "${field}" field.`
		);
	}
	return body as Record<string, unknown>;
}

export function requireStringField(body: unknown, field: string): string {
	const value = requireObjectField(body, field)[field];
	if (typeof value !== 'string') {
		throw new InvalidRequestError(`The request body must contain a string "${field}" field.`);
	}
	return value;
}

export function requireNumberField(body: unknown, field: string): number {
	const value = requireObjectField(body, field)[field];
	if (typeof value !== 'number') {
		throw new InvalidRequestError(`The request body must contain a numeric "${field}" field.`);
	}
	return value;
}
