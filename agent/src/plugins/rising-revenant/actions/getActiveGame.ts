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
    checkLatestBlock,
    fetchAverageBlockTime,
} from "../../../functions/starknet";
import { getActiveGame, getGamePhase } from "../../../functions/torii";
import { isTextResponse, TextResponseSchema } from "../types";

const CACHE_KEY = `activeGameId`;
const AVERAGE_TIME_CACHE_KEY = `averageBlockTime`;

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
    name: "GET_ACTIVE_GAME",
    description: "Get the current active game",
    similes: ["ACTIVE_GAME", "CURRENT_GAME"],
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
        elizaLogger.log("Starting GET_ACTIVE_GAME handler...");

        try {
            let gameId: string | undefined;

            const cachedGameId = await runtime.cacheManager.get(CACHE_KEY);

            if (cachedGameId) {
                gameId = cachedGameId as string;
            } else {
                const activeGameId = await getActiveGame();

                if (activeGameId) {
                    gameId = activeGameId;
                    await runtime.cacheManager.set(CACHE_KEY, gameId, {
                        expires: 60 * 60 * 24, // 1 day
                    });
                }
            }

            const currentBlock = await checkLatestBlock();
            const gamePhase = await getGamePhase(gameId);
            let text = "There is no active game at the moment.";

            if (currentBlock && gameId && gamePhase) {
                const { state, playBlockNumber, preparationBlockNumber } =
                    gamePhase;

                text = `The current active game is ${gameId} and the currently in ${state} phase.`;

                if (state === "preparation") {
                    let averageBlockTime = await runtime.cacheManager.get(
                        AVERAGE_TIME_CACHE_KEY
                    );

                    if (!averageBlockTime) {
                        averageBlockTime = await fetchAverageBlockTime();
                        await runtime.cacheManager.set(
                            AVERAGE_TIME_CACHE_KEY,
                            averageBlockTime,
                            { expires: 60 * 60 * 24 } // 1 day
                        );
                    }

                    const timeToNextPhase =
                        playBlockNumber - currentBlock.block_number;
                    const timeToNextPhaseInMinutes =
                        (timeToNextPhase * Number(averageBlockTime)) / 60;
                    const hours = Math.floor(timeToNextPhaseInMinutes / 60);
                    const minutes = Math.round(timeToNextPhaseInMinutes % 60);

                    text += `\nThe game phase will start in ${hours} hours and ${minutes} minutes. \nIf you haven't participated in the game yet, you can do so by purchasing an outpost.
                    `;
                }
            }

            if (callback) {
                callback({ text });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error getting active game:", error);
            if (callback) {
                callback({
                    text: `Error getting active game: ${error.message}`,
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
                    text: "Are there any active games right now?",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I will get the current active game now.",
                    action: "GET_ACTIVE_GAME",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What's the current active game?",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Let me check that for you.",
                    action: "GET_ACTIVE_GAME",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
