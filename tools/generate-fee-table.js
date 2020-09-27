const Scalar = require("ffjavascript").Scalar;

const bitsShiftPrecision = 79;

// feeStep = 0
function section0(){
    return 0;
}

// 1 <= feeStep <=  32
function section1(feeStep){
    const exp = -24 + feeStep/2;
    return Math.pow(10, exp);
}

// 33 <= feeStep <=  223
function section2(feeStep){
    const exp = -8 + (8/192)*(feeStep - 32);
    return Math.pow(10, exp);
}

// 224 <= feeStep <=  255
// calculated in Scalar to avoid lost precision in JS
function section3(feeStep){
    const exp = feeStep - 224;
    return Scalar.pow(10, exp);
}

function buildFeeTable(){
    const feeSteps = 256;
    const feeTable = [];

    for (let i = 0; i < feeSteps; i++){
        let feeFactor = 0;
        if (i == 0){
            feeFactor = section0();
        } else if (1 <= i && i <= 32){
            feeFactor = section1(i);
        } else if (33 <= i  && i <= 223){
            feeFactor = section2(i);
        } else if (224 <= i  && i <= 255){
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
    if (i < 224){
        adjustedTable[i] = tableDecimal[i] * 2**bitsShiftPrecision;
    } else {
        adjustedTable[i] = Scalar.shl(tableDecimal[i], bitsShiftPrecision);
    }
}

// Compute adjusted table floor
const adjustedTableFloor = new Array(256).fill(0);
for (let i = 0; i < tableDecimal.length; i++){
    if (i < 224){
        adjustedTableFloor[i] = Scalar.e(Math.floor(adjustedTable[i]));
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
    realFee[i] = (Number(adjustedTableFloor[i]) / 2**bitsShiftPrecision) * 100;
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

console.log("\n\nADJUSTED STR FLOOR TABLE");
for (let i = 0; i < strAdjustedTableFloor.length; i++){
    console.log(`FeeStep ${i}: `, strAdjustedTableFloor[i]);
    //console.log(`| ${i} | ${strAdjustedTableFloor[i]} |`);
}

console.log("\n\nREAL FEE");
for (let i = 0; i < realFee.length; i++){
    console.log(`FeeStep ${i}: `, `${realFee[i]} %`);
}

// const fs = require("fs");
// fs.writeFileSync("./table-fee.json", JSON.stringify(strAdjustedTableFloor));