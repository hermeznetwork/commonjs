const Scalar = require("ffjavascript").Scalar;
var blake = require("blakejs");

const r = Scalar.fromString("21888242871839275222246405745257275088548364400416034343698204186575808495617");

const HERMEZ_TX = "HERMEZ_TX";
const h = blake.blake2bHex(HERMEZ_TX);
const n =  Scalar.mod(Scalar.fromString(h, 16), r);

// Take the 32 less significant bits
const mask = Scalar.sub(Scalar.shl(1, 32), 1); 
const m = Scalar.band(mask, n);

console.log(m.toString());

// Result: 3322668559