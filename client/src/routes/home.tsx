import Chat from "@/components/chat";
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
import { AnimatePresence, motion } from "framer-motion";
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
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        const timer0 = setTimeout(() => setShowOpenEyes(true), 300);
        const timer1 = setTimeout(() => setShowGreeting1(true), 800);
        const timer2 = setTimeout(() => setShowGreeting2(true), 1800);
        const timer3 = setTimeout(() => setShowButtons(true), 2800);
        const timer4 = setTimeout(() => setShowContent(true), 500);

        return () => {
            clearTimeout(timer0);
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
        };
    }, []);

    // const cartridgeConnector = new ControllerConnector({
    //     chains: [{ rpcUrl: RPC_URL }],
    // }) as never as Connector;

    if (connectors.length === 0) {
        return (
            <div className="flex flex-col items-center gap-4 w-full max-w-[240px] text-center">
                <img src="/luna_open.png" alt="Luna" className="w-64 h-64" />
                {showContent && (
                    <>
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
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-6 w-full max-w-[240px]">
            <div className="relative w-64 h-64">
                <AnimatePresence>
                    {!showOpenEyes && (
                        <motion.img
                            src="/luna_closed.png"
                            alt="Luna"
                            className="absolute w-full h-full"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1 }}
                        />
                    )}
                    {showOpenEyes && (
                        <motion.img
                            src="/luna_open.png"
                            alt="Luna"
                            className="absolute w-full h-full"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1 }}
                        />
                    )}
                </AnimatePresence>
            </div>
            <div className="flex flex-col items-center gap-2">
                <motion.div
                    className="text-white text-lg"
                    initial={{ opacity: 0 }}
                    animate={showGreeting1 ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <motion.span
                        initial={{ width: 0 }}
                        animate={
                            showGreeting1 ? { width: "auto" } : { width: 0 }
                        }
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="inline-block whitespace-nowrap overflow-hidden"
                    >
                        Hello, Revenant.
                    </motion.span>
                </motion.div>
                <motion.div
                    className="text-white text-lg"
                    initial={{ opacity: 0 }}
                    animate={showGreeting2 ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <motion.span
                        initial={{ width: 0 }}
                        animate={
                            showGreeting2 ? { width: "auto" } : { width: 0 }
                        }
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="inline-block whitespace-nowrap overflow-hidden"
                    >
                        I am Luna.
                    </motion.span>
                </motion.div>
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
                                    className="w-full h-[50px] bg-[url('/login-button-frame.png')] bg-center bg-contain bg-no-repeat flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                                >
                                    Login Now
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
        <div className="flex flex-col items-center w-full gap-3">
            <p
                className={`text-white text-sm mb-2 ${showTitle ? "animate-slide-down" : "opacity-0"}`}
            >
                Quick Actions:
            </p>
            <div className="flex flex-col w-full max-w-[300px] gap-3">
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
        <div className="flex flex-col h-[100dvh]">
            <div className="relative flex flex-col items-center p-2 sm:p-4 shrink-0">
                {activeConnector && (
                    <button
                        onClick={() => disconnect()}
                        className="absolute top-2 right-4 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Log out
                    </button>
                )}
                {status === "connected" && (
                    <div className="relative w-24 h-24">
                        <AnimatePresence>
                            {isBlinking && (
                                <motion.img
                                    src="/luna_closed.png"
                                    alt="Luna"
                                    className="absolute w-full h-full"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                />
                            )}
                            {!isBlinking && (
                                <motion.img
                                    src="/luna_open.png"
                                    alt="Luna"
                                    className="absolute w-full h-full"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                />
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
            {status !== "connected" && (
                <div className="flex-1 flex items-center justify-center p-4">
                    <WalletManager />
                </div>
            )}
            {status === "connected" && agent && (
                <div className="flex flex-col flex-1">
                    {showQuickActions && (
                        <div className="flex flex-col items-center p-4 gap-4 shrink-0">
                            <QuickActions />
                        </div>
                    )}
                    <div className="relative flex-1">
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
