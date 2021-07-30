const { expect } = require("chai");
const bjj = require("circomlib").babyJub;
const utilsScalar = require("ffjavascript").utils;
const Scalar = require("ffjavascript").Scalar;

const Account = require("../index").HermezAccount;
const txUtils = require("../index").txUtils;
const withdrawUtils = require("../index").withdrawUtils;

describe("Hermez account", () => {
    let account;
    
    it("Create hermez account", async () => {
        account = new Account(1);

        expect(account.ax).to.be.not.equal(undefined);
        expect(account.ay).to.be.not.equal(undefined);
        expect(account.ethAddr).to.be.not.equal(undefined);
        expect(account.bjjCompressed).to.be.not.equal(undefined);

        const buf = utilsScalar.leInt2Buff(Scalar.fromString(account.bjjCompressed, 16));
        const point = bjj.unpackPoint(buf);
        
        expect(point[0].toString(16)).to.be.equal(account.ax);
        expect(point[1].toString(16)).to.be.equal(account.ay);
    });

    it("Sign transaction", async () => {
        const account2 = new Account(2);
        
        const tx = {
            chainID: 1,
            fromIdx: 2,
            toIdx: 3,
            amount: 4,
            tokenID: 5,
            nonce: 6,
            userFee: 128,
            toBjjSign: true,
            toEthAddr: account2.ethAddr,
            toBjjAy: account2.ay,
            maxNumBatch: 7
        };

        account.signTx(tx);
        expect(tx.fromAx).to.be.equal(account.ax);
        expect(tx.fromAy).to.be.equal(account.ay);

        expect(tx.r8x).to.be.not.equal(undefined);
        expect(tx.r8y).to.be.not.equal(undefined);
        expect(tx.s).to.be.not.equal(undefined);

        // Verify transaction
        const res = txUtils.verifyTxSig(tx);
        expect(res).to.be.equal(true);
    });

    it("Sign withdraw Bjj", async () => {
        const account = new Account(1);

        // bjj signature
        const zkInputs = {
            rootState: Scalar.sub(Scalar.shl(1, 256), 1),
            ethAddrCaller: Scalar.sub(Scalar.shl(1, 160), 1),
            ethAddrBeneficiary: Scalar.sub(Scalar.shl(1, 160), 1),
            tokenID: Scalar.sub(Scalar.shl(1, 32), 1),
            exitBalance: Scalar.sub(Scalar.shl(1, 192), 1),
            idx: Scalar.sub(Scalar.shl(1, 48), 1),
        };

        const signature = account.signWithdrawBjj(zkInputs);

        expect(signature.R8[0]).to.be.not.equal(undefined);
        expect(signature.R8[1]).to.be.not.equal(undefined);
        expect(signature.S).to.be.not.equal(undefined);

        // Verify withdraw bjj signature
        expect(withdrawUtils.verifyWithdrawBjjSig(zkInputs, account, signature)).to.be.equal(true);
    });
});
