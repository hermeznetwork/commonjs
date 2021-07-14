const { expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;

const withdrawMultiUtils = require("../index").withdrawMultiUtils;

describe("Withdraw Multi Tokens utils", function () {

    it("Hash inputs", async () => {
        const testVectors1 = [];

        testVectors1.push({
            inputs: {
                rootState: Scalar.sub(Scalar.shl(1, 256), 1),
                ethAddr: Scalar.sub(Scalar.shl(1, 160), 1),
                tokenIDs: [Scalar.sub(Scalar.shl(1, 32), 1)],
                exitBalances: [Scalar.sub(Scalar.shl(1, 192), 1)],
                idxs: [Scalar.sub(Scalar.shl(1, 48), 1)],
            },
            hashInputs: "15778360871549529117008120181949376962235627539756254096366101295965345284997",
        });

        testVectors1.push({
            inputs: {
                rootState: Scalar.e(0),
                ethAddr: Scalar.e(0),
                tokenIDs: [Scalar.e(0)],
                exitBalances: [Scalar.e(0)],
                idxs: [Scalar.e(0)],
            },
            hashInputs: "2947191321456247468500536442667528073422395474054880626898411652320224760326",
        });

        for (let i = 0; i < testVectors1.length; i++){
            const { inputs, hashInputs } = testVectors1[i];

            const computeHashInputs = withdrawMultiUtils.hashInputsWithdrawMultiTokens(inputs, 1);
            expect(computeHashInputs.toString()).to.be.equal(hashInputs);
        }

        const testVectors2 = [];

        testVectors2.push({
            inputs: {
                rootState: Scalar.sub(Scalar.shl(1, 256), 1),
                ethAddr: Scalar.sub(Scalar.shl(1, 160), 1),
                tokenIDs: [Scalar.sub(Scalar.shl(1, 32), 1), Scalar.sub(Scalar.shl(1, 32), 1)],
                exitBalances: [Scalar.sub(Scalar.shl(1, 192), 1), Scalar.sub(Scalar.shl(1, 192), 1)],
                idxs: [Scalar.sub(Scalar.shl(1, 48), 1), Scalar.sub(Scalar.shl(1, 48), 1)],
            },
            hashInputs: "21598614980877984659058368457980587349328796911536701473196229816257707744909",
        });

        testVectors2.push({
            inputs: {
                rootState: Scalar.e(0),
                ethAddr: Scalar.e(0),
                tokenIDs: [Scalar.e(0), Scalar.e(0)],
                exitBalances: [Scalar.e(0), Scalar.e(0)],
                idxs: [Scalar.e(0), Scalar.e(0)],
            },
            hashInputs: "6369501188531471175049099961257430146056743546541173376718633462751207466317",
        });

        // // data has been retrieved from smart contract `Hermez.sol` tests
        // testVectors.push({
        //     inputs: {
        //         rootState: Scalar.fromString(""),
        //         ethAddr: Scalar.fromString("0xc783df8a850f42e7f7e57013759c285caa701eb6", 16),
        //         tokenIDs: [Scalar.e(1), Scalar.e(2)],
        //         exitBalances: [Scalar.e(10), Scalar.e(20)],
        //         idxs: [Scalar.e(256), Scalar.e(257)],
        //     },
        //     hashInputs: "",
        // });

        // testVectors.push({
        //     inputs: {
        //         rootState: Scalar.fromString(""),
        //         ethAddr: Scalar.fromString("0xc783df8a850f42e7f7e57013759c285caa701eb6", 16),
        //         tokenIDs: [Scalar.e(1), Scalar.e(2)],
        //         exitBalances: [Scalar.e(10), Scalar.e(20)],
        //         idxs: [Scalar.e(256), Scalar.e(257)],
        //     },
        //     hashInputs: "",
        // });

        for (let i = 0; i < testVectors2.length; i++){
            const { inputs, hashInputs } = testVectors2[i];

            const computeHashInputs = withdrawMultiUtils.hashInputsWithdrawMultiTokens(inputs, 2);
            expect(computeHashInputs.toString()).to.be.equal(hashInputs);
        }
    });
});