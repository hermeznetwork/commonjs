const { expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;
const SMTMemDB = require("circomlib").SMTMemDB;

const Account = require("../index").HermezAccount;
const RollupDB = require("../index").RollupDB;
const Constants = require("../index").Constants;
const feeUtils = require("../index").feeTable;
const { depositTx, depositOnlyExitTx } = require("./helpers/test-utils");

describe("RollupDb - migrationBuilder", async function(){
    this.timeout(60000);

    const nLevels = 32;
    const maxTx = 8;
    const maxL1Tx = 6;

    const maxMigrationTx = 200;

    it("Should process two migration transactions with fees", async () => {
        // RollupSourceDB
        const db = new SMTMemDB();
        const rollupSourceDB = await RollupDB(db);
        const bb = await rollupSourceDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const account2 = new Account(2);
        const account3 = new Account(3);
        const accountDestRollup = new Account(4);

        depositTx(bb, account1, 1, 1000);
        depositTx(bb, account2, 1, 2000);
        depositOnlyExitTx(bb, accountDestRollup, 1, 0);

        const migrationIdx = 258;

        await bb.build();
        await rollupSourceDB.consolidate(bb);

        const bb2 = await rollupSourceDB.buildBatch(maxTx, nLevels, maxL1Tx);
        // two sends to exit-only account
        const tx = {
            fromIdx: 256,
            toIdx: 258,
            tokenID: 1,
            amount: Scalar.e(20),
            nonce: 0,
            userFee: 125,
        };

        const tx2 = {
            fromIdx: 257,
            toIdx: 258,
            tokenID: 1,
            amount: Scalar.e(100),
            nonce: 0,
            userFee: 127,
        };

        account1.signTx(tx);
        account2.signTx(tx2);
        bb2.addTx(tx);
        bb2.addTx(tx2);

        await bb2.build();
        await rollupSourceDB.consolidate(bb2);

        // add empty batches to migrate minBatches
        const bbToBuild = 10;

        while (rollupSourceDB.lastBatch < bbToBuild){
            const bb = await rollupSourceDB.buildBatch(maxTx, nLevels, maxL1Tx);
            bb.build();
            await rollupSourceDB.consolidate(bb);
        }

        // RollupDestinyDB
        const destDb = new SMTMemDB();
        const rollupDestDB = await RollupDB(destDb);
        const destBb = await rollupDestDB.buildBatch(maxTx, nLevels, maxL1Tx);

        depositTx(destBb, account2, 1, 2000);
        depositTx(destBb, account3, 1, 0);
        await rollupDestDB.setMigrationIdx(migrationIdx);

        await destBb.build();
        await rollupDestDB.consolidate(destBb);
        const oldStateRoot = rollupDestDB.stateRoot;
        const oldLastBatch = rollupDestDB.lastBatch;
        const oldInitialIdx = rollupDestDB.initialIdx;

        // migration-builder
        const initBatch = 1;
        const finalBatch = 10;

        const mb = await rollupDestDB.buildMigration(maxMigrationTx, nLevels, rollupSourceDB, initBatch, finalBatch);
        mb.setFeeIdx(257);

        await mb.build();
        await rollupDestDB.consolidateMigrate(mb);

        // check accounts has been migrated correctly
        const feeTx1 = feeUtils.computeFee(tx.amount, tx.userFee);
        const feeTx2 = feeUtils.computeFee(tx2.amount, tx2.userFee);

        const source1 = await rollupSourceDB.getStateByIdx(256);
        const source2 = await rollupSourceDB.getStateByIdx(257);
        const source3 = await rollupSourceDB.getStateByIdx(258);

        const dest1 = await rollupDestDB.getStateByIdx(256);
        const dest2 = await rollupDestDB.getStateByIdx(257);
        const dest3 = await rollupDestDB.getStateByIdx(258);

        // account2 to be updated in dest1 leaf
        expect(dest1.sign).to.be.equal(source2.sign);
        expect(dest1.ay).to.be.equal(source2.ay);
        expect(dest1.ethAddr).to.be.equal(source2.ethAddr);
        expect(dest1.balance.toString()).to.be.equal(Scalar.add(2000, Scalar.sub(tx2.amount, feeTx2)).toString());
        expect(dest1.tokenID).to.be.equal(source2.tokenID);
        expect(dest1.nonce).to.be.equal(0);
        expect(dest1.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(dest1.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());

        // account1 to insert a new leaf in dest3
        expect(dest3.sign).to.be.equal(source1.sign);
        expect(dest3.ay).to.be.equal(source1.ay);
        expect(dest3.ethAddr).to.be.equal(source1.ethAddr);
        expect(dest3.balance.toString()).to.be.equal(Scalar.sub(tx.amount, feeTx1).toString());
        expect(dest3.tokenID).to.be.equal(source1.tokenID);
        expect(dest3.nonce).to.be.equal(0);
        expect(dest3.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(dest3.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());

        // account3 to receive fees
        expect(dest2.sign).to.be.equal(account3.sign);
        expect(dest2.ay).to.be.equal(account3.ay);
        expect(dest2.ethAddr).to.be.equal(account3.ethAddr);
        expect(dest2.balance.toString()).to.be.equal(Scalar.add(feeTx1, feeTx2).toString());
        expect(dest2.tokenID).to.be.equal(1);
        expect(dest2.nonce).to.be.equal(0);
        expect(dest2.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(dest2.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());

        // check migrationIdx
        expect(source3.sign).to.be.equal(Constants.onlyExitBjjSign);
        expect(source3.ay).to.be.equal(Constants.onlyExitBjjAy.slice(2));
        expect(source3.ethAddr).to.be.equal(accountDestRollup.ethAddr);

        // check migration consolidate
        expect(rollupDestDB.lastBatch).to.be.equal(oldLastBatch + 1);
        expect(rollupDestDB.stateRoot.toString()).to.not.be.equal(oldStateRoot.toString());
        expect(rollupDestDB.initialIdx).to.be.equal(oldInitialIdx + 1);
    });

    it("Should migrate migrationTx > Constants.minTxToMigrate in 2 batches", async () => {
        const newMaxTx = 5 * Constants.minTxToMigrate;
        const numTxMigrate = 2 * Constants.minTxToMigrate;
        const newMaxMigrationTx = newMaxTx;

        // RollupSourceDB
        const db = new SMTMemDB();
        const rollupSourceDB = await RollupDB(db);
        const bb = await rollupSourceDB.buildBatch(newMaxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const accountDestRollup = new Account(3);

        depositTx(bb, account1, 1, 1000);
        depositOnlyExitTx(bb, accountDestRollup, 1, 0);

        const migrationIdx = 257;

        await bb.build();
        await rollupSourceDB.consolidate(bb);

        const bb2 = await rollupSourceDB.buildBatch(newMaxTx, nLevels, maxL1Tx);

        let nonceTrack = 0;
        for (let i = 0; i < numTxMigrate; i++){
            const tx = {
                fromIdx: 256,
                toIdx: 257,
                tokenID: 1,
                amount: Scalar.e(1),
                nonce: nonceTrack++,
                userFee: 0,
            };

            account1.signTx(tx);
            bb2.addTx(tx);
        }

        await bb2.build();
        await rollupSourceDB.consolidate(bb2);

        // RollupDestinyDB
        const destDb = new SMTMemDB();
        const rollupDestDB = await RollupDB(destDb);
        const destBb = await rollupDestDB.buildBatch(newMaxTx, nLevels, maxL1Tx);

        await rollupDestDB.setMigrationIdx(migrationIdx);

        await destBb.build();
        await rollupDestDB.consolidate(destBb);

        // migration-builder
        const initBatch = 1;
        const finalBatch = 2;

        const mb = await rollupDestDB.buildMigration(newMaxMigrationTx, nLevels, rollupSourceDB, initBatch, finalBatch);

        await mb.build();
        await rollupDestDB.consolidateMigrate(mb);

        // check all migration txs has been processed
        // first migration transaction creates a new leaf
        // follwoing ones update that leaf
        const dest1 = await rollupDestDB.getStateByIdx(256);
        expect(dest1.sign).to.be.equal(account1.sign);
        expect(dest1.ay).to.be.equal(account1.ay);
        expect(dest1.ethAddr).to.be.equal(account1.ethAddr);
        expect(dest1.balance.toString()).to.be.equal(Scalar.e(numTxMigrate).toString());
        expect(dest1.tokenID).to.be.equal(1);
        expect(dest1.nonce).to.be.equal(0);
        expect(dest1.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(dest1.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());
    });

    it("Should check errors", async () => {
        // RollupSourceDB
        const db = new SMTMemDB();
        const rollupSourceDB = await RollupDB(db);
        const bb = await rollupSourceDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const account2 = new Account(2);
        const account3 = new Account(3);
        const accountDestRollup = new Account(4);

        depositTx(bb, account1, 1, 1000);
        depositTx(bb, account2, 1, 2000);
        depositOnlyExitTx(bb, accountDestRollup, 1, 0);

        const migrationIdx = 258;

        await bb.build();
        await rollupSourceDB.consolidate(bb);

        const bb2 = await rollupSourceDB.buildBatch(maxTx, nLevels, maxL1Tx);
        // two sends to exit-only account
        const tx = {
            fromIdx: 256,
            toIdx: 258,
            tokenID: 1,
            amount: Scalar.e(20),
            nonce: 0,
            userFee: 125,
        };

        const tx2 = {
            fromIdx: 257,
            toIdx: 258,
            tokenID: 1,
            amount: Scalar.e(100),
            nonce: 0,
            userFee: 127,
        };

        account1.signTx(tx);
        account2.signTx(tx2);
        bb2.addTx(tx);
        bb2.addTx(tx2);

        await bb2.build();
        await rollupSourceDB.consolidate(bb2);

        // RollupDestinyDB
        const destDb = new SMTMemDB();
        const rollupDestDB = await RollupDB(destDb);
        const destBb = await rollupDestDB.buildBatch(maxTx, nLevels, maxL1Tx);

        depositTx(destBb, account2, 1, 2000);
        depositTx(destBb, account3, 1, 0);
        depositTx(destBb, account3, 2, 0);
        await rollupDestDB.setMigrationIdx(migrationIdx);

        await destBb.build();
        await rollupDestDB.consolidate(destBb);

        // check error: initial batch does not exit
        let initBatch = 3;
        let finalBatch = 4;

        const mb = await rollupDestDB.buildMigration(maxMigrationTx, nLevels, rollupSourceDB, initBatch, finalBatch);
        try {
            await mb.build();
            expect(true).to.be.equal(false);
        } catch (error){
            expect(error.message.includes("ERROR: Initial batch to migrate does not exist")).to.be.equal(true);
        }

        // check error: final batch does not exit
        initBatch = 1;
        const mb2 = await rollupDestDB.buildMigration(maxMigrationTx, nLevels, rollupSourceDB, initBatch, finalBatch);
        try {
            await mb2.build();
            expect(true).to.be.equal(false);
        } catch (error){
            expect(error.message.includes("ERROR: Final batch to migrate does not exist")).to.be.equal(true);
        }

        // check error: not enough batches or transactions
        finalBatch = 2;
        const mb3 = await rollupDestDB.buildMigration(maxMigrationTx, nLevels, rollupSourceDB, initBatch, finalBatch);
        try {
            await mb3.build();
            expect(true).to.be.equal(false);
        } catch (error){
            expect(error.message.includes("ERROR: Not enough batches to migrate neither enough transactions")).to.be.equal(true);
        }

        // add empty batches to skip min batches check
        const bbToBuild = 10;

        while (rollupSourceDB.lastBatch < bbToBuild){
            const bb = await rollupSourceDB.buildBatch(maxTx, nLevels, maxL1Tx);
            bb.build();
            await rollupSourceDB.consolidate(bb);
        }

        initBatch = 1;
        finalBatch = 10;

        // check error: feeIdx does not exist
        const mb4 = await rollupDestDB.buildMigration(maxMigrationTx, nLevels, rollupSourceDB, initBatch, finalBatch);
        mb4.setFeeIdx(260);
        try {
            await mb4.build();
            expect(true).to.be.equal(false);
        } catch (error){
            expect(error.message.includes("ERROR: feeIdx does not exist")).to.be.equal(true);
        }

        // check error: feeIdx tokenID does not match
        const mb5 = await rollupDestDB.buildMigration(maxMigrationTx, nLevels, rollupSourceDB, initBatch, finalBatch);
        mb5.setFeeIdx(258);
        try {
            await mb5.build();
            expect(true).to.be.equal(false);
        } catch (error){
            expect(error.message.includes("ERROR: feeIdx tokenID does not match with tokenID of migrationIdx")).to.be.equal(true);
        }
    });
});
