const { expect } = require("chai");
const lodash = require("lodash");
const SMTMemDB = require("circomlib").SMTMemDB;
const { stringifyBigInts } = require("ffjavascript").utils;
const util = require("util");
const exec = util.promisify( require("child_process").exec);

const Account = require("../index").HermezAccount;
const RollupDB = require("../index").RollupDB;
const Constants = require("../index").Constants;
const SMTLevelDb = require("../index").SMTLevelDb;
const { depositTx } = require("./helpers/test-utils");

async function initRollupDb(rollupDB) {

    const nLevels = 32;
    const maxTx = 32;
    const maxL1Tx = 16;
    const maxFeeTx = 64;

    const bb = await rollupDB.buildBatch(maxTx, nLevels, maxL1Tx, maxFeeTx);

    const account1 = new Account(1);
    const account2 = new Account(2);

    account1.idx = Constants.firstIdx + 1;
    account2.idx = Constants.firstIdx + 2;

    depositTx(bb, account1, 0, 1000);
    depositTx(bb, account2, 0, 1000);

    const txL1DepositTransfer = {
        fromIdx: account1.idx,
        loadAmountF: 200,
        tokenID: 0,
        fromBjjCompressed: 0,
        fromEthAddr: account1.ethAddr,
        toIdx: account2.idx,
        amount: 100,
        userFee: 126,
        onChain: true
    };

    const txL1ForceTransfer = {
        fromIdx: account2.idx,
        loadAmountF: 0,
        tokenID: 0,
        fromBjjCompressed: 0,
        fromEthAddr: account2.ethAddr,
        toIdx: account2.idx,
        amount: 100,
        userFee: 0,
        onChain: true
    };

    const txL1ForceExit = {
        fromIdx: account1.idx,
        loadAmountF: 0,
        tokenID: 0,
        fromBjjCompressed: 0,
        fromEthAddr: account1.ethAddr,
        toIdx: Constants.exitIdx,
        amount: 300,
        userFee: 100,
        onChain: true
    };

    const txL2Transfer = {
        fromIdx: account1.idx,
        loadAmountF: 0,
        tokenID: 0,
        fromBjjCompressed: 0,
        fromEthAddr: 0,
        toIdx: account2.idx,
        amount: 150,
        userFee: 126,
        onChain: 0,
        nonce: 0,
    };
    account1.signTx(txL2Transfer);

    const txL2Exit = {
        fromIdx: account2.idx,
        loadAmountF: 0,
        tokenID: 0,
        fromBjjCompressed: 0,
        fromEthAddr: 0,
        toIdx: Constants.exitIdx,
        amount: 100,
        userFee: 68,
        nonce: 0,
        onChain: 0,
    };
    account2.signTx(txL2Exit);

    const txL2TransferToEthAddr = {
        fromIdx: account1.idx,
        toIdx: Constants.nullIdx,
        toEthAddr: Constants.nullEthAddr,
        toBjjAy: account2.ay,
        toBjjSign: account2.sign,
        tokenID: 1,
        amount: 100,
        nonce: 1,
        userFee: 159,
    };
    account1.signTx(txL2TransferToEthAddr);

    const txL2TransferToBjj = {
        fromIdx: account2.idx,
        toIdx: Constants.nullIdx,
        toEthAddr: account1.ethAddr,
        tokenID: 1,
        amount: 500,
        nonce: 1,
        userFee: 184,
    };
    account2.signTx(txL2TransferToBjj);

    bb.addTx(txL1DepositTransfer);
    bb.addTx(txL1ForceTransfer);
    bb.addTx(txL1ForceExit);
    bb.addTx(txL2Transfer);
    bb.addTx(txL2Exit);

    await bb.build();
    await rollupDB.consolidate(bb);
}

async function assertDbs(memDb, toCheckDb){
    // Check root
    const memRoot = await memDb.db.getRoot();
    const checkRoot = await toCheckDb.db.getRoot();
    expect(memRoot.toString()).to.be.equal(checkRoot.toString());

    // Check database
    const keys = Object.keys(memDb.db.nodes);
    for (const key of keys) {
        const valueMem = JSON.stringify(stringifyBigInts(await memDb.db.get(key)));
        const valueToCheck = JSON.stringify(stringifyBigInts(await toCheckDb.db.get(key)));
        expect(lodash.isEqual(valueMem, valueToCheck)).to.be.equal(true);
    }
}

describe("RollupDb: memDb - LevelDb", async function () {

    let rollupMemDb;
    let rollupLevelDb;

    const pathDb = `${__dirname}/tmp-rollupDb`;

    it("should initialize with memory database", async () => {
        const db = new SMTMemDB();
        rollupMemDb = await RollupDB(db);
        await initRollupDb(rollupMemDb);
    });

    it("should initialize with level-db database", async () => {
        const db = new SMTLevelDb(pathDb);
        rollupLevelDb = await RollupDB(db);
        await initRollupDb(rollupLevelDb);
    });

    it("should check equal databases", async () => {
        await assertDbs(rollupMemDb, rollupLevelDb);
    });

    after(async () => {
        await exec(`rm -rf ${pathDb}`);
    });
});