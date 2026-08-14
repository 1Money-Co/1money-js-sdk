import type {
  BatchPaymentData,
  BatchReceiptInfo,
  FinalizedTransactionReceipt,
  Transaction,
  TransactionReceipt
} from '../../transactions/types';

type BatchPaymentDataHasNoMaxFee =
  'max_fee' extends keyof BatchPaymentData ? never : true;

const batchPaymentDataHasNoMaxFee: BatchPaymentDataHasNoMaxFee =
  true;

export const SENDER = `0x${'11'.repeat(20)}`;
export const TOKEN = `0x${'22'.repeat(20)}`;
export const RECIPIENT = `0x${'33'.repeat(20)}`;
export const ZERO_ADDRESS = `0x${'00'.repeat(20)}`;
export const TRANSACTION_HASH = `0x${'44'.repeat(32)}`;
export const CHECKPOINT_HASH = `0x${'55'.repeat(32)}`;
export const OPERATIONS_HASH = `0x${'66'.repeat(32)}`;

export const batchPaymentReceiptFixture = {
  success: true,
  transaction_hash: TRANSACTION_HASH,
  transaction_index: 4,
  fee_used: '15',
  from: SENDER,
  checkpoint_hash: CHECKPOINT_HASH,
  checkpoint_number: 9,
  recipient: null,
  token_address: TOKEN,
  success_info: {
    sender: SENDER,
    receiver: ZERO_ADDRESS,
    is_private: false,
    message: 'batch payment success: 2 operations',
    bridge_info: null
  },
  batch_info: {
    batch_id: 'payroll-1',
    operations_hash: OPERATIONS_HASH,
    operations_count: 2,
    total_amount: '15',
    failure: null
  },
  execution_events: [
    {
      event_type: 'BatchStarted',
      batch_id: 'payroll-1',
      operations_count: 2,
      total_amount: '15',
      operations_hash: OPERATIONS_HASH
    },
    {
      event_type: 'PaymentExecuted',
      operation_index: 0,
      recipient: RECIPIENT,
      amount: '10'
    },
    {
      event_type: 'BatchCompleted',
      batch_id: 'payroll-1',
      operations_count: 2,
      total_amount: '15',
      operations_hash: OPERATIONS_HASH
    }
  ]
} satisfies TransactionReceipt;

export const paymentSuccessReceiptFixture = {
  success: true,
  transaction_hash: TRANSACTION_HASH,
  fee_used: '5',
  from: SENDER,
  recipient: RECIPIENT,
  token_address: TOKEN,
  success_info: {
    sender: SENDER,
    receiver: RECIPIENT,
    is_private: false,
    message: 'payment success',
    bridge_info: {
      bbnonce: 7,
      destination_chain_id: 8453,
      destination_address: RECIPIENT,
      bridge_param: '0x0123'
    }
  }
} satisfies TransactionReceipt;

export const forwardCompatibleBatchFailureFixture = {
  batch_id: 'payroll-2',
  operations_hash: OPERATIONS_HASH,
  operations_count: 2,
  total_amount: '15',
  failure: {
    failed_operation_index: 1,
    reason: 'insufficient funds'
  }
} satisfies BatchReceiptInfo;

// Shaped after a real finalized response from a local node: a singular
// `counter_signature` BLS aggregate plus `fee` and `fee_bound`. The previous
// version of this fixture declared `counter_signatures: [{ r, s, v }]`, an
// ECDSA-shaped array the node has never returned -- and because it was
// `satisfies FinalizedTransactionReceipt`, it type-checked against the
// equally wrong interface and confirmed nothing.
export const finalizedBatchPaymentReceiptFixture = {
  ...batchPaymentReceiptFixture,
  epoch: 12,
  counter_signature: {
    signer_bitmask: '0x7f',
    signature: `0x${'ab'.repeat(48)}`,
    validator_public_keys: [
      `0x${'c1'.repeat(96)}`,
      `0x${'c2'.repeat(96)}`
    ]
  },
  fee: '15',
  fee_bound: true
} satisfies FinalizedTransactionReceipt;

export const batchPaymentTransactionFixture = {
  hash: TRANSACTION_HASH,
  checkpoint_hash: CHECKPOINT_HASH,
  checkpoint_number: 9,
  transaction_index: 4,
  chain_id: 1,
  from: SENDER,
  nonce: 3,
  // The node tags the authorization adjacently, so signature_type names the
  // shape in signature. Always present on a read.
  signature_type: 'Single',
  signature: {
    r: '0x01',
    s: '0x02',
    v: 1
  },
  // Present and 'domain_separated' is what the node returns for a v2
  // submission; a legacy transaction omits the key entirely.
  signature_scheme: 'domain_separated',
  transaction_type: 'BatchPayment',
  data: {
    token: TOKEN,
    operations: [
      {
        recipient: RECIPIENT,
        amount: '10'
      },
      {
        recipient: SENDER,
        amount: '5'
      }
    ],
    operations_hash: OPERATIONS_HASH,
    batch_id: 'payroll-1',
    created_at: 1723334400
  }
} satisfies Transaction;

void batchPaymentDataHasNoMaxFee;

// A multisig-authorized read. Its `signature` is { account, signatures },
// not { r, s, v } -- the shape the previous BaseTransaction could not express
// and which callers silently read as undefined.
export const multisigTransactionFixture = {
  hash: TRANSACTION_HASH,
  chain_id: 1,
  from: SENDER,
  nonce: 4,
  signature_type: 'Multi',
  signature: {
    account: SENDER,
    signatures: [
      {
        signer_pubkey: `0x02${'11'.repeat(32)}`,
        signature: { r: '0x01', s: '0x02', v: 0 }
      },
      {
        signer_pubkey: `0x03${'22'.repeat(32)}`,
        signature: { r: '0x03', s: '0x04', v: 1 }
      }
    ]
  },
  signature_scheme: 'domain_separated',
  transaction_type: 'TokenTransfer',
  data: {
    recipient: RECIPIENT,
    value: '10',
    token: TOKEN
  }
} satisfies Transaction;

// A transaction read before checkpoint inclusion. All three placement fields
// come back as null, not absent -- observed on a live node 65ms after
// submission. The previous `transaction_index?: number` excluded this, the
// one shape a caller polling for inclusion actually sees first.
export const pendingTransactionFixture = {
  hash: TRANSACTION_HASH,
  checkpoint_hash: null,
  checkpoint_number: null,
  transaction_index: null,
  chain_id: 1,
  from: SENDER,
  nonce: 5,
  signature_type: 'Single',
  signature: {
    r: '0x01',
    s: '0x02',
    v: 0
  },
  signature_scheme: 'domain_separated',
  transaction_type: 'TokenTransfer',
  data: {
    recipient: RECIPIENT,
    value: '10',
    token: TOKEN
  }
} satisfies Transaction;
