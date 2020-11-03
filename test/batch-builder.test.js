const { expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;
const SMTMemDB = require("circomlib").SMTMemDB;
const lodash = require("lodash");

const Account = require("../index").HermezAccount;
const RollupDB = require("../index").RollupDB;
const Constants = require("../index").Constants;
const computeFee = require("../index").feeTable.computeFee;
const { depositTx } = require("./helpers/test-utils");

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
        bb.getInput();

        await rollupDB.consolidate(bb);

        const s1 = await rollupDB.getStateByIdx(256);
        expect(s1.sign).to.be.equal(account1.sign);
        expect(s1.ay).to.be.equal(account1.ay);
        expect(s1.ethAddr).to.be.equal(account1.ethAddr);
        expect(s1.balance.toString()).to.be.equal(Scalar.e(1000).toString());
        expect(s1.tokenID).to.be.equal(1);
        expect(s1.nonce).to.be.equal(0);

        const s2 = await rollupDB.getStateByIdx(257);
        expect(s2.sign).to.be.equal(account2.sign);
        expect(s2.ay).to.be.equal(account2.ay);
        expect(s2.ethAddr).to.be.equal(account2.ethAddr);
        expect(s2.balance.toString()).to.be.equal(Scalar.e(2000).toString());
        expect(s2.tokenID).to.be.equal(1);
        expect(s2.nonce).to.be.equal(0);
    
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
        bb2.getInput();

        await rollupDB.consolidate(bb2);
    
        const s2_1 = await rollupDB.getStateByIdx(256);
        expect(s2_1.sign).to.be.equal(account1.sign);
        expect(s2_1.ay).to.be.equal(account1.ay);
        expect(s2_1.ethAddr).to.be.equal(account1.ethAddr);
        expect(s2_1.balance.toString()).to.be.equal(Scalar.e(945).toString());
        expect(s2_1.tokenID).to.be.equal(1);
        expect(s2_1.nonce).to.be.equal(1);

        const s2_2 = await rollupDB.getStateByIdx(257);
        expect(s2_2.sign).to.be.equal(account2.sign);
        expect(s2_2.ay).to.be.equal(account2.ay);
        expect(s2_2.ethAddr).to.be.equal(account2.ethAddr);
        expect(s2_2.balance.toString()).to.be.equal(Scalar.e(2050).toString());
        expect(s2_2.tokenID).to.be.equal(1);
        expect(s2_2.nonce).to.be.equal(0);

        const s2_3 = await rollupDB.getStateByIdx(258);
        expect(s2_3.sign).to.be.equal(account1.sign);
        expect(s2_3.ay).to.be.equal(account1.ay);
        expect(s2_3.ethAddr).to.be.equal(account1.ethAddr);
        expect(s2_3.balance.toString()).to.be.equal(Scalar.e(3000).toString());
        expect(s2_3.tokenID).to.be.equal(2);
        expect(s2_3.nonce).to.be.equal(0);
    
        const s3 = await rollupDB.getStateBySignAy(account1.sign, account1.ay);
        expect(lodash.isEqual(s3[0], s2_1)).to.be.equal(true);
        expect(lodash.isEqual(s3[1], s2_3)).to.be.equal(true);
    
        const s4 = await rollupDB.getStateByEthAddr(account1.ethAddr);
        expect(lodash.isEqual(s4[0], s2_1)).to.be.equal(true);
        expect(lodash.isEqual(s4[1], s2_3)).to.be.equal(true);
    
        const s5 = await rollupDB.getStateByEthAddr(account2.ethAddr);
        expect(lodash.isEqual(s5[0], s2_2)).to.be.equal(true);
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
        bb.getInput();

        await rollupDB.consolidate(bb);
    
        const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

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
        bb2.getInput();
        await rollupDB.consolidate(bb2);

        const s1 = await rollupDB.getStateByIdx(256);
        expect(s1.balance.toString()).to.be.equal(Scalar.e(945).toString());

        const s2 = await rollupDB.getStateByIdx(257);
        expect(s2.balance.toString()).to.be.equal(Scalar.e(2000).toString());

        const s3 = await rollupDB.getStateByIdx(258);
        expect(s3.balance.toString()).to.be.equal(Scalar.e(3050).toString());
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
        bb.getInput();

        await rollupDB.consolidate(bb);
    
        const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

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
        bb2.getInput();
        await rollupDB.consolidate(bb2);

        const s1 = await rollupDB.getStateByIdx(256);
        expect(s1.balance.toString()).to.be.equal(Scalar.e(945).toString());

        const s2 = await rollupDB.getStateByIdx(257);
        expect(s2.balance.toString()).to.be.equal(Scalar.e(2000).toString());

        const s3 = await rollupDB.getStateByIdx(258);
        expect(s3.balance.toString()).to.be.equal(Scalar.e(3050).toString());
    });

    it("Should process L2 exit", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDB(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
    
        const account1 = new Account(1);

        depositTx(bb, account1, 1, 1000);
    
        await bb.build();
        bb.getInput();

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
        bb2.getInput();

        await rollupDB.consolidate(bb2);
    
        const s1 = await rollupDB.getStateByIdx(256);
        expect(s1.sign).to.be.equal(account1.sign);
        expect(s1.ay).to.be.equal(account1.ay);
        expect(s1.ethAddr).to.be.equal(account1.ethAddr);
        expect(s1.balance.toString()).to.be.equal(Scalar.e(945).toString());
        expect(s1.tokenID).to.be.equal(1);
        expect(s1.nonce).to.be.equal(1);

        const s1_exit = await rollupDB.getExitTreeInfo(256, 2);
        expect(s1_exit.state.sign).to.be.equal(account1.sign);
        expect(s1_exit.state.ay).to.be.equal(account1.ay);
        expect(s1_exit.state.ethAddr).to.be.equal(account1.ethAddr);
        expect(s1_exit.state.balance.toString()).to.be.equal(Scalar.e(50).toString());
        expect(s1_exit.state.tokenID).to.be.equal(1);
        expect(s1_exit.state.nonce).to.be.equal(0);
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

        const tx = {
            fromIdx: 256,
            toIdx: 257,
            tokenID: 0,
            amount: 50,
            nonce: 0,
            userFee: 126,
        };

        account1.signTx(tx);
        bb.addTx(tx);
        bb.addFeeIdx(260);
        bb.addFeeIdx(261);
        
        await bb.build();

        // Check L1, L2, Fee data
        const resL1Data = "7e5f4552091a69125d5dfcb7b8c2659029395bdf21b0a1688b37f77b1d1d5539ec3b826db5ac78b2513f574a04c50a7d4f8246d7"
        + "00000000000003e80000000000000000000000002b5ad5c4795c026514f8317c7a215e218dccd6cf093985b1993d9f743f9d7d943ed56f38601cb8b1"
        + "96db025f79650c4007c3054d00000000000008c800000000000000000000000000000000000000000000000000000000000000000000000000000000"
        + "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        + "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        + "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        + "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        + "0000000000000000000000000000000000000000";
        
        const resL2Data = "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        + "00000000000000000000000000000000000000000000000000000001000000010100327e";
        
        const resFeeData = "00000104000001050000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        + "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        + "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        + "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
        + "000000000000000000000000000000000000000000000000000000000";

        const batchL1Data = await bb.getL1TxsData();
        const batchL2Data = await bb.getL2TxsData();
        const batchFeeData = await bb.getFeeTxsData();

        expect(resL1Data).to.be.equal(batchL1Data.toString());
        expect(resL2Data).to.be.equal(batchL2Data.toString());
        expect(resFeeData).to.be.equal(batchFeeData.toString());

        // input hash
        const resInputHash = "15603954494048303420269632640815702839748302996299536781443820012903000088868";

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
        const resL1Data = "0".repeat(864);
        const resL2Data = "0".repeat(176);
        const resFeeData = "0".repeat(512);

        const batchL1Data = await bb.getL1TxsData();
        const batchL2Data = await bb.getL2TxsData();
        const batchFeeData = await bb.getFeeTxsData();

        expect(resL1Data).to.be.equal(batchL1Data.toString());
        expect(resL2Data).to.be.equal(batchL2Data.toString());
        expect(resFeeData).to.be.equal(batchFeeData.toString());

        // input hash
        const resInputHash = "15619838842631047522682146668691545717283483538227411762561854652370844145326";

        const batchInputHash = await bb.getHashInputs();
        expect(resInputHash).to.be.equal(batchInputHash.toString());
    });
});