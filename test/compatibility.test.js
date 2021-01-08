const { expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;
const SMTMemDB = require("circomlib").SMTMemDB;
const lodash = require("lodash");

const Account = require("../index").HermezAccount;
const RollupDB = require("../index").RollupDB;
const Constants = require("../index").Constants;
const computeFee = require("../index").feeTable.computeFee;
const txUtils = require("../index").txUtils;
const float16 = require("../index").float16;
const { depositTx } = require("./helpers/test-utils");

describe("Rollup Db - batchbuilder", async function(){

    const db = new SMTMemDB();
    const rollupDB = await RollupDB(db);
    const nTx = 11;
    const nLevels = 16;
    const maxL1Tx = 5;
    const maxFeeTx = 4;

    const accounts = [];
    const numAccounts = 10;

    for (let i = 0; i < numAccounts; i++){
        accounts.push(new Account(i+1));
    }

    it("Should process L1 Deposit and L2 transfer", async () => {
        // log accounts
        const numAccounts = 5;
        for (let i = 0; i < numAccounts; i++){
            console.log(`<-------- ${i} ------->`);
            console.log(`pvtKeyEth: ${accounts[i].privateKey}`);
            console.log(`   ethAddr: ${accounts[i].ethAddr}`);
            console.log(`rollupPrvKey: ${accounts[i].rollupPrvKey.toString("hex")}`);
            console.log(`   bjjPub: ${accounts[i].compressedGO.toString("hex")}`);
        }

        // Batch 0
        const bb0 = await rollupDB.buildBatch(nTx, nLevels, maxL1Tx, maxFeeTx);

        await bb0.build();
        await rollupDB.consolidate(bb0);
        console.log("StateRoot batch 0: ", rollupDB.getRoot());

        // Batch 1
        const bb1 = await rollupDB.buildBatch(nTx, nLevels, maxL1Tx, maxFeeTx);

        await bb1.build();
        await rollupDB.consolidate(bb1);
        console.log("StateRoot batch 1: ", rollupDB.getRoot());

        // Batch 2
        const bb2 = await rollupDB.buildBatch(nTx, nLevels, maxL1Tx, maxFeeTx);

        await depositTx(bb2, accounts[0], 0, 500); // A - token 0: 256
        await depositTx(bb2, accounts[2], 1, 0); // C - token 1: 257
        
        await bb2.build();
        await rollupDB.consolidate(bb2);
        console.log("StateRoot batch 2: ", await rollupDB.getRoot());

        // Batch 3
        const bb3 = await rollupDB.buildBatch(nTx, nLevels, maxL1Tx, maxFeeTx);

        await depositTx(bb3, accounts[0], 1, 500); // A - token 1: 258
        
        await bb3.build();
        await rollupDB.consolidate(bb3);
        console.log("StateRoot batch 3: ", await rollupDB.getRoot());

        // Batch 4
        const bb4 = await rollupDB.buildBatch(nTx, nLevels, maxL1Tx, maxFeeTx);
        
        await bb4.build();
        await rollupDB.consolidate(bb4);
        console.log("StateRoot batch 4: ", await rollupDB.getRoot());

        // Batch 5
        const bb5 = await rollupDB.buildBatch(nTx, nLevels, maxL1Tx, maxFeeTx);

        const tx = {
            fromIdx: 0,
            loadAmountF: 500,
            tokenID: 0,
            fromBjjCompressed: accounts[1].bjjCompressed,
            fromEthAddr: accounts[1].ethAddr,
            toIdx: 256, // A-token 0
            amount: 100,
            userFee: 0,
            onChain: true
        };

        bb5.addTx(tx); // B - token 0: 259

        await bb5.build();
        await rollupDB.consolidate(bb5);
        console.log("StateRoot batch 5: ", await rollupDB.getRoot());

        // batch 6
        // Load GO JSON
        const bb6 = await rollupDB.buildBatch(nTx, nLevels, maxL1Tx, maxFeeTx);
        
        await depositTx(bb6, accounts[4], 0, 800); // D - token 0: 260
        
        // coord
        await depositTx(bb6, accounts[3], 1, 0); // Coord - token 1: 261
        await depositTx(bb6, accounts[3], 0, 0); // Coord - token 0: 262

        // non-existing
        await depositTx(bb6, accounts[1], 1, 0); // B - token 1: 263
        await depositTx(bb6, accounts[2], 0, 0); // C - token 0: 264

        // l2 transfers
        const txL2_0 = {
            fromIdx: 258,
            loadAmountF: 0,
            tokenID: 1,
            fromBjjCompressed: 0,
            fromEthAddr: 0,
            toIdx: 263,
            amount: 200,
            userFee: 126,
            onChain: 0,
            nonce: 0,
        };

        const txL2_1 = {
            fromIdx: 259,
            loadAmountF: 0,
            tokenID: 0,
            fromBjjCompressed: 0,
            fromEthAddr: 0,
            toIdx: 264,
            amount: 100,
            userFee: 126,
            nonce: 0,
            onChain: 0,
        };

        accounts[0].signTx(txL2_0);
        accounts[1].signTx(txL2_1);
        bb6.addTx(txL2_0);
        bb6.addTx(txL2_1);

        bb6.addToken(1);
        bb6.addFeeIdx(261);

        bb6.addToken(0);
        bb6.addFeeIdx(262);

        await bb6.build();
        await rollupDB.consolidate(bb6);
        console.log("StateRoot batch 6: ", await rollupDB.getRoot());

        const accountsToCheck = [256, 257, 258, 259, 260, 261, 262];

        for (let i = 0; i < accountsToCheck.length; i++){
            const idx = accountsToCheck[i];
            const stateInfo = await rollupDB.getStateByIdx(idx);
            console.log(`<------ ${idx} ------->`);
            console.log(stateInfo);
        }

        const zkInputs = await bb6.getInput();
        
        const { stringifyBigInts } = require("ffjavascript").utils;
        const zkInputsJSON = JSON.stringify(stringifyBigInts(zkInputs));
        const fs = require("fs");

        fs.writeFileSync("batch6.json", zkInputsJSON);
    });
    
    // batch0: 0
    // batch1: 0
    // batch2: 13644148972047617726265275926674266298636745191961029124811988256139761111521
    // batch3: 12433441613247342495680642890662773367605896324555599297255745922589338651261
    // batch4: 12433441613247342495680642890662773367605896324555599297255745922589338651261
    // batch5: 4191361650490017591061467288209836928064232431729236465872209988325272262963
    // batch6: 7614010373759339299470010949167613050707822522530721724565424494781010548240
    // batch7: 21231789250434471575486264439945776732824482207853465397552873521865656677689






    // it("Should process L2 transfer to ethereum address", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
    
    //     const account1 = new Account(1);
    //     const account2 = new Account(2);

    //     depositTx(bb, account1, 1, 1000);
    //     depositTx(bb, account2, 1, 2000);
    //     depositTx(bb, account2, 1, 3000);
    
    //     await bb.build();
    //     await rollupDB.consolidate(bb);
    
    //     const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

    //     const expectedToIdx = 258;

    //     const tx = {
    //         fromIdx: 256,
    //         toIdx: Constants.nullIdx,
    //         toEthAddr: account2.ethAddr,
    //         tokenID: 1,
    //         amount: Scalar.e(50),
    //         nonce: 0,
    //         userFee: 126, // effective fee is 4
    //     };

    //     account1.signTx(tx);
    //     bb2.addTx(tx);
    
    //     await bb2.build();
    //     await rollupDB.consolidate(bb2);

    //     const s1 = await rollupDB.getStateByIdx(256);
    //     expect(s1.balance.toString()).to.be.equal(Scalar.e(945).toString());

    //     const s2 = await rollupDB.getStateByIdx(257);
    //     expect(s2.balance.toString()).to.be.equal(Scalar.e(2000).toString());

    //     const s3 = await rollupDB.getStateByIdx(258);
    //     expect(s3.balance.toString()).to.be.equal(Scalar.e(3050).toString());

    //     // check L2 tx data availability
    //     const L2TxData = await bb2._L2TxsData();
    //     const L2TxDataDecoded = txUtils.decodeL2Tx(L2TxData, nLevels);

    //     expect(L2TxDataDecoded.userFee).to.be.equal(tx.userFee);
    //     expect(Scalar.e(L2TxDataDecoded.amountF).toString()).to.be.equal(float16.fix2Float(tx.amount).toString());
    //     expect(L2TxDataDecoded.fromIdx).to.be.equal(tx.fromIdx);
    //     expect(L2TxDataDecoded.toIdx).to.be.equal(expectedToIdx);
    // });

    // it("Should process L2 transfer to Bjj address", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
    
    //     const account1 = new Account(1);
    //     const account2 = new Account(2);

    //     depositTx(bb, account1, 1, 1000);
    //     depositTx(bb, account2, 1, 2000);
    //     depositTx(bb, account2, 1, 3000);
    
    //     await bb.build();
    //     await rollupDB.consolidate(bb);
    
    //     const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

    //     const expectedToIdx = 258;

    //     const tx = {
    //         fromIdx: 256,
    //         toIdx: Constants.nullIdx,
    //         toEthAddr: Constants.nullEthAddr,
    //         toBjjAy: account2.ay,
    //         toBjjSign: account2.sign,
    //         tokenID: 1,
    //         amount: Scalar.e(50),
    //         nonce: 0,
    //         userFee: 126, // effective fee is 4
    //     };

    //     account1.signTx(tx);
    //     bb2.addTx(tx);
    
    //     await bb2.build();
    //     await rollupDB.consolidate(bb2);

    //     const s1 = await rollupDB.getStateByIdx(256);
    //     expect(s1.balance.toString()).to.be.equal(Scalar.e(945).toString());

    //     const s2 = await rollupDB.getStateByIdx(257);
    //     expect(s2.balance.toString()).to.be.equal(Scalar.e(2000).toString());

    //     const s3 = await rollupDB.getStateByIdx(258);
    //     expect(s3.balance.toString()).to.be.equal(Scalar.e(3050).toString());

    //     // check L2 tx data availability
    //     const L2TxData = await bb2._L2TxsData();
    //     const L2TxDataDecoded = txUtils.decodeL2Tx(L2TxData, nLevels);

    //     expect(L2TxDataDecoded.userFee).to.be.equal(tx.userFee);
    //     expect(Scalar.e(L2TxDataDecoded.amountF).toString()).to.be.equal(float16.fix2Float(tx.amount).toString());
    //     expect(L2TxDataDecoded.fromIdx).to.be.equal(tx.fromIdx);
    //     expect(L2TxDataDecoded.toIdx).to.be.equal(expectedToIdx);
    // });

    // it("Should process L2 exit", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
    
    //     const account1 = new Account(1);

    //     depositTx(bb, account1, 1, 1000);
    
    //     await bb.build();
    //     await rollupDB.consolidate(bb);
    
    //     const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

    //     const tx = {
    //         fromIdx: 256,
    //         toIdx: Constants.exitIdx,
    //         tokenID: 1,
    //         amount: Scalar.e(50),
    //         nonce: 0,
    //         userFee: 126, // effective fee is 4
    //     };

    //     account1.signTx(tx);
    //     bb2.addTx(tx);
    
    //     await bb2.build();
    //     await rollupDB.consolidate(bb2);
    
    //     const s1 = await rollupDB.getStateByIdx(256);
    //     expect(s1.sign).to.be.equal(account1.sign);
    //     expect(s1.ay).to.be.equal(account1.ay);
    //     expect(s1.ethAddr).to.be.equal(account1.ethAddr);
    //     expect(s1.balance.toString()).to.be.equal(Scalar.e(945).toString());
    //     expect(s1.tokenID).to.be.equal(1);
    //     expect(s1.nonce).to.be.equal(1);

    //     const s1_exit = await rollupDB.getExitTreeInfo(256, 2);
    //     expect(s1_exit.state.sign).to.be.equal(account1.sign);
    //     expect(s1_exit.state.ay).to.be.equal(account1.ay);
    //     expect(s1_exit.state.ethAddr).to.be.equal(account1.ethAddr);
    //     expect(s1_exit.state.balance.toString()).to.be.equal(Scalar.e(50).toString());
    //     expect(s1_exit.state.tokenID).to.be.equal(1);
    //     expect(s1_exit.state.nonce).to.be.equal(0);

    //     // check L2 tx data availability
    //     const L2TxData = await bb2._L2TxsData();
    //     const L2TxDataDecoded = txUtils.decodeL2Tx(L2TxData, nLevels);

    //     expect(L2TxDataDecoded.userFee).to.be.equal(tx.userFee);
    //     expect(Scalar.e(L2TxDataDecoded.amountF).toString()).to.be.equal(float16.fix2Float(tx.amount).toString());
    //     expect(L2TxDataDecoded.fromIdx).to.be.equal(tx.fromIdx);
    //     expect(L2TxDataDecoded.toIdx).to.be.equal(tx.toIdx);

    //     // check exit root
    //     const exitRoot = await rollupDB.getExitRoot(bb2.batchNumber);
    //     const oldExitRoot = await rollupDB.getExitRoot(bb2.batchNumber - 1); // empty exit root
    //     const exitRootNonExisting = await rollupDB.getExitRoot(bb2.batchNumber + 1); // non-existing

    //     expect(exitRoot.toString()).to.be.equal(bb2.exitTree.root.toString());
    //     expect(oldExitRoot.toString()).to.be.equal(Scalar.e(0).toString());
    //     expect(exitRootNonExisting).to.be.equal(null);
    // });

    // it("Should check fee accumulated, fee plan tokens, fee idxs & pay fees on L2", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
        
    //     const account1 = new Account(1);
    //     const account2 = new Account(2);

    //     const feeAccount1 = new Account(3);
    //     const feeAccount2 = new Account(4);
        
    //     depositTx(bb, account1, 1, 1000);
    //     depositTx(bb, account2, 1, 1000);
    //     depositTx(bb, account1, 2, 1000);
    //     depositTx(bb, account2, 2, 1000);
    //     depositTx(bb, feeAccount1, 1, 0);
    //     depositTx(bb, feeAccount2, 2, 0);
        
    //     await bb.build();
    //     await rollupDB.consolidate(bb);

    //     const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
        
    //     const tx = {
    //         fromIdx: 256,
    //         toIdx: 257,
    //         tokenID: 1,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 173,
    //     };

    //     const feeTx1 = computeFee(tx.amount, tx.userFee);
    //     account1.signTx(tx);
    //     bb2.addTx(tx);

    //     const tx2 = {
    //         fromIdx: 258,
    //         toIdx: 259,
    //         tokenID: 2,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 126,
    //     };

    //     const feeTx2 = computeFee(tx2.amount, tx2.userFee);
    //     account1.signTx(tx2);
    //     bb2.addTx(tx2);

    //     bb2.addToken(1);
    //     bb2.addFeeIdx(260);

    //     bb2.addToken(2);
    //     bb2.addFeeIdx(261);

    //     await bb2.build();
    //     await rollupDB.consolidate(bb2);

    //     // Total fees accumulated
    //     const feePlanCoins = bb2.feePlanTokens;
    //     const feeTotals = bb2.feeTotals;
    //     const stateFees1 = await rollupDB.getStateByIdx(260);
    //     const stateFees2 = await rollupDB.getStateByIdx(261);

    //     // Token ID1
    //     const indexToken1 = feePlanCoins.indexOf(tx.tokenID);
    //     const feeAcc1 = feeTotals[indexToken1];
    //     expect(Scalar.eq(feeAcc1, feeTx1)).to.be.equal(true);
    //     // Receive fees
    //     expect(stateFees1.sign).to.be.equal(feeAccount1.sign);
    //     expect(stateFees1.ay).to.be.equal(feeAccount1.ay);
    //     expect(stateFees1.ethAddr).to.be.equal(feeAccount1.ethAddr);
    //     expect(stateFees1.balance.toString()).to.be.equal(Scalar.e(feeTx1).toString());
    //     expect(stateFees1.tokenID).to.be.equal(1);
    //     expect(stateFees1.nonce).to.be.equal(0);

    //     // Token ID1
    //     const indexToken2 = feePlanCoins.indexOf(tx2.tokenID);
    //     const feeAcc2 = feeTotals[indexToken2];
    //     expect(Scalar.eq(feeAcc2, feeTx2)).to.be.equal(true);
    //     // Receive fees
    //     expect(stateFees2.sign).to.be.equal(feeAccount2.sign);
    //     expect(stateFees2.ay).to.be.equal(feeAccount2.ay);
    //     expect(stateFees2.ethAddr).to.be.equal(feeAccount2.ethAddr);
    //     expect(stateFees2.balance.toString()).to.be.equal(Scalar.e(feeTx2).toString());
    //     expect(stateFees2.tokenID).to.be.equal(2);
    //     expect(stateFees2.nonce).to.be.equal(0);
    // });

    // it("Should check error L2 tx with loadAmount", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
        
    //     const account1 = new Account(1);
    //     const account2 = new Account(2);
        
    //     depositTx(bb, account1, 0, 1000);
    //     depositTx(bb, account2, 0, 2000);
        
    //     await bb.build();
    //     await rollupDB.consolidate(bb);
        
    //     const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

    //     const tx = {
    //         fromIdx: 256,
    //         toIdx: 257,
    //         loadAmountF: 100,
    //         tokenID: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 173,
    //     };

    //     account1.signTx(tx);
    //     bb2.addTx(tx);

    //     try {
    //         await bb2.build();
    //         expect(true).to.be.equal(false);
    //     } catch (error) {
    //         expect(error.message.includes("Load amount must be 0 for L2 txs")).to.be.equal(true);
    //     }
    // });

    // it("Should check error L2 send to unexisting leaf", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
        
    //     const account1 = new Account(1);
    //     const account2 = new Account(2);
        
    //     depositTx(bb, account1, 0, 1000);
    //     depositTx(bb, account2, 1, 2000);
        
    //     await bb.build();
    //     await rollupDB.consolidate(bb);
        
    //     const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

    //     const tx = {
    //         fromIdx: 256,
    //         toIdx: 527,
    //         tokenID: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 126,
    //     };

    //     account1.signTx(tx);
    //     bb2.addTx(tx);

    //     try {
    //         await bb2.build();
    //         expect(true).to.be.equal(false);
    //     } catch (error) {
    //         expect(error.message.includes("trying to send to a non existing account")).to.be.equal(true);
    //     }
    // });

    // it("Should check error fee selected", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
        
    //     const account1 = new Account(1);
    //     const account2 = new Account(2);
        
    //     depositTx(bb, account1, 0, 1000);
    //     depositTx(bb, account2, 0, 2000);
        
    //     await bb.build();
    //     await rollupDB.consolidate(bb);
        
    //     const bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

    //     const tx = {
    //         fromIdx: 256,
    //         toIdx: 257,
    //         tokenID: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 257,
    //     };

    //     account1.signTx(tx);
    //     bb2.addTx(tx);

    //     try {
    //         await bb2.build();
    //         expect(true).to.be.equal(false);
    //     } catch (error) {
    //         expect(error.message.includes("Fee selected does not exist")).to.be.equal(true);
    //     }
    // });

    // it("Should check non-empty L1, L2, Fee data and input hash", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
        
    //     const account1 = new Account(1);
    //     const account2 = new Account(2);
        
    //     depositTx(bb, account1, 0, 1000);
    //     depositTx(bb, account2, 0, 2000);

    //     // L2 tx
    //     const tx = {
    //         fromIdx: 256,
    //         toIdx: 257,
    //         tokenID: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 126,
    //     };

    //     // L1 tx force transfer
    //     const tx1 = {
    //         fromIdx: 256,
    //         loadAmountF: 0,
    //         tokenID: 0,
    //         fromBjjCompressed: 0,
    //         fromEthAddr: account1.ethAddr,
    //         toIdx: 257,
    //         amount: 100,
    //         userFee: 0,
    //         onChain: true
    //     };

    //     account1.signTx(tx);
    //     bb.addTx(tx);
    //     bb.addTx(tx1);
    //     bb.addFeeIdx(260);
    //     bb.addFeeIdx(261);
        
    //     await bb.build();

    //     // Check L1, txsData, Fee data
    //     const resL1Data = "7e5f4552091a69125d5dfcb7b8c2659029395bdf21b0a1688b37f77b1d1d5539ec3b826db5ac78b2513f574a04c50a7d4f8246d7"
    //     + "00000000000003e80000000000000000000000002b5ad5c4795c026514f8317c7a215e218dccd6cf093985b1993d9f743f9d7d943ed56f38601cb8b1"
    //     + "96db025f79650c4007c3054d00000000000008c80000000000000000000000007e5f4552091a69125d5dfcb7b8c2659029395bdf0000000000000000"
    //     + "000000000000000000000000000000000000000000000000000000000100000000640000000000000000010100000000000000000000000000000000"
    //     + "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    //     + "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    //     + "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    //     + "0000000000000000000000000000000000000000";
        
    //     const resTxsData = "000000000000000000000000000000000000000000000000010000000101006400000001000000010100327e000000000000000"
    //     + "0000000000000000000000000000000000000000000000000000000000000000000000000";

    //     const resTxsDataSM = "0x000000000000000000000000000000000000000000000000010000000101006400000001000000010100327e";
        
    //     const resFeeData = "00000104000001050000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    //     + "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    //     + "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    //     + "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    //     + "000000000000000000000000000000000000000000000000000000000";

    //     const batchL1Data = await bb.getL1TxsFullData();
    //     const batchTxsData = await bb.getL1L2TxsData();
    //     const batchTxsDataSM = await bb.getL1L2TxsDataSM();
    //     const batchFeeData = await bb.getFeeTxsData();

    //     expect(resL1Data).to.be.equal(batchL1Data.toString());
    //     expect(resTxsData).to.be.equal(batchTxsData.toString());
    //     expect(resTxsDataSM).to.be.equal(batchTxsDataSM.toString());
    //     expect(resFeeData).to.be.equal(batchFeeData.toString());

    //     // input hash
    //     const resInputHash = "3848126546564667706487593362615536693612752021773034767490834988872001719450";

    //     const batchInputHash = await bb.getHashInputs();
    //     expect(resInputHash).to.be.equal(batchInputHash.toString());
    // });

    // it("Should check empty L1, L2, Fee data", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
        
    //     await bb.build();
    //     await rollupDB.consolidate(bb);

    //     // Check L1, L2, Fee data
    //     const resL1Data = "0".repeat(864);
    //     const resL2Data = "0".repeat(176);
    //     const resFeeData = "0".repeat(512);

    //     const batchL1Data = await bb.getL1TxsFullData();
    //     const batchL2Data = await bb.getL1L2TxsData();
    //     const batchFeeData = await bb.getFeeTxsData();

    //     expect(resL1Data).to.be.equal(batchL1Data.toString());
    //     expect(resL2Data).to.be.equal(batchL2Data.toString());
    //     expect(resFeeData).to.be.equal(batchFeeData.toString());

    //     // input hash
    //     const resInputHash = "19011969024068128992305188301756127300982198022714122490207475097638130021654";

    //     const batchInputHash = await bb.getHashInputs();
    //     expect(resInputHash).to.be.equal(batchInputHash.toString());
    // });

    // it("Should check error maxNumBatch", async () => {
    //     // Start a new state
    //     const db = new SMTMemDB();
    //     const rollupDB = await RollupDB(db);
    //     const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
        
    //     const account1 = new Account(1);
    //     const account2 = new Account(2);
        
    //     depositTx(bb, account1, 0, 1000);
    //     depositTx(bb, account2, 0, 2000);
        
    //     await bb.build();
    //     await rollupDB.consolidate(bb);
        
    //     let bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
    //     const currentNumBatch = bb2.currentNumBatch;

    //     // maxNumBatch greater than currentNumBatch
    //     const tx = {
    //         fromIdx: 256,
    //         toIdx: 257,
    //         tokenID: 0,
    //         amount: 50,
    //         nonce: 0,
    //         userFee: 120,
    //         maxNumBatch: Scalar.add(currentNumBatch, 1),
    //     };

    //     account1.signTx(tx);
    //     bb2.addTx(tx);
    //     await bb2.build();

    //     // maxNumBatch equal to currentNumBatch
    //     bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
    //     tx.maxNumBatch = currentNumBatch;
    //     account1.signTx(tx);
    //     bb2.addTx(tx);
    //     await bb2.build();

    //     // maxNumBatch less than currentNumBatch
    //     bb2 = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);
    //     tx.maxNumBatch = Scalar.sub(currentNumBatch, 1);
    //     account1.signTx(tx);
    //     bb2.addTx(tx);

    //     try {
    //         await bb2.build();
    //         expect(true).to.be.equal(false);
    //     } catch (error) {
    //         expect(error.message.includes("maxNumBatch must be less than currentBatch")).to.be.equal(true);
    //     }
    // });
});