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
import { getActiveGame, getPlayerOutposts } from "../../../functions/torii";
import { isTextResponse, TextResponseSchema } from "../types";

const MARKET_ADDRESS = process.env.STARKNET_MARKET_ADDRESS;
const ACTIVE_GAME_CACHE_KEY = `activeGameId`;

interface SellOutpostRequest {
    locations: string | string[];
    price: number;
}

const createSellMessageTemplate = (message: string) => `
# Message Directions
{{messageDirections}}

# Recent Messages
{{recentMessages}}

# Message
${message}

# Task
To sell the outpost, we need 2 things from the user:
1. The outpost location
2. The price they want to sell the outpost for

with that being said,
if user doesn't specify a location, ask for the location.
if user doesn't specify a price, ask for the price.

Extract which outpost the user wants to sell from the message.
You must respond with the outpost location and the price.

# Examples
Message: "I want to sell my outpost"
Response: "Please specify the location and the price of the outpost you want to sell" (ensure the tone to align with the you lore)

Message: "I want to sell my outpost for 20 $LORDS"
Response: "Please specify the location of the outpost you want to sell" (ensure the tone to align with the you lore)

Message: "I want to sell my outpost at location 4960,2170"
Response: "Please specify the price of the outpost you want to sell" (ensure the tone to align with the you lore)

Message: "I want to sell my outpost at location 4960,2170 for 20 $LORDS"
Response: {"locations": [4960,2170], "price": 20}

Message: "Help me sell my outpost at location 4960,2170 and 3960,2171 for 30 $LORDS"
Response: {"locations": [4960,2170],[3960,2171], "price": 30}

Message: "I want to sell all my outposts for 30 $LORDS each"
Response: {"locations": "all", "price": 30}

# Important Rules
1. Respond only with the outpost location and the price
2. Do not include any text, punctuation, or explanation`;

const extractSellRequest = async (
    runtime: IAgentRuntime,
    state: State,
    message: string
): Promise<SellOutpostRequest | null> => {
    elizaLogger.log("extractSellRequest started with message:", message);

    const context = composeContext({
        state,
        template: createSellMessageTemplate(message),
    });

    const response = await generateObject({
        runtime,
        context,
        modelClass: ModelClass.SMALL,
        schema: TextResponseSchema,
        stop: ["\n"],
    });
    elizaLogger.log("extractSellRequest response:", response.object);

    if (!isTextResponse(response.object)) {
        elizaLogger.error("Invalid response content:", response.object);
        return null;
    }

    try {
        return JSON.parse(response.object.text.trim());
    } catch (error) {
        elizaLogger.error("Failed to parse sell request:", error);
        return null;
    }
};

export default {
    name: "SELL_OUTPOST",
    description: "Sell outpost(s) for the current game",
    similes: [
        "SELL_OUTPOST",
        "SELL_OUTPOSTS",
        "PUT_UP_FOR_SALE",
        "PUT_UP_FOR_SALE_OUTPOST",
        "PUT_UP_FOR_SALE_OUTPOSTS",
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
        elizaLogger.log("Starting SELL_OUTPOST handler...");
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

        const request = await extractSellRequest(
            runtime,
            state,
            message.content?.text || ""
        );

        if (!request) {
            if (callback) {
                callback({
                    text: "Could not understand your sell request. Please specify the outpost location and the price.",
                    content: { error: "Invalid request" },
                });
            }
            return false;
        }

        const { locations, price } = request;
        const outpostIds = [];
        if (typeof locations === "string") {
            const userOutpost = await getPlayerOutposts(walletAddress, gameId);

            userOutpost.forEach((outpost) => {
                outpostIds.push(outpost.position.x, outpost.position.y);
            });
        } else {
            outpostIds.push(...locations);
        }

        const contractCalls = [];

        for (let i = 0; i < outpostIds.length; i++) {
            contractCalls.push({
                contractAddress: MARKET_ADDRESS,
                calldata: [gameId, price, [outpostIds[i][0], outpostIds[i][1]]],
                entrypoint: "create",
                id: "sell_outpost",
            });
        }

        try {
            if (callback) {
                const callbackPayload = {
                    text: `Please sign the transaction to sell the outpost`,
                    contractCalls,
                };

                callback(callbackPayload);
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error selling outpost:", error);
            if (callback) {
                callback({
                    text: `Error selling outpost: ${error.message}`,
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
                    text: "I want to sell my outpost at location X,Y",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: `
                        Please sign the transaction to make the sell listing for the selected outpost
                    `,
                    action: "SELL_OUTPOST",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Put my outpost up for sale",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: `
                        Please sign the transaction to make the sell listing for the selected outpost
                    `,
                    action: "SELL_OUTPOST",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
