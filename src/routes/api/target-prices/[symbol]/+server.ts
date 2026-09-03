import { requireUserId } from '$lib/server/api/auth';
import { createApplicationServices } from '$lib/server/composition/createApplicationServices';
import { mapErrorToResponse } from '$lib/server/api/errorMapping';
import { parseJsonBody, requireNumberField } from '$lib/server/api/requestBody';
import { setTargetPrice } from '$lib/server/api/targetPriceHandlers';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ locals, platform, params, request }) => {
	try {
		const userId = requireUserId(locals);
		const body = await parseJsonBody(request);
		const targetPrice = requireNumberField(body, 'targetPrice');
		const { targetPriceService, marketDataProvider } = createApplicationServices(platform);
		return await setTargetPrice(
			userId,
			params.symbol,
			targetPrice,
			targetPriceService,
			marketDataProvider
		);
	} catch (error) {
		return mapErrorToResponse(error);
	}
};
