import { ErrorCode, FuelError } from '@fuel-ts/errors';
import { bn } from '@fuel-ts/math';
import { concatBytes } from '@fuel-ts/utils';

import { MAX_BYTES, WORD_SIZE } from '../../../utils/constants';
import { chunkByLength } from '../../../utils/utilities';
import type { TypesOfCoder } from '../AbstractCoder';
import { Coder } from '../AbstractCoder';
import { U64Coder } from '../v0/U64Coder';

type InputValueOf<TCoder extends Coder> = Array<TypesOfCoder<TCoder>['Input']>;
type DecodedValueOf<TCoder extends Coder> = Array<TypesOfCoder<TCoder>['Decoded']>;

export class VecCoder<TCoder extends Coder> extends Coder<
  InputValueOf<TCoder>,
  DecodedValueOf<TCoder>
> {
  coder: TCoder;

  constructor(coder: TCoder) {
    super('struct', `struct Vec`, coder.encodedLength + WORD_SIZE);
    this.coder = coder;
  }

  encode(value: InputValueOf<TCoder>): Uint8Array {
    if (!Array.isArray(value)) {
      throw new FuelError(ErrorCode.ENCODE_ERROR, `Expected array value.`);
    }

    const bytes = value.map((v) => this.coder.encode(v));
    const lengthBytes = new U64Coder().encode(value.length);

    return new Uint8Array([...lengthBytes, ...concatBytes(bytes)]);
  }

  decode(data: Uint8Array, offset: number): [DecodedValueOf<TCoder>, number] {
    if (data.length < this.encodedLength || data.length > MAX_BYTES) {
      throw new FuelError(ErrorCode.DECODE_ERROR, `Invalid vec data size.`);
    }

    const offsetAndLength = offset + WORD_SIZE;
    const lengthBytes = data.slice(offset, offsetAndLength);
    const length = bn(new U64Coder().decode(lengthBytes, 0)[0]).toNumber();
    const dataLength = length * this.coder.encodedLength;
    const dataBytes = data.slice(offsetAndLength, offsetAndLength + dataLength);

    if (dataBytes.length !== dataLength) {
      throw new FuelError(ErrorCode.DECODE_ERROR, `Invalid vec byte data size.`);
    }

    return [
      chunkByLength(dataBytes, this.coder.encodedLength).map(
        (chunk) => this.coder.decode(chunk, 0)[0]
      ),
      offsetAndLength + dataLength,
    ];
  }
}
