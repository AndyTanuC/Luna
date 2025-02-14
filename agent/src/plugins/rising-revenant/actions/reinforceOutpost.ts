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
    getActiveGame,
    getOutpostLocationById,
    getPlayerInfo,
    getPlayerOutposts,
} from "../../../functions/torii";
import { isTextResponse, TextResponseSchema } from "../types";
const OUTPOST_ADDRESS = process.env.STARKNET_OUTPOST_ADDRESS;
const ACTIVE_GAME_CACHE_KEY = `activeGameId`;

interface ReinforcementRequest {
    outpostIds: string[];
    count: string;
    reinforceAll: boolean;
}

const createOutpostIdMessageTemplate = (message: string) => `
# Message Directions
{{messageDirections}}

# Recent Messages
{{recentMessages}}

# Message
${message}

# Task
Extract the outpost ID and the count of reinforcements from the message. The user wants to reinforce outpost(s).

Set reinforceAll to true when:
- User mentions "all outposts"
- User mentions "both outposts"
- User mentions "all of my outposts"
- User mentions "every outpost"
- User mentions "every outpost they own"
- User mentions "every outpost they have"
- User mentions "every outpost they have access to"
- User mentions "every outpost they have control over"
- User mentions "every outpost they have access to"
- User wants to reinforce every outpost they own

Only set specific outpostIds when the user explicitly references specific outpost numbers (e.g., "#1", "#2").

Format the response as a JSON string wrapped in {"text": "YOUR_JSON_HERE"}
Example responses:
{"text": "{\\"outpostIds\\": [\\"0x6220917093cf6c9716c215f52bbb3754eb07094249595b42033464033591b30\\"], \\"count\\": \\"10\\", \\"reinforceAll\\": false}"}
{"text": "{\\"outpostIds\\": [], \\"count\\": \\"5\\", \\"reinforceAll\\": true}"}


IMPORTANT: Double check that you're using the correct outpost information that matches the user's requested number.
Generate only the JSON response, no other commentary.`;

const extractReinforcementRequest = async (
    runtime: IAgentRuntime,
    state: State,
    message: string
): Promise<ReinforcementRequest | null> => {
    const context = composeContext({
        state,
        template: createOutpostIdMessageTemplate(message),
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

    try {
        return JSON.parse(response.object.text.trim());
    } catch (error) {
        elizaLogger.error("Failed to parse reinforcement request:", error);
        return null;
    }
};

export default {
    name: "REINFORCE_OUPOST",
    description: "Reinforce an outpost",
    similes: ["REINFORCE_OUTPOST", "REINFORCE_OUTPOSTS", "REINFORCE_REVENANT"],
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
        elizaLogger.log("Starting REINFORCE_OUPOST handler...");
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

        // Extract request using LLM
        const request = await extractReinforcementRequest(
            runtime,
            state,
            message.content?.text || ""
        );
        elizaLogger.log("Reinforcement request:", request);

        if (!request) {
            if (callback) {
                callback({
                    text: "Could not understand your reinforcement request. Please specify outpost ID(s) or mention that you want to reinforce all outposts, along with the number of reinforcements.",
                    content: { error: "Invalid request" },
                });
            }
            return false;
        }

        if (!request.count) {
            if (callback) {
                callback({
                    text: "Please specify how many reinforcements you want to add to your outpost(s)",
                    content: { error: "No count provided" },
                });
            }
            return false;
        }

        const playerInfo = await getPlayerInfo(walletAddress, gameId);

        if (request.reinforceAll) {
            // Get all player outposts
            const outposts = await getPlayerOutposts(walletAddress, gameId);
            const totalReinforcements = Number(request.count) * outposts.length;

            if (
                playerInfo.reinforcements_available_count < totalReinforcements
            ) {
                if (callback) {
                    callback({
                        text: `You don't have enough reinforcements to reinforce all outposts. You have ${playerInfo.reinforcements_available_count} reinforcements available, but need ${totalReinforcements} (${request.count} per outpost). Do you want me to help you purchase more reinforcements?`,
                        content: { error: "Not enough reinforcements" },
                    });
                }
                return false;
            }

            // Create contract calls for each outpost
            const contractCalls = outposts.map((outpost) => ({
                contractAddress: OUTPOST_ADDRESS,
                calldata: [
                    gameId,
                    outpost.node.position.x,
                    outpost.node.position.y,
                    request.count,
                ],
                entrypoint: "reinforce",
                id: "reinforce_outpost",
                nextCall: {},
            }));

            if (callback) {
                callback({
                    text: `Please sign the transaction(s) to reinforce all your outposts with ${request.count} reinforcements each`,
                    contractCalls,
                });
            }

            return true;
        } else if (request.outpostIds.length > 0) {
            // Handle multiple specific outposts
            const outpostLocations = await Promise.all(
                request.outpostIds.map((id) => getOutpostLocationById(id))
            );

            // Check if all outpost IDs are valid
            if (outpostLocations.some((location) => !location)) {
                if (callback) {
                    callback({
                        text: "One or more outpost IDs are invalid",
                        content: { error: "Invalid outpost ID(s)" },
                    });
                }
                return false;
            }

            const totalReinforcements =
                Number(request.count) * request.outpostIds.length;

            if (
                playerInfo.reinforcements_available_count < totalReinforcements
            ) {
                if (callback) {
                    callback({
                        text: `You don't have enough reinforcements. You have ${playerInfo.reinforcements_available_count} reinforcements available, but need ${totalReinforcements} (${request.count} per outpost). Do you want me to help you purchase more reinforcements?`,
                        content: { error: "Not enough reinforcements" },
                    });
                }
                return false;
            }

            // Create contract calls for each specified outpost
            const contractCalls = outpostLocations.map((location) => ({
                contractAddress: OUTPOST_ADDRESS,
                calldata: [gameId, location.x, location.y, request.count],
                entrypoint: "reinforce",
                id: `reinforce_outpost`,
                nextCall: {},
            }));

            if (callback) {
                callback({
                    text: `Please sign the transaction(s) to reinforce your specified outposts with ${request.count} reinforcements each`,
                    contractCalls,
                });
            }

            return true;
        } else {
            if (callback) {
                callback({
                    text: "Please specify which outpost(s) you want to reinforce",
                    content: { error: "No outpost IDs provided" },
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
                    text: "I want to reinforce my outpost with id 123",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: `
                        Please sign the transaction to purchase an outpost for the current game
                    `,
                    action: "REINFORCE_OUTPOST",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I want to reinforce all my outposts with 5 reinforcements each",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Please sign the transaction(s) to reinforce all your outposts",
                    action: "REINFORCE_OUTPOST",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I want to reinforce outposts 123, 456, and 789 with 5 reinforcements each",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Please sign the transaction(s) to reinforce your specified outposts",
                    action: "REINFORCE_OUTPOST",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
