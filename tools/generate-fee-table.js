const Scalar = require("ffjavascript").Scalar;
const bitsShiftPrecision = 60;

// helpers
function getLinearStep(min, max, steps){
    return (max - min) / steps;
}

// Compute equations for each section
////////
// Section 1
const minExp_s1 = -60;
const maxExp_s1 = -8;
const numSteps_s1 = 32;
const firstIndex_s1 = 0; 
const stepExp_s1 = getLinearStep(minExp_s1, maxExp_s1, numSteps_s1);

function eqExponent_s1(feeStep){
    return minExp_s1 + (feeStep - firstIndex_s1)*stepExp_s1;
}

// Section 2
const minExp_s2 = -8;
const maxExp_s2 = 0;
const numSteps_s2 = 160;
const firstIndex_s2 = 32; 
const stepExp_s2 = getLinearStep(minExp_s2, maxExp_s2, numSteps_s2);

function eqExponent_s2(feeStep){
    return minExp_s2 + (feeStep - firstIndex_s2)*stepExp_s2;
}

// Section 3
const minExp_s3 = 0;
const maxExp_s3 = 63;
const numSteps_s3 = 63;
const firstIndex_s3 = 192; 
const stepExp_s3 = getLinearStep(minExp_s3, maxExp_s3, numSteps_s3);

function eqExponent_s3(feeStep){
    return minExp_s3 + (feeStep - firstIndex_s3)*stepExp_s3;
}

// Compute feeFactor for each feeStep
////////
// feeStep = 0
function section0(){
    return 0;
}

// 1 <= feeStep <=  31
function section1(feeStep){
    const exponent = eqExponent_s1(feeStep);
    return Math.pow(2, exponent);
}

// 33 <= feeStep <= 191
function section2(feeStep){
    const exponent = eqExponent_s2(feeStep);
    return Math.pow(2, exponent);
}

// 192 <= feeStep <= 255
function section3(feeStep){
    const exponent = eqExponent_s3(feeStep);
    return Math.pow(2, exponent);
}

function buildFeeTable(){
    const feeSteps = 256;
    const feeTable = [];

    for (let i = 0; i < feeSteps; i++){
        let feeFactor = 0;
        if (i == 0){
            feeFactor = section0();
        } else if (1 <= i && i <= 31){
            feeFactor = section1(i);
        } else if (32 <= i && i <= 191){
            feeFactor = section2(i);
        } else if (192 <= i && i <= 255){
            feeFactor = section3(i);
        }
        feeTable.push(feeFactor);
    }
    return feeTable;
}

const tableDecimal = buildFeeTable();

// Compute adjusted table
const adjustedTable = new Array(256).fill(0);
for (let i = 0; i < tableDecimal.length; i++){
    if (i < firstIndex_s3){
        adjustedTable[i] = tableDecimal[i] * 2**bitsShiftPrecision;
    } else {
        adjustedTable[i] = tableDecimal[i];
    }
}

// Compute adjusted table floor
const adjustedTableFloor = new Array(256).fill(0);
for (let i = 0; i < tableDecimal.length; i++){
    if (i < firstIndex_s3){
        adjustedTableFloor[i] = Math.floor(adjustedTable[i]);
    } else {
        adjustedTableFloor[i] = adjustedTable[i];
    }
}

// Compute string adjusted table floor
const strAdjustedTableFloor = [];
for (let i = 0; i < tableDecimal.length; i++){
    strAdjustedTableFloor[i] = Scalar.e(adjustedTableFloor[i]).toString();
}

// Compute real fee table
const realFee = new Array(16).fill(0);
for (let i = 0; i < tableDecimal.length; i++){ 
    if (i < firstIndex_s3){
        realFee[i] = (adjustedTableFloor[i] / 2**bitsShiftPrecision) * 100;
    } else {
        realFee[i] = adjustedTableFloor[i] * 100;
    }
}

console.log("\n\nFEE APPLIED");
for (let i = 0; i < tableDecimal.length; i++){
    console.log(`FeeStep ${i}: `, tableDecimal[i]);
}

console.log("\n\nADJUSTED TABLE");
for (let i = 0; i < adjustedTable.length; i++){
    console.log(`FeeStep ${i}: `, adjustedTable[i]);
}

console.log("\n\nADJUSTED FLOOR TABLE");
for (let i = 0; i < adjustedTableFloor.length; i++){
    console.log(`FeeStep ${i}: `, adjustedTableFloor[i]);
}

// console.log("\n\nADJUSTED STR FLOOR TABLE");
// for (let i = 0; i < strAdjustedTableFloor.length; i++){
//     console.log(`FeeStep ${i}: `, strAdjustedTableFloor[i]);
//     //console.log(`| ${i} | ${strAdjustedTableFloor[i]} |`);
// }

console.log("\n\nREAL FEE");
for (let i = 0; i < realFee.length; i++){
    console.log(`FeeStep ${i}: `, `${realFee[i]} %`);
}

const fs = require("fs");
fs.writeFileSync("./table-fee.json", JSON.stringify(strAdjustedTableFloor));