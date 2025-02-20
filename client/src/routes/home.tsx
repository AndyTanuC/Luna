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
import { useEffect, useState } from "react";

// const RPC_URL = "https://api.cartridge.gg/x/starknet/sepolia";

function WalletManager() {
    const { connect } = useConnect({});
    const { connectors } = useInjectedConnectors({
        recommended: [],
        includeRecommended: "onlyIfNoConnectors",
        order: "random",
    });
    const [showOpenEyes, setShowOpenEyes] = useState(false);
    const [showGreeting1, setShowGreeting1] = useState(false);
    const [showGreeting2, setShowGreeting2] = useState(false);
    const [showButtons, setShowButtons] = useState(false);

    useEffect(() => {
        const timer0 = setTimeout(() => setShowOpenEyes(true), 300);
        const timer1 = setTimeout(() => setShowGreeting1(true), 800);
        const timer2 = setTimeout(() => setShowGreeting2(true), 1800);
        const timer3 = setTimeout(() => setShowButtons(true), 2800);

        return () => {
            clearTimeout(timer0);
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, []);

    // const cartridgeConnector = new ControllerConnector({
    //     chains: [{ rpcUrl: RPC_URL }],
    // }) as never as Connector;

    const animateText = (text: string, show: boolean) => {
        return (
            <div className="flex h-[1.5em]">
                {text.split("").map((char, index) => (
                    <span
                        key={index}
                        className={`${
                            show ? "animate-typewriter" : "w-0"
                        } overflow-hidden opacity-0`}
                        style={{
                            animationDelay: show ? `${index * 100}ms` : "0ms",
                        }}
                    >
                        {char}
                    </span>
                ))}
            </div>
        );
    };

    if (connectors.length === 0) {
        return (
            <div className="flex flex-col items-center gap-4 w-full max-w-[240px] text-center">
                <img src="/luna_open.png" alt="Luna" className="w-64 h-64" />
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
        <div className="flex flex-col items-center gap-6 w-full max-w-[240px]">
            <div className="relative w-64 h-64">
                <img
                    src="/luna_closed.png"
                    alt="Luna"
                    className={`absolute w-full h-full transition-opacity duration-200 ${
                        showOpenEyes ? "opacity-0" : "opacity-100"
                    }`}
                />
                <img
                    src="/luna_open.png"
                    alt="Luna"
                    className={`absolute w-full h-full transition-opacity duration-200 ${
                        showOpenEyes ? "opacity-100" : "opacity-0"
                    }`}
                />
            </div>
            <div className="flex flex-col items-center gap-2">
                <div className="text-white text-lg">
                    {animateText("Hello,\u00A0Revenant.", showGreeting1)}
                </div>
                <div className="text-white text-lg">
                    {animateText("I\u00A0am\u00A0Luna.", showGreeting2)}
                </div>
            </div>

            {showButtons && (
                <div className="flex flex-col w-full gap-4 animate-slide-down">
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
            )}
        </div>
    );
}

function QuickActions() {
    const [showTitle, setShowTitle] = useState(false);
    const [showAction1, setShowAction1] = useState(false);
    const [showAction2, setShowAction2] = useState(false);
    const [showAction3, setShowAction3] = useState(false);

    useEffect(() => {
        const timer1 = setTimeout(() => setShowTitle(true), 300);
        const timer2 = setTimeout(() => setShowAction1(true), 600);
        const timer3 = setTimeout(() => setShowAction2(true), 900);
        const timer4 = setTimeout(() => setShowAction3(true), 1200);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
        };
    }, []);

    return (
        <div className="flex flex-col w-full max-w-[300px] gap-3">
            <p
                className={`text-white text-sm mb-2 ${showTitle ? "animate-slide-down" : "opacity-0"}`}
            >
                Quick Actions:
            </p>
            <button
                className={`w-full h-[50px] bg-[url('/button-frame.png')] bg-center bg-contain bg-no-repeat flex items-center justify-center text-white hover:opacity-90 transition-opacity ${
                    showAction1 ? "animate-slide-down" : "opacity-0"
                }`}
            >
                My Outposts
            </button>
            <button
                className={`w-full h-[50px] bg-[url('/button-frame.png')] bg-center bg-contain bg-no-repeat flex items-center justify-center text-white hover:opacity-90 transition-opacity ${
                    showAction2 ? "animate-slide-down" : "opacity-0"
                }`}
            >
                Game Stats
            </button>
            <button
                className={`w-full h-[50px] bg-[url('/button-frame.png')] bg-center bg-contain bg-no-repeat flex items-center justify-center text-white hover:opacity-90 transition-opacity ${
                    showAction3 ? "animate-slide-down" : "opacity-0"
                }`}
            >
                Active Trades
            </button>
        </div>
    );
}

export default function Home() {
    const [started, setIsStarted] = useState(false);
    const { connector: activeConnector, status } = useAccount();
    const { disconnect } = useDisconnect();
    const query = useQuery({
        queryKey: ["agents"],
        queryFn: () => apiClient.getAgents(),
        refetchInterval: 5_000,
    });

    const agents = query?.data?.agents;
    const agent = agents?.[0];

    const [showQuickActions, setShowQuickActions] = useState(true);
    const [isBlinking, setIsBlinking] = useState(false);

    // Add blinking effect when connected
    useEffect(() => {
        if (status === "connected") {
            const blinkTimer = setInterval(() => {
                setIsBlinking(true);
                setTimeout(() => setIsBlinking(false), 200);
            }, 4000);

            return () => clearInterval(blinkTimer);
        }
    }, [status]);

    const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setShowQuickActions(false);
    };

    if (!started) {
        return (
            <div className="flex flex-col h-[100dvh] justify-center">
                <div className="flex flex-col items-center gap-4">
                    <img
                        src="/luna_closed.png"
                        alt="Luna"
                        className="w-64 h-64"
                    />
                    <button
                        onClick={() => setIsStarted(true)}
                        className="rounded-md px-6 py-3 text-white hover:opacity-80 transition-opacity"
                    >
                        Tap to start
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen h-[100dvh]">
            <div className="flex justify-between items-center p-2 sm:p-4 shrink-0">
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
                <div className="flex flex-col flex-1 min-h-0">
                    <div className="flex flex-col items-center gap-6 p-4 shrink-0">
                        <div className="relative w-24 h-24">
                            <img
                                src="/luna_closed.png"
                                alt="Luna"
                                className={`absolute w-full h-full transition-opacity duration-200 ${
                                    isBlinking ? "opacity-100" : "opacity-0"
                                }`}
                            />
                            <img
                                src="/luna_open.png"
                                alt="Luna"
                                className={`absolute w-full h-full transition-opacity duration-200 ${
                                    isBlinking ? "opacity-0" : "opacity-100"
                                }`}
                            />
                        </div>
                        {showQuickActions && <QuickActions />}
                    </div>
                    <div className="flex-1 min-h-0">
                        <Chat
                            agentId={agent.id}
                            onSendMessage={handleSendMessage}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
