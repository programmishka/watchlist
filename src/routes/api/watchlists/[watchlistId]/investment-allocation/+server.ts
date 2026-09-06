import { requireUserId } from '$lib/server/api/auth';
import { createApplicationServices } from '$lib/server/composition/createApplicationServices';
import { mapErrorToResponse } from '$lib/server/api/errorMapping';
import { parseJsonBody } from '$lib/server/api/requestBody';
import {
	calculateInvestmentAllocation,
	requireValidTotalSavings
} from '$lib/server/api/investmentAllocationHandlers';
import { requireValidWatchlistId } from '$lib/server/watchlist/watchlistIdBoundary';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	try {
		const userId = requireUserId(locals);
		const watchlistId = requireValidWatchlistId(params.watchlistId);
		const body = await parseJsonBody(request);
		const totalSavings = requireValidTotalSavings(body);
		const { investmentAllocationService } = createApplicationServices(platform);
		return await calculateInvestmentAllocation(
			userId,
			watchlistId,
			totalSavings,
			investmentAllocationService
		);
	} catch (error) {
		return mapErrorToResponse(error);
	}
};
