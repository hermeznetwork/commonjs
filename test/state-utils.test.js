const { expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;

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
        };

        const stateArray = stateUtils.state2Array(state);
        const stateDecoded = stateUtils.array2State(stateArray);

        expect(Scalar.eq(state.tokenID, stateDecoded.tokenID)).to.be.equal(true);
        expect(Scalar.eq(state.nonce, stateDecoded.nonce)).to.be.equal(true);
        expect(Scalar.eq(state.balance, stateDecoded.balance)).to.be.equal(true);
        expect(Scalar.eq(state.sign, stateDecoded.sign)).to.be.equal(true);
        expect(state.ay).to.be.equal(stateDecoded.ay);
        expect(state.ethAddr).to.be.equal(stateDecoded.ethAddr);
    });

    it("Hash state", async () => {
        const hashState = "427583314703185075673874472431049668659591379598736964088479258544354409991";
        
        const state = {
            tokenID: 1,
            nonce: 49,
            balance: Scalar.e(12343256),
            sign: "1",
            ay: "144e7e10fd47e0c67a733643b760e80ed399f70e78ae97620dbb719579cd645d",
            ethAddr: "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
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
});