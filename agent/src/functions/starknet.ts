import { Contract, RpcProvider } from "starknet";
const PROVIDER_URL = process.env.STARKNET_PROVIDER_URL;
const CONTRACT_ADDRESS = process.env.STARKNET_CONTRACT_ADDRESS;
const OUTPOST_ADDRESS = process.env.STARKNET_OUTPOST_ADDRESS;
const REINFORCEMENT_ADDRESS = process.env.STARKNET_REINFORCEMENT_ADDRESS;

const provider = new RpcProvider({
    nodeUrl: PROVIDER_URL,
});

function splitUint256(value: number) {
    const maxUint128 = BigInt("0x100000000000000000000000000000000"); // 2^128
    return [BigInt(value) % maxUint128, BigInt(value) / maxUint128];
}

const initiateContract = async (address: string) => {
    const contractAbi = await provider.getClassAt(address);

    const contract = new Contract(contractAbi.abi, address, provider);

    return contract;
};

export const checkLatestBlock = async () => {
    try {
        const block = await provider.getBlockLatestAccepted();

        return block;
    } catch (error) {
        console.error(error);
    }
};

export const getLordsBalance = async (address: string) => {
    const contract = await initiateContract(CONTRACT_ADDRESS);

    const result = await contract.call("balance_of", [address]);

    return result || 0;
};

export const getOutpostAllowance = async (address: string) => {
    const contract = await initiateContract(CONTRACT_ADDRESS);

    const result = await contract.call("allowance", [address, OUTPOST_ADDRESS]);

    return result || 0;
};

export const getReinforcementAllowance = async (address: string) => {
    const contract = await initiateContract(CONTRACT_ADDRESS);

    const result = await contract.call("allowance", [
        address,
        REINFORCEMENT_ADDRESS,
    ]);

    return result || 0;
};

export async function fetchAverageBlockTime(): Promise<number> {
    const url = "https://alpha-sepolia.starknet.io/feeder_gateway/get_block";
    const numberOfBlocksToAverage = 10; // You can set the number of blocks to average
    let averageBlockTime = 60; // default block time in seconds

    try {
        // Fetch the latest block
        const latestBlockResponse = await fetch(url);
        if (!latestBlockResponse.ok) {
            throw new Error(
                `Error fetching latest block: ${latestBlockResponse.statusText}`
            );
        }

        const latestBlock = await latestBlockResponse.json();
        const latestBlockNumber = latestBlock.block_number as number;
        console.debug(`Latest Block Number: ${latestBlockNumber}`);

        let totalTime = 0;

        for (let i = 0; i < numberOfBlocksToAverage; i++) {
            // Fetch the current block
            const currentBlockResponse = await fetch(
                `${url}?blockNumber=${latestBlockNumber - i}`
            );
            if (!currentBlockResponse.ok) {
                throw new Error(
                    `Error fetching current block: ${currentBlockResponse.statusText}`
                );
            }

            const currentBlock = await currentBlockResponse.json();

            // Fetch the previous block
            const previousBlockResponse = await fetch(
                `${url}?blockNumber=${latestBlockNumber - i - 1}`
            );
            if (!previousBlockResponse.ok) {
                throw new Error(
                    `Error fetching previous block: ${previousBlockResponse.statusText}`
                );
            }

            const previousBlock = await previousBlockResponse.json();

            // Calculate block time
            const blockTime = currentBlock.timestamp - previousBlock.timestamp;
            totalTime += blockTime;
        }

        // Calculate average block time
        averageBlockTime = totalTime / numberOfBlocksToAverage;
    } catch (error) {
        console.error(error);
    }

    return averageBlockTime;
}

// Write Contract Related

export const increaseAllowance = async (amount: number) => {
    const [low, high] = splitUint256(amount);

    const tx = {
        contractAddress: CONTRACT_ADDRESS,
        calldata: [OUTPOST_ADDRESS, low.toString(), high.toString()],
        entrypoint: "approve",
        id: "increase_allowance",
        nextCalls: [],
    };

    return tx;
};
