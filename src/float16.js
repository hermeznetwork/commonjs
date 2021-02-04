const Scalar = require("ffjavascript").Scalar;
const utils = require("./utils");

/**
 * Convert a float to a fix
 * @param {Scalar} fl - Scalar encoded in float
 * @returns {Scalar} Scalar encoded in fix
 */
function float2Fix(fl) {
    const flScalar = Scalar.e(fl);

    const m = utils.extract(flScalar, 0, 35);
    const e = utils.extract(flScalar, 35, 5);

    const exp = Scalar.pow(10, e);

    return Scalar.mul(m, exp);
}

/**
 * Convert a fix to a float, always rounding down
 * @param {String} _f - Scalar encoded in fix
 * @returns {Scalar} Scalar encoded in float
 */
function _floorFix2Float(_f) {
    const f = Scalar.e(_f);
    if (Scalar.isZero(f)) return 0;

    let m = f;
    let e = 0;

    while (!Scalar.isZero(Scalar.shr(m, 10))) {
        m = Scalar.div(m, 10);
        e++;
    }

    const res = Scalar.toNumber(m) + (e << 11);
    return res;
}

/**
 * Convert a fix to a float 
 * @param {String} _f - Scalar encoded in fix
 * @returns {Scalar} Scalar encoded in float
 */
function fix2Float(_f) {
    const f = Scalar.e(_f);

    function dist(n1, n2) {
        const tmp = Scalar.sub(n1, n2);

        return Scalar.abs(tmp);
    }

    const fl1 = _floorFix2Float(f);
    const fi1 = float2Fix(fl1);
    const fl2 = fl1 | 0x400;
    const fi2 = float2Fix(fl2);

    let m3 = (fl1 & 0x3FF) + 1;
    let e3 = (fl1 >> 11);
    if (m3 == 0x400) {
        m3 = 0x66; // 0x400 / 10
        e3++;
    }
    const fl3 = m3 + (e3 << 11);
    const fi3 = float2Fix(fl3);

    let res = fl1;
    let d = dist(fi1, f);

    let d2 = dist(fi2, f);
    if (Scalar.gt(d, d2)) {
        res = fl2;
        d = d2;
    }

    let d3 = dist(fi3, f);
    if (Scalar.gt(d, d3)) {
        res = fl3;
    }

    return res;
}

/**
 * Convert a float to a fix, always rounding down
 * @param {Scalar} fl - Scalar encoded in float
 * @returns {Scalar} Scalar encoded in fix
 */
function floorFix2Float(_f){
    const f = Scalar.e(_f);

    const fl1 = _floorFix2Float(f);
    const fl2 = fl1 | 0x400;
    const fi2 = float2Fix(fl2);

    if (Scalar.leq(fi2, f)){
        return fl2;
    } else {
        return fl1;
    }
}

/**
 * Round large integer by encode-decode in float16 encoding
 * @param {Scalar} fix
 * @returns {Scalar} fix rounded 
 */
function round(fix){
    return float2Fix(fix2Float(fix));
}


module.exports = {
    fix2Float,
    float2Fix,
    floorFix2Float,
    round
};