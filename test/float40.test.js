const { expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;
const float40 = require("../index").float40;

describe("Float16", function () {

    it("Test vectors floating point number", async () => {
        const testVector = [
            [6 * 0x800000000 + 123, "123000000"],
            [2 * 0x800000000 + 4545, "454500"],
            [30 * 0x800000000 + 10235, "10235000000000000000000000000000000"],
            [0, "0"],
            [0x800000000, "0"],
            [0x0001, "1"],
            [31 * 0x800000000, "0"],
            [0x800000000 + 1, "10"],
            [0xFFFFFFFFFF, "343597383670000000000000000000000000000000"],
        ];

        for (let i=0; i<testVector.length; i++) {
            const fx = float40.float2Fix(testVector[i][0]);
            expect(fx.toString()).to.be.equal(testVector[i][1]);

            const fl = float40.fix2Float(Scalar.e(testVector[i][1]));
            const fx2 = float40.float2Fix(fl);
            expect(fx2.toString()).to.be.equal(testVector[i][1]);
        }
    });

    it("Floor fix2Float", async () => {
        const testVector = [
            [30 * 0x800000000 + 9922334455, "9922334455000000000000000000000000000001"],
            [30 * 0x800000000 + 9922334454, "9922334454999999999999999999999999999999"],
        ];

        for (let i = 0; i < testVector.length; i++) {
            const testFloat = float40.floorFix2Float(testVector[i][1]);
            expect(testFloat).to.be.equal(testVector[i][0]);
        }
    });

    it("Round", async () => {
        const testVector = [
            ["9922334455000000000000000000000000000000", "9922334455000000000000000000000000000001"],
            ["9922334455000000000000000000000000000000", "9922334454999999999999999999999999999999"],
        ];

        for (let i = 0; i < testVector.length; i++) {
            const testFloat = float40.round(testVector[i][1]);
            expect(testFloat.toString()).to.be.equal(testVector[i][0]);
        }
    });

    it("exceptions", async() => {
        expect(() => {
            float40.fix2Float("992233445500000000000000000000000000000000");
        }).to.throw("number too big");

        expect(() => {
            float40.floorFix2Float("992233445500000000000000000000000000000000");
        }).to.throw("number too big");

        expect(() => {
            float40.round("992233445500000000000000000000000000000000");
        }).to.throw("number too big");

        expect(() => {
            float40.fix2Float("99223344556573838487575");
        }).to.throw("not enough precission");
    });

});
