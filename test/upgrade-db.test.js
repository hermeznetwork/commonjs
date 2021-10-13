const { expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;
const SMTMemDB = require("circomlib").SMTMemDB;
const lodash = require("lodash");

const Account = require("../index").HermezAccount;
const Constants = require("../index").Constants;
const stateUtils = require("../index").stateUtils;
const { depositTx } = require("./helpers/test-utils");
const UpgradeDb = require("../index").upgradeDb;

const {
    RollupDB: RollupDBLegacy
} = require("@hermeznetwork/commonjs-old");

describe("Rollup Db - batchbuilder", async function () {

    const nLevels = 32;
    const maxTx = 8;
    const maxL1Tx = 6;

    it("Should process L1 Deposit and L2 transfer", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDBLegacy(db);
        const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx);

        const account1 = new Account(1);
        const account2 = new Account(2);

        depositTx(bb, account1, 1, 1000);
        depositTx(bb, account2, 1, 2000);

        await bb.build();
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


        const s5 = await rollupDB.getStateByEthAddr(account2.ethAddr);
        expect(lodash.isEqual(s5[0], s2_2)).to.be.equal(true);

        // check state roots
        const stateRoot1 = await rollupDB.getStateRoot(bb.batchNumber);
        expect(stateRoot1.toString()).to.be.equal(bb.stateTree.root.toString());

        const stateRoot2 = await rollupDB.getStateRoot(bb2.batchNumber);
        expect(stateRoot2.toString()).to.be.equal(bb2.stateTree.root.toString());

        const stateRootNonExisting = await rollupDB.getStateRoot(bb2.batchNumber + 1);
        expect(stateRootNonExisting).to.be.equal(null);


        // upgrade DB
        const accountsMigrate = 1000;
        const upgradeDBClass = new UpgradeDb(rollupDB, accountsMigrate, nLevels);
        const rollupDBUpgraded = await upgradeDBClass.doUpgrade();

        // Check lastBatch
        expect(rollupDB.lastBatch + 1).to.be.equal(rollupDBUpgraded.lastBatch);

        // Check state
        const s2_1V1 = await rollupDBUpgraded.getStateByIdx(256);
        const s2_2V1 = await rollupDBUpgraded.getStateByIdx(257);

        for (let key in s2_1) {
            expect(s2_1[key]).to.be.equal(s2_1V1[key]);
            expect(s2_2[key]).to.be.equal(s2_2V1[key]);
        }

        expect(s2_1V1.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s2_1V1.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());

        expect(s2_2V1.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s2_2V1.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());

        // forge batch with upgraded DB
        const bb3 = await rollupDBUpgraded.buildBatch(maxTx, nLevels, maxL1Tx);

        const tx2 = {
            fromIdx: 256,
            toIdx: 257,
            tokenID: 1,
            amount: Scalar.e(50),
            nonce: 1,
            userFee: 126, // effective fee is 4
        };
        account1.signTx(tx2);
        bb3.addTx(tx2);

        await bb3.build();
        await rollupDBUpgraded.consolidate(bb3);

        const s3_1 = await rollupDBUpgraded.getStateByIdx(256);
        expect(s3_1.sign).to.be.equal(account1.sign);
        expect(s3_1.ay).to.be.equal(account1.ay);
        expect(s3_1.ethAddr).to.be.equal(account1.ethAddr);
        expect(s3_1.balance.toString()).to.be.equal(Scalar.e(890).toString());
        expect(s3_1.tokenID).to.be.equal(1);
        expect(s3_1.nonce).to.be.equal(2);
        expect(s3_1.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s3_1.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());

        const newAccHash = stateUtils.computeAccumulatedHash(s2_2V1.accumulatedHash, tx2, nLevels);
        const s3_2 = await rollupDBUpgraded.getStateByIdx(257);
        expect(s3_2.sign).to.be.equal(account2.sign);
        expect(s3_2.ay).to.be.equal(account2.ay);
        expect(s3_2.ethAddr).to.be.equal(account2.ethAddr);
        expect(s3_2.balance.toString()).to.be.equal(Scalar.e(2100).toString());
        expect(s3_2.tokenID).to.be.equal(1);
        expect(s3_2.nonce).to.be.equal(0);
        expect(s3_2.accumulatedHash.toString()).to.be.equal(newAccHash.toString());
        expect(s3_2.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
    });


    it("Should process L2 exit", async () => {
        // Start a new state
        const db = new SMTMemDB();
        const rollupDB = await RollupDBLegacy(db);
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
            userFee: 126, // effective fee is 5
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

        const s1_exit = await rollupDB.getExitTreeInfo(256, 2);
        expect(s1_exit.state.sign).to.be.equal(account1.sign);
        expect(s1_exit.state.ay).to.be.equal(account1.ay);
        expect(s1_exit.state.ethAddr).to.be.equal(account1.ethAddr);
        expect(s1_exit.state.balance.toString()).to.be.equal(Scalar.e(50).toString());
        expect(s1_exit.state.tokenID).to.be.equal(1);
        expect(s1_exit.state.nonce).to.be.equal(0);


        // upgrade DB
        const accountsMigrate = 1000;
        const upgradeDBClass = new UpgradeDb(rollupDB, accountsMigrate, nLevels);
        const rollupDBUpgraded = await upgradeDBClass.doUpgrade();

        // Check lastBatch
        expect(rollupDB.lastBatch + 1).to.be.equal(rollupDBUpgraded.lastBatch);

        // Check state
        const s1V1 = await rollupDBUpgraded.getStateByIdx(256);

        for (let key in s1) {
            expect(s1V1[key]).to.be.equal(s1[key]);
        }
        expect(s1V1.exitBalance.toString()).to.be.equal(Scalar.e(0).toString());
        expect(s1V1.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());


        const tx2 = {
            fromIdx: 256,
            toIdx: Constants.exitIdx,
            tokenID: 1,
            amount: Scalar.e(50),
            nonce: 1,
            userFee: 126, // effective fee is 5
        };

        account1.signTx(tx2);

        const bb3 = await rollupDBUpgraded.buildBatch(maxTx, nLevels, maxL1Tx);
        bb3.addTx(tx2);

        await bb3.build();
        await rollupDBUpgraded.consolidate(bb3);

        const s1_2 = await rollupDBUpgraded.getStateByIdx(256);
        expect(s1_2.sign).to.be.equal(account1.sign);
        expect(s1_2.ay).to.be.equal(account1.ay);
        expect(s1_2.ethAddr).to.be.equal(account1.ethAddr);
        expect(s1_2.balance.toString()).to.be.equal(Scalar.e(890).toString());
        expect(s1_2.tokenID).to.be.equal(1);
        expect(s1_2.nonce).to.be.equal(2);
        expect(s1_2.exitBalance.toString()).to.be.equal(Scalar.e(50).toString());
        expect(s1_2.accumulatedHash.toString()).to.be.equal(Scalar.e(0).toString());

        const s1_exitLegacy = await rollupDB.getExitTreeInfo(256, 2);
        for (let key in s1_exit) {
            expect(s1_exitLegacy[key]).to.be.deep.equal(s1_exit[key]);
        }

        // check that legacy and new db returns the same in the same exit information
        const s1_exitLegacyV1 = await rollupDBUpgraded.getExitInfo(256, 2);
        expect(lodash.isEqual(s1_exitLegacyV1, s1_exitLegacy)).to.be.equal(true);

        const s1_exitV1 = await rollupDBUpgraded.getExitInfo(256, 4);
        expect(lodash.isEqual(s1_exitV1.state, s1_2)).to.be.equal(true);
    });
});
