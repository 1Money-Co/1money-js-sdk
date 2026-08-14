import { expect } from 'chai';
import 'mocha';

import { axiosStatic } from '../../client';
import { LOCAL_API_URL } from '../constants';
import {
  TransactionOutcomeUnknownError,
  TransactionSubmissionError
} from '../errors';
import transactionsApi from '../transactions';
import type {
  BatchExecutionEvent,
  Transaction
} from '../transactions/types';
import {
  batchPaymentReceiptFixture,
  batchPaymentTransactionFixture,
  multisigTransactionFixture,
  pendingTransactionFixture,
  finalizedBatchPaymentReceiptFixture,
  paymentSuccessReceiptFixture,
  ZERO_ADDRESS
} from './fixtures/transactions';

function summarizeEvent(event: BatchExecutionEvent): string {
  switch (event.event_type) {
    case 'BatchStarted':
      return `start:${event.operations_count}`;
    case 'PaymentExecuted':
      return `payment:${event.operation_index}`;
    case 'BatchCompleted':
      return `complete:${event.operations_count}`;
  }
  const exhaustive: never = event;
  return exhaustive;
}

describe('transaction response models', function () {
  it('models Batch Payment receipts and transactions', function () {
    expect(batchPaymentReceiptFixture).to.not.have.property(
      'max_fee'
    );
    expect(batchPaymentTransactionFixture.data).to.not.have.property(
      'max_fee'
    );
    expect(batchPaymentReceiptFixture.fee_used).to.equal('15');
    expect(batchPaymentReceiptFixture.success_info?.receiver).to.equal(
      ZERO_ADDRESS
    );
    expect(batchPaymentReceiptFixture.batch_info?.failure).to.equal(null);
    expect(
      batchPaymentReceiptFixture.execution_events?.map(summarizeEvent)
    ).to.deep.equal(['start:2', 'payment:0', 'complete:2']);
  });

  it('models bridge success and finalized receipt metadata', function () {
    expect(paymentSuccessReceiptFixture.success_info?.bridge_info).to.deep.equal({
      bbnonce: 7,
      destination_chain_id: 8453,
      destination_address: paymentSuccessReceiptFixture.recipient,
      bridge_param: '0x0123'
    });
    expect(finalizedBatchPaymentReceiptFixture).to.include({
      transaction_index: 4,
      fee_used: '15',
      checkpoint_number: 9,
      epoch: 12
    });
  });

  it('exposes the v2 signature scheme on the read model', function () {
    // The node returns signature_scheme: 'domain_separated' for every
    // domain-separated v2 transaction and omits the key for legacy ones, so
    // presence of that value is how a caller identifies a v2 submission.
    expect(
      batchPaymentTransactionFixture.signature_scheme
    ).to.equal('domain_separated');

    // Absence is the legacy signal, and must stay assignable.
    const legacy: Transaction = {
      ...batchPaymentTransactionFixture,
      signature_scheme: undefined
    };
    expect(legacy.signature_scheme).to.equal(undefined);
  });

  it('accepts null placement fields before checkpoint inclusion', function () {
    // The node emits these keys with a null value rather than omitting them,
    // because their Option carries no skip_serializing_if. Verified on a live
    // node: 65ms after submission a transaction read returned all three as
    // null. Declaring them `?: number` alone made this real response shape
    // unassignable.
    expect(
      pendingTransactionFixture.transaction_index
    ).to.equal(null);
    expect(
      pendingTransactionFixture.checkpoint_number
    ).to.equal(null);
    expect(
      pendingTransactionFixture.checkpoint_hash
    ).to.equal(null);

    // Null is distinct from absent here, so the keys must be present.
    expect(pendingTransactionFixture).to.have.property(
      'transaction_index'
    );

    // The fields the node really does omit must stay null-free, so that
    // `?: T` without null keeps meaning "absent" for them.
    expect(
      batchPaymentReceiptFixture.success_info
    ).to.not.equal(null);
  });

  it('narrows the signature shape on signature_type', function () {
    // The point of the discriminated union: this function compiles only
    // because signature_type narrows signature. Before, `signature` was
    // declared { r, s, v } for every variant, so the Multi branch below read
    // undefined at runtime while type-checking fine.
    function describeAuth(tx: Transaction): string {
      switch (tx.signature_type) {
        case 'Single':
          return `single:${tx.signature.r}`;
        case 'Multi':
          return `multi:${tx.signature.account}:${tx.signature.signatures.length}`;
      }
    }

    expect(
      describeAuth(batchPaymentTransactionFixture)
    ).to.equal('single:0x01');
    expect(
      describeAuth(multisigTransactionFixture)
    ).to.equal(
      `multi:${multisigTransactionFixture.signature.account}:2`
    );

    // The multisig authorization genuinely has no r/s/v at the top level --
    // that is exactly what the old type claimed was there.
    expect(
      multisigTransactionFixture.signature
    ).to.not.have.property('r');
    expect(
      multisigTransactionFixture.signature
        .signatures[0].signer_pubkey
    ).to.match(/^0x0[23][0-9a-f]{64}$/);
  });

  it('models the finalized counter-signature as a single BLS aggregate', function () {
    // The node returns one aggregate, never a per-validator array. Asserting
    // the singular key by name is what catches a regression back to
    // `counter_signatures`, which would silently read as undefined.
    expect(
      finalizedBatchPaymentReceiptFixture
    ).to.have.property('counter_signature');
    expect(
      finalizedBatchPaymentReceiptFixture
    ).to.not.have.property('counter_signatures');

    const aggregate =
      finalizedBatchPaymentReceiptFixture.counter_signature;
    expect(Object.keys(aggregate).sort()).to.deep.equal([
      'signature',
      'signer_bitmask',
      'validator_public_keys'
    ]);
    expect(aggregate.signature).to.match(/^0x[0-9a-f]{96}$/);
    expect(
      aggregate.validator_public_keys
    ).to.be.an('array');

    // fee is what the validators signed over; fee_used is what was charged.
    // They are separate fields and must both survive.
    expect(
      finalizedBatchPaymentReceiptFixture.fee
    ).to.equal('15');
    expect(
      finalizedBatchPaymentReceiptFixture.fee_bound
    ).to.equal(true);
  });
});

const FROM = `0x${'11'.repeat(20)}`;
const TOKEN = `0x${'22'.repeat(20)}`;
const OPERATIONS = [
  {
    recipient: `0x${'33'.repeat(20)}`,
    amount: '10'
  },
  {
    recipient: `0x${'44'.repeat(20)}`,
    amount: '20'
  }
];

describe('Batch Payment fee estimate', function () {
  let originalAdapter: typeof axiosStatic.defaults.adapter;
  let originalBaseURL: string | undefined;
  let seenMethod: string | undefined;
  let seenUrl: string | undefined;
  let seenBody: unknown;

  before(function () {
    originalAdapter = axiosStatic.defaults.adapter;
    originalBaseURL = axiosStatic.defaults.baseURL;
    axiosStatic.defaults.baseURL = LOCAL_API_URL;
  });

  after(function () {
    axiosStatic.defaults.adapter = originalAdapter;
    axiosStatic.defaults.baseURL = originalBaseURL;
  });

  beforeEach(function () {
    seenMethod = undefined;
    seenUrl = undefined;
    seenBody = undefined;
    axiosStatic.defaults.adapter = (config => {
      seenMethod = config.method;
      seenUrl = config.url;
      seenBody =
        typeof config.data === 'string'
          ? JSON.parse(config.data)
          : config.data;
      return Promise.resolve({
        data: {
          fee: '15',
          plan: 'batch-payment'
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      });
    }) as typeof originalAdapter;
  });

  afterEach(function () {
    axiosStatic.defaults.adapter = originalAdapter;
  });

  it('posts the unsigned request to the Batch Payment fee estimate endpoint', async function () {
    const result =
      transactionsApi.estimateBatchPaymentFee({
        from: FROM,
        token: TOKEN,
        operations: OPERATIONS
      });

    expect(await result).to.deep.equal({
      fee: '15',
      plan: 'batch-payment'
    });
    expect(seenMethod).to.equal('post');
    expect(seenUrl).to.equal(
      '/v1/transactions/batch_payment/estimate_fee'
    );
    expect(seenBody).to.deep.equal({
      from: FROM,
      token: TOKEN,
      operations: OPERATIONS
    });
  });

  it('preserves an optional plan from the regular fee estimator', async function () {
    const result = transactionsApi.estimateFee(
      FROM,
      OPERATIONS[0].recipient,
      OPERATIONS[0].amount,
      TOKEN
    );

    expect(await result).to.deep.equal({
      fee: '15',
      plan: 'batch-payment'
    });
  });

  it('rejects a 422 without classifying the estimate as a submitted transaction', async function () {
    axiosStatic.defaults.adapter = (config =>
      Promise.reject({
        message: 'Request failed with status code 422',
        name: 'AxiosError',
        config,
        response: {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: {},
          config,
          data: {
            message: 'invalid batch payment operation'
          }
        }
      })) as typeof originalAdapter;

    let caught: unknown;
    try {
      await transactionsApi.estimateBatchPaymentFee({
        from: FROM,
        token: TOKEN,
        operations: OPERATIONS
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).to.not.be.instanceOf(
      TransactionSubmissionError
    );
    expect(caught).to.not.be.instanceOf(
      TransactionOutcomeUnknownError
    );
    expect(caught).to.deep.include({
      status: 422,
      data: {
        message: 'invalid batch payment operation'
      }
    });
  });
});
