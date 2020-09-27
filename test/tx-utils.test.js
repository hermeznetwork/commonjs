const { expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;

const txUtils = require("../index").txUtils;
const float16 = require("../index").float16;

describe("Tx-utils", function () {

    it("tx compressed data", async () => {
        const tx = {
            chainID: 1,
            fromIdx: 2,
            toIdx: 3,
            amount: 4,
            tokenID: 5,
            nonce: 6,
            toBjjSign: true
        };

        const txData = `0x${txUtils.buildTxCompressedData(tx).toString(16)}`;
        const txDataDecoded = txUtils.decodeTxCompressedData(txData);

        expect(Scalar.eq(tx.chainID, txDataDecoded.chainID)).to.be.equal(true);
        expect(Scalar.eq(tx.fromIdx, txDataDecoded.fromIdx)).to.be.equal(true);
        expect(Scalar.eq(tx.toIdx, txDataDecoded.toIdx)).to.be.equal(true);
        expect(Scalar.eq(tx.amount, txDataDecoded.amount)).to.be.equal(true);
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
            [0x307B, "123000000"],
        ];
        
        const tx = {
            amount: testVector[0][1],
        };

        txUtils.txRoundValues(tx);

        expect(Scalar.eq(testVector[0][0], tx.amountF)).to.be.equal(true);
        expect(Scalar.eq(testVector[0][1], tx.amount)).to.be.equal(true);
    });

    it("encode decode l1-tx", async () => {

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
        const txData = `0x${txUtils.encodeL1Tx(tx, nLevels).toString(16)}`;
        const txDataDecoded = txUtils.decodeL1Tx(txData, nLevels);

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
            amount: float16.float2Fix(float16.fix2Float(Scalar.e("1982082637635472634987360"))),
            userFee: 240,
        };
        const txData = `0x${txUtils.encodeL2Tx(tx, nLevels).toString(16)}`;
        const txDataDecoded = txUtils.decodeL2Tx(txData, nLevels);

        expect(Scalar.eq(txDataDecoded.userFee, tx.userFee)).to.be.equal(true);
        expect(Scalar.eq(txDataDecoded.amount, tx.amount)).to.be.equal(true);
        expect(Scalar.eq(txDataDecoded.toIdx, tx.toIdx)).to.be.equal(true);
        expect(Scalar.eq(txDataDecoded.fromIdx, tx.fromIdx)).to.be.equal(true);
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
});