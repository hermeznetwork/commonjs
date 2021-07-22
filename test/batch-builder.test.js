const { expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;
const SMTMemDB = require("circomlib").SMTMemDB;
const lodash = require("lodash");

const Account = require("../index").HermezAccount;
const RollupDB = require("../index").RollupDB;
const Constants = require("../index").Constants;
const computeFee = require("../index").feeTable.computeFee;
const txUtils = require("../index").txUtils;
const stateUtils = require("../index").stateUtils;
const float40 = require("../index").float40;
const { depositTx, depositOnlyExitTx } = require("./helpers/test-utils");

describe("Rollup Db - batchbuilder", async function(){

    const nLevels = 32;
    const maxTx = 8;
    const maxL1Tx = 6;

    it("Should process L1 Deposit and L2 transfer", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const account2 = new Account(2);

        depositTx(bb, account1, 1, 1000);
        depositTx(bb, account2, 1, 2000);
        depositTx(bb, account1, 2, 3000);
        depositTx(bb, account2, 2, 3000);

        await bb.build();
        await rollupDB.consolidate(bb);

        const s1 = await rollupDB.getStateByIdx(256);
        expect(s1.sign).to.be.equal(account1.sign);
        expect(s1.ay).to.be.equal(account1.ay);
        expect(s1.ethAddr).to.be.equal(account1.ethAddr);
        expect(s1.balance.toString()).to.be.equal(Scalar.e(1000).toString());
        expect(s1.tokenID).to.be.equal(1);
        expect(s1.nonce).to.be.equal(0);
        expect(s1.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s1.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());

        const s2 = await rollupDB.getStateByIdx(257);
        expect(s2.sign).to.be.equal(account2.sign);
        expect(s2.ay).to.be.equal(account2.ay);
        expect(s2.ethAddr).to.be.equal(account2.ethAddr);
        expect(s2.balance.toString()).to.be.equal(Scalar.e(2000).toString());
        expect(s2.tokenID).to.be.equal(1);
        expect(s2.nonce).to.be.equal(0);
        expect(s2.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s2.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());

        const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx = {
            fromIdx: 256,
            toIdx: 257,
            tokenID: 1,
            amount: Scalar.e(50),
            nonce: 0,
            userFee: 126, // effective fee is 4
        };

        account1.signTx(tx);
        bb2.addTx(tx);

        await bb2.build();
        await rollupDB.consolidate(bb2);

        const s2_1 = await rollupDB.getStateByIdx(256);
        expect(s2_1.sign).to.be.equal(account1.sign);
        expect(s2_1.ay).to.be.equal(account1.ay);
        expect(s2_1.ethAddr).to.be.equal(account1.ethAddr);
        expect(s2_1.balance.toString()).to.be.equal(Scalar.e(945).toString());
        expect(s2_1.tokenID).to.be.equal(1);
        expect(s2_1.nonce).to.be.equal(1);
        expect(s2_1.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s2_1.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());

        const s2_2 = await rollupDB.getStateByIdx(257);
        const newAccHash = stateUtils.computeAccumulatedHash(s2.accumulatedHash, tx, nLevels);
        expect(s2_2.sign).to.be.equal(account2.sign);
        expect(s2_2.ay).to.be.equal(account2.ay);
        expect(s2_2.ethAddr).to.be.equal(account2.ethAddr);
        expect(s2_2.balance.toString()).to.be.equal(Scalar.e(2050).toString());
        expect(s2_2.tokenID).to.be.equal(1);
        expect(s2_2.nonce).to.be.equal(0);
        expect(s2_2.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s2_2.accumulatedHash.toString()).to.be.equal(newAccHash.toString());

        const s2_3 = await rollupDB.getStateByIdx(258);
        expect(s2_3.sign).to.be.equal(account1.sign);
        expect(s2_3.ay).to.be.equal(account1.ay);
        expect(s2_3.ethAddr).to.be.equal(account1.ethAddr);
        expect(s2_3.balance.toString()).to.be.equal(Scalar.e(3000).toString());
        expect(s2_3.tokenID).to.be.equal(2);
        expect(s2_3.nonce).to.be.equal(0);
        expect(s2_3.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s2_3.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());

        const s3 = await rollupDB.getStateBySignAy(account1.sign, account1.ay);
        expect(lodash.isEqual(s3[0], s2_1)).to.be.equal(true);
        expect(lodash.isEqual(s3[1], s2_3)).to.be.equal(true);

        const s4 = await rollupDB.getStateByEthAddr(account1.ethAddr);
        expect(lodash.isEqual(s4[0], s2_1)).to.be.equal(true);
        expect(lodash.isEqual(s4[1], s2_3)).to.be.equal(true);

        const s5 = await rollupDB.getStateByEthAddr(account2.ethAddr);
        expect(lodash.isEqual(s5[0], s2_2)).to.be.equal(true);

        // check L2 tx data availability
        const L2TxData = await bb2._L2TxsData();
        const L2TxDataDecoded = txUtils.decodeL2Tx(L2TxData, nLevels);

        expect(L2TxDataDecoded.userFee).to.be.equal(tx.userFee);
        expect(Scalar.e(L2TxDataDecoded.amountF).toString()).to.be.equal(float40.fix2Float(tx.amount).toString());
        expect(L2TxDataDecoded.fromIdx).to.be.equal(tx.fromIdx);
        expect(L2TxDataDecoded.toIdx).to.be.equal(tx.toIdx);

        // check state roots
        const stateRoot1 = await rollupDB.getStateRoot(bb.batchNumber);
        expect(stateRoot1.toString()).to.be.equal(bb.stateTree.root.toString());

        const stateRoot2 = await rollupDB.getStateRoot(bb2.batchNumber);
        expect(stateRoot2.toString()).to.be.equal(bb2.stateTree.root.toString());

        const stateRootNonExisting = await rollupDB.getStateRoot(bb2.batchNumber + 1);
        expect(stateRootNonExisting).to.be.equal(null);
    });

    it("Should process L2 transfer to ethereum address", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const account2 = new Account(2);

        depositTx(bb, account1, 1, 1000);
        depositTx(bb, account2, 1, 2000);
        depositTx(bb, account2, 1, 3000);

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const expectedToIdx = 258;

        const tx = {
            fromIdx: 256,
            toIdx: Constants.nullIdx,
            toEthAddr: account2.ethAddr,
            tokenID: 1,
            amount: Scalar.e(50),
            nonce: 0,
            userFee: 126, // effective fee is 4
        };

        account1.signTx(tx);
        bb2.addTx(tx);

        await bb2.build();
        await rollupDB.consolidate(bb2);

        const s1 = await rollupDB.getStateByIdx(256);
        expect(s1.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s1.balance.toString()).to.be.equal(Scalar.e(945).toString());

        const s2 = await rollupDB.getStateByIdx(257);
        expect(s2.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s2.balance.toString()).to.be.equal(Scalar.e(2000).toString());

        const s3 = await rollupDB.getStateByIdx(258);
        const newAccHash = stateUtils.computeAccumulatedHash(s2.accumulatedHash, tx, nLevels);
        expect(s3.accumulatedHash.toString()).to.be.equal(newAccHash.toString());
        expect(s3.balance.toString()).to.be.equal(Scalar.e(3050).toString());

        // check L2 tx data availability
        const L2TxData = await bb2._L2TxsData();
        const L2TxDataDecoded = txUtils.decodeL2Tx(L2TxData, nLevels);

        expect(L2TxDataDecoded.userFee).to.be.equal(tx.userFee);
        expect(Scalar.e(L2TxDataDecoded.amountF).toString()).to.be.equal(float40.fix2Float(tx.amount).toString());
        expect(L2TxDataDecoded.fromIdx).to.be.equal(tx.fromIdx);
        expect(L2TxDataDecoded.toIdx).to.be.equal(expectedToIdx);
    });

    it("Should process L2 transfer to Bjj address", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const account2 = new Account(2);

        depositTx(bb, account1, 1, 1000);
        depositTx(bb, account2, 1, 2000);
        depositTx(bb, account2, 1, 3000);

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const expectedToIdx = 258;

        const tx = {
            fromIdx: 256,
            toIdx: Constants.nullIdx,
            toEthAddr: Constants.nullEthAddr,
            toBjjAy: account2.ay,
            toBjjSign: account2.sign,
            tokenID: 1,
            amount: Scalar.e(50),
            nonce: 0,
            userFee: 126, // effective fee is 4
        };

        account1.signTx(tx);
        bb2.addTx(tx);

        await bb2.build();
        await rollupDB.consolidate(bb2);

        const s1 = await rollupDB.getStateByIdx(256);
        expect(s1.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s1.balance.toString()).to.be.equal(Scalar.e(945).toString());

        const s2 = await rollupDB.getStateByIdx(257);
        expect(s2.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s2.balance.toString()).to.be.equal(Scalar.e(2000).toString());

        const s3 = await rollupDB.getStateByIdx(258);
        const newAccHash = stateUtils.computeAccumulatedHash(s2.accumulatedHash, tx, nLevels);
        expect(s3.accumulatedHash.toString()).to.be.equal(newAccHash.toString());
        expect(s3.balance.toString()).to.be.equal(Scalar.e(3050).toString());

        // check L2 tx data availability
        const L2TxData = await bb2._L2TxsData();
        const L2TxDataDecoded = txUtils.decodeL2Tx(L2TxData, nLevels);

        expect(L2TxDataDecoded.userFee).to.be.equal(tx.userFee);
        expect(Scalar.e(L2TxDataDecoded.amountF).toString()).to.be.equal(float40.fix2Float(tx.amount).toString());
        expect(L2TxDataDecoded.fromIdx).to.be.equal(tx.fromIdx);
        expect(L2TxDataDecoded.toIdx).to.be.equal(expectedToIdx);
    });

    it("Should process L2 exit", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);

        depositTx(bb, account1, 1, 1000);

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx = {
            fromIdx: 256,
            toIdx: Constants.exitIdx,
            tokenID: 1,
            amount: Scalar.e(50),
            nonce: 0,
            userFee: 126, // effective fee is 4
        };

        account1.signTx(tx);
        bb2.addTx(tx);

        await bb2.build();
        await rollupDB.consolidate(bb2);

        const s1 = await rollupDB.getStateByIdx(256);
        expect(s1.sign).to.be.equal(account1.sign);
        expect(s1.ay).to.be.equal(account1.ay);
        expect(s1.ethAddr).to.be.equal(account1.ethAddr);
        expect(s1.balance.toString()).to.be.equal(Scalar.e(945).toString());
        expect(s1.tokenID).to.be.equal(1);
        expect(s1.nonce).to.be.equal(1);
        expect(s1.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s1.exitBalance.toString()).to.be.equal(Scalar.e(50).toString());

        const s1_exit = await rollupDB.getExitInfo(256, 2);
        expect(s1_exit.state.sign).to.be.equal(account1.sign);
        expect(s1_exit.state.ay).to.be.equal(account1.ay);
        expect(s1_exit.state.ethAddr).to.be.equal(account1.ethAddr);
        expect(s1_exit.state.balance.toString()).to.be.equal(Scalar.e(945).toString());
        expect(s1_exit.state.tokenID).to.be.equal(1);
        expect(s1_exit.state.nonce).to.be.equal(1);
        expect(s1_exit.state.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s1_exit.state.exitBalance.toString()).to.be.equal(Scalar.e(50).toString());

        // check L2 tx data availability
        const L2TxData = await bb2._L2TxsData();
        const L2TxDataDecoded = txUtils.decodeL2Tx(L2TxData, nLevels);

        expect(L2TxDataDecoded.userFee).to.be.equal(tx.userFee);
        expect(Scalar.e(L2TxDataDecoded.amountF).toString()).to.be.equal(float40.fix2Float(tx.amount).toString());
        expect(L2TxDataDecoded.fromIdx).to.be.equal(tx.fromIdx);
        expect(L2TxDataDecoded.toIdx).to.be.equal(tx.toIdx);
    });

    it("Should process L2 exit with 0 amount", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);

        depositTx(bb, account1, 1, 1000);

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx = {
            fromIdx: 256,
            toIdx: Constants.exitIdx,
            tokenID: 1,
            amount: Scalar.e(0),
            nonce: 0,
            userFee: 126, // effective fee is 4
        };

        account1.signTx(tx);
        bb2.addTx(tx);

        await bb2.build();
        await rollupDB.consolidate(bb2);

        const s1 = await rollupDB.getStateByIdx(256);
        expect(s1.balance.toString()).to.be.equal(Scalar.e(1000).toString());

        // check exit info
        const s1_exit = await rollupDB.getExitInfo(256, 2);
        expect(s1_exit.state.balance.toString()).to.be.equal(Scalar.e(1000).toString());
        expect(s1_exit.state.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s1_exit.state.nonce.toString()).to.be.equal(Scalar.e(1).toString());
    });

    it("Should process L1 force exit with 0 amount", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);

        depositTx(bb, account1, 1, 1000);

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx = {
            fromIdx: 256,
            loadAmountF: 0,
            tokenID: 1,
            fromBjjCompressed: 0,
            fromEthAddr: account1.ethAddr,
            toIdx: Constants.exitIdx,
            amount: 0,
            userFee: 0,
            onChain: true
        };

        bb2.addTx(tx);

        await bb2.build();
        await rollupDB.consolidate(bb2);

        const s1 = await rollupDB.getStateByIdx(256);
        expect(s1.balance.toString()).to.be.equal(Scalar.e(1000).toString());

        // check exit info
        const s1_exit = await rollupDB.getExitInfo(256, 2);
        expect(s1_exit.state.balance.toString()).to.be.equal(Scalar.e(1000).toString());
        expect(s1_exit.state.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s1_exit.state.nonce.toString()).to.be.equal(Scalar.e(0).toString());
    });

    it("Should process L2 transfer with 0 amount", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const account2 = new Account(2);

        depositTx(bb, account1, 1, 1000);
        depositTx(bb, account2, 1, 1000);

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx = {
            fromIdx: 256,
            toIdx: 257,
            tokenID: 1,
            amount: Scalar.e(50),
            nonce: 0,
            userFee: 126, // effective fee is 4
        };

        account1.signTx(tx);
        bb2.addTx(tx);

        await bb2.build();
        await rollupDB.consolidate(bb2);

        // check balances
        const s1 = await rollupDB.getStateByIdx(256);
        expect(s1.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s1.balance.toString()).to.be.equal(Scalar.e(945).toString());

        const s2 = await rollupDB.getStateByIdx(257);
        expect(s2.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s2.balance.toString()).to.be.equal(Scalar.e(1050).toString());

        const bb3 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx2 = {
            fromIdx: 256,
            toIdx: 257,
            tokenID: 1,
            amount: Scalar.e(0),
            nonce: 1,
            userFee: 126, // effective fee is 4
        };

        account1.signTx(tx2);
        bb3.addTx(tx2);

        await bb3.build();
        await rollupDB.consolidate(bb3);

        // check balances
        const s1_2 = await rollupDB.getStateByIdx(256);
        expect(s1_2.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s1_2.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s1_2.balance.toString()).to.be.equal(Scalar.e(945).toString());

        const s2_2 = await rollupDB.getStateByIdx(257);
        const newAccHash = stateUtils.computeAccumulatedHash(s2.accumulatedHash, tx2, nLevels);
        expect(s2_2.accumulatedHash.toString()).to.be.equal(newAccHash.toString());
        expect(s2_2.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s2_2.balance.toString()).to.be.equal(Scalar.e(1050).toString());
    });

    it("Should process L1 force transfer with 0 amount", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const account2 = new Account(2);

        depositTx(bb, account1, 1, 1000);
        depositTx(bb, account2, 1, 1000);

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx = {
            fromIdx: 256,
            loadAmountF: 0,
            tokenID: 1,
            fromBjjCompressed: 0,
            fromEthAddr: account1.ethAddr,
            toIdx: 257,
            amount: 50,
            userFee: 0,
            onChain: true
        };
        bb2.addTx(tx);

        await bb2.build();
        await rollupDB.consolidate(bb2);

        // check balances
        const s1 = await rollupDB.getStateByIdx(256);
        expect(s1.balance.toString()).to.be.equal(Scalar.e(950).toString());
        expect(s1.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s1.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());

        const s2 = await rollupDB.getStateByIdx(257);
        let newAccHash = stateUtils.computeAccumulatedHash(Scalar.e(0), tx, nLevels);
        expect(s2.accumulatedHash.toString()).to.be.equal(newAccHash.toString());
        expect(s2.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s2.balance.toString()).to.be.equal(Scalar.e(1050).toString());

        const bb3 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx2 = {
            fromIdx: 256,
            loadAmountF: 0,
            tokenID: 1,
            fromBjjCompressed: 0,
            fromEthAddr: account1.ethAddr,
            toIdx: 257,
            amount: 0,
            userFee: 0,
            onChain: true
        };
        bb3.addTx(tx2);

        await bb3.build();
        await rollupDB.consolidate(bb3);

        // check balances
        const s1_2 = await rollupDB.getStateByIdx(256);
        expect(s1_2.balance.toString()).to.be.equal(Scalar.e(950).toString());
        expect(s1_2.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s1_2.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());

        const s2_2 = await rollupDB.getStateByIdx(257);
        newAccHash = stateUtils.computeAccumulatedHash(s2.accumulatedHash, tx2, nLevels);
        expect(s2_2.balance.toString()).to.be.equal(Scalar.e(1050).toString());
        expect(s2_2.accumulatedHash.toString()).to.be.equal(newAccHash.toString());
        expect(s2_2.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
    });

    it("Should process only-exit account", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const account2 = new Account(2);
        const account3 = new Account(3);

        depositTx(bb, account1, 1, 1000);
        depositOnlyExitTx(bb, account2, 1, 1000);

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        // send to exit-only account
        const tx = {
            fromIdx: 256,
            toIdx: 257,
            tokenID: 1,
            amount: Scalar.e(50),
            nonce: 0,
            userFee: 126,
        };

        account1.signTx(tx);
        bb2.addTx(tx);

        await bb2.build();
        await rollupDB.consolidate(bb2);

        // check balances
        const s1 = await rollupDB.getStateByIdx(256);
        expect(s1.balance.toString()).to.be.equal(Scalar.e(945).toString());
        expect(s1.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());

        const s2 = await rollupDB.getStateByIdx(257);
        let newAccHash = stateUtils.computeAccumulatedHash(Scalar.e(0), tx, nLevels);
        expect(s2.accumulatedHash.toString()).to.be.equal(newAccHash.toString());
        expect(s2.exitBalance.toString()).to.be.equal(Scalar.e(50).toString());
        expect(s2.balance.toString()).to.be.equal(Scalar.e(1000).toString());

        // force transfer to exit-only account
        const bb3 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx2 = {
            fromIdx: 256,
            loadAmountF: 0,
            tokenID: 1,
            fromBjjCompressed: 0,
            fromEthAddr: account1.ethAddr,
            toIdx: 257,
            amount: 50,
            userFee: 0,
            onChain: true
        };
        bb3.addTx(tx2);

        await bb3.build();
        await rollupDB.consolidate(bb3);

        // check balances
        const s1_2 = await rollupDB.getStateByIdx(256);
        expect(s1_2.balance.toString()).to.be.equal(Scalar.e(895).toString());
        expect(s1_2.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());

        const s2_2 = await rollupDB.getStateByIdx(257);
        newAccHash = stateUtils.computeAccumulatedHash(s2.accumulatedHash, tx2, nLevels);
        expect(s2_2.balance.toString()).to.be.equal(Scalar.e(1000).toString());
        expect(s2_2.accumulatedHash.toString()).to.be.equal(newAccHash.toString());
        expect(s2_2.exitBalance.toString()).to.be.equal(Scalar.e(100).toString());

        // force transfer nullified to exit-only account
        const bb4 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx3 = {
            fromIdx: 256,
            loadAmountF: 0,
            tokenID: 1,
            fromBjjCompressed: 0,
            fromEthAddr: account1.ethAddr,
            toIdx: 257,
            amount: 1000,
            userFee: 0,
            onChain: true
        };
        bb4.addTx(tx3);

        await bb4.build();
        await rollupDB.consolidate(bb4);

        // check balances
        const s1_3 = await rollupDB.getStateByIdx(256);
        expect(s1_3.balance.toString()).to.be.equal(Scalar.e(895).toString());
        expect(s1_3.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());

        const s2_3 = await rollupDB.getStateByIdx(257);
        expect(s2_3.balance.toString()).to.be.equal(Scalar.e(1000).toString());
        expect(s2_3.accumulatedHash.toString()).to.be.equal(newAccHash.toString());
        expect(s2_3.exitBalance.toString()).to.be.equal(Scalar.e(100).toString());

        // force exit from exit-only account
        const bb5 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx4 = {
            fromIdx: 257,
            loadAmountF: 0,
            tokenID: 1,
            fromBjjCompressed: 0,
            fromEthAddr: account2.ethAddr,
            toIdx: Constants.exitIdx,
            amount: 120,
            userFee: 0,
            onChain: true
        };
        bb5.addTx(tx4);

        await bb5.build();
        await rollupDB.consolidate(bb5);

        const s2_4 = await rollupDB.getStateByIdx(257);
        expect(s2_4.balance.toString()).to.be.equal(Scalar.e(880).toString());
        expect(s2_4.accumulatedHash.toString()).to.be.equal(newAccHash.toString());
        expect(s2_4.exitBalance.toString()).to.be.equal(Scalar.e(220).toString());

        // create account deposit and transfer to exit-only account
        const bb6 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx5 = {
            fromIdx: 0,
            loadAmountF: 500,
            tokenID: 1,
            fromBjjCompressed: account3.bjjCompressed,
            fromEthAddr: account3.ethAddr,
            toIdx: 257,
            amount: 100,
            userFee: 0,
            onChain: true
        };

        bb6.addTx(tx5);

        await bb6.build();
        await rollupDB.consolidate(bb6);

        const s2_5 = await rollupDB.getStateByIdx(257);
        newAccHash = stateUtils.computeAccumulatedHash(s2_2.accumulatedHash, tx5, nLevels);
        expect(s2_5.balance.toString()).to.be.equal(Scalar.e(880).toString());
        expect(s2_5.accumulatedHash.toString()).to.be.equal(newAccHash.toString());
        expect(s2_5.exitBalance.toString()).to.be.equal(Scalar.e(320).toString());

        const s3 = await rollupDB.getStateByIdx(258);
        expect(s3.balance.toString()).to.be.equal(Scalar.e(400).toString());
        expect(s3.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
    });

    it("Should check fee accumulated, fee plan tokens, fee idxs & pay fees on L2", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const account2 = new Account(2);

        const feeAccount1 = new Account(3);
        const feeAccount2 = new Account(4);

        depositTx(bb, account1, 1, 1000);
        depositTx(bb, account2, 1, 1000);
        depositTx(bb, account1, 2, 1000);
        depositTx(bb, account2, 2, 1000);
        depositTx(bb, feeAccount1, 1, 0);
        depositTx(bb, feeAccount2, 2, 0);

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx = {
            fromIdx: 256,
            toIdx: 257,
            tokenID: 1,
            amount: 50,
            nonce: 0,
            userFee: 173,
        };

        const feeTx1 = computeFee(tx.amount, tx.userFee);
        account1.signTx(tx);
        bb2.addTx(tx);

        const tx2 = {
            fromIdx: 258,
            toIdx: 259,
            tokenID: 2,
            amount: 50,
            nonce: 0,
            userFee: 126,
        };

        const feeTx2 = computeFee(tx2.amount, tx2.userFee);
        account1.signTx(tx2);
        bb2.addTx(tx2);

        bb2.addToken(1);
        bb2.addFeeIdx(260);

        bb2.addToken(2);
        bb2.addFeeIdx(261);

        await bb2.build();
        await rollupDB.consolidate(bb2);

        // Total fees accumulated
        const feePlanCoins = bb2.feePlanTokens;
        const feeTotals = bb2.feeTotals;
        const stateFees1 = await rollupDB.getStateByIdx(260);
        const stateFees2 = await rollupDB.getStateByIdx(261);

        // Token ID1
        const indexToken1 = feePlanCoins.indexOf(tx.tokenID);
        const feeAcc1 = feeTotals[indexToken1];
        expect(Scalar.eq(feeAcc1, feeTx1)).to.be.equal(true);
        // Receive fees
        expect(stateFees1.sign).to.be.equal(feeAccount1.sign);
        expect(stateFees1.ay).to.be.equal(feeAccount1.ay);
        expect(stateFees1.ethAddr).to.be.equal(feeAccount1.ethAddr);
        expect(stateFees1.balance.toString()).to.be.equal(Scalar.e(feeTx1).toString());
        expect(stateFees1.tokenID).to.be.equal(1);
        expect(stateFees1.nonce).to.be.equal(0);
        expect(stateFees1.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(stateFees1.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());

        // Token ID1
        const indexToken2 = feePlanCoins.indexOf(tx2.tokenID);
        const feeAcc2 = feeTotals[indexToken2];
        expect(Scalar.eq(feeAcc2, feeTx2)).to.be.equal(true);
        // Receive fees
        expect(stateFees2.sign).to.be.equal(feeAccount2.sign);
        expect(stateFees2.ay).to.be.equal(feeAccount2.ay);
        expect(stateFees2.ethAddr).to.be.equal(feeAccount2.ethAddr);
        expect(stateFees2.balance.toString()).to.be.equal(Scalar.e(feeTx2).toString());
        expect(stateFees2.tokenID).to.be.equal(2);
        expect(stateFees2.nonce).to.be.equal(0);
        expect(stateFees1.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(stateFees1.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());
    });

    it("Should check error L2 tx with loadAmount", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const account2 = new Account(2);

        depositTx(bb, account1, 0, 1000);
        depositTx(bb, account2, 0, 2000);

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx = {
            fromIdx: 256,
            toIdx: 257,
            loadAmountF: 100,
            tokenID: 0,
            amount: 50,
            nonce: 0,
            userFee: 173,
        };

        account1.signTx(tx);
        bb2.addTx(tx);

        try {
            await bb2.build();
            expect(true).to.be.equal(false);
        } catch (error) {
            expect(error.message.includes("Load amount must be 0 for L2 txs")).to.be.equal(true);
        }
    });

    it("Should check error L2 send to unexisting leaf", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const account2 = new Account(2);

        depositTx(bb, account1, 0, 1000);
        depositTx(bb, account2, 1, 2000);

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx = {
            fromIdx: 256,
            toIdx: 527,
            tokenID: 0,
            amount: 50,
            nonce: 0,
            userFee: 126,
        };

        account1.signTx(tx);
        bb2.addTx(tx);

        try {
            await bb2.build();
            expect(true).to.be.equal(false);
        } catch (error) {
            expect(error.message.includes("trying to send to a non existing account")).to.be.equal(true);
        }
    });

    it("Should check error L2 exit fromIdx does not exist", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const account2 = new Account(2);

        depositTx(bb, account1, 0, 1000);
        depositTx(bb, account2, 1, 2000);

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx = {
            fromIdx: 258,
            toIdx: Constants.exitIdx,
            tokenID: 0,
            amount: 50,
            nonce: 0,
            userFee: 126,
        };

        account1.signTx(tx);
        bb2.addTx(tx);

        try {
            await bb2.build();
            expect(true).to.be.equal(false);
        } catch (error) {
            expect(error.message.includes("FromIdx does not exist")).to.be.equal(true);
        }
    });

    it("Should check error fee selected", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const account2 = new Account(2);

        depositTx(bb, account1, 0, 1000);
        depositTx(bb, account2, 0, 2000);

        await bb.build();
        await rollupDB.consolidate(bb);

        const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx = {
            fromIdx: 256,
            toIdx: 257,
            tokenID: 0,
            amount: 50,
            nonce: 0,
            userFee: 257,
        };

        account1.signTx(tx);
        bb2.addTx(tx);

        try {
            await bb2.build();
            expect(true).to.be.equal(false);
        } catch (error) {
            expect(error.message.includes("Fee selected does not exist")).to.be.equal(true);
        }
    });

    it("Should check non-empty L1, L2, Fee data and input hash", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const account2 = new Account(2);

        depositTx(bb, account1, 0, 1000);
        depositTx(bb, account2, 0, 2000);

        // L2 tx
        const tx = {
            fromIdx: 256,
            toIdx: 257,
            tokenID: 0,
            amount: 50,
            nonce: 0,
            userFee: 126,
        };

        // L1 tx force transfer
        const tx1 = {
            fromIdx: 256,
            loadAmountF: 0,
            tokenID: 0,
            fromBjjCompressed: 0,
            fromEthAddr: account1.ethAddr,
            toIdx: 257,
            amount: 100,
            userFee: 0,
            onChain: true
        };

        account1.signTx(tx);
        bb.addTx(tx);
        bb.addTx(tx1);
        bb.addFeeIdx(260);
        bb.addFeeIdx(261);

        await bb.build();

        // Check L1, txsData, Fee data
        const resL1Data =
        "7e5f4552091a69125d5dfcb7b8c2659029395bdf" +
        "21b0a1688b37f77b1d1d5539ec3b826db5ac78b2513f574a04c50a7d4f8246d7" +
        "000000000000" +
        "00000003e8" +
        "0000000000" +
        "00000000" +
        "000000000000" +
        "2b5ad5c4795c026514f8317c7a215e218dccd6cf" +
        "093985b1993d9f743f9d7d943ed56f38601cb8b196db025f79650c4007c3054d" +
        "000000000000" +
        "00000007d0" +
        "0000000000" +
        "00000000" +
        "000000000000" +
        "7e5f4552091a69125d5dfcb7b8c2659029395bdf" +
        "0000000000000000000000000000000000000000000000000000000000000000" +
        "000000000100" +
        "0000000000" +
        "0000000064" +
        "00000000" +
        "000000000101" +
        "0000000000000000000000000000000000000000" +
        "0000000000000000000000000000000000000000000000000000000000000000" +
        "000000000000" +
        "0000000000" +
        "0000000000" +
        "00000000" +
        "000000000000" +
        "0000000000000000000000000000000000000000" +
        "0000000000000000000000000000000000000000000000000000000000000000" +
        "000000000000" +
        "0000000000" +
        "0000000000" +
        "00000000" +
        "000000000000" +
        "0000000000000000000000000000000000000000" +
        "0000000000000000000000000000000000000000000000000000000000000000" +
        "000000000000" +
        "0000000000" +
        "0000000000" +
        "00000000" +
        "000000000000";

        const resTxsData =
            "0000000000000000000000000000" +
            "0000000000000000000000000000" +
            "0000000000000000000000000000" +
            "0000000000000000000000000000" +
            "0000000000000000000000000000" +
            "0000000000000000000000000000" +
            "0000000000000000000000000000" +
            "000001000000010100000000327e";

        const resTxsDataSM = "0x000001000000010100000000327e";

        const resFeeData = "00000104000001050000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        + "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        + "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        + "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        + "000000000000000000000000000000000000000000000000000000000";

        const batchL1Data = await bb.getL1TxsFullData();
        const batchTxsData = await bb.getL2TxsData();
        const batchTxsDataSM = await bb.getL2TxsDataSM();
        const batchFeeData = await bb.getFeeTxsData();

        expect(resL1Data).to.be.equal(batchL1Data.toString());
        expect(resTxsData).to.be.equal(batchTxsData.toString());
        expect(resTxsDataSM).to.be.equal(batchTxsDataSM.toString());
        expect(resFeeData).to.be.equal(batchFeeData.toString());

        // input hash
        const resInputHash = "18489165602096978856602580072378708182780688698641839456008570926730041949263";

        const batchInputHash = await bb.getHashInputs();
        expect(resInputHash).to.be.equal(batchInputHash.toString());
    });

    it("Should check empty L1, L2, Fee data", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        await bb.build();
        await rollupDB.consolidate(bb);

        // Check L1, L2, Fee data
        const resL1Data = "0".repeat(864 + 6 * 6 * 2);
        const resL2Data = "0".repeat(176 + 8 * 3 * 2);
        const resFeeData = "0".repeat(512);

        const batchL1Data = await bb.getL1TxsFullData();
        const batchL2Data = await bb.getL2TxsData();
        const batchFeeData = await bb.getFeeTxsData();

        expect(batchL1Data.toString()).to.be.equal(resL1Data);
        expect(batchL2Data.toString()).to.be.equal(resL2Data);
        expect(batchFeeData.toString()).to.be.equal(resFeeData);

        // input hash
        const resInputHash = "20754921306922570106105324123418747433017277729861541401529941815324066219927";

        const batchInputHash = await bb.getHashInputs();
        expect(resInputHash).to.be.equal(batchInputHash.toString());
    });

    it("Should check error maxNumBatch", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const account2 = new Account(2);

        depositTx(bb, account1, 0, 1000);
        depositTx(bb, account2, 0, 2000);

        await bb.build();
        await rollupDB.consolidate(bb);

        let bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
        const currentNumBatch = bb2.currentNumBatch;

        // maxNumBatch greater than currentNumBatch
        const tx = {
            fromIdx: 256,
            toIdx: 257,
            tokenID: 0,
            amount: 50,
            nonce: 0,
            userFee: 120,
            maxNumBatch: Scalar.add(currentNumBatch, 1),
        };

        account1.signTx(tx);
        bb2.addTx(tx);
        await bb2.build();

        // maxNumBatch equal to currentNumBatch
        bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
        tx.maxNumBatch = currentNumBatch;
        account1.signTx(tx);
        bb2.addTx(tx);
        await bb2.build();

        // maxNumBatch less than currentNumBatch
        bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
        tx.maxNumBatch = Scalar.sub(currentNumBatch, 1);
        account1.signTx(tx);
        bb2.addTx(tx);

        try {
            await bb2.build();
            expect(true).to.be.equal(false);
        } catch (error) {
            expect(error.message.includes("maxNumBatch must be less than currentBatch")).to.be.equal(true);
        }
    });
});
