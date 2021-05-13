const { expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;
const ethers = require("ethers");

const txUtils = require("../index").txUtils;
const float40 = require("../index").float40;
const Constants = require("../index").Constants;

describe("Tx-utils", function () {

    it("tx compressed data", async () => {
        const tx = {
            chainID: 1,
            fromIdx: 2,
            toIdx: 3,
            tokenID: 5,
            nonce: 6,
            toBjjSign: true
        };

        const txData = `0x${txUtils.buildTxCompressedData(tx).toString(16)}`;
        const txDataDecoded = txUtils.decodeTxCompressedData(txData);

        expect(Scalar.eq(tx.chainID, txDataDecoded.chainID)).to.be.equal(true);
        expect(Scalar.eq(tx.fromIdx, txDataDecoded.fromIdx)).to.be.equal(true);
        expect(Scalar.eq(tx.toIdx, txDataDecoded.toIdx)).to.be.equal(true);
        expect(Scalar.eq(tx.tokenID, txDataDecoded.tokenID)).to.be.equal(true);
        expect(Scalar.eq(tx.nonce, txDataDecoded.nonce)).to.be.equal(true);
        expect(Scalar.eq(tx.toBjjSign, txDataDecoded.toBjjSign)).to.be.equal(true);
    });

    it("rq tx compressed data v2", async () => {
        const tx = {
            fromIdx: 7,
            toIdx: 8,
            amount: 9,
            tokenID: 10,
            nonce: 11,
            userFee: 12,
            toBjjSign: true
        };

        const txData = `0x${txUtils.buildTxCompressedDataV2(tx).toString(16)}`;
        const txDataDecoded = txUtils.decodeTxCompressedDataV2(txData);

        expect(Scalar.eq(tx.fromIdx, txDataDecoded.fromIdx)).to.be.equal(true);
        expect(Scalar.eq(tx.toIdx, txDataDecoded.toIdx)).to.be.equal(true);
        expect(Scalar.eq(tx.amount, txDataDecoded.amount)).to.be.equal(true);
        expect(Scalar.eq(tx.tokenID, txDataDecoded.tokenID)).to.be.equal(true);
        expect(Scalar.eq(tx.nonce, txDataDecoded.nonce)).to.be.equal(true);
        expect(Scalar.eq(tx.toBjjSign, txDataDecoded.toBjjSign)).to.be.equal(true);
    });

    it("tx round values", async () => {
        const testVector = [
            [123000000, "123000000"],
        ];

        const tx = {
            amount: testVector[0][1],
        };

        txUtils.txRoundValues(tx);

        expect(Scalar.eq(testVector[0][0], tx.amountF)).to.be.equal(true);
        expect(Scalar.eq(testVector[0][1], tx.amount)).to.be.equal(true);
    });

    it("encode decode l1-full-tx", async () => {

        const nLevels = 32;
        const tx = {
            toIdx: 257,
            tokenID: 12,
            amountF: 10,
            loadAmountF: 1000,
            fromIdx: 123,
            fromBjjCompressed: "0x8efe299dccec53409219f4352d7cba8ae12b8e6d64e9352ebefec438092e8324",
            fromEthAddr: "0x0083df8a850f42e7f7e57013759c285caa701eb6"
        };
        const txData = `0x${txUtils.encodeL1TxFull(tx, nLevels).toString(16)}`;
        const txDataDecoded = txUtils.decodeL1TxFull(txData, nLevels);

        expect(Scalar.eq(txDataDecoded.toIdx, tx.toIdx)).to.be.equal(true);
        expect(Scalar.eq(txDataDecoded.tokenID, tx.tokenID)).to.be.equal(true);
        expect(Scalar.eq(txDataDecoded.amountF, tx.amountF)).to.be.equal(true);
        expect(Scalar.eq(txDataDecoded.loadAmountF, tx.loadAmountF)).to.be.equal(true);
        expect(Scalar.eq(txDataDecoded.fromIdx, tx.fromIdx)).to.be.equal(true);
        expect(txDataDecoded.fromBjjCompressed).to.be.equal(tx.fromBjjCompressed);
        expect(txDataDecoded.fromEthAddr).to.be.equal(tx.fromEthAddr);
    });

    it("encode decode l2-tx", async () => {
        const nLevels = 32;

        const tx = {
            toIdx: 2**24 - 1,
            fromIdx: 2**30,
            amount: float40.round(Scalar.e("1982082637635472634987360")),
            userFee: 240,
        };
        const txData = `0x${txUtils.encodeL2Tx(tx, nLevels).toString(16)}`;
        const txDataDecoded = txUtils.decodeL2Tx(txData, nLevels);

        expect(Scalar.eq(txDataDecoded.userFee, tx.userFee)).to.be.equal(true);
        expect(Scalar.eq(txDataDecoded.amount, tx.amount)).to.be.equal(true);
        expect(Scalar.eq(txDataDecoded.toIdx, tx.toIdx)).to.be.equal(true);
        expect(Scalar.eq(txDataDecoded.fromIdx, tx.fromIdx)).to.be.equal(true);

        // check missing auxToIdx error
        const tx2 = {
            toIdx: Constants.nullIdx,
            fromIdx: 256,
            amount: float40.round(Scalar.fromString("10235000000000000000000000000000000")),
            userFee: 0,
        };

        try {
            txUtils.encodeL2Tx(tx2, nLevels);
            expect(true).to.be.equal(false);
        } catch(error){
            expect(error.message.includes("encodeL2Tx: auxToIdx is not defined")).to.be.equal(true);
        }

        // add auxToIdx
        tx2.auxToIdx = 312;
        const txData2 = `0x${txUtils.encodeL2Tx(tx2, nLevels).toString(16)}`;
        const txDataDecoded2 = txUtils.decodeL2Tx(txData2, nLevels);

        expect(Scalar.eq(txDataDecoded2.userFee, tx2.userFee)).to.be.equal(true);
        expect(Scalar.eq(txDataDecoded2.amount, tx2.amount)).to.be.equal(true);
        expect(Scalar.eq(txDataDecoded2.toIdx, tx2.auxToIdx)).to.be.equal(true);
        expect(Scalar.eq(txDataDecoded2.fromIdx, tx2.fromIdx)).to.be.equal(true);
    });

    it("encode decode l1-tx coordinator", async () => {
        const l1CoordinatorTx = {
            tokenID: 2**16,
            fromBjjCompressed: "0x8efe299dccec53409219f4352d7cba8ae12b8e6d64e9352ebefec438092e8324",
            r: Scalar.shl(1, 240).toString(16),
            s: Scalar.sub(Scalar.shl(1, 256), 1).toString(16),
            v: 2**7 - 3,
        };

        const txData = `0x${txUtils.encodeL1CoordinatorTx(l1CoordinatorTx).toString(16)}`;
        const txDataDecoded = txUtils.decodeL1CoordinatorTx(txData);

        expect(Scalar.eq(txDataDecoded.tokenID, l1CoordinatorTx.tokenID)).to.be.equal(true);
        expect(txDataDecoded.fromBjjCompressed).to.be.equal(l1CoordinatorTx.fromBjjCompressed);
        expect(Scalar.eq(txDataDecoded.r, l1CoordinatorTx.r)).to.be.equal(true);
        expect(txDataDecoded.s).to.be.equal(l1CoordinatorTx.s);
        expect(txDataDecoded.v).to.be.equal(txDataDecoded.v);
    });

    it("encode decode l1-tx", async () => {
        const nLevels = 32;

        const l1Tx = {
            effectiveAmount: float40.round(Scalar.e("1000000000")),
            toIdx: 2**24 - 1,
            fromIdx: 2**30 - 1
        };

        const txData = `0x${txUtils.encodeL1Tx(l1Tx, nLevels).toString(16)}`;
        const txDataDecoded = txUtils.decodeL1Tx(txData, nLevels);

        expect(txDataDecoded.userFee.toString()).to.be.equal(Scalar.e(0).toString());
        expect(txDataDecoded.effectiveAmount.toString()).to.be.equal(l1Tx.effectiveAmount.toString());
        expect(float40.float2Fix(txDataDecoded.effectiveAmountF).toString()).to.be.
            equal(l1Tx.effectiveAmount.toString());
        expect(txDataDecoded.toIdx.toString()).to.be.equal(l1Tx.toIdx.toString());
        expect(txDataDecoded.fromIdx.toString()).to.be.equal(l1Tx.fromIdx.toString());
    });

    it("account creation authorization", async () => {
        const testVectors = [];

        testVectors.push({
            inputs: {
                ethPrivKey: "0000000000000000000000000000000000000000000000000000000000000001",
                bjjCompressed: "0x21b0a1688b37f77b1d1d5539ec3b826db5ac78b2513f574a04c50a7d4f8246d7",
                chainID: "0x004",
                ethAddress: "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf"
            },
            expectedSignature: "0xdbedcc5ce02db8f48afbdb2feba9a3a31848eaa8fca5f312ce37b01db45d2199208335330d4445bd2f51d1db68dbc0d0bf3585c4a07504b4efbe46a69eaae5a21b"
        });

        // testVectors.push({
        //     inputs: {
        //         ethPrivKey: "0000000000000000000000000000000000000000000000000000000000000002",
        //         bjjCompressed: "093985b1993d9f743f9d7d943ed56f38601cb8b196db025f79650c4007c3054d",
        //         chainID: "0x00",
        //         ethAddress: "2b5ad5c4795c026514f8317c7a215e218dccd6cf"
        //     },
        //     expectedSignature: "0x6a0da90ba2d2b1be679a28ebe54ee03082d44b836087391cd7d2607c1e4dafe04476e6e88dccb8707c68312512f16c947524b35c80f26c642d23953e9bb84c701c"
        // });

        // // this inputs has been taken from contracts repository to assure compatibility:
        // // https://github.com/hermeznetwork/contracts/blob/master/test/hermez/HermezHelpers.test.js#L93
        // testVectors.push({
        //     inputs: {
        //         ethPrivKey: "0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122",
        //         bjjCompressed: "22870c1bcc451396202d62f566026eab8e438c6c91decf8ddf63a6c162619b52",
        //         chainID: "7a69",
        //         ethAddress: "0xf4e77E5Da47AC3125140c470c71cBca77B5c638c"
        //     },
        //     expectedSignature: "0xa0766181102428b5672e523dc4b905c10ddf025c10dbd0b3534ef864632a14652737610041c670b302fc7dca28edd5d6eac42b72d69ce58da8ce21287b244e381b"
        // });

        for (let i = 0; i < testVectors.length; i++){
            const { ethPrivKey, bjjCompressed, chainID, ethAddress } = testVectors[i].inputs;
            const { expectedSignature } = testVectors[i];

            const wallet = new ethers.Wallet(ethPrivKey);
            const computedSignature = await txUtils.signBjjAuth(wallet, bjjCompressed, chainID, ethAddress);
            const computedSignatureRaw = await txUtils.signBjjAuthRaw(wallet, bjjCompressed, chainID, ethAddress);

            expect(expectedSignature).to.be.equal(computedSignature);
            expect(expectedSignature).to.be.equal(computedSignatureRaw);
        }
    });
});
