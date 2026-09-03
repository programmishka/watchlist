import { requireUserId } from '$lib/server/api/auth';
import { createApplicationServices } from '$lib/server/composition/createApplicationServices';
import { mapErrorToResponse } from '$lib/server/api/errorMapping';
import { removeStock } from '$lib/server/api/watchlistHandlers';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	try {
		const userId = requireUserId(locals);
		const { watchlistService, watchlistQueryService } = createApplicationServices(platform);
		return await removeStock(
			userId,
			params.watchlistId,
			params.symbol,
			watchlistService,
			watchlistQueryService
		);
	} catch (error) {
		return mapErrorToResponse(error);
	}
};
