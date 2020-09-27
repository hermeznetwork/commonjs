# Commonjs
Javascript library implementing common utilities for [hermez network](https://hermez.io/)

![Main CI](https://github.com/hermeznetwork/commonjs/workflows/Main%20CI/badge.svg)

## Usage
```
const hermezCommons = require("@hermeznetwork/commonjs");
```

You will find the following modules inside the package:
- `float16`: custom float 16 bits to encode large integers
- `HermezAccount`: class to create ethereum/babyjubjub keys 
- `txUtils`: transaction utils
- `stateUtils`: account state utils
- `utils`: global utils
- `feeTable`: utils to 
- `SMTTmpDb`: sparse merkle tree temporary database
- `Constants`: hermez network global constants
- `RollupDB`: class to create rollup database
- `BatchBuilder`: class to create batch-builder

## Test
```
npm run eslint & npm run test
```

WARNING
All code here is in WIP

## License
`commonjs` is part of the iden3 project copyright 2020 HermezDAO and published with AGPL-3 license. Please check the LICENSE file for more details.