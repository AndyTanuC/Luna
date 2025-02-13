import {
    ActionExample,
    composeContext,
    elizaLogger,
    generateObject,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    type Action,
} from "@elizaos/core";
import { getActiveGame, getPlayerOutpostSales } from "../../../functions/torii";
import { isTextResponse, TextResponseSchema } from "../types";

const MARKET_ADDRESS = process.env.STARKNET_MARKET_ADDRESS;
const ACTIVE_GAME_CACHE_KEY = `activeGameId`;

interface RevokeOutpostSaleRequest {
    locations: string | string[];
}

const createRevokeMessageTemplate = (message: string) => `
# Message Directions
{{messageDirections}}

# Recent Messages
{{recentMessages}}

# Message
${message}

# Task
To revoke the sale of an outpost, we need 1 thing from the user:
1. The outpost location

with that being said, if user doesn't specify a location, ask for the location.
unless user mentioned they want to revoke all their outpost sales.

Extract which outpost sale the user wants to revoke from the message.
You must respond with the outpost location.

# Examples
Message: "I want to revoke my outpost sale"
Response: "Please specify the location of the outpost you want to revoke" (ensure the tone to align with the you lore)

Message: "I want to revoke all my outpost sales"
Response: {"locations": "all"}

Message: "I want to revoke my outpost sale at location 4960,2170"
Response: {"locations": [4960,2170]}

Message: "I want to revoke my outpost sale at location 4960,2170 and 4960,2171"
Response: {"locations": [[4960,2170],[4960,2171]]}

# Important Rules
1. Respond only with the outpost location
2. Do not include any text, punctuation, or explanation`;

const extractRevokeRequest = async (
    runtime: IAgentRuntime,
    state: State,
    message: string
): Promise<RevokeOutpostSaleRequest | null> => {
    elizaLogger.log("extractRevokeRequest started with message:", message);

    const context = composeContext({
        state,
        template: createRevokeMessageTemplate(message),
    });

    const response = await generateObject({
        runtime,
        context,
        modelClass: ModelClass.SMALL,
        schema: TextResponseSchema,
        stop: ["\n"],
    });
    elizaLogger.log("extractRevokeRequest response:", response.object);

    if (!isTextResponse(response.object)) {
        elizaLogger.error("Invalid response content:", response.object);
        return null;
    }

    try {
        return JSON.parse(response.object.text.trim());
    } catch (error) {
        elizaLogger.error("Failed to parse revoke request:", error);
        return null;
    }
};

export default {
    name: "REVOKE_OUTPOST_SALE",
    description: "Revoke the sale of an outpost",
    similes: [
        "REVOKE_OUTPOST_SALE",
        "REVOKE_SALE",
        "REVOKE_SALE_OUTPOST",
        "REVOKE_SALE_OUTPOSTS",
    ],
    suppressInitialMessage: true,
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting REVOKE_OUTPOST_SALE handler...");
        const walletAddress = message.userId;

        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        let gameId: string | undefined;

        const cachedGameId = await runtime.cacheManager.get(
            ACTIVE_GAME_CACHE_KEY
        );

        if (cachedGameId) {
            gameId = cachedGameId as string;
        } else {
            const activeGameId = await getActiveGame();

            if (activeGameId) {
                gameId = activeGameId;
                await runtime.cacheManager.set(ACTIVE_GAME_CACHE_KEY, gameId, {
                    expires: 60 * 60 * 24, // 1 day
                });
            }
        }

        if (!gameId) {
            elizaLogger.error("No active game id found");
            if (callback) {
                callback({
                    text: "No active game id found",
                    content: { error: "No active game id found" },
                });
            }
            return false;
        }

        const request = await extractRevokeRequest(
            runtime,
            state,
            message.content?.text || ""
        );

        if (!request) {
            if (callback) {
                callback({
                    text: "Could not understand your revoke request. Can you please specify the outpost location?",
                    content: { error: "Invalid request" },
                });
            }
            return false;
        }

        const { locations } = request;
        const playerOutpostSales = await getPlayerOutpostSales(
            walletAddress,
            gameId
        );

        const contractCalls = [];
        if (typeof locations === "string" && locations === "all") {
            playerOutpostSales.forEach((sale) => {
                contractCalls.push({
                    contractAddress: MARKET_ADDRESS,
                    calldata: [gameId, sale.trade_id],
                    entrypoint: "revoke",
                    id: "revoke_outpost_sale",
                });
            });
        } else if (typeof locations === "object" && locations.length > 0) {
            for (const location of locations) {
                const findOutpostSale = playerOutpostSales.find((sale) => {
                    return (
                        sale.offer.x === location[0] &&
                        sale.offer.y === location[1]
                    );
                });

                if (!findOutpostSale) {
                    elizaLogger.error("Outpost sale not found");
                    if (callback) {
                        callback({
                            text: `We couldn't find the outpost sale you wanted to revoke at ${location[0]},${location[1]}`,
                            content: { error: "Outpost sale not found" },
                        });
                    }
                    return false;
                }

                contractCalls.push({
                    contractAddress: MARKET_ADDRESS,
                    calldata: [gameId, findOutpostSale.trade_id],
                    entrypoint: "revoke",
                    id: "revoke_outpost_sale",
                });
            }
        }

        try {
            if (callback) {
                const callbackPayload = {
                    text: `Please sign the transaction to revoke the outpost sale`,
                    contractCalls,
                };

                callback(callbackPayload);
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error revoking outpost sale:", error);
            if (callback) {
                callback({
                    text: `Error revoking outpost sale: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I want to cancel all sale listing",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: `Which outpost sale do you want to cancel? Please specify the outpost location`,
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I want to cancel all my sale listing",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: `
                        Please sign the transaction to cancel all your sell listing
                    `,
                    action: "REVOKE_OUTPOST_SALE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Please help me cancel my sale listing at location 4960,2170",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: `
                        Please sign the transaction to cancel the sell listing for the selected outpost
                    `,
                    action: "REVOKE_OUTPOST_SALE",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
