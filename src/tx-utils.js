const Scalar = require("ffjavascript").Scalar;
const poseidonHash = require("circomlib").poseidon;
const eddsa = require("circomlib").eddsa;

const float16 = require("./float16");
const utils = require("./utils");

/**
 * Encode L1 tx data
 * @param {Object} tx - Transaction object
 * @returns {String} L1 tx data encoded as hexadecimal
 */
function encodeL1TxFull(tx) {
    const fromBjjCompressedB = 256;
    const fromEthAddrB = 160;
    const f16B = 16;
    const tokenIDB = 32;
    const idxB = 48; // MAX_NLEVELS

    const L1TxFullB = fromEthAddrB + fromBjjCompressedB + 2*idxB + tokenIDB + 2*f16B;

    let res = Scalar.e(0);
    res = Scalar.add(res, tx.toIdx || 0);
    res = Scalar.add(res, Scalar.shl(tx.tokenID || 0, idxB));
    res = Scalar.add(res, Scalar.shl(tx.amountF || 0, idxB + tokenIDB));
    res = Scalar.add(res, Scalar.shl(tx.loadAmountF || 0, idxB + tokenIDB + f16B));
    res = Scalar.add(res, Scalar.shl(tx.fromIdx || 0, idxB + tokenIDB + 2*f16B));
    res = Scalar.add(res, Scalar.shl(Scalar.fromString(tx.fromBjjCompressed || "0", 16), 2*idxB + tokenIDB + 2*f16B));
    res = Scalar.add(res, Scalar.shl(Scalar.fromString(tx.fromEthAddr || "0", 16), fromBjjCompressedB + 2*idxB + tokenIDB + 2*f16B));

    return utils.padZeros(res.toString("16"), L1TxFullB / 4);
}

/**
 * Decode L1 tx data
 * @param {String} l1TxEncoded - L1 tx data encoded as hexadecimal string
 * @returns {Object} Object representing a L1 tx 
 */
function decodeL1TxFull(l1TxEncoded) {
    const l1TxScalar = Scalar.fromString(l1TxEncoded, 16);
    const fromEthAddrB = 160;
    const fromBjjCompressedB = 256;
    const idxB = 48; // MAX_NLEVELS
    const f16B = 16;
    const tokenIDB = 32;
    let l1tx = {};

    l1tx.toIdx = Scalar.toNumber(utils.extract(l1TxScalar, 0, idxB));
    l1tx.tokenID = Scalar.toNumber(utils.extract(l1TxScalar, idxB, tokenIDB));
    l1tx.amountF = Scalar.toNumber(utils.extract(l1TxScalar, idxB + tokenIDB , f16B));
    l1tx.loadAmountF = Scalar.toNumber(utils.extract(l1TxScalar, idxB + tokenIDB + f16B, f16B));
    l1tx.fromIdx = Scalar.toNumber(utils.extract(l1TxScalar, idxB + tokenIDB + 2*f16B, idxB));
    const fromBjjCompressed =(utils.extract(l1TxScalar, 2*idxB + tokenIDB + 2*f16B, fromBjjCompressedB)).toString(16);
    l1tx.fromBjjCompressed = `0x${utils.padZeros(fromBjjCompressed.toString("16"), fromBjjCompressedB / 4)}`;
    const fromEthAddr = (utils.extract(l1TxScalar, fromBjjCompressedB + 2*idxB + tokenIDB + 2*f16B, fromEthAddrB)).toString(16);
    l1tx.fromEthAddr = `0x${utils.padZeros(fromEthAddr.toString("16"), fromEthAddrB / 4)}`;
    l1tx.onChain = true;

    return l1tx;
}

/**
 * Encode L1 coordinator tx
 * @param {Object} tx - coordinator L1 tx
 * @returns {String} L1 tx coordinator data encoded as hexadecimal 
 */
function encodeL1CoordinatorTx(tx) {
    const tokenIDB = 32;
    const fromBjjCompressedB = 256;
    const rB = 256;
    const sB = 256;
    const vB = 8;

    let res = Scalar.e(0);
    res = Scalar.add(res, tx.tokenID || 0);
    res = Scalar.add(res, Scalar.shl(Scalar.fromString(tx.fromBjjCompressed  || "0",16), tokenIDB));
    res = Scalar.add(res, Scalar.shl(Scalar.fromString(tx.r || "0", 16), fromBjjCompressedB + tokenIDB));
    res = Scalar.add(res, Scalar.shl(Scalar.fromString(tx.s || "0", 16), fromBjjCompressedB + tokenIDB + rB));
    res = Scalar.add(res, Scalar.shl(tx.v || 0, fromBjjCompressedB + tokenIDB + rB + sB));

    return utils.padZeros(res.toString("16"), (tokenIDB + fromBjjCompressedB + rB + sB + vB) / 4);
}

/**
 * Decode L1 coordiantor tx
 * @param {String} l1TxEncoded - L1 coordinaotr tx encoded as hexadecimal string
 * @returns {Object} Object representing a L1 coordinator tx 
 */
function decodeL1CoordinatorTx(l1TxEncoded) {
    const l1TxScalar = Scalar.fromString(l1TxEncoded, 16);
    const tokenIDB = 32;
    const fromBjjCompressedB = 256;
    const rB = 256;
    const sB = 256;
    const vB = 8;
    let l1tx = {};

    l1tx.tokenID = utils.extract(l1TxScalar, 0, tokenIDB);
    const fromBjjCompressed = (utils.extract(l1TxScalar, tokenIDB, fromBjjCompressedB)).toString(16);
    l1tx.fromBjjCompressed = `0x${utils.padZeros(fromBjjCompressed.toString("16"), fromBjjCompressedB / 4)}`;
    l1tx.r = (utils.extract(l1TxScalar, tokenIDB + fromBjjCompressedB , rB)).toString(16);
    l1tx.s = (utils.extract(l1TxScalar, tokenIDB + fromBjjCompressedB + rB, sB)).toString(16);
    l1tx.v = utils.extract(l1TxScalar, tokenIDB + fromBjjCompressedB + rB + sB, vB);

    return l1tx;
}

/**
 * Encode tx compressed data
 * @param {Object} tx - Transaction object
 * @returns {Scalar} Encoded tx compressed data
 */
function buildTxCompressedData(tx) {
    const signatureConstant = Scalar.fromString("3322668559");
    let res = Scalar.e(0);

    res = Scalar.add(res, signatureConstant); // SignConst --> 32 bits
    res = Scalar.add(res, Scalar.shl(tx.chainID || 0, 32)); // chainId --> 16 bits
    res = Scalar.add(res, Scalar.shl(tx.fromIdx || 0, 48)); // fromIdx --> 48 bits
    res = Scalar.add(res, Scalar.shl(tx.toIdx || 0, 96)); // toIdx --> 48 bits
    res = Scalar.add(res, Scalar.shl(float16.fix2Float(tx.amount || 0), 144)); // amounf16 --> 16 bits
    res = Scalar.add(res, Scalar.shl(tx.tokenID || 0, 160)); // tokenID --> 32 bits
    res = Scalar.add(res, Scalar.shl(tx.nonce || 0, 192)); // nonce --> 40 bits
    res = Scalar.add(res, Scalar.shl(tx.userFee || 0, 232)); // userFee --> 8 bits
    res = Scalar.add(res, Scalar.shl(tx.toBjjSign ? 1 : 0, 240)); // toBjjSign --> 1 bit

    return res;
}

/**
 * Parse encoded tx compressed data
 * @param {String} txDataEncoded - Encoded tx compressed data
 * @returns {Object} Object transaction
 */
function decodeTxCompressedData(txDataEncoded) {
    const txDataBi = Scalar.fromString(txDataEncoded);
    let txData = {};

    txData.chainID = utils.extract(txDataBi, 32, 16);
    txData.fromIdx = utils.extract(txDataBi, 48, 48);
    txData.toIdx = utils.extract(txDataBi, 96, 48);
    txData.amount = float16.float2Fix(Scalar.toNumber(utils.extract(txDataBi, 144, 16)));
    txData.tokenID = utils.extract(txDataBi, 160, 32);
    txData.nonce = utils.extract(txDataBi, 192, 40);
    txData.userFee = Scalar.toNumber(utils.extract(txDataBi, 232, 8));
    txData.toBjjSign = Scalar.isZero(utils.extract(txDataBi, 240, 1)) ? false : true;

    return txData;
}

/**
 * Encode tx compressed data v2
 * @param {Object} tx - Transaction object
 * @returns {Scalar} Encoded tx compressed data v2
 */
function buildTxCompressedDataV2(tx) {
    let res = Scalar.e(0);

    res = Scalar.add(res, tx.fromIdx || 0); // fromIdx --> 48 bits
    res = Scalar.add(res, Scalar.shl(tx.toIdx || 0, 48)); // toIdx --> 48 bits
    res = Scalar.add(res, Scalar.shl(float16.fix2Float(tx.amount || 0), 96)); // amounf16 --> 16 bits
    res = Scalar.add(res, Scalar.shl(tx.tokenID || 0, 112)); // tokenID --> 32 bits
    res = Scalar.add(res, Scalar.shl(tx.nonce || 0, 144)); // nonce --> 40 bits
    res = Scalar.add(res, Scalar.shl(tx.userFee || 0, 184)); // userFee --> 8 bits
    res = Scalar.add(res, Scalar.shl(tx.toBjjSign ? 1 : 0, 192)); // toBjjSign --> 1 bit

    return res;
}

/**
 * Parse encoded tx compressed data v2
 * @param {String} txDataEncoded - Encoded tx compressed data v2
 * @returns {Object} Object transactions
 */
function decodeTxCompressedDataV2(txDataEncoded) {
    const txDataBi = Scalar.fromString(txDataEncoded);
    let txData = {};

    txData.fromIdx = utils.extract(txDataBi, 0, 48);
    txData.toIdx = utils.extract(txDataBi, 48, 48);
    txData.amount = float16.float2Fix(Scalar.toNumber(utils.extract(txDataBi, 96, 16)));
    txData.tokenID = utils.extract(txDataBi, 112, 32);
    txData.nonce = utils.extract(txDataBi, 144, 40);
    txData.userFee = Scalar.toNumber(utils.extract(txDataBi, 184, 8));
    txData.toBjjSign = Scalar.isZero(utils.extract(txDataBi, 192, 1)) ? false : true;

    return txData;
}

/**
 * Round amount value of the transaction
 * @param {Object} tx - Transaction object
 */
function txRoundValues(tx) {
    tx.amountF = float16.fix2Float(tx.amount);
    tx.amount = float16.float2Fix(tx.amountF);
}

/**
 * Verify the transaction signature
 * @param {Object} tx - Transaction object with signature included
 * @returns {Boolean} Return true if the signature matches with the transaction sender
 */
function verifyTxSig(tx) {
    try {
        const h = buildHashSig(tx);

        const signature = {
            R8: [Scalar.e(tx.r8x), Scalar.e(tx.r8y)],
            S: Scalar.e(tx.s)
        };

        const pubKey = [Scalar.fromString(tx.fromAx, 16), Scalar.fromString(tx.fromAy, 16)];
        return eddsa.verifyPoseidon(h, signature, pubKey);
    } catch (E) {
        return false;
    }
}

/**
 * Build element_1 for L2HashSignature
 * @param {Object} tx - transaction object
 * @returns {Scalar} element_1 L2 signature
 */
function buildElement1(tx){
    let res = Scalar.e(0);

    res = Scalar.add(res, Scalar.fromString(tx.toEthAddr || "0", 16)); // ethAddr --> 160 bits
    res = Scalar.add(res, Scalar.shl(tx.maxNumBatch || 0, 160)); // maxNumBatch --> 32 bits

    return res;  
}

/**
 * Builds the message to hash
 * @param {Object} tx - Transaction object
 * @returns {Scalar} message to sign 
 */
function buildHashSig(tx){
    const txCompressedData = buildTxCompressedData(tx);
    const element1 = buildElement1(tx);    

    const h = poseidonHash([
        txCompressedData,
        element1,
        Scalar.fromString(tx.toBjjAy || "0", 16),
        Scalar.e(tx.rqTxCompressedDataV2 || 0),
        Scalar.fromString(tx.rqToEthAddr || "0", 16),
        Scalar.fromString(tx.rqToBjjAy || "0", 16),
    ]);

    return h;
}

/**
 * Encode L1 tx data availability
 * @param {Object} tx - Transaction object
 * @param {Number} nLevels - merkle tree depth
 * @returns {String} L1 tx data encoded as hexadecimal
 */
function encodeL1Tx(tx, nLevels){
    const idxB = nLevels;
    const f16B = 16;
    const userFeeB = 8; 

    const L1TxB = 2*idxB + f16B + userFeeB;

    let res = Scalar.e(0);
    res = Scalar.add(res, Scalar.e(0)); // fee for L1 transaction is 0
    res = Scalar.add(res, Scalar.shl(float16.fix2Float(tx.effectiveAmount), userFeeB));
    res = Scalar.add(res, Scalar.shl(tx.toIdx, f16B + userFeeB));
    res = Scalar.add(res, Scalar.shl(tx.fromIdx, idxB + f16B + userFeeB));

    return utils.padZeros(res.toString("16"), L1TxB / 4);
}

/**
 * Decode L1 tx data availability
 * @param {String} l1TxEncoded - L1 tx data availability encoded as hexadecimal string
 * @param {Number} nLevels - merkle tree depth
 * @returns {Object} Object representing a L1 tx 
 */
function decodeL1Tx(l1TxEncoded, nLevels){
    const l1TxScalar = Scalar.fromString(l1TxEncoded, 16);
    const idxB = nLevels;
    const f16B = 16;
    const userFeeB = 8;

    let l1Tx = {};

    l1Tx.userFee = Scalar.toNumber(utils.extract(l1TxScalar, 0, userFeeB));
    l1Tx.effectiveAmountF = Scalar.toNumber(utils.extract(l1TxScalar, userFeeB, f16B));
    l1Tx.effectiveAmount = float16.float2Fix(l1Tx.effectiveAmountF);
    l1Tx.toIdx = Scalar.toNumber(utils.extract(l1TxScalar, userFeeB + f16B, idxB));
    l1Tx.fromIdx = Scalar.toNumber(utils.extract(l1TxScalar, userFeeB + f16B + idxB, idxB));

    return l1Tx;
}

/**
 * Encode L2 tx data
 * @param {Object} tx - Transaction object
 * @param {Number} nLevels - merkle tree depth
 * @returns {String} L2 tx data encoded as hexadecimal
 */
function encodeL2Tx(tx, nLevels){
    const idxB = nLevels;
    const f16B = 16;
    const userFeeB = 8; 

    const L2TxB = 2*idxB + f16B + userFeeB;

    let res = Scalar.e(0);
    res = Scalar.add(res, tx.userFee);
    res = Scalar.add(res, Scalar.shl(float16.fix2Float(tx.amount), userFeeB));
    res = Scalar.add(res, Scalar.shl(tx.toIdx, f16B + userFeeB));
    res = Scalar.add(res, Scalar.shl(tx.fromIdx, idxB + f16B + userFeeB));

    return utils.padZeros(res.toString("16"), L2TxB / 4);
}

/**
 * Decode L2 tx data
 * @param {String} l2TxEncoded - L2 tx data encoded as hexadecimal string
 * @param {Number} nLevels - merkle tree depth
 * @returns {Object} Object representing a L2 tx 
 */
function decodeL2Tx(l2TxEncoded, nLevels){
    const l1TxScalar = Scalar.fromString(l2TxEncoded, 16);
    const idxB = nLevels;
    const f16B = 16;
    const userFeeB = 8;

    let l2tx = {};

    l2tx.userFee = Scalar.toNumber(utils.extract(l1TxScalar, 0, userFeeB));
    l2tx.amountF = Scalar.toNumber(utils.extract(l1TxScalar, userFeeB, f16B));
    l2tx.amount = float16.float2Fix(l2tx.amountF);
    l2tx.toIdx = Scalar.toNumber(utils.extract(l1TxScalar, userFeeB + f16B, idxB));
    l2tx.fromIdx = Scalar.toNumber(utils.extract(l1TxScalar, userFeeB + f16B + idxB, idxB));

    return l2tx;
}

module.exports = {
    buildTxCompressedData,
    decodeTxCompressedData,
    buildTxCompressedDataV2,
    decodeTxCompressedDataV2,
    verifyTxSig,
    txRoundValues,
    encodeL1TxFull,
    decodeL1TxFull,
    buildHashSig,
    encodeL1CoordinatorTx,
    decodeL1CoordinatorTx,
    encodeL2Tx,
    decodeL2Tx,
    encodeL1Tx,
    decodeL1Tx
};