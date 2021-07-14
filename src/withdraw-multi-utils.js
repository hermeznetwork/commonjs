const utils = require("./utils");
const Constants = require("./constants");

/**
 * @param {Object} inputs - Object containing all withdraw inputs
 * @param {Number} nTokens - Number of tokens to withdraw
 * @return {Scalar} hash global inputs with sha256 % rField
 */
function hashInputsWithdrawMultiTokens(inputs, nTokens){
    const rootStateB = 256;
    const ethAddrB = 160;
    const tokenIDB = 32;
    const exitBalanceB = 192;
    const idxB = Constants.maxNlevels;

    if (
        inputs.rootState === undefined ||
        inputs.ethAddr === undefined ||
        inputs.tokenIDs === undefined ||
        inputs.exitBalances === undefined ||
        inputs.idxs === undefined
    ) {
        throw new Error("Missing inputs fields on `hashInputWithdraw`");
    } else if (
        inputs.tokenIDs.length != nTokens ||
        inputs.exitBalances.length != nTokens ||
        inputs.idxs.length != nTokens
    ) {
        throw new Error("TokensIds & ExitBalances & idxs must have the same length and length = nTokens");
    }

    // inputs strings hexadecimal
    let strRootState = utils.padZeros(inputs.rootState.toString("16"), rootStateB / 4);
    let strEthAddr = utils.padZeros(inputs.ethAddr.toString("16"), ethAddrB / 4);
    let strTokenIds = "";
    let strExitBalances = "";
    let strIdxs = "";
    for (let i = 0; i < nTokens; i++) {
        let strTokenID = utils.padZeros(inputs.tokenIDs[i].toString("16"), tokenIDB / 4);
        strTokenIds = strTokenIds.concat(strTokenID);
        let strExitBalance = utils.padZeros(inputs.exitBalances[i].toString("16"), exitBalanceB / 4);
        strExitBalances = strExitBalances.concat(strExitBalance);
        let strIdx = utils.padZeros(inputs.idxs[i].toString("16"), idxB / 4);
        strIdxs = strIdxs.concat(strIdx);
    }

    // build final inputs string
    const finalStr = strRootState.concat(strEthAddr).concat(strTokenIds).concat(strExitBalances)
        .concat(strIdxs);

    return utils.sha256Snark(finalStr);
}

module.exports = {
    hashInputsWithdrawMultiTokens,
};