const utils = require("./utils");
const Constants = require("./constants");

/**
 * @param {Object} inputs - Object containing all withdraw inputs
 * @return {Scalar} hash global inputs with sha256 % rField
 */
function hashInputsWithdraw(inputs){
    const rootStateB = 256;
    const ethAddrB = 160;
    const tokenIDB = 32;
    const exitBalanceB = 192;
    const idxB = Constants.maxNlevels;

    if (
        inputs.rootState === undefined ||
        inputs.ethAddrState === undefined ||
        inputs.tokenID === undefined ||
        inputs.exitBalance === undefined ||
        inputs.idx === undefined
    ) {
        throw new Error("Missing inputs fields on `hashInputWithdraw`");
    }

    // inputs strings hexadecimal
    let strRootState = utils.padZeros(inputs.rootState.toString("16"), rootStateB / 4);
    let strEthAddrState = utils.padZeros(inputs.ethAddrState.toString("16"), ethAddrB / 4);
    let strTokenID = utils.padZeros(inputs.tokenID.toString("16"), tokenIDB / 4);
    let strExitBalance = utils.padZeros(inputs.exitBalance.toString("16"), exitBalanceB / 4);
    let strIdx = utils.padZeros(inputs.idx.toString("16"), idxB / 4);

    // build final inputs string
    const finalStr = strRootState.concat(strEthAddrState).concat(strTokenID).concat(strExitBalance)
        .concat(strIdx);

    return utils.sha256Snark(finalStr);
}


/**
 * @param {Object} inputs - Object containing all withdraw Bjj inputs 
 * @return {Scalar} hash global inputs with sha256 % rField 
 */
function hashInputsWithdrawBjj(inputs){
    const rootStateB = 256;
    const ethAddrB = 160;
    const tokenIDB = 32;
    const exitBalanceB = 192;
    const idxB = Constants.maxNlevels;
    if (
        inputs.rootState === undefined ||
        inputs.ethAddrCaller === undefined ||
        inputs.ethAddrBeneficiary === undefined ||
        inputs.tokenID === undefined ||
        inputs.exitBalance === undefined ||
        inputs.idx === undefined
    ) {
        throw new Error("Missing inputs fields on `hashInputWithdraw`");
    }

    // inputs strings hexadecimal
    let strRootState = utils.padZeros(inputs.rootState.toString("16"), rootStateB / 4);
    let strEthAddrCaller = utils.padZeros(inputs.ethAddrCaller.toString("16"), ethAddrB / 4);
    let strEthAddrBeneficiary = utils.padZeros(inputs.ethAddrBeneficiary.toString("16"), ethAddrB / 4);
    let strTokenID = utils.padZeros(inputs.tokenID.toString("16"), tokenIDB / 4);
    let strExitBalance = utils.padZeros(inputs.exitBalance.toString("16"), exitBalanceB / 4);
    let strIdx = utils.padZeros(inputs.idx.toString("16"), idxB / 4);

    // build final inputs string
    const finalStr = strRootState.concat(strEthAddrCaller).concat(strEthAddrBeneficiary)
        .concat(strTokenID).concat(strExitBalance).concat(strIdx);
    
    return utils.sha256Snark(finalStr);
}

module.exports = {
    hashInputsWithdraw,
    hashInputsWithdrawBjj
};