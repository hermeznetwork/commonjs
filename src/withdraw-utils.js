const utils = require("./utils");
const Constants = require("./constants");

/**
 * @param {Object} inputs - Object containing all withdraw inputs 
 * @return {Scalar} hash global inputs with sha256 % rField 
 */
function hashInputsWithdraw(inputs){
    const rootExitB = 256;
    const ethAddrB = 160;
    const tokenIDB = 32;
    const balanceB = 192;
    const idxB = Constants.maxNlevels;

    if (
        inputs.rootExit === undefined ||
        inputs.ethAddr === undefined ||
        inputs.tokenID === undefined ||
        inputs.balance === undefined ||
        inputs.idx === undefined
    ) {
        throw new Error("Missing inputs fields on `hashInputWithdraw`");
    }

    // inputs strings hexadecimal
    let strRootExit = utils.padZeros(inputs.rootExit.toString("16"), rootExitB / 4);
    let strEthAddr = utils.padZeros(inputs.ethAddr.toString("16"), ethAddrB / 4);
    let strTokenID = utils.padZeros(inputs.tokenID.toString("16"), tokenIDB / 4);
    let strBalance = utils.padZeros(inputs.balance.toString("16"), balanceB / 4);
    let strIdx = utils.padZeros(inputs.idx.toString("16"), idxB / 4);

    // build final inputs string
    const finalStr = strRootExit.concat(strEthAddr).concat(strTokenID).concat(strBalance)
        .concat(strIdx);
    
    return utils.sha256Snark(finalStr);
}

module.exports = {
    hashInputsWithdraw,
};