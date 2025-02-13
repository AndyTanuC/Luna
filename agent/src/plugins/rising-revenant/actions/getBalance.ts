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
import { getLordsBalance } from "../../../functions/starknet";
import { isTextResponse, TextResponseSchema } from "../types";

const CACHE_KEY = `activeGameId`;

const createActiveGameMessageTemplate = (gameId = "none") => `
# Game ID
Game ID: ${gameId}

# Topics
{{topics}}

# Knowledge
{{knowledge}}

Recent conversation history:
{{recentMessages}}

# Task
Generate a message based on the recent conversation history:

If theres no recent conversation history:
- "Hello there, thanks for waiting. The current active game is: ${gameId}"
Else
- "Thanks for waiting. The current active game is: ${gameId}"

Return the message in JSON format like: {"text": "response"}
`;

const composeActiveGameMessage = async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    gameId: string
): Promise<string | null> => {
    const context = composeContext({
        state,
        template: createActiveGameMessageTemplate(gameId),
    });

    const activeGameObject = await generateObject({
        runtime,
        context,
        modelClass: ModelClass.SMALL,
        schema: TextResponseSchema,
        stop: ["\n"],
    });

    if (!isTextResponse(activeGameObject.object)) {
        elizaLogger.error(
            "Invalid active game object:",
            activeGameObject.object
        );
        return null;
    }

    return activeGameObject.object.text.trim();
};

export default {
    name: "GET_BALANCE",
    description: "Get the current balance of the user",
    similes: ["BALANCE", "CURRENT_BALANCE", "CHECK_BALANCE"],
    suppressInitialMessage: true,
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content?.text?.toLowerCase() || "";

        if (text.includes("balance") || text.includes("$LORDS")) {
            return true;
        }

        return false;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting GET_BALANCE handler...");

        try {
            const lordsBalance = await getLordsBalance(message.userId);

            if (callback) {
                const text = `Your $LORDS balance is ${lordsBalance}`;
                callback({ text });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error getting balance:", error);
            if (callback) {
                callback({
                    text: `Error getting balance: ${error.message}`,
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
                    text: "What's my $LORDS balance?",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    action: "GET_BALANCE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you help me check my $LORDS balance?",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    action: "GET_BALANCE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "How much $LORDS do I have?",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    action: "GET_BALANCE",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
