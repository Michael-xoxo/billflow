const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const { app, connectDB } = require('../server');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');

async function jsonRequest(baseUrl, method, path, token, payload) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: payload !== undefined ? JSON.stringify(payload) : undefined
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function runAdversarialVoidSuite() {
  console.log('=== AGENT GAMMA: TASK 3.6 ADVERSARIAL INVOICE VOID ENGINE QA SUITE ===');

  let unhandledErrors = [];
  const onUnhandled = (err) => unhandledErrors.push(err);
  process.on('unhandledRejection', onUnhandled);
  process.on('uncaughtException', onUnhandled);

  await connectDB();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[BOOT] Ephemeral test server listening at ${baseUrl}`);

  const runId = Date.now();
  const createdUserIds = [];

  try {
    // Provision Tenant A and Tenant B via /api/auth/register
    const regA = await jsonRequest(baseUrl, 'POST', '/api/auth/register', null, {
      name: 'Gamma Tenant A',
      email: `gamma_tenant_a_${runId}@billflow.test`,
      password: 'Password123!'
    });
    assert.equal(regA.status, 201, 'Tenant A registration should return 201');
    const tokenA = regA.body.token;
    const userAId = regA.body.user._id || regA.body.user.id;
    createdUserIds.push(userAId);

    const regB = await jsonRequest(baseUrl, 'POST', '/api/auth/register', null, {
      name: 'Gamma Tenant B',
      email: `gamma_tenant_b_${runId}@billflow.test`,
      password: 'Password123!'
    });
    assert.equal(regB.status, 201, 'Tenant B registration should return 201');
    const tokenB = regB.body.token;
    const userBId = regB.body.user._id || regB.body.user.id;
    createdUserIds.push(userBId);

    // Create Customer for Tenant A
    const custRes = await jsonRequest(baseUrl, 'POST', '/api/customers', tokenA, {
      name: 'Gamma Enterprise Client',
      email: `client_${runId}@enterprise.test`,
      company: 'Gamma Corp'
    });
    assert.equal(custRes.status, 201, 'Customer creation should return 201');
    const customerAId = custRes.body._id;

    // -------------------------------------------------------------------------
    // TEST 1: Immutability Check (Voiding a PAID invoice must return HTTP 400)
    // -------------------------------------------------------------------------
    const createPaidRes = await jsonRequest(baseUrl, 'POST', '/api/invoices', tokenA, {
      customer: customerAId,
      invoiceNumber: `INV-PAID-${runId}`,
      status: 'paid',
      taxPercent: 0,
      lineItems: [
        { description: 'Settled Enterprise License', quantity: 1, unitPriceCents: 15000 }
      ]
    });
    assert.equal(createPaidRes.status, 201, 'Paid invoice creation should return 201');
    const paidInvoiceId = createPaidRes.body._id;

    const voidPaidRes = await jsonRequest(
      baseUrl,
      'PATCH',
      `/api/invoices/${paidInvoiceId}/void`,
      tokenA
    );
    assert.equal(voidPaidRes.status, 400, 'Voiding a paid invoice must return HTTP 400');
    assert.equal(
      voidPaidRes.body.error,
      'Cannot void an invoice that is already paid',
      'Paid invoice void error message must match contract'
    );
    console.log(
      `[PASS] 1. Immutability Check: Voiding paid invoice ${paidInvoiceId} rejected with HTTP ${voidPaidRes.status} (${JSON.stringify(voidPaidRes.body)})`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Analytics Balance Reconciliation ($200.00 / 20,000 cents pending)
    // -------------------------------------------------------------------------
    const createPendingRes = await jsonRequest(baseUrl, 'POST', '/api/invoices', tokenA, {
      customer: customerAId,
      invoiceNumber: `INV-PEND-200-${runId}`,
      status: 'pending',
      taxPercent: 0,
      lineItems: [
        { description: 'Cloud Compute Usage ($200.00)', quantity: 1, unitPriceCents: 20000 }
      ]
    });
    assert.equal(createPendingRes.status, 201, 'Pending invoice creation should return 201');
    assert.equal(createPendingRes.body.totalCents, 20000, 'Invoice totalCents must be 20000');
    const pendingInvoiceId = createPendingRes.body._id;

    const preAnalytics = await jsonRequest(baseUrl, 'GET', '/api/analytics/summary', tokenA);
    assert.equal(preAnalytics.status, 200, 'Pre-void analytics summary should return 200');
    const preOutstanding = preAnalytics.body.outstandingCents;
    const preRevenue = preAnalytics.body.totalRevenueCents;
    const preMrr = preAnalytics.body.mrrCents;

    const voidPendingRes = await jsonRequest(
      baseUrl,
      'PATCH',
      `/api/invoices/${pendingInvoiceId}/void`,
      tokenA
    );
    assert.equal(voidPendingRes.status, 200, 'Voiding pending invoice should return HTTP 200');
    assert.equal(voidPendingRes.body.status, 'void', 'Voided invoice status must be "void"');
    assert.ok(voidPendingRes.body.voidedAt, 'Voided invoice must include a voidedAt timestamp');

    const postAnalytics = await jsonRequest(baseUrl, 'GET', '/api/analytics/summary', tokenA);
    assert.equal(postAnalytics.status, 200, 'Post-void analytics summary should return 200');
    const postOutstanding = postAnalytics.body.outstandingCents;
    const deltaOutstanding = preOutstanding - postOutstanding;

    assert.equal(
      deltaOutstanding,
      20000,
      `Expected outstandingCents to drop by exactly 20000 cents, got delta=${deltaOutstanding}`
    );
    assert.equal(
      postAnalytics.body.totalRevenueCents,
      preRevenue,
      'Voided invoice must not alter totalRevenueCents'
    );
    assert.equal(
      postAnalytics.body.mrrCents,
      preMrr,
      'Voided invoice must not alter mrrCents'
    );
    console.log(
      `[PASS] 2. Analytics Balance Reconciliation: Pre-void outstandingCents=${preOutstanding}, Post-void outstandingCents=${postOutstanding} (Exact delta = -${deltaOutstanding} cents)`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Tenant Isolation (User B attempting to void User A's invoice)
    // -------------------------------------------------------------------------
    const tenantTargetRes = await jsonRequest(baseUrl, 'POST', '/api/invoices', tokenA, {
      customer: customerAId,
      invoiceNumber: `INV-ISOLATION-${runId}`,
      status: 'pending',
      taxPercent: 0,
      lineItems: [
        { description: 'Tenant A Confidential Retainer', quantity: 1, unitPriceCents: 9500 }
      ]
    });
    assert.equal(tenantTargetRes.status, 201);
    const tenantAInvoiceId = tenantTargetRes.body._id;

    const crossTenantVoidRes = await jsonRequest(
      baseUrl,
      'PATCH',
      `/api/invoices/${tenantAInvoiceId}/void`,
      tokenB
    );
    assert.equal(
      crossTenantVoidRes.status,
      404,
      'Cross-tenant void attempt must return HTTP 404'
    );

    // Verify User A's invoice remains untouched ('pending')
    const verifyTenantAInv = await jsonRequest(
      baseUrl,
      'GET',
      `/api/invoices/${tenantAInvoiceId}`,
      tokenA
    );
    assert.equal(verifyTenantAInv.body.status, 'pending', 'Target invoice must remain pending');
    console.log(
      `[PASS] 3. Tenant Isolation: User B void attempt against User A invoice ${tenantAInvoiceId} blocked with HTTP ${crossTenantVoidRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Concurrency Stress (5 simultaneous PATCH /api/invoices/:id/void)
    // -------------------------------------------------------------------------
    const raceInvoiceRes = await jsonRequest(baseUrl, 'POST', '/api/invoices', tokenA, {
      customer: customerAId,
      invoiceNumber: `INV-RACE-${runId}`,
      status: 'pending',
      taxPercent: 0,
      lineItems: [
        { description: 'Concurrent Race Target', quantity: 1, unitPriceCents: 33000 }
      ]
    });
    assert.equal(raceInvoiceRes.status, 201);
    const raceInvoiceId = raceInvoiceRes.body._id;

    const concurrentResponses = await Promise.all(
      Array.from({ length: 5 }, () =>
        jsonRequest(baseUrl, 'PATCH', `/api/invoices/${raceInvoiceId}/void`, tokenA)
      )
    );

    const statusCodes = concurrentResponses.map((r) => r.status);
    const successResponses = concurrentResponses.filter((r) => r.status === 200);
    const alreadyVoidedResponses = concurrentResponses.filter(
      (r) => r.status === 400 && r.body.error === 'Invoice is already voided'
    );

    assert.equal(
      successResponses.length,
      1,
      `Expected exactly 1 HTTP 200 response among 5 concurrent void requests, got ${successResponses.length} (statuses: ${JSON.stringify(statusCodes)})`
    );
    assert.equal(
      alreadyVoidedResponses.length,
      4,
      `Expected 4 HTTP 400 "Invoice is already voided" responses, got ${alreadyVoidedResponses.length}`
    );
    assert.equal(
      unhandledErrors.length,
      0,
      `Expected 0 unhandled rejections/exceptions, got ${unhandledErrors.length}`
    );

    console.log(
      `[PASS] 4. Concurrency Stress (5x simultaneous PATCH): Status distribution = ${JSON.stringify(statusCodes)} (1x HTTP 200, 4x HTTP 400 "Invoice is already voided", 0 crashes)`
    );
    console.log('=== ALL 4 ADVERSARIAL QA ASSERTIONS PASSED ===');
  } finally {
    process.off('unhandledRejection', onUnhandled);
    process.off('uncaughtException', onUnhandled);
    if (createdUserIds.length > 0) {
      await Invoice.deleteMany({ user: { $in: createdUserIds } });
      await Customer.deleteMany({ user: { $in: createdUserIds } });
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
}

runAdversarialVoidSuite().catch((err) => {
  console.error('[FAIL] Adversarial QA Suite failed:', err);
  process.exit(1);
});
