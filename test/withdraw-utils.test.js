const { expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;

const withdrawUtils = require("../index").withdrawUtils;

describe("Withdraw utils", function () {

    it("Hash inputs", async () => {
        const testVectors = [];

        testVectors.push({
            inputs: {
                rootState: Scalar.sub(Scalar.shl(1, 256), 1),
                ethAddr: Scalar.sub(Scalar.shl(1, 160), 1),
                tokenID: Scalar.sub(Scalar.shl(1, 32), 1),
                exitBalance: Scalar.sub(Scalar.shl(1, 192), 1),
                idx: Scalar.sub(Scalar.shl(1, 48), 1),
            },
            hashInputs: "15778360871549529117008120181949376962235627539756254096366101295965345284997",
        });

        testVectors.push({
            inputs: {
                rootState: Scalar.e(0),
                ethAddr: Scalar.e(0),
                tokenID: Scalar.e(0),
                exitBalance: Scalar.e(0),
                idx: Scalar.e(0),
            },
            hashInputs: "2947191321456247468500536442667528073422395474054880626898411652320224760326",
        });

        // data has been retrieved from smart contract `Hermez.sol` tests
        testVectors.push({
            inputs: {
                rootState: Scalar.fromString("13200088145901176893595469331707638750894861633224415999890070172130678036523"),
                ethAddr: Scalar.fromString("0xc783df8a850f42e7f7e57013759c285caa701eb6", 16),
                tokenID: Scalar.e(1),
                exitBalance: Scalar.e(10),
                idx: Scalar.e(256),
            },
            hashInputs: "2460886625247102446886849565021853492292893192215227925476037055211441186909",
        });

        testVectors.push({
            inputs: {
                rootState: Scalar.fromString("19777073878055650062116128690837730234443261362783742317565719695028113749949"),
                ethAddr: Scalar.fromString("0xc783df8a850f42e7f7e57013759c285caa701eb6", 16),
                tokenID: Scalar.e(1),
                exitBalance: Scalar.e(10),
                idx: Scalar.e(256),
            },
            hashInputs: "16156768620914124825192675433853783412642934703585261543172402974275274063611",
        });

        for (let i = 0; i < testVectors.length; i++){
            const { inputs, hashInputs } = testVectors[i];

            const computeHashInputs = withdrawUtils.hashInputsWithdraw(inputs);
            expect(computeHashInputs.toString()).to.be.equal(hashInputs);
        }
    });
    
    it("Hash inputs withdraw bjj", async () => {
        const testVectors = [];
        testVectors.push({
            inputs: {
                rootState: Scalar.sub(Scalar.shl(1, 256), 1),
                ethAddrCaller: Scalar.sub(Scalar.shl(1, 160), 1),
                ethAddrBeneficiary: Scalar.sub(Scalar.shl(1, 160), 1),
                tokenID: Scalar.sub(Scalar.shl(1, 32), 1),
                exitBalance: Scalar.sub(Scalar.shl(1, 192), 1),
                idx: Scalar.sub(Scalar.shl(1, 48), 1),
            },
            hashInputs: "11643042532268778702594508118130492875243250744883041983982601517308832748201",
        });

        testVectors.push({
            inputs: {
                rootState: Scalar.e(0),
                ethAddrCaller: Scalar.e(0),
                ethAddrBeneficiary: Scalar.e(0),
                tokenID: Scalar.e(0),
                exitBalance: Scalar.e(0),
                idx: Scalar.e(0),
            },
            hashInputs: "2020446893782515759367120463867252626807267720013729371513734555780637187092",
        });

        testVectors.push({
            inputs: {
                rootState: Scalar.fromString("13200088145901176893595469331707638750894861633224415999890070172130678036523"),
                ethAddrCaller: Scalar.fromString("0xc783df8a850f42e7f7e57013759c285caa701eb6", 16),
                ethAddrBeneficiary: Scalar.fromString("0xc783df8a850f42e7f7e57013759c285caa701eb6", 16),
                tokenID: Scalar.e(1),
                exitBalance: Scalar.e(10),
                idx: Scalar.e(256),
            },
            hashInputs: "2397439606223957392220631942442932452686865575023685321224435937511459553583",
        });

        testVectors.push({
            inputs: {
                rootState: Scalar.fromString("19777073878055650062116128690837730234443261362783742317565719695028113749949"),
                ethAddrCaller: Scalar.fromString("0xc783df8a850f42e7f7e57013759c285caa701eb6", 16),
                ethAddrBeneficiary: Scalar.fromString("0xc783df8a850f42e7f7e57013759c285caa701eb6", 16),
                tokenID: Scalar.e(1),
                exitBalance: Scalar.e(10),
                idx: Scalar.e(256),
            },
            hashInputs: "6342191461254665446259269042703994688139881001178976119436159488034688112374",
        });

        for (let i = 0; i < testVectors.length; i++){
            const { inputs, hashInputs } = testVectors[i];

            const computeHashInputs = withdrawUtils.hashInputsWithdrawBjj(inputs);
            expect(computeHashInputs.toString()).to.be.equal(hashInputs);
        }
    });
});