"use client";
import React from "react";

import { mainnet, sepolia } from "@starknet-react/chains";
import {
    StarknetConfig,
    argent,
    braavos,
    publicProvider,
    useInjectedConnectors,
    voyager,
} from "@starknet-react/core";

export function StarknetProvider({ children }: { children: React.ReactNode }) {
    const { connectors } = useInjectedConnectors({
        recommended: [argent(), braavos()],
        includeRecommended: "onlyIfNoConnectors",
        order: "random",
    });

    return (
        <StarknetConfig
            chains={[mainnet, sepolia]}
            provider={publicProvider()}
            connectors={connectors}
            explorer={voyager}
        >
            {children}
        </StarknetConfig>
    );
}
