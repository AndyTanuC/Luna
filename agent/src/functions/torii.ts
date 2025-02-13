import { InMemoryCache } from "@apollo/client/cache";
import { ApolloClient, gql } from "@apollo/client/core";
import { checkLatestBlock } from "./starknet";

const TORII_URL = process.env.TORII_URL;

const client = new ApolloClient({
    uri: TORII_URL,
    cache: new InMemoryCache(),
});

export const getActiveGame = async () => {
    const { data } = await client.query({
        query: gql`
            query GetActiveGame {
                currentGameModels(first: 1) {
                    edges {
                        node {
                            game_id
                        }
                    }
                }
            }
        `,
        variables: {},
    });

    return data.currentGameModels.edges[0].node.game_id;
};

export const getGamePhase = async (gameId: string) => {
    const { data } = await client.query({
        query: gql`
            query GetGamePhase($gameId: String!) {
                gamePhasesModels(where: { game_id: $gameId }) {
                    edges {
                        node {
                            play_block_number
                            preparation_block_number
                            status
                            game_id
                        }
                    }
                }
            }
        `,
        variables: { gameId },
    });

    const currentBlock = await checkLatestBlock();
    const phase = data.gamePhasesModels.edges[0].node;
    const playBlockNumber = parseInt(phase.play_block_number, 16);
    const preparationBlockNumber = parseInt(phase.preparation_block_number, 16);

    let state = "ended";

    if (currentBlock.block_number >= playBlockNumber) {
        state = "game";
    } else if (currentBlock.block_number >= preparationBlockNumber) {
        state = "preparation";
    }

    return {
        state,
        playBlockNumber,
        preparationBlockNumber,
    };
};

export const getPlayerInfo = async (walletAddress: string, gameId: string) => {
    const { data } = await client.query({
        query: gql`
            query GetPlayerInfo($walletAddress: String!, $gameId: String!) {
                playerInfoModels(
                    where: { player_id: $walletAddress, game_id: $gameId }
                ) {
                    edges {
                        node {
                            player_id
                            outpost_count
                            reinforcements_available_count
                            init
                            entity {
                                createdAt
                            }
                        }
                    }
                }
            }
        `,
        variables: { walletAddress, gameId },
    });

    return data.playerInfoModels.edges.length
        ? data.playerInfoModels.edges[0].node
        : null;
};

export const getPlayerOutposts = async (
    walletAddress: string,
    gameId: string
) => {
    const { data } = await client.query({
        query: gql`
            query GetPlayerOutposts($walletAddress: String!, $gameId: String!) {
                outpostModels(
                    where: { owner: $walletAddress, game_id: $gameId }
                ) {
                    edges {
                        node {
                            game_id
                            position {
                                x
                                y
                            }
                            status
                            life
                            reinforces_remaining
                            reinforcement_type
                            owner
                            entity {
                                id
                                createdAt
                            }
                        }
                    }
                }
            }
        `,
        variables: { walletAddress, gameId },
    });

    return data.outpostModels.edges || [];
};

export const getOutpostLocationById = async (entityId: string) => {
    const { data } = await client.query({
        query: gql`
            query GetOutpostById($entityId: String!) {
                entity(id: $entityId) {
                    id
                    keys
                    eventId
                    models {
                        ... on Outpost {
                            position {
                                x
                                y
                            }
                        }
                    }
                }
            }
        `,
        variables: { entityId },
    });

    return data.entity.models[0].position || null;
};

export const getPlayerOutpostSales = async (
    walletAddress: string,
    gameId: string
) => {
    const { data } = await client.query({
        query: gql`
            query GetPlayerOutpostSales(
                $walletAddress: String!
                $gameId: String!
            ) {
                outpostTradeModels(
                    where: { seller: $walletAddress, game_id: $gameId }
                ) {
                    edges {
                        node {
                            game_id
                            buyer
                            seller
                            status
                            trade_id
                            trade_type
                            offer {
                                x
                                y
                            }
                            entity {
                                createdAt
                            }
                        }
                    }
                }
            }
        `,
        variables: { walletAddress, gameId },
    });

    return data.outpostTradeModels.edges || [];
};
