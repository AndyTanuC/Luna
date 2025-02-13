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
    getReinforcementAllowance,
    increaseAllowance,
} from "../../../functions/starknet";
import { getActiveGame } from "../../../functions/torii";
import { isTextResponse, TextResponseSchema } from "../types";

const REINFORCEMENT_ADDRESS = process.env.STARKNET_REINFORCEMENT_ADDRESS;
const ACTIVE_GAME_CACHE_KEY = `activeGameId`;

interface PurchaseRequest {
    count: string;
}

const createPurchaseMessageTemplate = (message: string) => `
# Message
${message}

# Task
Extract the number of reinforcements the user wants to purchase from the message.
You must respond with a number as a string.

# Examples
Message: "I want to buy 2 reinforcements"
Response: "2"

Message: "Help me purchase 5 reinforcements"
Response: "5"

Message: "I want to buy a reinforcement"
Response: "1"

# Important Rules
1. Respond with a single number as a string
2. If no specific number is mentioned, use "1"
3. Include the quotes around the number
4. Do not include any additional text, punctuation, or explanation

Respond with the quoted number:`;

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

    // Remove any quotes from the response and trim whitespace
    const numberStr = response.object.text.replace(/['"]/g, "").trim();
    const count = Number(numberStr);

    if (isNaN(count) || count < 1) {
        elizaLogger.error("Invalid count value:", count);
        return null;
    }

    return { count: count.toString() };
};

export default {
    name: "PURCHASE_REINFORCEMENT",
    description: "Purchase reinforcement(s) for the current game",
    similes: [
        "PURCHASE_REINFORCEMENT",
        "PURCHASE_REINFORCEMENTS",
        "BUY_REINFORCEMENT",
        "BUY_REINFORCEMENTS",
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
        elizaLogger.log("Starting PURCHASE_REINFORCEMENT handler...");
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

        const count = Number(request.count);

        const reinforcementPrice = Number(
            process.env.STARKNET_REINFORCEMENT_PRICE
        );
        const totalPrice = reinforcementPrice * count;
        const lordsBalance = Number(await getLordsBalance(walletAddress));

        if (lordsBalance === 0) {
            if (callback) {
                callback({
                    text: "You don't have any $LORDS balance",
                    content: { error: "No $LORDS balance" },
                });
            }
            return false;
        }

        const allowance = Number(
            await getReinforcementAllowance(walletAddress)
        );

        const contractCalls = [];
        const totalPriceInWei = totalPrice * 10 ** 18;

        let text = ``;
        if (allowance < totalPriceInWei) {
            const increaseAllowanceCall = await increaseAllowance(
                allowance + totalPriceInWei
            );
            contractCalls.push(increaseAllowanceCall);
            text = `Please sign the first transaction to increase your allowance fist`;
        }

        try {
            const purchaseReinforcementCall = {
                contractAddress: REINFORCEMENT_ADDRESS,
                calldata: [gameId, count],
                entrypoint: "purchase",
                id: "purchase_reinforcement",
            };

            if (contractCalls.length > 0) {
                contractCalls[0].nextCalls.push(purchaseReinforcementCall);
                text += `. After that please sign the second transaction to purchase ${count} reinforcement${count > 1 ? "s" : ""} for the current game`;
            } else {
                contractCalls.push(purchaseReinforcementCall);
                text = `Please sign the transaction to purchase ${count} reinforcement${count > 1 ? "s" : ""} for the current game`;
            }

            if (callback) {
                const callbackPayload = { text, contractCalls };

                callback(callbackPayload);
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error purchasing reinforcement:", error);
            if (callback) {
                callback({
                    text: `Error purchasing reinforcement: ${error.message}`,
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
                    text: "I want to purchase a reinforcement",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: `
                        Please sign the transaction to purchase a reinforcement for the current game
                    `,
                    action: "PURCHASE_REINFORCEMENT",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Help me purchase 5 reinforcements",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: `
                        Please sign the transaction to purchase 5 reinforcements for the current game
                    `,
                    action: "PURCHASE_REINFORCEMENT",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
