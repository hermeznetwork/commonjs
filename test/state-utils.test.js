const { expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;

const Constants = require("../index").Constants;
const stateUtils = require("../index").stateUtils;

describe("Utils", function () {

    it("Leaf state from / to array", async () => {
        const state = {
            tokenID: 1,
            nonce: 49,
            balance: Scalar.e(12343256),
            sign: 1,
            ay: "144e7e10fd47e0c67a733643b760e80ed399f70e78ae97620dbb719579cd645d",
            ethAddr: "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
            exitBalance: Scalar.e(78910),
            accumulatedHash: Scalar.e(11121314)
        };

        const stateArray = stateUtils.state2Array(state);
        const stateDecoded = stateUtils.array2State(stateArray);

        expect(Scalar.eq(state.tokenID, stateDecoded.tokenID)).to.be.equal(true);
        expect(Scalar.eq(state.nonce, stateDecoded.nonce)).to.be.equal(true);
        expect(Scalar.eq(state.balance, stateDecoded.balance)).to.be.equal(true);
        expect(Scalar.eq(state.sign, stateDecoded.sign)).to.be.equal(true);
        expect(state.ay).to.be.equal(stateDecoded.ay);
        expect(state.ethAddr).to.be.equal(stateDecoded.ethAddr);
        expect(Scalar.eq(state.exitBalance, stateDecoded.exitBalance)).to.be.equal(true);
        expect(Scalar.eq(state.accumulatedHash, stateDecoded.accumulatedHash)).to.be.equal(true);
    });

    it("Hash state", async () => {
        const hashState = "21866955965937445343918870539532641557673308466220525821695163767541598385049";

        const state = {
            tokenID: 1,
            nonce: 49,
            balance: Scalar.e(12343256),
            sign: "1",
            ay: "144e7e10fd47e0c67a733643b760e80ed399f70e78ae97620dbb719579cd645d",
            ethAddr: "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
            exitBalance: Scalar.e(78910),
            accumulatedHash: Scalar.e(11121314)
        };

        const hash = stateUtils.hashState(state);
        expect(Scalar.eq(hash, hashState)).to.be.equal(true);
    });

    it("get Ax", async () => {
        const ax = "2365417ae7f7d1929148d920b5e3d1db474bd9acd0c789ad04c8de978919ffe0";
        const ay = "19c5a1ecfd3074b5cd441cf1ec6f136c45b788b59c1a1394028f05bd8dca1ad2";
        const sign = 1;

        const resAx = stateUtils.getAx(sign, ay);

        expect(ax).to.be.equal(resAx);
    });

    it("Compute accumulatedHash", async () => {
        const testVectors = [];

        testVectors.push({
            previousHash: Scalar.e(0),
            nLevels: 16,
            tx: {
                toIdx: Scalar.sub(Scalar.shl(1, 16), 1),
                fromIdx: Scalar.sub(Scalar.shl(1, 16), 1),
                amount: Scalar.fromString("343597383670000000000000000000000000000000"), // 0xFFFFFFFFFF in float40
                userFee: Scalar.sub(Scalar.shl(1, 8), 1),
            },
            nextAccmulatedHash: "2993961035884929808181072384169205205742051482970847885461362543783060445268",
        });

        testVectors.push({
            previousHash: Scalar.e(0),
            nLevels: 32,
            tx: {
                toIdx: Scalar.sub(Scalar.shl(1, 32), 1),
                fromIdx: Scalar.sub(Scalar.shl(1, 32), 1),
                amount: Scalar.fromString("343597383670000000000000000000000000000000"), // 0xFFFFFFFFFF in float40
                userFee: Scalar.sub(Scalar.shl(1, 8), 1),
            },
            nextAccmulatedHash: "20362841926573862215069519214140397310944218102006969434206408997767832213658",
        });

        testVectors.push({
            previousHash: Scalar.e(0),
            nLevels: 32,
            tx: {
                toIdx: 0,
                fromIdx: 0,
                amount: 0,
                userFee: 0,
                auxToIdx: 0,
            },
            nextAccmulatedHash: "14744269619966411208579211824598458697587494354926760081771325075741142829156",
        });

        testVectors.push({
            previousHash: Scalar.e(0),
            nLevels: 32,
            tx: {
                toIdx: Constants.nullIdx,
                fromIdx: 1061,
                amount: Scalar.fromString("420000000000"),
                userFee: 127,
                auxToIdx: 333,
            },
            nextAccmulatedHash: "16554556163037278008794315740010979134677207255019241373008007370078365251659",
        });

        testVectors.push({
            previousHash: Scalar.e(0),
            nLevels: 32,
            tx: {
                toIdx: 256,
                fromIdx: 257,
                amount: Scalar.fromString("79000000"),
                userFee: 201,
            },
            nextAccmulatedHash: "12811856022258017950349510240770625834102074605559167883649872075697698792430",
        });

        for(let i = 0; i < testVectors.length; i++){
            const { previousHash, tx, nLevels, nextAccmulatedHash } = testVectors[i];

            const computeHash = stateUtils.computeAccumulatedHash(previousHash, tx, nLevels);
            expect(computeHash.toString()).to.be.equal(nextAccmulatedHash);
        }
    });
});