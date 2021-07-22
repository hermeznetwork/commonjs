const float40 = require("../../index").float40;
const Constants = require("../../index").Constants;

async function depositTx(bb, account, tokenID, loadAmount) {
    bb.addTx({
        fromIdx: 0,
        loadAmountF: float40.fix2Float(loadAmount),
        tokenID: tokenID,
        fromBjjCompressed: account.bjjCompressed,
        fromEthAddr: account.ethAddr,
        toIdx: 0,
        onChain: true
    });
}

async function depositOnlyExitTx(bb, account, tokenID, loadAmount) {
    bb.addTx({
        fromIdx: 0,
        loadAmountF: float40.fix2Float(loadAmount),
        tokenID: tokenID,
        fromBjjCompressed: Constants.onlyExitBjjCompressed,
        fromEthAddr: account.ethAddr,
        toIdx: 0,
        onChain: true
    });
}

module.exports = {
    depositTx,
    depositOnlyExitTx
};
