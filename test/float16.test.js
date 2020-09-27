const { expect } = require("chai");
const Scalar = require("ffjavascript").Scalar;
const float16 = require("../index").float16;

describe("Float16", function () {

    it("Test vectors floating point number", async () => {
        const testVector = [
            [0x307B, "123000000"],
            [0x1DC6, "454500"],
            [0xFFFF, "10235000000000000000000000000000000"],
            [0x0000, "0"],
            [0x0400, "0"],
            [0x0001, "1"],
            [0x0401, "1"],
            [0x0800, "0"],
            [0x0c00, "5"],
            [0x0801, "10"],
            [0x0c01, "15"],
        ];

        for (let i=0; i<testVector.length; i++) {
            const fx = float16.float2Fix(testVector[i][0]);
            expect(fx.toString()).to.be.equal(testVector[i][1]);

            const fl = float16.fix2Float(Scalar.e(testVector[i][1]));
            const fx2 = float16.float2Fix(fl);
            expect(fx2.toString()).to.be.equal(testVector[i][1]);
        }
    });

    it("Floor fix2Float", async () => {
        const testVector = [
            [0x776f, "87999990000000000"],
            [0x776f, "87950000000000001"],
            [0x776f, "87950000000000000"],
            [0x736f, "87949999999999999"],
        ];

        for (let i = 0; i < testVector.length; i++) {
            const testFloat = float16.floorFix2Float(testVector[i][1]);
            expect(testFloat).to.be.equal(testVector[i][0]);
        }
    });
});