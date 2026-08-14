// Types for transactions API
import { AuthorityType, RestSignature } from '../tokens/types';
import type {
  AddressSchema,
  B256Schema,
  BytesSchema
} from '../types';
import type { Memo } from '@/utils';

export interface BatchPaymentOperation {
  recipient: AddressSchema;
  amount: string;
}

export interface BridgeInfo {
  bbnonce: number;
  destination_chain_id: number;
  destination_address: string;
  bridge_param: BytesSchema;
}

export interface SuccessInfo {
  sender: AddressSchema;
  /** Batch receipts use the zero address; read PaymentExecuted events. */
  receiver: AddressSchema;
  is_private: boolean;
  message: string;
  bridge_info: BridgeInfo | null;
}

export interface BatchFailureInfo {
  failed_operation_index: number;
  reason: string;
}

export interface BatchReceiptInfo {
  batch_id: string | null;
  operations_hash: B256Schema | null;
  operations_count: number;
  total_amount: string;
  /** Reserved; current production failure path does not populate it. */
  failure: BatchFailureInfo | null;
}

export type BatchExecutionEvent =
  | {
      event_type: 'BatchStarted';
      batch_id: string | null;
      operations_count: number;
      total_amount: string;
      operations_hash: B256Schema | null;
    }
  | {
      event_type: 'PaymentExecuted';
      operation_index: number;
      recipient: AddressSchema;
      amount: string;
    }
  | {
      event_type: 'BatchCompleted';
      batch_id: string | null;
      operations_count: number;
      total_amount: string;
      operations_hash: B256Schema | null;
    };

// Transaction receipt response
export interface TransactionReceipt {
  success: boolean;
  transaction_hash: B256Schema;
  /**
   * The three checkpoint-placement fields below are `null` — not absent —
   * until the transaction is included in a checkpoint. Their node-side
   * `Option` carries no `skip_serializing_if`, so serde emits the key with a
   * `null` value. Observed on a live node 65ms after submission: all three
   * read `null` on the same response.
   */
  transaction_index?: number | null;
  fee_used: string;
  from: AddressSchema;
  checkpoint_hash?: B256Schema | null;
  checkpoint_number?: number | null;
  recipient?: AddressSchema | null;
  token_address?: AddressSchema | null;
  /**
   * These three, by contrast, are genuinely absent when unset: the node
   * marks them `skip_serializing_if` (`Option::is_none` for the first two,
   * `Vec::is_empty` for the events), so no `null` ever appears.
   */
  success_info?: SuccessInfo;
  batch_info?: BatchReceiptInfo;
  execution_events?: BatchExecutionEvent[];
}

/**
 * Validator BLS aggregate that certifies finalization.
 *
 * Mirrors the node's `RestBlsAggregateSignature`. This is a single
 * aggregate, not a list of per-validator signatures: `signature` is one
 * BLS12-381 aggregate over the counter-sign domain, and `signer_bitmask`
 * says which validators contributed to it. Bit i of the bitmask
 * corresponds to index i of `validator_public_keys`, so both are needed
 * to verify the aggregate.
 */
export interface BlsAggregateSignature {
  /** Hex bitmask of contributing validators, e.g. '0x7f'. */
  signer_bitmask: string;
  /** The 48-byte BLS12-381 aggregate signature, hex encoded. */
  signature: string;
  /** Ordered validator BLS public keys; index matches bitmask bit. */
  validator_public_keys: string[];
}

// Finalized transaction receipt response
export interface FinalizedTransactionReceipt extends TransactionReceipt {
  epoch: number;
  /**
   * Singular BLS aggregate. Note this is NOT `counter_signatures: []` --
   * the node has never returned a per-validator array here.
   */
  counter_signature: BlsAggregateSignature;
  /**
   * The fee bound into the counter-sign domain for fee-bound (V2)
   * certificates: a decimal string for fee-bearing transactions
   * (payments), `null` for fee-less ones (token operations) and for legacy
   * certificates. Distinct from the receipt's `fee_used` -- this is the
   * value the validators signed over, not what was charged. Optional
   * because a node predating the field omits it entirely.
   */
  fee?: string | null;
  /**
   * True when the aggregate is over the V2 fee-bound counter-sign domain
   * `signature_hash_for_counter_sign_v2(tx_hash, epoch, fee)`. Absent or
   * false means v1 verification. Optional for the same reason as `fee`.
   */
  fee_bound?: boolean;
}

// Estimate fee response
export interface EstimateFee {
  fee: string;
  plan?: string;
}

export interface BatchFeeEstimateRequest {
  from: AddressSchema;
  token: AddressSchema;
  operations: PaymentOperation[];
}

// Payment transaction payload
export interface PaymentPayload {
  chain_id: number;
  nonce: number;
  recipient: AddressSchema;
  value: string;
  token: AddressSchema;
  signature: RestSignature;
  /**
   * Optional transaction memo. When present (even with empty subfields),
   * the request is routed to the V2 envelope variant on-chain and the
   * client MUST sign over the WithMemo<PaymentPayload> RLP shape.
   * When omitted/undefined, the request takes the legacy V1 path.
   */
  memo?: Memo;
}

// Transaction data types for different transaction types
export interface TokenCreateData {
  decimals: number;
  is_private: boolean;
  master_authority: AddressSchema;
  name: string;
  symbol: string;
}

export interface TokenTransferData {
  recipient: AddressSchema;
  token: AddressSchema;
  value: string;
}

export interface TokenMintData {
  recipient: AddressSchema;
  token: AddressSchema;
  value: string;
}

export interface TokenGrantAuthorityData {
  authority_address: AddressSchema;
  authority_type: AuthorityType;
  token: AddressSchema;
  value: string;
}

export interface TokenRevokeAuthorityData {
  authority_address: AddressSchema;
  authority_type: AuthorityType;
  token: AddressSchema;
  value: string;
}

export interface TokenBlacklistAccountData {
  address: AddressSchema;
  token: AddressSchema;
}

export interface TokenWhitelistAccountData {
  address: AddressSchema;
  token: AddressSchema;
}

export interface TokenBridgeAndMintData {
  bridge_metadata: string | null;
  recipient: AddressSchema;
  source_chain_id: number;
  source_tx_hash: string;
  token: AddressSchema;
  value: string;
}

export interface TokenBurnData {
  token: AddressSchema;
  value: string;
}

export interface TokenBurnAndBridgeData {
  value: string;
  sender: AddressSchema;
  destination_chain_id: number;
  destination_address: AddressSchema;
  escrow_fee: string;
  bridge_metadata: string | null;
  bridge_param: BytesSchema;
  token: AddressSchema;
}

export interface TokenClawbackData {
  from: AddressSchema;
  recipient: AddressSchema;
  value: string;
  token: AddressSchema;
}

export interface TokenCloseAccountData {
  token: AddressSchema;
}

export interface TokenPauseData {
  token: AddressSchema;
}

export interface TokenUpdateMetadataData {
  metadata: {
    name: string;
    uri: string;
    additional_metadata: Array<{
      key: string;
      value: string;
    }>;
  };
  token: AddressSchema;
}

export interface RawData {
  input: string;
  token: AddressSchema;
}

export interface TokenUnpauseData {
  token: AddressSchema;
}

// One recipient/amount pair inside a batch payment.
export interface PaymentOperation {
  recipient: AddressSchema;
  amount: string;
}

// Batch payment payload. `operations_hash` and `batch_id` are the
// only optional fields and are strictly trailing.
export interface BatchPaymentPayload {
  chain_id: number;
  nonce: number;
  token: AddressSchema;
  operations: PaymentOperation[];
  created_at: number;
  operations_hash?: B256Schema;
  /** Signed correlation metadata only; not an idempotency or replay key. */
  batch_id?: string;
}

export interface BatchPaymentData {
  token: AddressSchema | null;
  operations: BatchPaymentOperation[];
  operations_hash: B256Schema | null;
  batch_id: string | null;
  created_at: number;
}

export interface CreateMultiSigData {
  signers: Array<{
    public_key: string;
    weight: number;
  }>;
  threshold: number;
  multisig_address: AddressSchema;
}

/**
 * How a transaction's authorization was produced, as reported by the node.
 *
 * Wire values are lowercase snake_case, mirroring the node's
 * `SignatureScheme` enum and the Go SDK's constants of the same name so both
 * SDKs expose the same surface.
 */
export type SignatureScheme =
  | 'legacy_native'
  | 'domain_separated'
  | 'ethereum'
  | 'eip712';

/** One signer's contribution inside a multisig authorization. */
export interface MultiSigSignatureEntry {
  /** Signer's 33-byte SEC1-compressed public key, hex encoded. */
  signer_pubkey: string;
  signature: RestSignature;
}

/** The `signature` content when `signature_type` is `'Multi'`. */
export interface MultiSignature {
  /** The multisig account the signatures authorize for. */
  account: AddressSchema;
  signatures: MultiSigSignatureEntry[];
}

/**
 * The authorization carried by a transaction read.
 *
 * The node tags this adjacently
 * (`#[serde(tag = "signature_type", content = "signature")]`), so
 * `signature_type` names the shape held in `signature` — the two fields are
 * correlated, not independent. Modelling them as one union is what lets
 * `if (tx.signature_type === 'Single')` narrow `tx.signature` to
 * `{ r, s, v }`.
 *
 * Declaring `signature` as a plain `{ r, s, v }`, as this SDK did before,
 * silently reads `undefined` on every multisig transaction, whose
 * `signature` is `{ account, signatures }` instead. Declaring it as a bare
 * `RestSignature | MultiSignature` without the discriminant would compile
 * but never narrow.
 */
export type TransactionAuthorization =
  | {
      signature_type: 'Single';
      signature: RestSignature;
    }
  | {
      signature_type: 'Multi';
      signature: MultiSignature;
    };

// Base transaction fields shared by all transaction types
interface BaseTransactionFields {
  hash: B256Schema;

  // `null` until the transaction lands in a checkpoint -- the node emits the
  // key with a null value rather than omitting it. A transaction read
  // succeeds before inclusion, so this is a state callers do observe.
  checkpoint_hash?: B256Schema | null;
  checkpoint_number?: number | null;
  transaction_index?: number | null;

  chain_id: number;
  from: AddressSchema;
  nonce: number;
  /**
   * Signed memo attached to the transaction. Populated only for V2
   * (memo-bearing) envelope variants; omitted when the transaction was
   * a legacy variant.
   */
  memo?: Memo;
  /**
   * How this transaction was authorized.
   *
   * Optional because the node omits the key entirely rather than sending
   * null (`skip_serializing_if = "Option::is_none"`), which keeps
   * pre-existing REST JSON byte-identical. On this endpoint today the node's
   * REST layer only ever assigns `'domain_separated'` and leaves every
   * legacy Single/Multi signature unset, whatever its provenance — so in
   * practice **present and `'domain_separated'` means native-v2, absent
   * means legacy**. The remaining three values are declared by the node's
   * enum and typed here so a future response cannot break the union, but
   * they are not currently emitted on transaction reads.
   */
  signature_scheme?: SignatureScheme;
}

/**
 * Every transaction read carries the shared fields plus a correlated
 * `signature_type` / `signature` pair. Narrow on `signature_type` before
 * reading `signature`.
 */
type BaseTransaction = BaseTransactionFields &
  TransactionAuthorization;

// Discriminated union for all transaction types
export type Transaction =
  | (BaseTransaction & {
      transaction_type: 'TokenCreate';
      data: TokenCreateData;
    })
  | (BaseTransaction & {
      transaction_type: 'TokenTransfer';
      data: TokenTransferData;
    })
  | (BaseTransaction & {
      transaction_type: 'BatchPayment';
      data: BatchPaymentData;
    })
  | (BaseTransaction & {
      transaction_type: 'TokenMint';
      data: TokenMintData;
    })
  | (BaseTransaction & {
      transaction_type: 'TokenGrantAuthority';
      data: TokenGrantAuthorityData;
    })
  | (BaseTransaction & {
      transaction_type: 'TokenRevokeAuthority';
      data: TokenRevokeAuthorityData;
    })
  | (BaseTransaction & {
      transaction_type: 'TokenBlacklistAccount';
      data: TokenBlacklistAccountData;
    })
  | (BaseTransaction & {
      transaction_type: 'TokenWhitelistAccount';
      data: TokenWhitelistAccountData;
    })
  | (BaseTransaction & {
      transaction_type: 'TokenBridgeAndMint';
      data: TokenBridgeAndMintData;
    })
  | (BaseTransaction & {
      transaction_type: 'TokenBurn';
      data: TokenBurnData;
    })
  | (BaseTransaction & {
      transaction_type: 'TokenBurnAndBridge';
      data: TokenBurnAndBridgeData;
    })
  | (BaseTransaction & {
      transaction_type: 'TokenClawback';
      data: TokenClawbackData;
    })
  | (BaseTransaction & {
      transaction_type: 'TokenCloseAccount';
      data: TokenCloseAccountData;
    })
  | (BaseTransaction & {
      transaction_type: 'TokenPause';
      data: TokenPauseData;
    })
    | (BaseTransaction & {
        transaction_type: 'TokenUnpause';
        data: TokenUnpauseData;
    })
  | (BaseTransaction & {
      transaction_type: 'TokenUpdateMetadata';
      data: TokenUpdateMetadataData;
    })
  | (BaseTransaction & {
      transaction_type: 'CreateMultiSig';
      data: CreateMultiSigData;
    })
  | (BaseTransaction & {
      transaction_type: 'Raw';
      data: RawData;
    });
