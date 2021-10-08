const assert = require("assert");
const Scalar = require("ffjavascript").Scalar;
const poseidonHash = require("circomlib").poseidon;
const SMT = require("circomlib").SMT;

const SMTTmpDb = require("./smt-tmp-db");
const feeUtils = require("./fee-table");
const utils = require("./utils");
const stateUtils = require("./state-utils");
const txUtils = require("./tx-utils");
const Constants = require("./constants");

/**
 * Builds and process migration transactions
 */
class MigrationBuilder {
    constructor(
        rollupDB,
        batchNumber,
        root,
        initialIdx,
        maxMigrationTx,
        nLevels,
        sourceRollupDB,
        initBatchToMigrate,
        finalBatchToMigrate,
        migrationIdx
    ) {
        assert((nLevels % 8) == 0);
        this.rollupDB = rollupDB;
        this.batchNumber = batchNumber;
        this.currentNumBatch = Scalar.e(batchNumber);
        this.initialIdx = initialIdx;
        this.finalIdx = initialIdx;
        this.maxMigrationTx = maxMigrationTx;
        this.nLevels = nLevels;
        this.dbState = new SMTTmpDb(rollupDB.db);
        this.stateTree = new SMT(this.dbState, root);

        this.sourceRollupDB = sourceRollupDB;
        this.initBatchToMigrate = initBatchToMigrate;
        this.finalBatchToMigrate = finalBatchToMigrate;
        this.totalBatches = this.finalBatchToMigrate - this.initBatchToMigrate + 1;
        this.migrationIdx = migrationIdx;

        this.accumulatedFee = Scalar.e(0);

        this._initBits();
    }

    /**
     * Initialize parameters
     */
    _initBits(){
        this.maxIdxB = Constants.maxNlevels;
        this.idxB = this.nLevels;
        this.rootB = 256;
        this.chainIDB = 16;
        this.fromEthAddrB = 160;
        this.fromBjjCompressedB = 256;
        this.f40B = 40;
        this.tokenIDB = 32;
        this.feeB = 8;
        this.numBatchB = 32;
    }

    /**
     * Build the migration batch
     * Adds all the transactions and calculate the inputs for the circuit
     */
    async build(){
        await this._sanityChecks();

        this.input = {
            // Intermediary States to parallelize witness computation
            // decode-compute-acc-hash
            imOutAccHash: [],
            imOutCounter: [],
            // rollup-tx
            imStateRoot: [],
            imAccFeeOut: [],
            imOutIdx: [],
            // hash global inputs
            imFinalOutIdx: this.finalIdx,
            // fee-tx
            imInitStateRootFeeTx: 0,
            imFinalAccFee: 0,

            // inputs to compute hash global inputs
            initSourceStateRoot: await this.sourceRollupDB.getStateRoot(this.initBatchToMigrate),
            finalSourceStateRoot: await this.sourceRollupDB.getStateRoot(this.finalBatchToMigrate),
            oldStateRoot: this.stateTree.root,
            oldLastIdx: this.finalIdx,
            migrationIdx: this.migrationIdx,
            feeIdx: this.feeIdx || 0, // 0 means no fee is collected
            totalBatchesToMigrate: this.totalBatches,

            // signals needed to proof accumulatedHash in initSourceStateRoot & finalSourceStateRoot
            tokenID: 0,
            initBalance: 0,
            finalBalance: 0,
            ethAddr: 0,
            initExitBalance: 0,
            finalExitBalance: 0,
            initAccHash: 0,
            finalAccHash: 0,
            initSiblings: [],
            finalSiblings: [],

            // data availability for each transaction to process
            L1L2TxsData: [],

            // signals to proof fromIdx[nTx] data correctness
            tokenID1: [],
            nonce1: [],
            sign1: [],
            balance1: [],
            ay1: [],
            ethAddr1: [],
            exitBalance1: [],
            accumulatedHash1: [],
            siblings1: [],

            // signals needed to process migration transactions
            // signaling add balance to the same leaf or create new one
            idxDestiny: [],
            // receiver state
            nonce2: [],
            balance2: [],
            exitBalance2: [],
            accumulatedHash2: [],
            siblings2: [],
            // Required for inserts and deletes
            isOld0_2: [],
            oldKey2: [],
            oldValue2: [],

            tokenID3: 0,
            nonce3: 0,
            sign3: 0,
            balance3: 0,
            ay3: 0,
            ethAddr3: 0,
            exitBalance3: 0,
            accumulatedHash3: 0,
            siblings3: []
        };

        await this._proofAccHashInitAndFinal();
        await this._proofCorrectnessDataAvailability();
        await this._minBatchMinTxCheck();
        await this._processMigrateTxs();

        for (let i = this.totalMigrationTx; i < this.maxMigrationTx; i++){
            await this._addNopTx(i);
        }

        await this._processFeeTxs();

        this.builded = true;
    }

    /**
     * Verify accumulated hash for init and final batch
     */
    async _proofAccHashInitAndFinal(){
        const initState = await this.sourceRollupDB.getStateTreeInfo(this.migrationIdx, this.initBatchToMigrate);
        const finalState = await this.sourceRollupDB.getStateTreeInfo(this.migrationIdx, this.finalBatchToMigrate);

        this.input.tokenID = Scalar.e(initState.state.tokenID);
        this.input.initBalance = Scalar.e(initState.state.balance);
        this.input.finalBalance = Scalar.e(finalState.state.balance);
        this.input.ethAddr = Scalar.fromString(finalState.state.ethAddr, 16);
        this.input.initExitBalance = Scalar.e(initState.state.exitBalance);
        this.input.finalExitBalance = Scalar.e(finalState.state.exitBalance);
        this.input.initAccHash = Scalar.e(initState.state.accumulatedHash);
        this.input.finalAccHash = Scalar.e(finalState.state.accumulatedHash);

        let initSiblings = initState.siblings;
        while (initSiblings.length < this.nLevels + 1) initSiblings.push(Scalar.e(0));
        let finalSiblings = finalState.siblings;
        while (finalSiblings.length < this.nLevels + 1) finalSiblings.push(Scalar.e(0));

        this.input.initSiblings = initSiblings;
        this.input.finalSiblings = finalSiblings;
    }

    /**
     * Verify data availability data
     */
    async _proofCorrectnessDataAvailability(){
        // get data-availability for all batches processed
        let allL1L2Data = [];

        for (let i = 0; i < this.totalBatches; i++){
            const numBatch = this.initBatchToMigrate + i;
            const l1L2Data = await this.sourceRollupDB.getL1L2Data(numBatch);
            allL1L2Data = [...allL1L2Data, ...l1L2Data];
        }

        // filter by toIdx
        const finalL1L2Data = allL1L2Data.filter(data => (txUtils.decodeL2Tx(data, this.nLevels)).toIdx === Scalar.toNumber(this.migrationIdx));
        this.totalMigrationTx = finalL1L2Data.length;

        let tmpAccHash = this.input.initAccHash;

        for (let i = 0; i < this.totalMigrationTx; i++){
            const fromIdx = (txUtils.decodeL2Tx(finalL1L2Data[i], this.nLevels)).fromIdx;
            const state = await this.sourceRollupDB.getStateTreeInfo(fromIdx, this.finalBatchToMigrate);

            this.input.L1L2TxsData[i] = Scalar.fromString(finalL1L2Data[i], 16);
            this.input.tokenID1[i] = Scalar.e(state.state.tokenID);
            this.input.nonce1[i] = Scalar.e(state.state.nonce);
            this.input.sign1[i] = Scalar.e(state.state.sign);
            this.input.balance1[i] = Scalar.e(state.state.balance);
            this.input.ay1[i] = Scalar.fromString(state.state.ay, 16);
            this.input.ethAddr1[i] = Scalar.fromString(state.state.ethAddr, 16);
            this.input.exitBalance1[i] = Scalar.e(state.state.exitBalance);
            this.input.accumulatedHash1[i] = Scalar.e(state.state.accumulatedHash);

            let siblings = state.siblings;
            while (siblings.length < this.nLevels + 1) siblings.push(Scalar.e(0));

            this.input.siblings1[i] = siblings;

            tmpAccHash = stateUtils.computeAccumulatedHash(tmpAccHash, txUtils.decodeL2Tx(finalL1L2Data[i], this.nLevels), this.nLevels);

            // intermediary signals
            if (i < this.maxMigrationTx - 1) {
                this.input.imOutAccHash[i] = tmpAccHash;
                this.input.imOutCounter[i] = i + 1;
            }
        }
    }

    /**
     * Process all migration transactions
     */
    async _processMigrateTxs(){
        for (let i = 0; i < this.totalMigrationTx; i++){
            // check if a leaf could be updated: must match tokenID, sign, ay & ethAddr
            // get states by ethAddr
            const idxDestiny = await this._findIdx(i);
            const op = (idxDestiny === 0) ? "INSERT" : "UPDATE";

            let oldState;
            let newState;
            let fee2Charge;
            let depositAmount;
            const L1L2Hex = txUtils.scalarToHexL2Data(this.input.L1L2TxsData[i]);
            const dataTx = txUtils.decodeL2Tx(L1L2Hex, this.nLevels);

            fee2Charge = feeUtils.computeFee(dataTx.amount, dataTx.userFee);

            const underFlowOk = Scalar.geq(Scalar.sub(dataTx.amount, fee2Charge), 0);
            if (underFlowOk){
                depositAmount = Scalar.sub(dataTx.amount, fee2Charge);
            } else {
                depositAmount = 0;
                fee2Charge = dataTx.amount;
            }

            this.accumulatedFee = Scalar.add(this.accumulatedFee, fee2Charge);

            if (op === "INSERT"){
                this.finalIdx += 1;
                this.input.idxDestiny[i] = Scalar.e(0);

                // build new state
                oldState = {
                    balance: Scalar.e(0),
                    tokenID: this.input.tokenID1[i],
                    nonce: 0,
                    sign: this.input.sign1[i],
                    ay: this.input.ay1[i].toString(16),
                    ethAddr: this.input.ethAddr1[i].toString(16),
                    exitBalance: Scalar.e(0),
                    accumulatedHash: Scalar.e(0)
                };

                newState = Object.assign({}, oldState);
                newState.balance = depositAmount;

                const newValue = stateUtils.hashState(newState);
                const res = await this.stateTree.insert(this.finalIdx, newValue);
                let siblings = res.siblings;
                while (siblings.length < this.nLevels + 1) siblings.push(Scalar.e(0));

                // State 2
                this.input.nonce2[i] = Scalar.e(0x1234); // should not matter
                this.input.balance2[i] = Scalar.e(0x1234); // should not matter
                this.input.exitBalance2[i] = Scalar.e(0x1234); // should not matter
                this.input.accumulatedHash2[i] = Scalar.e(0x1234); // should not matter
                this.input.siblings2[i] = siblings;
                this.input.isOld0_2[i] = Scalar.e(res.isOld0 ? 1 : 0);
                this.input.oldKey2[i] = Scalar.e(res.isOld0 ? 0 : res.oldKey);
                this.input.oldValue2[i] = Scalar.e(res.isOld0 ? 0 : res.oldValue);

                // Database AxAy
                const keyAxAy = Scalar.add( Scalar.add(Constants.DB_AxAy, newState.sign), Scalar.fromString(newState.ay, 16));
                const lastAxAyStates = await this.dbState.get(keyAxAy);

                // get last state and add last batch number
                let valStatesAxAy;
                let lastAxAyState;
                if (!lastAxAyStates) {
                    lastAxAyState = null;
                    valStatesAxAy = [];
                }
                else {
                    valStatesAxAy = [...lastAxAyStates];
                    lastAxAyState = valStatesAxAy.slice(-1)[0];
                }
                if (!valStatesAxAy.includes(this.currentNumBatch)){
                    valStatesAxAy.push(this.currentNumBatch);
                    await this.dbState.multiIns([
                        [keyAxAy, valStatesAxAy],
                    ]);
                }

                // get last state
                let valOldAxAy = null;
                if (lastAxAyState){
                    const keyOldAxAyBatch = poseidonHash([keyAxAy, lastAxAyState]);
                    valOldAxAy = await this.dbState.get(keyOldAxAyBatch);
                }

                let newValAxAy;
                if (!valOldAxAy) newValAxAy = [];
                else newValAxAy = [...valOldAxAy];
                newValAxAy.push(Scalar.e(this.finalIdx));
                // new key newValAxAy
                const newKeyAxAyBatch = poseidonHash([keyAxAy, this.currentNumBatch]);
                await this.dbState.multiIns([
                    [newKeyAxAyBatch, newValAxAy],
                ]);

                // Database Ether address
                const keyEth = Scalar.add(Constants.DB_EthAddr, Scalar.fromString(newState.ethAddr, 16));
                const lastEthStates = await this.dbState.get(keyEth);

                // get last state and add last batch number
                let valStatesEth;
                let lastEthState;
                if (!lastEthStates) {
                    lastEthState = null;
                    valStatesEth = [];
                } else {
                    valStatesEth = [...lastEthStates];
                    lastEthState = valStatesEth.slice(-1)[0];
                }
                if (!valStatesEth.includes(this.currentNumBatch)){
                    valStatesEth.push(this.currentNumBatch);
                    await this.dbState.multiIns([
                        [keyEth, valStatesEth],
                    ]);
                }

                // get last state
                let valOldEth = null;
                if (lastEthState){
                    const keyOldEthBatch = poseidonHash([keyEth, lastEthState]);
                    valOldEth = await this.dbState.get(keyOldEthBatch);
                }

                let newValEth;
                if (!valOldEth) newValEth = [];
                else newValEth = [...valOldEth];
                newValEth.push(Scalar.e(this.finalIdx));

                // new key newValEth
                const newKeyEthBatch = poseidonHash([keyEth, this.currentNumBatch]);

                await this.dbState.multiIns([
                    [newKeyEthBatch, newValEth],
                ]);

                // Database Idx
                // get array of states saved by batch
                const lastIdStates = await this.dbState.get(Scalar.add(Constants.DB_Idx, this.finalIdx));
                // add last batch number
                let valStatesId;
                if (!lastIdStates) valStatesId = [];
                else valStatesId = [...lastIdStates];
                if (!valStatesId.includes(this.currentNumBatch)) valStatesId.push(this.currentNumBatch);

                // new state for idx
                const newValueId = poseidonHash([newValue, this.finalIdx]);

                // new entry according idx and batchNumber
                const keyIdBatch = poseidonHash([this.finalIdx, this.currentNumBatch]);

                await this.dbState.multiIns([
                    [newValueId, stateUtils.state2Array(newState)],
                    [keyIdBatch, newValueId],
                    [Scalar.add(Constants.DB_Idx, this.finalIdx), valStatesId],
                ]);

            } else if (op === "UPDATE"){
                this.input.idxDestiny[i] = Scalar.e(idxDestiny);

                const resFind = await this.stateTree.find(idxDestiny);
                if (!resFind.found) {
                    throw new Error(`ERROR: Idx ${idxDestiny} not found`);
                }

                const foundValueId = poseidonHash([resFind.foundValue, idxDestiny]);
                oldState = stateUtils.array2State(await this.dbState.get(foundValueId));

                newState = Object.assign({}, oldState);
                newState.balance = Scalar.add(oldState.balance, depositAmount);

                const newValue = stateUtils.hashState(newState);
                const res = await this.stateTree.update(idxDestiny, newValue);
                let siblings = res.siblings;
                while (siblings.length < this.nLevels + 1) siblings.push(Scalar.e(0));

                // State 2
                this.input.nonce2[i] = Scalar.e(oldState.nonce);
                this.input.balance2[i] = Scalar.e(oldState.balance);
                this.input.exitBalance2[i] = Scalar.e(oldState.exitBalance);
                this.input.accumulatedHash2[i] = Scalar.e(oldState.accumulatedHash);
                this.input.siblings2[i] = siblings;
                this.input.isOld0_2[i] = Scalar.e(0);
                this.input.oldKey2[i] = Scalar.e(0x1234); // should not matter
                this.input.oldValue2[i] = Scalar.e(0x1234); // should not matter

                // get array of states saved by batch
                const lastIdStates = await this.dbState.get(Scalar.add(Constants.DB_Idx, idxDestiny));
                // add last batch number
                let valStatesId;
                if (!lastIdStates) valStatesId = [];
                else valStatesId = [...lastIdStates];
                if (!valStatesId.includes(this.currentNumBatch)) valStatesId.push(this.currentNumBatch);

                // new state for idx
                const newValueId = poseidonHash([newValue, idxDestiny]);

                // new entry according idx and batchNumber
                const keyIdBatch = poseidonHash([idxDestiny, this.currentNumBatch]);

                await this.dbState.multiIns([
                    [newValueId, stateUtils.state2Array(newState)],
                    [keyIdBatch, newValueId],
                    [Scalar.add(Constants.DB_Idx, idxDestiny), valStatesId]
                ]);
            }

            // Database numBatch - Idx
            const keyNumBatchIdx = Scalar.add(Constants.DB_NumBatch_Idx, this.currentNumBatch);
            let lastBatchIdx = await this.dbState.get(keyNumBatchIdx);

            // get last state and add last batch number
            let newBatchIdx;
            if (!lastBatchIdx) lastBatchIdx = [];
            newBatchIdx = [...lastBatchIdx];

            if (op == "INSERT") {
                if (!newBatchIdx.includes(this.finalIdx)) newBatchIdx.push(this.finalIdx);
            }

            if (op == "UPDATE") {
                if (!newBatchIdx.includes(idxDestiny)) newBatchIdx.push(idxDestiny);
            }

            await this.dbState.multiIns([
                [keyNumBatchIdx, newBatchIdx],
            ]);

            // Database NumBatch
            if (op == "INSERT") {
            // AxAy
                const hashAxAy = poseidonHash([newState.sign, Scalar.fromString(newState.ay, 16)]);
                const keyNumBatchAxAy = Scalar.add(Constants.DB_NumBatch_AxAy, this.currentNumBatch);
                let oldStatesAxAy = await this.dbState.get(keyNumBatchAxAy);
                let newStatesAxAy;
                if (!oldStatesAxAy) oldStatesAxAy = [];
                newStatesAxAy = [...oldStatesAxAy];
                if (!newStatesAxAy.includes(hashAxAy)) {
                    newStatesAxAy.push(hashAxAy);
                    await this.dbState.multiIns([
                        [hashAxAy, [newState.sign, Scalar.fromString(newState.ay, 16)]],
                        [keyNumBatchAxAy, newStatesAxAy],
                    ]);
                }
                // EthAddress
                const ethAddr =  Scalar.fromString(newState.ethAddr, 16);
                const keyNumBatchEthAddr = Scalar.add(Constants.DB_NumBatch_EthAddr, this.currentNumBatch);
                let oldStatesEthAddr = await this.dbState.get(keyNumBatchEthAddr);
                let newStatesEthAddr;
                if (!oldStatesEthAddr) oldStatesEthAddr = [];
                newStatesEthAddr = [...oldStatesEthAddr];
                if (!newStatesEthAddr.includes(ethAddr)) {
                    newStatesEthAddr.push(ethAddr);
                    await this.dbState.multiIns([
                        [keyNumBatchEthAddr, newStatesEthAddr],
                    ]);
                }
            }

            // intermediary signals
            if (i < this.maxMigrationTx - 1) {
                this.input.imOutIdx[i] = this.finalIdx;
                this.input.imStateRoot[i] = this.stateTree.root;
                this.input.imAccFeeOut[i] = this.accumulatedFee;
            }
        }
        this.input.imFinalOutIdx = this.finalIdx;
    }

    /**
     * find idx with similar state fields to update
     * @param {Number} txPos -  migration transaction position
     * @returns idxDestiny (0 means INSERT)
     */
    async _findIdx(txPos){
        // check first temporary states
        const keyEth = Scalar.add(Constants.DB_EthAddr, Scalar.fromString(this.input.ethAddr1[txPos].toString(16), 16));
        const newKeyEthBatch = poseidonHash([keyEth, this.currentNumBatch]);
        const newIdxs = await this.dbState.get(newKeyEthBatch);

        if (newIdxs){
            // return the first match
            for (let i = 0; i < newIdxs.length ; i++){
                const resFind = await this.stateTree.find(newIdxs[i]);
                const foundValueId = poseidonHash([resFind.foundValue, newIdxs[i]]);
                const state = stateUtils.array2State(await this.dbState.get(foundValueId));

                if (
                    Scalar.eq(state.tokenID, this.input.tokenID1[txPos]) &&
                    Scalar.eq(state.sign, this.input.sign1[txPos]) &&
                    Scalar.eq(Scalar.fromString(state.ay, 16), this.input.ay1[txPos]) &&
                    Scalar.eq(Scalar.fromString(state.ethAddr, 16), this.input.ethAddr1[txPos])
                ){
                    return newIdxs[i];
                }
            }
        }

        // check saved accounts
        const idxsCandidates = await this.rollupDB.getIdxsByEthAddr(this.input.ethAddr1[txPos].toString(16));
        if (idxsCandidates !== null){
            // return the first match
            for (let i = 0; i < idxsCandidates.length; i++){
                const state = await this.rollupDB.getStateByIdx(idxsCandidates[i]);

                if (
                    Scalar.eq(state.tokenID, this.input.tokenID1[txPos]) &&
                    Scalar.eq(state.sign, this.input.sign1[txPos]) &&
                    Scalar.eq(Scalar.fromString(state.ay, 16), this.input.ay1[txPos]) &&
                    Scalar.eq(Scalar.fromString(state.ethAddr, 16), this.input.ethAddr1[txPos])
                ){
                    return idxsCandidates[i];
                }
            }
        } else {
            return 0;
        }
    }

    /**
     * Process fee tx
     */
    async _processFeeTxs(){
        const op = (typeof this.feeIdx === "undefined") ? "NOP" : "UPDATE";

        const feeIdx = this.feeIdx;
        let oldState;

        this.input.imInitStateRootFeeTx = this.stateTree.root;
        this.input.imFinalAccFee = this.accumulatedFee;

        if (op === "UPDATE"){
            const resFind = await this.stateTree.find(feeIdx);
            if (resFind.found){
                const foundValueId = poseidonHash([resFind.foundValue, feeIdx]);
                oldState = stateUtils.array2State(await this.dbState.get(foundValueId));
                // check tokenID matches feeIdx with tokenID transactions
                if (!Scalar.eq(oldState.tokenID, this.input.tokenID)){
                    throw new Error("ERROR: feeIdx tokenID does not match with tokenID of migrationIdx");
                }
            } else {
                throw new Error("ERROR: feeIdx does not exist");
            }

            const newState = Object.assign({}, oldState);
            newState.balance = Scalar.add(newState.balance, this.accumulatedFee);

            const newValue = stateUtils.hashState(newState);

            const res = await this.stateTree.update(feeIdx, newValue);
            let siblings = res.siblings;
            while (siblings.length < this.nLevels + 1) siblings.push(Scalar.e(0));

            // StateFee i
            // get the input from the oldState
            this.input.tokenID3 = oldState.tokenID;
            this.input.nonce3 = oldState.nonce;
            this.input.sign3 = Scalar.e(oldState.sign);
            this.input.balance3 = oldState.balance;
            this.input.ay3 = Scalar.fromString(oldState.ay, 16);
            this.input.ethAddr3 = Scalar.fromString(oldState.ethAddr, 16);
            this.input.exitBalance3 = Scalar.e(oldState.exitBalance);
            this.input.accumulatedHash3 = Scalar.e(oldState.accumulatedHash);
            this.input.siblings3 = siblings;

            // Update DB
            // get array of states saved by batch
            const lastIdStates = await this.dbState.get(Scalar.add(Constants.DB_Idx, feeIdx));
            // add last batch number
            let valStatesId;
            if (!lastIdStates) valStatesId = [];
            else valStatesId = [...lastIdStates];
            if (!valStatesId.includes(this.currentNumBatch)) valStatesId.push(this.currentNumBatch);

            // new state for idx
            const newValueId = poseidonHash([newValue, feeIdx]);

            // new entry according idx and batchNumber
            const keyIdBatch = poseidonHash([feeIdx, this.currentNumBatch]);

            await this.dbState.multiIns([
                [newValueId, stateUtils.state2Array(newState)],
                [keyIdBatch, newValueId],
                [Scalar.add(Constants.DB_Idx, feeIdx), valStatesId]
            ]);

            // Database numBatch - Idx
            const keyNumBatchIdx = Scalar.add(Constants.DB_NumBatch_Idx, this.currentNumBatch);
            let lastBatchIdx = await this.dbState.get(keyNumBatchIdx);

            // get last state and add last batch number
            let newBatchIdx;
            if (!lastBatchIdx) lastBatchIdx = [];
            newBatchIdx = [...lastBatchIdx];

            if (!newBatchIdx.includes(feeIdx)) newBatchIdx.push(feeIdx);

            await this.dbState.multiIns([
                [keyNumBatchIdx, newBatchIdx],
            ]);
        } else if (op === "NOP"){
            this._addNopTxFee();
        }
    }

    /**
     * Add nop transaction to collect fees
     */
    async _addNopTxFee(){
        this.input.tokenID3 = Scalar.e(0);
        this.input.nonce3 = Scalar.e(0);
        this.input.sign3 = Scalar.e(0);
        this.input.balance3 = Scalar.e(0);
        this.input.ay3 = Scalar.e(0);
        this.input.ethAddr3 = Scalar.e(0);
        this.input.exitBalance3 = Scalar.e(0);
        this.input.accumulatedHash3 = Scalar.e(0);

        this.input.siblings3 = [];
        for (let i = 0; i < this.nLevels + 1; i++) {
            this.input.siblings3[i] = Scalar.e(0);
        }
    }

    /**
     * Add an empty transaction
     * @param {Number} i transaction index
     */
    async _addNopTx(i) {
        this.input.L1L2TxsData[i] = Scalar.e(0);
        this.input.tokenID1[i] = Scalar.e(0);
        this.input.nonce1[i] = Scalar.e(0);
        this.input.sign1[i] = Scalar.e(0);
        this.input.balance1[i] = Scalar.e(0);
        this.input.ay1[i] = Scalar.e(0);
        this.input.ethAddr1[i] = Scalar.e(0);
        this.input.exitBalance1[i] = Scalar.e(0);
        this.input.accumulatedHash1[i] = Scalar.e(0);

        this.input.siblings1[i] = [];
        for (let j = 0; j < this.nLevels + 1; j++) {
            this.input.siblings1[i][j] = Scalar.e(0);
        }

        this.input.idxDestiny[i] = Scalar.e(0);
        this.input.nonce2[i] = Scalar.e(0);
        this.input.balance2[i] = Scalar.e(0);
        this.input.exitBalance2[i] = Scalar.e(0);
        this.input.accumulatedHash2[i] = Scalar.e(0);

        this.input.siblings2[i] = [];
        for (let j = 0; j < this.nLevels + 1; j++) {
            this.input.siblings2[i][j] = Scalar.e(0);
        }

        this.input.isOld0_2[i] = Scalar.e(0);
        this.input.oldKey2[i] = Scalar.e(0);
        this.input.oldValue2[i] = Scalar.e(0);

        // intermediary signals
        if (i < this.maxMigrationTx - 1) {
            this.input.imOutIdx[i] = this.finalIdx;
            this.input.imStateRoot[i] = this.stateTree.root;
            this.input.imAccFeeOut[i] = this.accumulatedFee;
            this.input.imOutAccHash[i] = (i == 0) ? this.input.initAccHash : this.input.imOutAccHash[i - 1];
            this.input.imOutCounter[i] = (i == 0) ? Scalar.e(0) : this.input.imOutCounter[i - 1];
        }
    }

    /**
     * Return the circuit input
     * @return {Object} Circuit input
     */
    getInput() {
        if (!this.builded) throw new Error("ERROR: Batch must first be builded");
        return this.input;
    }

    /**
     * Return the pretended public inputs
     * @return {Object} Circuit pretended public inputs
     */
    getPretendedPublicInputs(){
        if (!this.builded) throw new Error("ERROR: Batch must first be builded");

        return {
            initSourceStateRoot: this.input.initSourceStateRoot,
            finalSourceStateRoot: this.input.finalSourceStateRoot,
            oldStateRoot: this.input.oldStateRoot,
            newStateRoot: this.stateTree.root,
            oldLastIdx: this.input.oldLastIdx,
            newLastIdx: this.finalIdx,
            migrationIdx: this.migrationIdx,
            feeIdx: this.feeIdx || 0,
            batchesToMigrate: this.totalBatches
        };
    }

    /**
     * Computes hash of all pretended public inputs
     * @return {Scalar} hash global input
     */
    getHashInputs(){
        if (!this.builded) throw new Error("ERROR: Batch must first be builded");
        const finalStr = this.getInputsStr();

        return utils.sha256Snark(finalStr);
    }

    /**
     * Computes string in hexadecimal of all pretended public inputs
     * @return {String} Public input string encoded as hexadecimal
     */
    getInputsStr(){
        if (!this.builded) throw new Error("ERROR: Batch must first be builded");

        const inputs = this.getPretendedPublicInputs();

        // string hexacecimal initSourceStateRoot
        let strInitSourceStateRoot = utils.padZeros(inputs.initSourceStateRoot.toString("16"), this.rootB / 4);

        // string hexacecimal finalSourceStateRoot
        let strFinalSourceStateRoot = utils.padZeros(inputs.finalSourceStateRoot.toString("16"), this.rootB / 4);

        // string hexacecimal oldStateRoot
        let strOldStateRoot = utils.padZeros(inputs.oldStateRoot.toString("16"), this.rootB / 4);

        // string hexacecimal newStateRoot
        let strNewStateRoot = utils.padZeros(inputs.newStateRoot.toString("16"), this.rootB / 4);

        // string oldLastIdx, newLastIdx, migrateIdx and feeIdx
        let res = Scalar.e(0);
        res = Scalar.add(res, inputs.feeIdx);
        res = Scalar.add(res, Scalar.shl(inputs.migrationIdx, this.maxIdxB));
        res = Scalar.add(res, Scalar.shl(inputs.newLastIdx, 2 * this.maxIdxB));
        res = Scalar.add(res, Scalar.shl(inputs.oldLastIdx, 3 * this.maxIdxB));
        const finalIdxStr = utils.padZeros(res.toString("16"), (4 * this.maxIdxB) / 4);

        // string hexacecimal totalBatches
        let strCurrentNumBatch = utils.padZeros(inputs.batchesToMigrate.toString("16"), this.numBatchB / 4);

        // build input string
        const finalStr = strInitSourceStateRoot
            .concat(strFinalSourceStateRoot)
            .concat(strOldStateRoot)
            .concat(strNewStateRoot)
            .concat(finalIdxStr)
            .concat(strCurrentNumBatch);

        return finalStr;
    }

    /**
     * Return data related to migration build related with the Rollup SC
     * @return {Object} Contains all SC related data
     */
    async getDataSC(){
        if (!this.builded) throw new Error("ERROR: Batch must first be builded");

        return {
            newStateRootMigrations: this.stateTree.root,
            feeIdxCoordinator: this.feeIdx || 0,
            accountsToMigrate: this.accountToMigrate,
            batchToMigrate: this.finalBatchToMigrate,
            newLastIdx: this.finalIdx
        };
    }

    /**
     * Check exiting batches to migrate
     */
    async _sanityChecks(){
        const sourceCurrentBlock = this.sourceRollupDB.lastBatch;

        if (this.initBatchToMigrate > sourceCurrentBlock){
            throw new Error("ERROR: Initial batch to migrate does not exist");
        }

        if (this.finalBatchToMigrate > sourceCurrentBlock){
            throw new Error("ERROR: Final batch to migrate does not exist");
        }
    }

    /**
     * Check minimum bacthes to process or minim transactions to process
     */
    async _minBatchMinTxCheck(){
        if (Constants.minBatchesToMigrate > this.totalBatches){
            if (this.totalMigrationTx < Constants.minTxToMigrate){
                throw new Error("ERROR: Not enough batches to migrate neither enough transactions");
            }
        }
    }

    async setFeeIdx(idx){
        this.feeIdx = idx;
    }
}

module.exports = MigrationBuilder;