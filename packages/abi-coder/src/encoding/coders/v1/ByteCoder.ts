import { ErrorCode, FuelError } from '@fuel-ts/errors';
import { bn } from '@fuel-ts/math';

import { WORD_SIZE } from '../../../utils/constants';
import { Coder } from '../AbstractCoder';
import { U64Coder } from '../v0/U64Coder';

export class ByteCoder extends Coder<number[], Uint8Array> {
  static memorySize = 1;
  constructor() {
    super('struct', 'struct Bytes', WORD_SIZE);
  }

  encode(value: number[]): Uint8Array {
    if (!Array.isArray(value)) {
      throw new FuelError(ErrorCode.ENCODE_ERROR, `Expected array value.`);
    }

    const bytes = new Uint8Array(value);
    const lengthBytes = new U64Coder().encode(value.length);

    return new Uint8Array([...lengthBytes, ...bytes]);
  }

  decode(data: Uint8Array, offset: number): [Uint8Array, number] {
    if (data.length < WORD_SIZE) {
      throw new FuelError(ErrorCode.DECODE_ERROR, `Invalid byte data size.`);
    }

    const offsetAndLength = offset + WORD_SIZE;
    const lengthBytes = data.slice(offset, offsetAndLength);
    const length = bn(new U64Coder().decode(lengthBytes, 0)[0]).toNumber();

    const dataBytes = data.slice(offsetAndLength, offsetAndLength + length);

    if (dataBytes.length !== length) {
      throw new FuelError(ErrorCode.DECODE_ERROR, `Invalid bytes byte data size.`);
    }

    return [dataBytes, offsetAndLength + length];
  }
}
