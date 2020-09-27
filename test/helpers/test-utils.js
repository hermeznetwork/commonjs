const float16 = require("../../index").float16;

async function depositTx(bb, account, tokenID, loadAmount) {
    bb.addTx({
        fromIdx: 0,
        loadAmountF: float16.fix2Float(loadAmount),
        tokenID: tokenID,
        fromBjjCompressed: account.bjjCompressed,
        fromEthAddr: account.ethAddr,
        toIdx: 0,
        onChain: true
    });
}

module.exports = {
    depositTx,
};