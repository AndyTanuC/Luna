import Chat from "@/components/chat";
import PageTitle from "@/components/page-title";
import { apiClient } from "@/lib/api";
// import { ControllerConnector } from "@cartridge/connector";
import {
    // Connector,
    useAccount,
    useConnect,
    useDisconnect,
    useInjectedConnectors,
} from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";

// const RPC_URL = "https://api.cartridge.gg/x/starknet/sepolia";

function WalletManager() {
    const { connect } = useConnect({});
    const { connectors } = useInjectedConnectors({
        recommended: [],
        includeRecommended: "onlyIfNoConnectors",
        order: "random",
    });

    // const cartridgeConnector = new ControllerConnector({
    //     chains: [{ rpcUrl: RPC_URL }],
    // }) as never as Connector;

    if (connectors.length === 0) {
        return (
            <div className="flex flex-col items-center gap-4 w-full max-w-[240px] text-center">
                <p className="text-sm">No wallet extensions detected</p>
                <div className="flex flex-col gap-2">
                    <p className="text-xs">
                        Please install one of these wallets:
                    </p>
                    <a
                        href="https://www.argent.xyz/argent-x/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline text-sm"
                    >
                        Install Argent X
                    </a>
                    <a
                        href="https://braavos.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline text-sm"
                    >
                        Install Braavos
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-4 w-full max-w-[240px]">
            <p className="text-xs text-center">
                Please connect to a wallet to start interacting with Luna
            </p>
            <div className="flex flex-col w-full gap-4">
                {connectors.map((connector) => {
                    if (connector.id === "argentX") {
                        return (
                            <button
                                key={connector.id}
                                onClick={() => connect({ connector })}
                                className="bg-black rounded-md p-3 w-full h-[50px] flex items-center justify-center hover:opacity-90 transition-opacity"
                            >
                                <img
                                    src="/wallet-argent.png"
                                    alt="Argent"
                                    className="h-full w-auto"
                                />
                            </button>
                        );
                    }

                    if (connector.id === "braavos") {
                        return (
                            <button
                                key={connector.id}
                                onClick={() => connect({ connector })}
                                className="bg-black rounded-md p-3 w-full h-[50px] flex items-center justify-center hover:opacity-90 transition-opacity"
                            >
                                <img
                                    src="/wallet-braavos.png"
                                    alt="Braavos"
                                    className="h-full w-auto"
                                />
                            </button>
                        );
                    }
                })}
            </div>
        </div>
    );
}

export default function Home() {
    const { connector: activeConnector, status } = useAccount();
    const { disconnect } = useDisconnect();
    const query = useQuery({
        queryKey: ["agents"],
        queryFn: () => apiClient.getAgents(),
        refetchInterval: 5_000,
    });

    const agents = query?.data?.agents;
    const agent = agents?.[0];

    return (
        <div className="flex flex-col h-[100dvh]">
            <div className="flex justify-between items-center p-2 sm:p-4">
                <PageTitle title="Luna" />
                {activeConnector && (
                    <button
                        onClick={() => disconnect()}
                        className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Disconnect
                    </button>
                )}
            </div>
            {status !== "connected" && (
                <div className="flex-1 flex items-center justify-center p-4">
                    <WalletManager />
                </div>
            )}
            {status === "connected" && agent && (
                <div className="flex-1 flex">
                    <Chat agentId={agent.id} />
                </div>
            )}
        </div>
    );
}
