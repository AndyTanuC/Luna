import {
    ActionExample,
    elizaLogger,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    type Action,
} from "@elizaos/core";
import { increaseAllowance } from "../../../functions/starknet";

const ACTIVE_GAME_CACHE_KEY = `activeGameId`;

export default {
    name: "INCREASE_ALLOWANCE",
    description: "Increase the allowance of the user",
    similes: ["INCREASE_ALLOWANCE"],
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
        elizaLogger.log("Starting INCREASE_ALLOWANCE handler...");

        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        try {
            const contractCall = await increaseAllowance(10000);

            if (callback) {
                const callbackPayload = {
                    text: "Please sign the transaction to increase your allowance",
                    contractCall,
                };

                callback(callbackPayload);
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error increasing allowance:", error);
            if (callback) {
                callback({
                    text: `Error increasing allowance: ${error.message}`,
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
                    text: "Increase my allowance to XXX",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: `
                        You have increased your allowance to XXX
                    `,
                    action: "INCREASE_ALLOWANCE",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
