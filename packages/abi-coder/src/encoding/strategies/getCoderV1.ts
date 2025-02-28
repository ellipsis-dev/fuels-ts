import { ErrorCode, FuelError } from '@fuel-ts/errors';

import { ResolvedAbiType } from '../../ResolvedAbiType';
import type { EncodingOptions } from '../../types/EncodingOptions';
import type { GetCoderFn } from '../../types/GetCoder';
import {
  B256_CODER_TYPE,
  B512_CODER_TYPE,
  BOOL_CODER_TYPE,
  BYTES_CODER_TYPE,
  ENCODING_V0,
  OPTION_CODER_TYPE,
  RAW_PTR_CODER_TYPE,
  RAW_SLICE_CODER_TYPE,
  STD_STRING_CODER_TYPE,
  STR_SLICE_CODER_TYPE,
  U16_CODER_TYPE,
  U32_CODER_TYPE,
  U64_CODER_TYPE,
  U8_CODER_TYPE,
  VEC_CODER_TYPE,
  arrayRegEx,
  enumRegEx,
  stringRegEx,
  structRegEx,
  tupleRegEx,
} from '../../utils/constants';
import { findOrThrow } from '../../utils/utilities';
import type { Coder } from '../coders/AbstractCoder';
import { ArrayCoder } from '../coders/v0/ArrayCoder';
import { B256Coder } from '../coders/v0/B256Coder';
import { B512Coder } from '../coders/v0/B512Coder';
import { OptionCoder } from '../coders/v0/OptionCoder';
import { U64Coder } from '../coders/v0/U64Coder';
import { BooleanCoder } from '../coders/v1/BooleanCoder';
import { ByteCoder } from '../coders/v1/ByteCoder';
import { EnumCoder } from '../coders/v1/EnumCoder';
import { NumberCoder } from '../coders/v1/NumberCoder';
import { RawSliceCoder } from '../coders/v1/RawSliceCoder';
import { StdStringCoder } from '../coders/v1/StdStringCoder';
import { StringCoder } from '../coders/v1/StringCoder';
import { StructCoder } from '../coders/v1/StructCoder';
import { TupleCoder } from '../coders/v1/TupleCoder';
import { VecCoder } from '../coders/v1/VecCoder';

import { getCoders } from './getCoders';

/**
 * Retrieves coders that adhere to the v0 spec.
 *
 * @param resolvedAbiType - the resolved type to return a coder for.
 * @param options - options to be utilized during the encoding process.
 * @returns the coder for a given type.
 */
export const getCoder: GetCoderFn = (
  resolvedAbiType: ResolvedAbiType,
  _options?: EncodingOptions
): Coder => {
  switch (resolvedAbiType.type) {
    case U8_CODER_TYPE:
    case U16_CODER_TYPE:
    case U32_CODER_TYPE:
      return new NumberCoder(resolvedAbiType.type);
    case U64_CODER_TYPE:
    case RAW_PTR_CODER_TYPE:
      return new U64Coder();
    case RAW_SLICE_CODER_TYPE:
      return new RawSliceCoder();
    case BOOL_CODER_TYPE:
      return new BooleanCoder();
    case B256_CODER_TYPE:
      return new B256Coder();
    case B512_CODER_TYPE:
      return new B512Coder();
    case BYTES_CODER_TYPE:
      return new ByteCoder();
    case STD_STRING_CODER_TYPE:
      return new StdStringCoder();
    default:
      break;
  }

  const stringMatch = stringRegEx.exec(resolvedAbiType.type)?.groups;
  if (stringMatch) {
    const length = parseInt(stringMatch.length, 10);

    return new StringCoder(length);
  }

  // ABI types underneath MUST have components by definition

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const components = resolvedAbiType.components!;

  const arrayMatch = arrayRegEx.exec(resolvedAbiType.type)?.groups;
  if (arrayMatch) {
    const length = parseInt(arrayMatch.length, 10);
    const arg = components[0];
    if (!arg) {
      throw new FuelError(
        ErrorCode.INVALID_COMPONENT,
        `The provided Array type is missing an item of 'component'.`
      );
    }

    const arrayElementCoder = getCoder(arg, { isSmallBytes: true });
    return new ArrayCoder(arrayElementCoder as Coder, length);
  }

  if (resolvedAbiType.type === VEC_CODER_TYPE) {
    const arg = findOrThrow(components, (c) => c.name === 'buf').originalTypeArguments?.[0];
    if (!arg) {
      throw new FuelError(
        ErrorCode.INVALID_COMPONENT,
        `The provided Vec type is missing the 'type argument'.`
      );
    }
    const argType = new ResolvedAbiType(resolvedAbiType.abi, arg);

    const itemCoder = getCoder(argType, { isSmallBytes: true, encoding: ENCODING_V0 });
    return new VecCoder(itemCoder as Coder);
  }

  const structMatch = structRegEx.exec(resolvedAbiType.type)?.groups;
  if (structMatch) {
    const coders = getCoders(components, { isRightPadded: true, getCoder });
    return new StructCoder(structMatch.name, coders);
  }

  const enumMatch = enumRegEx.exec(resolvedAbiType.type)?.groups;
  if (enumMatch) {
    const coders = getCoders(components, { getCoder });

    const isOptionEnum = resolvedAbiType.type === OPTION_CODER_TYPE;
    if (isOptionEnum) {
      return new OptionCoder(enumMatch.name, coders);
    }
    return new EnumCoder(enumMatch.name, coders);
  }

  const tupleMatch = tupleRegEx.exec(resolvedAbiType.type)?.groups;
  if (tupleMatch) {
    const coders = components.map((component) =>
      getCoder(component, { isRightPadded: true, encoding: ENCODING_V0 })
    );
    return new TupleCoder(coders as Coder[]);
  }

  if (resolvedAbiType.type === STR_SLICE_CODER_TYPE) {
    throw new FuelError(
      ErrorCode.INVALID_DATA,
      'String slices can not be decoded from logs. Convert the slice to `str[N]` with `__to_str_array`'
    );
  }

  throw new FuelError(
    ErrorCode.CODER_NOT_FOUND,
    `Coder not found: ${JSON.stringify(resolvedAbiType)}.`
  );
};
