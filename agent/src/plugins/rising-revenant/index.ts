import { Plugin } from "@elizaos/core";
import getActiveGame from "./actions/getActiveGame";
import getBalance from "./actions/getBalance";
import getOutpost from "./actions/getOutpost";
import getOutpostAfterTrx from "./actions/getOutpostAfterTrx";
// import increaseAllowance from "./actions/increaseAllowance";
import purchaseOutpost from "./actions/purchaseOutpost";
import purchaseReinforcement from "./actions/purchaseReinforcement";
import reinforceOutpost from "./actions/reinforceOutpost";
import revokeOutpostSale from "./actions/revokeOutpostSale";
import sellOutpost from "./actions/sellOutpost";

export const risingRevenantPlugin: Plugin = {
    name: "rising-revenant",
    description: "Rising Revenant Plugin for Luna",
    actions: [
        getActiveGame,
        getBalance,
        getOutpost,
        getOutpostAfterTrx,
        // increaseAllowance,
        purchaseOutpost,
        purchaseReinforcement,
        reinforceOutpost,
        revokeOutpostSale,
        sellOutpost,
    ],
    evaluators: [],
    providers: [],
};

export default risingRevenantPlugin;
