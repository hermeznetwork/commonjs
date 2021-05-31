const utils = require("./utils");
const Constants = require("./constants");

/**
 * @param {Object} inputs - Object containing all set-idx inputs
 * @return {Scalar} hash global inputs with sha256 % rField
 */
 function hashInputsSetIdx(inputs){
    const stateRootB = 256;
    const ethAddrB = 160;
    const tokenIDB = 32;
    const idxB = Constants.maxNlevels;

    if (
        inputs.stateRoot === undefined ||
        inputs.ethAddr === undefined ||
        inputs.tokenID === undefined ||
        inputs.idx === undefined
    ) {
        throw new Error("Missing inputs fields on `hashInputSetIdx`");
    }

    // inputs strings hexadecimal
    let strStateRoot = utils.padZeros(inputs.stateRoot.toString("16"), stateRootB / 4);
    let strEthAddr = utils.padZeros(inputs.ethAddr.toString("16"), ethAddrB / 4);
    let strTokenID = utils.padZeros(inputs.tokenID.toString("16"), tokenIDB / 4);
    let strIdx = utils.padZeros(inputs.idx.toString("16"), idxB / 4);

    // build final inputs string
    const finalStr = strStateRoot.concat(strEthAddr).concat(strTokenID).concat(strIdx);

    return utils.sha256Snark(finalStr);
}

module.exports = {
    hashInputsSetIdx,
};