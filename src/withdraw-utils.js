const Scalar = require("ffjavascript").Scalar;

const utils = require("./utils");
const Constants = require("./constants");
const eddsa = require("circomlib").eddsa;
const poseidonHash = require("circomlib").poseidon;

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

/**
 * @param {String} ethAddrCallerAuth - thereum address that will call the smart contract
 * @param {String} ethAddrBeneficiary - Ethereum address that will recieve the withdraw
 * @param {String} rootState - State root of where with withdraw take place
 * @param {Scalar} idx - Index leaf of the withdraw account
 * @return {Scalar} poseidon hash of signature parameters
 */
function hashWithdrawBjjSignature(ethAddrCallerAuth, ethAddrBeneficiary, rootState, idx){
    const h = poseidonHash([
        Scalar.fromString(ethAddrCallerAuth || "0", 16),
        Scalar.fromString(ethAddrBeneficiary || "0", 16),
        rootState,
        idx
    ]);

    return h;
}

/**
 * Verify the transaction signature of a withdraw bjj
 * @param {String} ethAddrCallerAuth - thereum address that will call the smart contract
 * @param {String} ethAddrBeneficiary - Ethereum address that will recieve the withdraw
 * @param {Scalar} rootState - State root of where with withdraw take place
 * @param {Scalar} idx - Index leaf of the withdraw account
 * @param {Object} hermezAccount - Hermez account object that sign the withdraw bjj
 * @param {Object} signature Signature parameters
 * @returns {Boolean} Return true if the verification is correct
 */
function verifyWithdrawBjjSig(ethAddrCallerAuth, ethAddrBeneficiary, rootState, idx, hermezAccount, signature){
    const h = hashWithdrawBjjSignature(ethAddrCallerAuth, ethAddrBeneficiary, rootState, idx);
    const pubKey = [Scalar.fromString(hermezAccount.ax, 16), Scalar.fromString(hermezAccount.ay, 16)];
    return eddsa.verifyPoseidon(h, signature, pubKey);
}

module.exports = {
    hashInputsWithdraw,
    hashInputsWithdrawBjj,
    hashWithdrawBjjSignature,
    verifyWithdrawBjjSig
};