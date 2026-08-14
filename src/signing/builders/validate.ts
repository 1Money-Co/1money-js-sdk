import { isAddress } from 'viem';

const UINT_STRING_RE = /^\d+$/;

// Every uint-string field validated in this module is a U256 on the node.
// A value above this has no wire form at all: alloy's deserializer rejects
// it while parsing the request body, before any state is read. Verified
// against a local node -- `value` of 2^256 returns HTTP 400
// validation_invalid_param, `invalid value: string "1157...936", expected a
// 32 byte hex string`, whereas the same request with a small value gets
// past parsing and fails later on state lookup.
//
// So this is an encodability check, not an admission rule: without it the
// SDK computes a signing hash, spends a signing operation, and ships a
// request the node cannot even decode.
export const U256_MAX =
  (BigInt(1) << BigInt(256)) - BigInt(1);

function fail(name: string, value: unknown): never {
  throw new Error(
    `[1Money SDK]: Invalid ${name}: ${String(value)}`
  );
}

export function assertPositiveInteger(
  name: string,
  value: number
) {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    fail(name, value);
  }
}

export function assertPositiveIntegerAtMost(
  name: string,
  value: number,
  max: number
) {
  assertPositiveInteger(name, value);
  if (value > max) {
    fail(name, value);
  }
}

export function assertNonNegativeInteger(
  name: string,
  value: number
) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    fail(name, value);
  }
}

export function assertUintString(
  name: string,
  value: string
) {
  if (!UINT_STRING_RE.test(value)) {
    fail(name, value);
  }
  // Checked after the format test so a non-numeric string still reports the
  // format error rather than throwing inside BigInt().
  if (BigInt(value) > U256_MAX) {
    throw new Error(
      `[1Money SDK]: Invalid ${name}: exceeds U256::MAX`
    );
  }
}

export function assertOptionalUintString(
  name: string,
  value: string | undefined
) {
  if (value === undefined) return;
  assertUintString(name, value);
}

export function assertAddress(
  name: string,
  value: string
) {
  // viem's isAddress validates both format and EIP-55 checksum
  // It accepts: lowercase, uppercase, and correctly checksummed addresses
  // It rejects: invalid format or incorrect checksum (when mixed case is used)
  if (!isAddress(value)) {
    fail(name, value);
  }
}

export function validateChainAndNonce(unsigned: {
  chain_id: number;
  nonce: number;
}) {
  assertPositiveInteger('chain_id', unsigned.chain_id);
  assertNonNegativeInteger('nonce', unsigned.nonce);
}

export function validateRecipientValueToken(unsigned: {
  recipient: string;
  value: string;
  token: string;
}) {
  assertAddress('recipient', unsigned.recipient);
  assertUintString('value', unsigned.value);
  assertAddress('token', unsigned.token);
}

export function validateValueToken(unsigned: {
  value: string;
  token: string;
}) {
  assertUintString('value', unsigned.value);
  assertAddress('token', unsigned.token);
}
