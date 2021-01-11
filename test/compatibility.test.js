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
        let txL2_0 = {    // 258 to 263
            fromIdx: 258,
            loadAmountF: 0,
            tokenID: 1,
            fromBjjCompressed: 0,
            fromEthAddr: 0,
            toIdx: Constants.nullIdx,
            toEthAddr: accounts[1].ethAddr,
            amount: 200,
            userFee: 126,
            onChain: 0,
            nonce: 0,
        };

        let txL2_1 = {    // 259 to 264
            fromIdx: 259,
            loadAmountF: 0,
            tokenID: 0,
            fromBjjCompressed: 0,
            fromEthAddr: 0,
            toIdx: Constants.nullIdx,
            toEthAddr: accounts[2].ethAddr,
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

        // const accountsToCheck = [256, 257, 258, 259, 260, 261, 262];

        // for (let i = 0; i < accountsToCheck.length; i++){
        //     const idx = accountsToCheck[i];
        //     const stateInfo = await rollupDB.getStateByIdx(idx);
        //     console.log(`<------ ${idx} ------->`);
        //     console.log(stateInfo);
        // }

        // batch 7
        // Load GO JSON
        const bb7 = await rollupDB.buildBatch(nTx, nLevels, maxL1Tx, maxFeeTx);

        // l2 transfers
        txL2_0 = {
            fromIdx: 256,
            loadAmountF: 0,
            tokenID: 1,
            fromBjjCompressed: 0,
            fromEthAddr: 0,
            toIdx: 259,
            amount: 100,
            userFee: 126,
            onChain: 0,
            nonce: 0,
        };

        txL2_1 = {
            fromIdx: 264,
            loadAmountF: 0,
            tokenID: 0,
            fromBjjCompressed: 0,
            fromEthAddr: 0,
            toIdx: 256,
            amount: 50,
            userFee: 126,
            nonce: 0,
            onChain: 0,
        };

        let txL2_2 = {
            fromIdx: 263,
            loadAmountF: 0,
            tokenID: 0,
            fromBjjCompressed: 0,
            fromEthAddr: 0,
            toIdx: 257,
            amount: 100,
            userFee: 126,
            nonce: 0,
            onChain: 0,
        };

        let txL2_3 = {
            fromIdx: 256,
            loadAmountF: 0,
            tokenID: 0,
            fromBjjCompressed: 0,
            fromEthAddr: 0,
            toIdx: Constants.exitIdx,
            amount: 100,
            userFee: 126,
            nonce: 1,
            onChain: 0,
        };

        accounts[0].signTx(txL2_0);
        accounts[2].signTx(txL2_1);
        accounts[1].signTx(txL2_2);
        accounts[0].signTx(txL2_3);
        bb7.addTx(txL2_0);
        bb7.addTx(txL2_1);
        bb7.addTx(txL2_2);
        bb7.addTx(txL2_3);

        bb7.addToken(1);
        bb7.addFeeIdx(261);

        bb7.addToken(0);
        bb7.addFeeIdx(262);

        await bb7.build();
        await rollupDB.consolidate(bb7);
        console.log("StateRoot batch 7: ", await rollupDB.getRoot());

        // batch 8
        // Load GO JSON
        const bb8 = await rollupDB.buildBatch(nTx, nLevels, maxL1Tx, maxFeeTx);

        const txDeposit = {
            fromIdx: 264,
            loadAmountF: 500,
            tokenID: 0,
            fromBjjCompressed: 0,
            fromEthAddr: 0,
            toIdx: 0,
            amount: 0,
            userFee: 0,
            onChain: true
        };
        bb8.addTx(txDeposit);

        const txDepositTransfer = {
            fromIdx: 264,
            loadAmountF: 400,
            tokenID: 0,
            fromBjjCompressed: accounts[2].bjjCompressed,
            fromEthAddr: accounts[2].ethAddr,
            toIdx: 260,
            amount: 100,
            userFee: 0,
            onChain: true
        };
        bb8.addTx(txDepositTransfer);

        const txForceTransfer = {
            fromIdx: 260,
            loadAmountF: 0,
            tokenID: 0,
            fromBjjCompressed: accounts[4].bjjCompressed,
            fromEthAddr: accounts[4].ethAddr,
            toIdx: 259,
            amount: 200,
            userFee: 0,
            onChain: true
        };
        bb8.addTx(txForceTransfer);

        const txForceExit = {
            fromIdx: 259,
            loadAmountF: 0,
            tokenID: 0,
            fromBjjCompressed: accounts[1].bjjCompressed,
            fromEthAddr: accounts[1].ethAddr,
            toIdx: Constants.exitIdx,
            amount: 100,
            userFee: 0,
            onChain: true
        };
        bb8.addTx(txForceExit);

        txL2_0 = {
            fromIdx: 260,
            loadAmountF: 0,
            tokenID: 0,
            fromBjjCompressed: 0,
            fromEthAddr: 0,
            toIdx: 256,
            amount: 300,
            userFee: 126,
            onChain: 0,
            nonce: 0,
        };

        txL2_1 = {
            fromIdx: 259,
            loadAmountF: 0,
            tokenID: 0,
            fromBjjCompressed: 0,
            fromEthAddr: 0,
            toIdx: 260,
            amount: 100,
            userFee: 126,
            nonce: 1,
            onChain: 0,
        };

        accounts[4].signTx(txL2_0);
        accounts[1].signTx(txL2_1);
        bb8.addTx(txL2_0);
        bb8.addTx(txL2_1);

        // bb8.addToken(1);
        // bb8.addFeeIdx(261);

        bb8.addToken(0);
        bb8.addFeeIdx(262);

        await bb8.build();
        await rollupDB.consolidate(bb8);
        console.log("StateRoot batch 8: ", await rollupDB.getRoot());

        const accountsToCheck = [256, 257, 258, 259, 260, 261, 262, 263, 264];

        for (let i = 0; i < accountsToCheck.length; i++){
            const idx = accountsToCheck[i];
            const stateInfo = await rollupDB.getStateByIdx(idx);
            console.log(`<------ ${idx} ------->`);
            console.log(stateInfo);
        }

        const zkInputs = await bb8.getInput();
        
        const { stringifyBigInts } = require("ffjavascript").utils;
        const zkInputsJSON = JSON.stringify(stringifyBigInts(zkInputs));

        const bb8Hash = await bb8.getHashInputs();
        console.log("bb8Hash: ", bb8Hash);

        const strHashGlobalInputs = await bb8.getInputsStr();
        console.log("strHashGlobalInputs: ", strHashGlobalInputs);

        const fs = require("fs");
        fs.writeFileSync("batch8.json", zkInputsJSON);
    });
    
    // batch0: 0
    // batch1: 0
    // batch2: 13644148972047617726265275926674266298636745191961029124811988256139761111521
    // batch3: 12433441613247342495680642890662773367605896324555599297255745922589338651261
    // batch4: 12433441613247342495680642890662773367605896324555599297255745922589338651261
    // batch5: 4191361650490017591061467288209836928064232431729236465872209988325272262963
    // batch6: 7614010373759339299470010949167613050707822522530721724565424494781010548240
    // batch7: 21231789250434471575486264439945776732824482207853465397552873521865656677689
    // batch8: 11289313644810782435120113035387729451095637380468777086895109386127538554246
    // batch9: 10342681351319338354912862547249967104198317571995055517008223832276478908482
});