const { expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;

const massiveMigrationsUtils = require("../index").massiveMigrationsUtils;

describe("Massive Migrations utils", function () {

    it("Hash inputs", async () => {
        const testVectors = [];

        testVectors.push({
            inputs: {
                stateRoot: Scalar.sub(Scalar.shl(1, 256), 1),
                ethAddr: Scalar.sub(Scalar.shl(1, 160), 1),
                tokenID: Scalar.sub(Scalar.shl(1, 32), 1),
                idx: Scalar.sub(Scalar.shl(1, 48), 1),
            },
            hashInputs: "13472656359431343880119778421286687686979219649112919375425745197586956080558",
        });

        testVectors.push({
            inputs: {
                stateRoot: Scalar.e(0),
                ethAddr: Scalar.e(0),
                tokenID: Scalar.e(0),
                idx: Scalar.e(0),
            },
            hashInputs: "13900088574673836256164243873408713741270913316374222114903316782360364470074",
        });

        // data has been retrieved from smart contract `Hermez.sol` tests
        testVectors.push({
            inputs: {
                stateRoot: Scalar.fromString("13200088145901176893595469331707638750894861633224415999890070172130678036523"),
                ethAddr: Scalar.fromString("0xc783df8a850f42e7f7e57013759c285caa701eb6", 16),
                tokenID: Scalar.e(1),
                idx: Scalar.e(256),
            },
            hashInputs: "956009209051782762853154255727320229112439265607312738357311625751530475828",
        });

        testVectors.push({
            inputs: {
                stateRoot: Scalar.fromString("19777073878055650062116128690837730234443261362783742317565719695028113749949"),
                ethAddr: Scalar.fromString("0xc783df8a850f42e7f7e57013759c285caa701eb6", 16),
                tokenID: Scalar.e(1),
                idx: Scalar.e(256),
            },
            hashInputs: "19254266995151442020142202479857869178678446934360858993236122937733995488431",
        });

        for (let i = 0; i < testVectors.length; i++){
            const { inputs, hashInputs } = testVectors[i];

            const computeHashInputs = massiveMigrationsUtils.hashInputsSetIdx(inputs);
            expect(computeHashInputs.toString()).to.be.equal(hashInputs);
        }
    });
});