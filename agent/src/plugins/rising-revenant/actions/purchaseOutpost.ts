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
import {
    getLordsBalance,
    getOutpostAllowance,
    increaseAllowance,
} from "../../../functions/starknet";
import { getActiveGame, getGamePhase } from "../../../functions/torii";
import { isTextResponse, TextResponseSchema } from "../types";

const OUTPOST_ADDRESS = process.env.STARKNET_OUTPOST_ADDRESS;
const ACTIVE_GAME_CACHE_KEY = `activeGameId`;

interface PurchaseRequest {
    count: string;
}

const createPurchaseMessageTemplate = (message: string) => `
# Message
${message}

# Task
Extract the number of outposts the user wants to purchase from the message.
You must respond with a single number as a string.

# Examples
Message: "I want to buy 2 outposts"
Response: "2"

Message: "Help me purchase 5 outposts"
Response: "5"

Message: "I want to buy an outpost"
Response: "1"

# Important Rules
1. Respond only with a single number as a string
2. If no specific number is mentioned, use "1"
3. Include the quotes around the number
4. Do not include any additional text, punctuation, or explanation

Respond with the number as a string:`;

const extractPurchaseRequest = async (
    runtime: IAgentRuntime,
    state: State,
    message: string
): Promise<PurchaseRequest | null> => {
    elizaLogger.log("extractPurchaseRequest started with message:", message);

    const context = composeContext({
        state,
        template: createPurchaseMessageTemplate(message),
    });

    const response = await generateObject({
        runtime,
        context,
        modelClass: ModelClass.SMALL,
        schema: TextResponseSchema,
        stop: ["\n"],
    });

    if (!isTextResponse(response.object)) {
        elizaLogger.error("Invalid response content:", response.object);
        return null;
    }

    const count = response.object.text.toString().trim();
    if (isNaN(Number(count)) || Number(count) < 1) {
        elizaLogger.error("Invalid count value:", count);
        return null;
    }

    return { count };
};

export default {
    name: "PURCHASE_OUTPOST",
    description: "Purchase outpost(s) for the current game",
    similes: [
        "PURCHASE_OUTPOST",
        "PURCHASE_OUTPOSTS",
        "PURCHASE_REVENANT",
        "BUY_OUTPOST",
        "BUY_OUTPOSTS",
        "BUY_REVENANT",
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
        elizaLogger.log("Starting PURCHASE_OUTPOST handler...");
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

        const gamePhase = await getGamePhase(gameId);

        if (gamePhase.state !== "preparation") {
            if (callback) {
                callback({
                    text: "You can't purchase an outpost. The game is not in preparation phase.",
                    content: { error: "Game is not in preparation phase" },
                });
            }
            return false;
        }

        const request = await extractPurchaseRequest(
            runtime,
            state,
            message.content?.text || ""
        );

        if (!request) {
            if (callback) {
                callback({
                    text: "Could not understand your purchase request. Please specify how many outposts you want to purchase.",
                    content: { error: "Invalid request" },
                });
            }
            return false;
        }

        const count = request.count;

        const outpostPrice = Number(process.env.STARKNET_OUTPOST_PRICE);
        const totalPrice = outpostPrice * Number(count);
        const lordsBalance = Number(await getLordsBalance(walletAddress));
        const allowance = Number(await getOutpostAllowance(walletAddress));

        if (lordsBalance < totalPrice) {
            elizaLogger.error("Insufficient balance");
            if (callback) {
                callback({
                    text: `Insufficient $LORDS balance to purchase ${count} outpost${Number(count) > 1 ? "s" : ""}`,
                    content: { error: "Insufficient balance" },
                });
            }
            return false;
        }

        const contractCalls = [];
        const totalPriceInWei = totalPrice * 10 ** 18;

        if (allowance < totalPriceInWei) {
            const increaseAllowanceCall =
                await increaseAllowance(totalPriceInWei);
            contractCalls.push(increaseAllowanceCall);
        }

        try {
            // Add all purchase calls in a single array
            const purchaseCalls = Array(Number(count)).fill({
                contractAddress: OUTPOST_ADDRESS,
                calldata: [gameId],
                entrypoint: "purchase",
                id: "purchase_outpost",
            });

            // Combine all calls
            contractCalls.push(...purchaseCalls);

            if (callback) {
                const callbackPayload = {
                    text: `Please sign the transaction${Number(count) > 1 ? "s" : ""} to purchase ${count} outpost${Number(count) > 1 ? "s" : ""} for the current game`,
                    contractCalls,
                };

                callback(callbackPayload);
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error purchasing outpost:", error);
            if (callback) {
                callback({
                    text: `Error purchasing outpost: ${error.message}`,
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
                    text: "I want to purchase an outpost",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: `
                        Please sign the transaction to purchase an outpost for the current game
                    `,
                    action: "PURCHASE_OUTPOST",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Help me purchase an outpost",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: `
                        Please sign the transaction to purchase an outpost for the current game
                    `,
                    action: "PURCHASE_OUTPOST",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
