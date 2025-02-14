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
    getPlayerInfo,
    getPlayerOutposts,
} from "../../../functions/torii";
import { isTextResponse, TextResponseSchema } from "../types";

const ACTIVE_GAME_CACHE_KEY = `activeGameId`;

interface PlayerInfo {
    player_id: string;
    outpost_count: number;
    reinforcements_available_count: number;
    init: boolean;
    entity: { createdAt: string };
}

interface OutpostInformation {
    id: string;
    position: {
        x: number;
        y: number;
    };
    life: number;
    reinforcementSlotsRemaining: number;
    reinforcementType: string;
}

const createOutpostMessageTemplate = (
    outpostInformations: OutpostInformation[],
    reinforcementsAvailableCount = 0
) => `
# Message Directions
{{messageDirections}}

# Outpost Information
Outpost_count: ${outpostInformations.length}

# Task
Generate a message based on the outpostInformations:

If ${outpostInformations.length} is 0:
1. Inform the user that they don't have any outposts
2. Suggest the user to purchase one

If ${outpostInformations.length} > 0
1. Return exactly this: "
The transaction was successful, now you have ${outpostInformations.length} outposts: \n
${
    outpostInformations
        .map(
            (outpost, idx) => `
    #${idx + 1} \n
    ID: ${outpost.id} \n
    Location: [${outpost.position.x}, ${outpost.position.y}] \n
    Life: ${outpost.life} \n
    Reinforcement Slots Remaining: ${outpost.reinforcementSlotsRemaining} \n
    Reinforcement Type: "${outpost.reinforcementType === "None" ? "Unprotected" : outpost.reinforcementType}"
    `
        )
        .join("\n") + "\n"
}

\n You also have ${reinforcementsAvailableCount} reinforcements available. \n
"
2. If ${outpostInformations.filter((o) => o.reinforcementSlotsRemaining > 0).length} > 0 AND ${reinforcementsAvailableCount} <= 0 THEN suggest the user to purchase reinforcements
3. If ${outpostInformations.filter((o) => o.reinforcementSlotsRemaining > 0).length} > 0 AND ${reinforcementsAvailableCount} > 0 THEN suggest the user to reinforce the outposts (mention the outpost #)
4. If ${outpostInformations.filter((o) => o.reinforcementType === "None").length} > 0 THEN suggest the user to set the reinforcement type

Generate only the message text, no other commentary.

Return the message in JSON format like: {"text": "your message here"}`;

const composeOutpostMessage = async (
    runtime: IAgentRuntime,
    state: State,
    outpostInformations: {
        outpostInformations: OutpostInformation[];
        playerInfo?: PlayerInfo;
    }
): Promise<string | null> => {
    const context = composeContext({
        state,
        template: createOutpostMessageTemplate(
            outpostInformations.outpostInformations,
            outpostInformations.playerInfo?.reinforcements_available_count
        ),
    });

    const outpostContentObject = await generateObject({
        runtime,
        context,
        modelClass: ModelClass.SMALL,
        schema: TextResponseSchema,
        stop: ["\n"],
    });

    if (!isTextResponse(outpostContentObject.object)) {
        elizaLogger.error(
            "Invalid outpost content:",
            outpostContentObject.object
        );
        return "You don't have any outposts.";
    }

    return outpostContentObject.object.text.trim();
};

export default {
    name: "TRX_PURCHASE_OUTPOST",
    description: "Get the outpost of the user after a transaction",
    similes: [],
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
        elizaLogger.log("Starting TRX_PURCHASE_OUTPOST handler...");
        const walletAddress = message.userId;

        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        try {
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
                    await runtime.cacheManager.set(
                        ACTIVE_GAME_CACHE_KEY,
                        gameId,
                        {
                            expires: 60 * 60 * 24, // 1 day
                        }
                    );
                }
            }

            elizaLogger.info(
                `Start getting outpost for ${walletAddress} in game ${gameId}`
            );
            const outposts = await getPlayerOutposts(walletAddress, gameId);
            elizaLogger.success("Successfully fetched outpost data:", outposts);
            const playerInfo = await getPlayerInfo(walletAddress, gameId);
            elizaLogger.success(
                "Successfully fetched player info:",
                playerInfo
            );

            const outpostLocations = outposts
                .filter((edge) => edge && edge.node)
                .map((edge) => {
                    const outpost = edge.node;

                    return {
                        id: outpost.entity.id,
                        position: {
                            x: outpost.position.x,
                            y: outpost.position.y,
                        },
                        life: outpost.life,
                        reinforcementSlotsRemaining:
                            outpost.reinforces_remaining,
                        reinforcementType: outpost.reinforcement_type,
                    };
                });

            if (callback) {
                const outpostMessage = await composeOutpostMessage(
                    runtime,
                    state,
                    {
                        playerInfo,
                        outpostInformations: outpostLocations,
                    }
                );

                const callbackPayload = { text: outpostMessage };

                callback(callbackPayload);
            }

            return true;
        } catch (error) {
            elizaLogger.error(
                "Error getting outpost after transaction:",
                error
            );
            if (callback) {
                callback({
                    text: `Error getting outpost after transaction: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },
    examples: [] as ActionExample[][],
} as Action;
