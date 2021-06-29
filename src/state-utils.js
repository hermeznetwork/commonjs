const Scalar = require("ffjavascript").Scalar;
const scalarUtils = require("ffjavascript").utils;
const poseidonHash = require("circomlib").poseidon;
const babyJub = require("circomlib").babyJub;

const utils = require("./utils");
const txUtils = require("./tx-utils");

/**
 * Encode a state object into an array
 * @param {Object} st - Merkle tree state object
 * @returns {Array} Resulting array
 */
function state2Array(st) {
    let data = Scalar.e(0);

    data = Scalar.add(data, st.tokenID); // 32 bits
    data = Scalar.add(data, Scalar.shl(st.nonce, 32)); // 40 bits
    data = Scalar.add(data, Scalar.shl(st.sign, 72)); // 1 bit

    return [
        data,
        Scalar.e(st.balance),
        Scalar.fromString(st.ay, 16),
        Scalar.fromString(st.ethAddr, 16),
        Scalar.e(st.exitBalance),
        Scalar.e(st.accumulatedHash),
    ];
}

/**
 * Parse encoded array into a state object
 * @param {Array} a - Encoded array
 * @returns {Object} Merkle tree state object
 */
function array2State(a) {
    return {
        tokenID: Scalar.toNumber(utils.extract(a[0], 0, 32)),
        nonce: Scalar.toNumber(utils.extract(a[0], 32, 40)),
        sign: Scalar.toNumber(utils.extract(a[0], 72, 1)),
        balance: Scalar.e(a[1]),
        ay: Scalar.e(a[2]).toString(16),
        ethAddr: "0x" + utils.padZeros(Scalar.e(a[3]).toString(16), 40),
        exitBalance: Scalar.e(a[4]),
        accumulatedHash: Scalar.e(a[5]),
    };
}

/**
 * Return the hash of a state object
 * @param {Object} st - Merkle tree state object
 * @returns {Scalar} Resulting poseidon hash
 */
function hashState(st) {
    return poseidonHash(state2Array(st));
}

/**
 * Build compressed babyjubjub from sign an Ay and get Ax
 * @param {Number} sign - babyjubjub sign
 * @param {String} ay - babyjubjub ay coordiante encoded as heaxadecimal string
 * @returns {String} - babyjubjub ax coordinate encoded as heaxadecimal string
 */
function getAx(sign, ay){
    const buff = scalarUtils.leInt2Buff(Scalar.fromString(ay, 16), 32);
    if (sign){
        buff[31] = buff[31] | 0x80;
    }
    const point = babyJub.unpackPoint(buff);
    return point[0].toString(16);
}

/**
 * compute accumulated hash given a tx
 * @param {Scalar} previousHash - previous accumulated hash
 * @param {Object} tx - transaction object
 * @param {Number} nLevels - merkle tree depth
 * @returns {Scalar} Next accumulated hash
 */
function computeAccumulatedHash(previousHash, tx, nLevels){
    const dataAvailability = txUtils.encodeL2Tx(tx, nLevels);
    return poseidonHash([previousHash, Scalar.fromString(dataAvailability, 16)]);
}

module.exports = {
    state2Array,
    array2State,
    hashState,
    getAx,
    computeAccumulatedHash
};