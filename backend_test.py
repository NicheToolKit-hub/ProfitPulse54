#!/usr/bin/env python3
"""
ProfitPulse Backend Test — Payments Flow Only (Emergent-managed Stripe sandbox)
Tests ONLY the payments endpoints as requested in the review.
"""
import requests
import json
import sys
from uuid import uuid4

BASE_URL = "https://profitpulse-54.preview.emergentagent.com/api"

def log(msg):
    print(f"✓ {msg}")

def error(msg):
    print(f"✗ {msg}")
    sys.exit(1)

def test_payments_flow():
    """Test ONLY the payments flow with Emergent-managed Stripe sandbox"""
    
    print("\n" + "="*80)
    print("PAYMENTS FLOW TEST — Emergent-managed Stripe Sandbox")
    print("="*80 + "\n")
    
    # -------------------------------------------------------------------------
    # SETUP: Create tenants and invoice
    # -------------------------------------------------------------------------
    print("SETUP: Creating demo tenants...")
    resp = requests.post(f"{BASE_URL}/demo/seed", json={})
    assert resp.status_code == 200, f"Demo seed failed: {resp.status_code} {resp.text}"
    data = resp.json()
    tenants = data.get('tenants', [])
    assert len(tenants) >= 1, "No tenants created"
    
    # Use the ecommerce tenant
    tenant = next((t for t in tenants if t.get('niche') == 'ecommerce'), tenants[0])
    tenant_id = tenant['id']
    log(f"Using tenant: {tenant['name']} (id: {tenant_id})")
    
    print("\nSETUP: Creating open invoice...")
    invoice_payload = {
        "tenantId": tenant_id,
        "kind": "itemized",
        "clientName": "PayTest Client",
        "lines": [
            {
                "description": "Consulting Services",
                "quantity": 1,
                "unitAmount": 2500  # 2500 cents = $25.00
            }
        ]
    }
    resp = requests.post(f"{BASE_URL}/invoices", json=invoice_payload)
    assert resp.status_code == 200, f"Invoice creation failed: {resp.status_code} {resp.text}"
    invoice = resp.json()
    invoice_id = invoice['id']
    assert invoice['status'] == 'open', f"Invoice status should be 'open', got {invoice['status']}"
    assert invoice['total'] == 2500, f"Invoice total should be 2500, got {invoice['total']}"
    log(f"Created invoice {invoice['number']} (id: {invoice_id}, total: {invoice['total']} cents)")
    
    # Get initial journal entry count for later verification
    resp = requests.get(f"{BASE_URL}/transactions?tenantId={tenant_id}")
    assert resp.status_code == 200, f"Failed to get transactions: {resp.status_code}"
    initial_tx_count = len(resp.json())
    log(f"Initial transaction count: {initial_tx_count}")
    
    # -------------------------------------------------------------------------
    # TEST 1: GET /api/payments/providers → configured:true
    # -------------------------------------------------------------------------
    print("\n" + "-"*80)
    print("TEST 1: GET /api/payments/providers")
    print("-"*80)
    resp = requests.get(f"{BASE_URL}/payments/providers")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert 'providers' in data, "Response missing 'providers' key"
    assert len(data['providers']) > 0, "No providers returned"
    stripe_provider = data['providers'][0]
    assert stripe_provider['configured'] == True, f"Stripe should be configured:true, got {stripe_provider.get('configured')}"
    log(f"✅ TEST 1 PASSED: Stripe provider configured = {stripe_provider['configured']}")
    
    # -------------------------------------------------------------------------
    # TEST 2: POST /api/payments/checkout → url, sessionId (cs_test_), txId
    # -------------------------------------------------------------------------
    print("\n" + "-"*80)
    print("TEST 2: POST /api/payments/checkout")
    print("-"*80)
    checkout_payload = {"invoiceId": invoice_id}
    resp = requests.post(f"{BASE_URL}/payments/checkout", json=checkout_payload)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    checkout_data = resp.json()
    
    # Verify response structure
    assert 'url' in checkout_data, "Response missing 'url'"
    assert 'sessionId' in checkout_data, "Response missing 'sessionId'"
    assert 'txId' in checkout_data, "Response missing 'txId'"
    
    checkout_url = checkout_data['url']
    session_id = checkout_data['sessionId']
    tx_id = checkout_data['txId']
    
    # Verify URL is valid HTTP(S)
    assert checkout_url.startswith('http'), f"URL should start with 'http', got: {checkout_url}"
    log(f"Checkout URL: {checkout_url}")
    
    # Verify sessionId starts with 'cs_test_'
    assert session_id.startswith('cs_test_'), f"sessionId should start with 'cs_test_', got: {session_id}"
    log(f"Session ID: {session_id}")
    log(f"Transaction ID: {tx_id}")
    
    # Verify invoice now has stripeSessionId
    resp = requests.get(f"{BASE_URL}/invoices?tenantId={tenant_id}")
    assert resp.status_code == 200, f"Failed to get invoices: {resp.status_code}"
    invoices = resp.json()
    updated_invoice = next((inv for inv in invoices if inv['id'] == invoice_id), None)
    assert updated_invoice is not None, "Invoice not found after checkout"
    assert 'stripeSessionId' in updated_invoice, "Invoice missing stripeSessionId"
    assert updated_invoice['stripeSessionId'] == session_id, f"Invoice stripeSessionId mismatch"
    log(f"Invoice updated with stripeSessionId: {updated_invoice['stripeSessionId']}")
    log(f"✅ TEST 2 PASSED: Checkout created successfully with valid URL and sessionId")
    
    # -------------------------------------------------------------------------
    # TEST 3: GET /api/payments/status?session_id → status 'open', paymentStatus 'unpaid'
    #         CRITICAL: Must NOT crash, must NOT mark invoice paid, must NOT create ledger entry
    # -------------------------------------------------------------------------
    print("\n" + "-"*80)
    print("TEST 3: GET /api/payments/status (unpaid checkout)")
    print("-"*80)
    resp = requests.get(f"{BASE_URL}/payments/status?session_id={session_id}")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    status_data = resp.json()
    
    # Verify status fields
    assert 'status' in status_data, "Response missing 'status'"
    assert 'paymentStatus' in status_data, "Response missing 'paymentStatus'"
    
    # CRITICAL: Status should be 'open' and paymentStatus should be 'unpaid'
    # (payment not completed via API — this is EXPECTED and CORRECT)
    assert status_data['status'] == 'open', f"Expected status 'open', got {status_data['status']}"
    assert status_data['paymentStatus'] == 'unpaid', f"Expected paymentStatus 'unpaid', got {status_data['paymentStatus']}"
    log(f"Status: {status_data['status']}, Payment Status: {status_data['paymentStatus']}")
    
    # Verify invoice is still 'open' (NOT marked paid)
    resp = requests.get(f"{BASE_URL}/invoices?tenantId={tenant_id}")
    assert resp.status_code == 200, f"Failed to get invoices: {resp.status_code}"
    invoices = resp.json()
    current_invoice = next((inv for inv in invoices if inv['id'] == invoice_id), None)
    assert current_invoice is not None, "Invoice not found"
    assert current_invoice['status'] == 'open', f"Invoice should still be 'open', got {current_invoice['status']}"
    log(f"Invoice status still 'open' (correct — payment not completed)")
    
    # Verify NO new journal entry was created
    resp = requests.get(f"{BASE_URL}/transactions?tenantId={tenant_id}")
    assert resp.status_code == 200, f"Failed to get transactions: {resp.status_code}"
    current_tx_count = len(resp.json())
    assert current_tx_count == initial_tx_count, f"Transaction count changed! Expected {initial_tx_count}, got {current_tx_count}. NO ledger entry should be created for unpaid status."
    log(f"Transaction count unchanged: {current_tx_count} (correct — no ledger entry for unpaid)")
    log(f"✅ TEST 3 PASSED: Status endpoint working correctly for unpaid checkout")
    
    # -------------------------------------------------------------------------
    # TEST 4: GET /api/payments/status with bogus session_id → 404
    # -------------------------------------------------------------------------
    print("\n" + "-"*80)
    print("TEST 4: GET /api/payments/status (bogus session_id)")
    print("-"*80)
    bogus_session = "cs_test_bogus_nonexistent_12345"
    resp = requests.get(f"{BASE_URL}/payments/status?session_id={bogus_session}")
    assert resp.status_code == 404, f"Expected 404 for bogus session, got {resp.status_code}"
    error_data = resp.json()
    assert 'error' in error_data, "Response should contain 'error' field"
    log(f"Correctly returned 404 with error: {error_data['error']}")
    log(f"✅ TEST 4 PASSED: Bogus session_id returns 404")
    
    # -------------------------------------------------------------------------
    # TEST 5: POST /api/payments/checkout with non-existent invoiceId → 404
    # -------------------------------------------------------------------------
    print("\n" + "-"*80)
    print("TEST 5: POST /api/payments/checkout (non-existent invoice)")
    print("-"*80)
    fake_invoice_id = str(uuid4())
    checkout_payload = {"invoiceId": fake_invoice_id}
    resp = requests.post(f"{BASE_URL}/payments/checkout", json=checkout_payload)
    assert resp.status_code == 404, f"Expected 404 for non-existent invoice, got {resp.status_code}"
    error_data = resp.json()
    assert 'error' in error_data, "Response should contain 'error' field"
    assert 'Invoice not payable' in error_data['error'], f"Expected 'Invoice not payable' error, got: {error_data['error']}"
    log(f"Correctly returned 404 with error: {error_data['error']}")
    log(f"✅ TEST 5 PASSED: Non-existent invoice returns 404 'Invoice not payable'")
    
    # -------------------------------------------------------------------------
    # SUMMARY
    # -------------------------------------------------------------------------
    print("\n" + "="*80)
    print("ALL PAYMENTS TESTS PASSED ✅")
    print("="*80)
    print("\nSummary:")
    print("  ✅ TEST 1: Stripe provider configured = true")
    print("  ✅ TEST 2: Checkout returns valid URL (http), sessionId (cs_test_), txId")
    print("  ✅ TEST 3: Status endpoint returns 'open'/'unpaid' WITHOUT crash, NO invoice paid, NO ledger entry")
    print("  ✅ TEST 4: Bogus session_id returns 404")
    print("  ✅ TEST 5: Non-existent invoice returns 404 'Invoice not payable'")
    print("\n✅ Emergent-managed Stripe sandbox integration working correctly!")
    print("="*80 + "\n")

if __name__ == "__main__":
    try:
        test_payments_flow()
    except AssertionError as e:
        error(f"Test failed: {e}")
    except Exception as e:
        error(f"Unexpected error: {e}")
