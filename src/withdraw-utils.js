const utils = require("./utils");
const Constants = require("./constants");
const poseidonHash = require("circomlib").poseidon;
const Scalar = require("ffjavascript").Scalar;

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
        inputs.ethAddr === undefined ||
        inputs.tokenID === undefined ||
        inputs.exitBalance === undefined ||
        inputs.idx === undefined
    ) {
        throw new Error("Missing inputs fields on `hashInputWithdraw`");
    }

    // inputs strings hexadecimal
    let strRootState = utils.padZeros(inputs.rootState.toString("16"), rootStateB / 4);
    let strEthAddr = utils.padZeros(inputs.ethAddr.toString("16"), ethAddrB / 4);
    let strTokenID = utils.padZeros(inputs.tokenID.toString("16"), tokenIDB / 4);
    let strExitBalance = utils.padZeros(inputs.exitBalance.toString("16"), exitBalanceB / 4);
    let strIdx = utils.padZeros(inputs.idx.toString("16"), idxB / 4);

    // build final inputs string
    const finalStr = strRootState.concat(strEthAddr).concat(strTokenID).concat(strExitBalance)
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
        inputs.ethAddrSender === undefined ||
        inputs.ethAddrReciever === undefined ||
        inputs.tokenID === undefined ||
        inputs.exitBalance === undefined ||
        inputs.idx === undefined
    ) {
        throw new Error("Missing inputs fields on `hashInputWithdraw`");
    }

    // inputs strings hexadecimal
    let strRootState = utils.padZeros(inputs.rootState.toString("16"), rootStateB / 4);
    let strEthAddrSender = utils.padZeros(inputs.ethAddrSender.toString("16"), ethAddrB / 4);
    let ethAddrReciever = utils.padZeros(inputs.ethAddrReciever.toString("16"), ethAddrB / 4);
    let strTokenID = utils.padZeros(inputs.tokenID.toString("16"), tokenIDB / 4);
    let strExitBalance = utils.padZeros(inputs.exitBalance.toString("16"), exitBalanceB / 4);
    let strIdx = utils.padZeros(inputs.idx.toString("16"), idxB / 4);

    // build final inputs string
    const finalStr = strRootState.concat(strEthAddrSender).concat(ethAddrReciever)
        .concat(strTokenID).concat(strExitBalance).concat(strIdx);
    
    return utils.sha256Snark(finalStr);
}

/**
 * @param {String} ethAddrSender - Ethereum address that will be the msg.sender
 * @param {String} ethAddrReciever - Ethereum address that will recieve the withdraw
 * @return {Scalar} hash global inputs with sha256 % rField 
 */
function hashWithdrawBjjSignature(ethAddrSender, ethAddrReciever){
    const h = poseidonHash([
        Scalar.fromString(ethAddrSender || "0", 16),
        Scalar.fromString(ethAddrReciever || "0", 16),
    ]);

    return h;
}


module.exports = {
    hashInputsWithdraw,
    hashWithdrawBjjSignature,
    hashInputsWithdrawBjj
};