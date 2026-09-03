import { requireUserId } from '$lib/server/api/auth';
import { createApplicationServices } from '$lib/server/composition/createApplicationServices';
import { mapErrorToResponse } from '$lib/server/api/errorMapping';
import { parseJsonBody, requireStringField } from '$lib/server/api/requestBody';
import { createWatchlist, listWatchlists } from '$lib/server/api/watchlistHandlers';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	try {
		const userId = requireUserId(locals);
		const { watchlistService } = createApplicationServices(platform);
		return await listWatchlists(userId, watchlistService);
	} catch (error) {
		return mapErrorToResponse(error);
	}
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	try {
		const userId = requireUserId(locals);
		const body = await parseJsonBody(request);
		const name = requireStringField(body, 'name');
		const { watchlistService } = createApplicationServices(platform);
		return await createWatchlist(userId, name, watchlistService);
	} catch (error) {
		return mapErrorToResponse(error);
	}
};
