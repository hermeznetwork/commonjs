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

        // data has been retrieved from smart contract `Hermez.sol` tests
        testVectors1.push({
            inputs: {
                rootState: Scalar.fromString("13200088145901176893595469331707638750894861633224415999890070172130678036523"),
                ethAddr: Scalar.fromString("0xc783df8a850f42e7f7e57013759c285caa701eb6", 16),
                tokenIDs: [Scalar.e(1)],
                exitBalances: [Scalar.e(10)],
                idxs: [Scalar.e(256)],
            },
            hashInputs: "2460886625247102446886849565021853492292893192215227925476037055211441186909",
        });

        testVectors1.push({
            inputs: {
                rootState: Scalar.fromString("19777073878055650062116128690837730234443261362783742317565719695028113749949"),
                ethAddr: Scalar.fromString("0xc783df8a850f42e7f7e57013759c285caa701eb6", 16),
                tokenIDs: [Scalar.e(1)],
                exitBalances: [Scalar.e(10)],
                idxs: [Scalar.e(256)],
            },
            hashInputs: "16156768620914124825192675433853783412642934703585261543172402974275274063611",
        });

        // data has been retrieved from smart contract `HermezV2.sol` tests
        testVectors1.push({
            inputs: {
                rootState: Scalar.fromString("21751474315316766652697882906935923777724758492971736302052331043358381016813"),
                ethAddr: Scalar.fromString("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 16),
                tokenIDs: [Scalar.e(1)],
                exitBalances: [Scalar.e(5)],
                idxs: [Scalar.e(256)],
            },
            hashInputs: "21348381685534899521377713807454200542276390688050508760702644118922964316540",
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

        // data has been retrieved from smart contract `HermezV2.sol` tests
        testVectors2.push({
            inputs: {
                rootState: Scalar.fromString("9561455911863943647035735969434514879444005082005701880863786638933188198191"),
                ethAddr: Scalar.fromString("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 16),
                tokenIDs: [Scalar.e(1), Scalar.e(2)],
                exitBalances: [Scalar.e(25), Scalar.e(50)],
                idxs: [Scalar.e(256), Scalar.e(257)],
            },
            hashInputs: "9591707768959262926161397393483712555786517185768458065545955522091189687067",
        });

        for (let i = 0; i < testVectors2.length; i++){
            const { inputs, hashInputs } = testVectors2[i];

            const computeHashInputs = withdrawMultiUtils.hashInputsWithdrawMultiTokens(inputs, 2);
            expect(computeHashInputs.toString()).to.be.equal(hashInputs);
        }

        const testVectors3 = [];

        testVectors3.push({
            inputs: {
                rootState: Scalar.sub(Scalar.shl(1, 256), 1),
                ethAddr: Scalar.sub(Scalar.shl(1, 160), 1),
                tokenIDs: [Scalar.sub(Scalar.shl(1, 32), 1), Scalar.sub(Scalar.shl(1, 32), 1), Scalar.sub(Scalar.shl(1, 32), 1)],
                exitBalances: [Scalar.sub(Scalar.shl(1, 192), 1), Scalar.sub(Scalar.shl(1, 192), 1), Scalar.sub(Scalar.shl(1, 192), 1)],
                idxs: [Scalar.sub(Scalar.shl(1, 48), 1), Scalar.sub(Scalar.shl(1, 48), 1), Scalar.sub(Scalar.shl(1, 48), 1)],
            },
            hashInputs: "15790912017113763891857051264314971529698344910715913103566995115274191285993",
        });

        testVectors3.push({
            inputs: {
                rootState: Scalar.e(0),
                ethAddr: Scalar.e(0),
                tokenIDs: [Scalar.e(0), Scalar.e(0), Scalar.e(0)],
                exitBalances: [Scalar.e(0), Scalar.e(0), Scalar.e(0)],
                idxs: [Scalar.e(0), Scalar.e(0), Scalar.e(0)],
            },
            hashInputs: "3216157236439478198685876019816103142529866021141577307300190912490131294353",
        });

        // data has been retrieved from smart contract `HermezV2.sol` tests
        testVectors3.push({
            inputs: {
                rootState: Scalar.fromString("12027803346469967569761533028350715475936295455114133350857285531171514749429"),
                ethAddr: Scalar.fromString("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 16),
                tokenIDs: [Scalar.e(1), Scalar.e(2), Scalar.e(3)],
                exitBalances: [Scalar.e(25), Scalar.e(50), Scalar.e(25)],
                idxs: [Scalar.e(256), Scalar.e(257), Scalar.e(258)],
            },
            hashInputs: "3491950391434434736609064181613889138150779654476958033173694132101066493231",
        });

        for (let i = 0; i < testVectors3.length; i++){
            const { inputs, hashInputs } = testVectors3[i];

            const computeHashInputs = withdrawMultiUtils.hashInputsWithdrawMultiTokens(inputs, 3);
            expect(computeHashInputs.toString()).to.be.equal(hashInputs);
        }

        const testVectors4 = [];

        testVectors4.push({
            inputs: {
                rootState: Scalar.sub(Scalar.shl(1, 256), 1),
                ethAddr: Scalar.sub(Scalar.shl(1, 160), 1),
                tokenIDs: [Scalar.sub(Scalar.shl(1, 32), 1), Scalar.sub(Scalar.shl(1, 32), 1), Scalar.sub(Scalar.shl(1, 32), 1), Scalar.sub(Scalar.shl(1, 32), 1)],
                exitBalances: [Scalar.sub(Scalar.shl(1, 192), 1), Scalar.sub(Scalar.shl(1, 192), 1), Scalar.sub(Scalar.shl(1, 192), 1), Scalar.sub(Scalar.shl(1, 192), 1)],
                idxs: [Scalar.sub(Scalar.shl(1, 48), 1), Scalar.sub(Scalar.shl(1, 48), 1), Scalar.sub(Scalar.shl(1, 48), 1), Scalar.sub(Scalar.shl(1, 48), 1)],
            },
            hashInputs: "8414220615499328454566122564997969436707700697104334166012549872147226330593",
        });

        testVectors4.push({
            inputs: {
                rootState: Scalar.e(0),
                ethAddr: Scalar.e(0),
                tokenIDs: [Scalar.e(0), Scalar.e(0), Scalar.e(0), Scalar.e(0)],
                exitBalances: [Scalar.e(0), Scalar.e(0), Scalar.e(0), Scalar.e(0)],
                idxs: [Scalar.e(0), Scalar.e(0), Scalar.e(0), Scalar.e(0)],
            },
            hashInputs: "15342705619514134256877404778922440463966161875109463112865709789760869100738",
        });

        // data has been retrieved from smart contract `HermezV2.sol` tests
        testVectors4.push({
            inputs: {
                rootState: Scalar.fromString("16471487336663764955476459003196782406396780162073565271464820707413001416579"),
                ethAddr: Scalar.fromString("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 16),
                tokenIDs: [Scalar.e(1), Scalar.e(2), Scalar.e(3), Scalar.e(4)],
                exitBalances: [Scalar.e(25), Scalar.e(50), Scalar.e(25), Scalar.e(50)],
                idxs: [Scalar.e(256), Scalar.e(257), Scalar.e(258), Scalar.e(259)],
            },
            hashInputs: "1106951918443281709282875456005307283342673022777003068551488511025245160133",
        });

        for (let i = 0; i < testVectors4.length; i++){
            const { inputs, hashInputs } = testVectors4[i];

            const computeHashInputs = withdrawMultiUtils.hashInputsWithdrawMultiTokens(inputs, 4);
            expect(computeHashInputs.toString()).to.be.equal(hashInputs);
        }
    });
});