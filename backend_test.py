#!/usr/bin/env python3
"""
ProfitPulse Backend API Test Suite
Tests all backend endpoints with double-entry validation
"""

import requests
import json
from typing import Dict, List, Any

# Base URL from .env
BASE_URL = "https://profitpulse-54.preview.emergentagent.com/api"

class TestResults:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
    
    def add_pass(self, test_name: str, details: str = ""):
        self.passed.append(f"✅ {test_name}: {details}")
        print(f"✅ PASS: {test_name} - {details}")
    
    def add_fail(self, test_name: str, details: str):
        self.failed.append(f"❌ {test_name}: {details}")
        print(f"❌ FAIL: {test_name} - {details}")
    
    def add_warning(self, test_name: str, details: str):
        self.warnings.append(f"⚠️  {test_name}: {details}")
        print(f"⚠️  WARNING: {test_name} - {details}")
    
    def summary(self):
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print(f"Passed: {len(self.passed)}")
        print(f"Failed: {len(self.failed)}")
        print(f"Warnings: {len(self.warnings)}")
        print("="*80)
        if self.failed:
            print("\nFAILURES:")
            for f in self.failed:
                print(f)
        if self.warnings:
            print("\nWARNINGS:")
            for w in self.warnings:
                print(w)
        print("\n")

results = TestResults()

def verify_balanced_entry(entry: Dict, test_name: str) -> bool:
    """Verify that a journal entry has balanced debits and credits"""
    lines = entry.get('lines', [])
    if len(lines) < 2:
        results.add_fail(test_name, f"Entry {entry.get('id')} has less than 2 lines")
        return False
    
    total_debit = sum(line.get('debit', 0) for line in lines)
    total_credit = sum(line.get('credit', 0) for line in lines)
    
    if total_debit != total_credit:
        results.add_fail(test_name, f"Entry {entry.get('id')} UNBALANCED: debits={total_debit} credits={total_credit}")
        return False
    
    if total_debit == 0:
        results.add_fail(test_name, f"Entry {entry.get('id')} has zero amount")
        return False
    
    return True

def test_demo_seed():
    """Test 1: POST /api/demo/seed - Create 4 niche tenants"""
    print("\n" + "="*80)
    print("TEST 1: Demo Seed - Create 4 Niche Tenants")
    print("="*80)
    
    try:
        response = requests.post(f"{BASE_URL}/demo/seed", json={}, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            results.add_fail("Demo Seed", f"Expected 200, got {response.status_code}: {response.text}")
            return None
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)[:500]}")
        
        # Check if created or already exists
        if data.get('created') == False:
            results.add_pass("Demo Seed (Idempotent)", "Tenants already exist, returned existing tenants")
        else:
            results.add_pass("Demo Seed (Create)", "Created 4 new tenants")
        
        tenants = data.get('tenants', [])
        if len(tenants) != 4:
            results.add_fail("Demo Seed", f"Expected 4 tenants, got {len(tenants)}")
            return None
        
        # Verify tenant names and niches
        expected = {
            'Nimbus Goods Co.': 'ecommerce',
            'Ironclad Contracting': 'field_trades',
            'Studio Vera': 'freelancer',
            'FlowMetric SaaS': 'saas'
        }
        
        tenant_map = {}
        for tenant in tenants:
            name = tenant.get('name')
            niche = tenant.get('niche')
            tenant_id = tenant.get('id')
            
            if name in expected:
                if expected[name] == niche:
                    results.add_pass("Demo Seed Tenant", f"{name} has correct niche: {niche}")
                    tenant_map[niche] = tenant_id
                else:
                    results.add_fail("Demo Seed Tenant", f"{name} has wrong niche: {niche}, expected {expected[name]}")
            else:
                results.add_warning("Demo Seed Tenant", f"Unexpected tenant: {name}")
        
        return tenant_map
    
    except Exception as e:
        results.add_fail("Demo Seed", f"Exception: {str(e)}")
        return None

def test_get_tenants():
    """Test 2: GET /api/tenants - List all tenants"""
    print("\n" + "="*80)
    print("TEST 2: Get Tenants")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/tenants", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            results.add_fail("Get Tenants", f"Expected 200, got {response.status_code}")
            return
        
        tenants = response.json()
        print(f"Found {len(tenants)} tenants")
        
        if len(tenants) != 4:
            results.add_fail("Get Tenants", f"Expected 4 tenants, got {len(tenants)}")
            return
        
        for tenant in tenants:
            if not all(k in tenant for k in ['id', 'name', 'niche', 'onboardingComplete']):
                results.add_fail("Get Tenants", f"Tenant missing required fields: {tenant}")
                return
        
        results.add_pass("Get Tenants", f"Retrieved {len(tenants)} tenants with all required fields")
    
    except Exception as e:
        results.add_fail("Get Tenants", f"Exception: {str(e)}")

def test_accounts(tenant_id: str, niche: str):
    """Test 3: GET /api/accounts - Verify niche-specific chart of accounts"""
    print(f"\n--- Testing Accounts for {niche} (tenant: {tenant_id[:8]}...) ---")
    
    try:
        response = requests.get(f"{BASE_URL}/accounts", params={'tenantId': tenant_id}, timeout=10)
        
        if response.status_code != 200:
            results.add_fail(f"Accounts ({niche})", f"Expected 200, got {response.status_code}")
            return
        
        accounts = response.json()
        print(f"Found {len(accounts)} accounts")
        
        if len(accounts) < 6:
            results.add_fail(f"Accounts ({niche})", f"Expected at least 6 base accounts, got {len(accounts)}")
            return
        
        account_names = [acc.get('name') for acc in accounts]
        
        # Verify base accounts
        base_required = ['Cash & Bank', 'Accounts Receivable', 'Accounts Payable']
        for base in base_required:
            if base not in account_names:
                results.add_fail(f"Accounts ({niche})", f"Missing base account: {base}")
                return
        
        # Verify niche-specific accounts
        niche_checks = {
            'ecommerce': ['Product Sales', 'Marketplace Fees'],
            'field_trades': ['Job Revenue'],
            'freelancer': ['Retainer Income'],
            'saas': ['Subscription Revenue']
        }
        
        required = niche_checks.get(niche, [])
        for req in required:
            if req in account_names:
                results.add_pass(f"Accounts ({niche})", f"Found niche account: {req}")
            else:
                results.add_fail(f"Accounts ({niche})", f"Missing niche account: {req}")
    
    except Exception as e:
        results.add_fail(f"Accounts ({niche})", f"Exception: {str(e)}")

def test_transactions(tenant_id: str, niche: str):
    """Test 4: GET /api/transactions - Verify balanced journal entries"""
    print(f"\n--- Testing Transactions for {niche} (tenant: {tenant_id[:8]}...) ---")
    
    try:
        response = requests.get(f"{BASE_URL}/transactions", params={'tenantId': tenant_id}, timeout=10)
        
        if response.status_code != 200:
            results.add_fail(f"Transactions ({niche})", f"Expected 200, got {response.status_code}")
            return []
        
        entries = response.json()
        print(f"Found {len(entries)} journal entries")
        
        if len(entries) == 0:
            results.add_warning(f"Transactions ({niche})", "No transactions found")
            return []
        
        # Verify each entry is balanced
        unbalanced_count = 0
        for entry in entries:
            if not verify_balanced_entry(entry, f"Transactions ({niche})"):
                unbalanced_count += 1
        
        if unbalanced_count == 0:
            results.add_pass(f"Transactions ({niche})", f"All {len(entries)} entries are balanced (debits == credits)")
        else:
            results.add_fail(f"Transactions ({niche})", f"{unbalanced_count} unbalanced entries found")
        
        return entries
    
    except Exception as e:
        results.add_fail(f"Transactions ({niche})", f"Exception: {str(e)}")
        return []

def test_dashboard(tenant_id: str, niche: str):
    """Test 5: GET /api/dashboard - Verify niche-specific dashboard"""
    print(f"\n--- Testing Dashboard for {niche} (tenant: {tenant_id[:8]}...) ---")
    
    try:
        response = requests.get(f"{BASE_URL}/dashboard", params={'tenantId': tenant_id}, timeout=10)
        
        if response.status_code != 200:
            results.add_fail(f"Dashboard ({niche})", f"Expected 200, got {response.status_code}: {response.text}")
            return None
        
        data = response.json()
        
        # Verify common fields
        if 'common' not in data:
            results.add_fail(f"Dashboard ({niche})", "Missing 'common' block")
            return None
        
        common = data['common']
        required_common = ['revenue', 'expenses', 'netProfit', 'cash', 'margin', 'monthly', 'triage', 'txCount']
        for field in required_common:
            if field not in common:
                results.add_fail(f"Dashboard ({niche})", f"Missing common field: {field}")
                return None
        
        # Verify monthly has 6 items
        if len(common.get('monthly', [])) != 6:
            results.add_fail(f"Dashboard ({niche})", f"Expected 6 monthly items, got {len(common.get('monthly', []))}")
        else:
            results.add_pass(f"Dashboard ({niche})", "Common block has all required fields including 6 monthly items")
        
        # Verify triage
        triage = common.get('triage', {})
        if not all(k in triage for k in ['reconciled', 'flagged', 'pending']):
            results.add_fail(f"Dashboard ({niche})", "Triage missing required fields")
        else:
            results.add_pass(f"Dashboard ({niche})", f"Triage: {triage}")
        
        # Verify niche-specific fields
        if 'niche' not in data:
            results.add_fail(f"Dashboard ({niche})", "Missing 'niche' block")
            return None
        
        niche_data = data['niche']
        niche_checks = {
            'ecommerce': ['skuMargins', 'marketplaceFees', 'adRoi'],
            'field_trades': ['jobs', 'receiptsCount'],
            'freelancer': ['unsortedFeed', 'estQuarterlyTax', 'businessExpenses', 'personalExpenses'],
            'saas': ['mrr', 'churn', 'arpu', 'gatewayFees', 'mrrSeries']
        }
        
        required_niche = niche_checks.get(niche, [])
        missing = []
        for field in required_niche:
            if field not in niche_data:
                missing.append(field)
        
        if missing:
            results.add_fail(f"Dashboard ({niche})", f"Missing niche fields: {missing}")
        else:
            results.add_pass(f"Dashboard ({niche})", f"Niche block has all required fields: {required_niche}")
        
        return data
    
    except Exception as e:
        results.add_fail(f"Dashboard ({niche})", f"Exception: {str(e)}")
        return None

def test_reports(tenant_id: str, niche: str):
    """Test 6: GET /api/reports - Verify P&L and Balance Sheet"""
    print(f"\n--- Testing Reports for {niche} (tenant: {tenant_id[:8]}...) ---")
    
    try:
        response = requests.get(f"{BASE_URL}/reports", params={'tenantId': tenant_id}, timeout=10)
        
        if response.status_code != 200:
            results.add_fail(f"Reports ({niche})", f"Expected 200, got {response.status_code}")
            return
        
        data = response.json()
        
        # Verify P&L
        if 'pnl' not in data:
            results.add_fail(f"Reports ({niche})", "Missing P&L")
            return
        
        pnl = data['pnl']
        if not all(k in pnl for k in ['income', 'expense', 'totalIncome', 'totalExpense', 'netIncome']):
            results.add_fail(f"Reports ({niche})", "P&L missing required fields")
            return
        
        # Verify net income calculation
        calculated_net = pnl['totalIncome'] - pnl['totalExpense']
        if pnl['netIncome'] != calculated_net:
            results.add_fail(f"Reports ({niche})", f"Net income mismatch: {pnl['netIncome']} != {calculated_net}")
        else:
            results.add_pass(f"Reports ({niche})", f"P&L net income correct: {pnl['netIncome']/100:.2f} USD")
        
        # Verify Balance Sheet
        if 'balanceSheet' not in data:
            results.add_fail(f"Reports ({niche})", "Missing Balance Sheet")
            return
        
        bs = data['balanceSheet']
        if not all(k in bs for k in ['assets', 'liabilities', 'equity']):
            results.add_fail(f"Reports ({niche})", "Balance Sheet missing required fields")
        else:
            results.add_pass(f"Reports ({niche})", "Balance Sheet present with all required fields")
    
    except Exception as e:
        results.add_fail(f"Reports ({niche})", f"Exception: {str(e)}")

def test_reports_csv(tenant_id: str, niche: str):
    """Test 7: GET /api/reports/csv - Verify CSV export"""
    print(f"\n--- Testing CSV Export for {niche} (tenant: {tenant_id[:8]}...) ---")
    
    try:
        response = requests.get(f"{BASE_URL}/reports/csv", params={'tenantId': tenant_id}, timeout=10)
        
        if response.status_code != 200:
            results.add_fail(f"CSV Export ({niche})", f"Expected 200, got {response.status_code}")
            return
        
        if 'text/csv' not in response.headers.get('Content-Type', ''):
            results.add_fail(f"CSV Export ({niche})", f"Wrong content type: {response.headers.get('Content-Type')}")
            return
        
        csv_text = response.text
        lines = csv_text.split('\n')
        
        if len(lines) < 2:
            results.add_fail(f"CSV Export ({niche})", "CSV has no data rows")
            return
        
        # Check header
        header = lines[0]
        if 'Date' not in header or 'Description' not in header:
            results.add_fail(f"CSV Export ({niche})", f"Invalid header: {header}")
            return
        
        results.add_pass(f"CSV Export ({niche})", f"CSV export successful with {len(lines)-1} rows")
    
    except Exception as e:
        results.add_fail(f"CSV Export ({niche})", f"Exception: {str(e)}")

def test_post_transaction(tenant_id: str, niche: str, tx_type: str, category: str, amount: int):
    """Test 8: POST /api/transactions - Create new transaction"""
    print(f"\n--- Testing POST Transaction ({tx_type}) for {niche} ---")
    
    try:
        payload = {
            'tenantId': tenant_id,
            'type': tx_type,
            'category': category,
            'amount': amount,
            'description': f'Test {tx_type} transaction',
            'status': 'pending'
        }
        
        response = requests.post(f"{BASE_URL}/transactions", json=payload, timeout=10)
        
        if response.status_code != 200:
            results.add_fail(f"POST Transaction ({tx_type}, {niche})", f"Expected 200, got {response.status_code}: {response.text}")
            return None
        
        entry = response.json()
        
        if 'id' not in entry:
            results.add_fail(f"POST Transaction ({tx_type}, {niche})", "Response missing entry id")
            return None
        
        results.add_pass(f"POST Transaction ({tx_type}, {niche})", f"Created entry {entry['id'][:8]}...")
        
        # Verify the entry exists and is balanced
        response = requests.get(f"{BASE_URL}/transactions", params={'tenantId': tenant_id}, timeout=10)
        if response.status_code == 200:
            entries = response.json()
            new_entry = next((e for e in entries if e['id'] == entry['id']), None)
            if new_entry:
                if verify_balanced_entry(new_entry, f"POST Transaction ({tx_type}, {niche})"):
                    results.add_pass(f"POST Transaction ({tx_type}, {niche})", f"Entry is balanced with amount {amount}")
                    return new_entry
            else:
                results.add_fail(f"POST Transaction ({tx_type}, {niche})", "Created entry not found in GET")
        
        return entry
    
    except Exception as e:
        results.add_fail(f"POST Transaction ({tx_type}, {niche})", f"Exception: {str(e)}")
        return None

def test_patch_status(entry_id: str, new_status: str):
    """Test 9: PATCH /api/transactions/status - Update transaction status"""
    print(f"\n--- Testing PATCH Transaction Status ---")
    
    try:
        payload = {'id': entry_id, 'status': new_status}
        response = requests.patch(f"{BASE_URL}/transactions/status", json=payload, timeout=10)
        
        if response.status_code != 200:
            results.add_fail("PATCH Status", f"Expected 200, got {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        if data.get('ok') != True:
            results.add_fail("PATCH Status", f"Response not ok: {data}")
            return False
        
        results.add_pass("PATCH Status", f"Updated entry {entry_id[:8]}... to status '{new_status}'")
        return True
    
    except Exception as e:
        results.add_fail("PATCH Status", f"Exception: {str(e)}")
        return False

def test_patch_classify(entry_id: str, classification: str):
    """Test 10: PATCH /api/transactions/classify - Classify freelancer transaction"""
    print(f"\n--- Testing PATCH Transaction Classify ---")
    
    try:
        payload = {'id': entry_id, 'classification': classification}
        response = requests.patch(f"{BASE_URL}/transactions/classify", json=payload, timeout=10)
        
        if response.status_code != 200:
            results.add_fail("PATCH Classify", f"Expected 200, got {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        if data.get('ok') != True:
            results.add_fail("PATCH Classify", f"Response not ok: {data}")
            return False
        
        results.add_pass("PATCH Classify", f"Classified entry {entry_id[:8]}... as '{classification}'")
        return True
    
    except Exception as e:
        results.add_fail("PATCH Classify", f"Exception: {str(e)}")
        return False

def test_invoicing(tenant_id: str, niche: str):
    """Test 11: POST /api/invoices - Create invoice"""
    print(f"\n--- Testing Invoicing for {niche} ---")
    
    try:
        payload = {
            'tenantId': tenant_id,
            'kind': 'itemized',
            'clientName': 'Acme Corp',
            'lines': [
                {'description': 'Widget', 'quantity': 2, 'unitAmount': 5000}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/invoices", json=payload, timeout=10)
        
        if response.status_code != 200:
            results.add_fail(f"Invoicing ({niche})", f"Expected 200, got {response.status_code}: {response.text}")
            return None
        
        invoice = response.json()
        
        # Verify invoice fields
        if 'id' not in invoice or 'number' not in invoice:
            results.add_fail(f"Invoicing ({niche})", "Invoice missing required fields")
            return None
        
        if not invoice['number'].startswith('INV-'):
            results.add_fail(f"Invoicing ({niche})", f"Invalid invoice number format: {invoice['number']}")
            return None
        
        if invoice.get('total') != 10000:
            results.add_fail(f"Invoicing ({niche})", f"Wrong total: {invoice.get('total')}, expected 10000")
            return None
        
        if invoice.get('status') != 'open':
            results.add_fail(f"Invoicing ({niche})", f"Wrong status: {invoice.get('status')}, expected 'open'")
            return None
        
        results.add_pass(f"Invoicing ({niche})", f"Created invoice {invoice['number']} with total 10000 cents (100 USD)")
        
        # Verify GET /api/invoices
        response = requests.get(f"{BASE_URL}/invoices", params={'tenantId': tenant_id}, timeout=10)
        if response.status_code == 200:
            invoices = response.json()
            if any(inv['id'] == invoice['id'] for inv in invoices):
                results.add_pass(f"Invoicing ({niche})", f"Invoice found in GET /api/invoices")
            else:
                results.add_fail(f"Invoicing ({niche})", "Invoice not found in GET")
        
        return invoice
    
    except Exception as e:
        results.add_fail(f"Invoicing ({niche})", f"Exception: {str(e)}")
        return None

def test_payment_providers():
    """Test 12: GET /api/payments/providers - List payment providers"""
    print("\n--- Testing Payment Providers ---")
    
    try:
        response = requests.get(f"{BASE_URL}/payments/providers", timeout=10)
        
        if response.status_code != 200:
            results.add_fail("Payment Providers", f"Expected 200, got {response.status_code}")
            return
        
        data = response.json()
        
        if 'providers' not in data:
            results.add_fail("Payment Providers", "Missing 'providers' field")
            return
        
        providers = data['providers']
        stripe_provider = next((p for p in providers if p.get('id') == 'stripe'), None)
        
        if not stripe_provider:
            results.add_fail("Payment Providers", "Stripe provider not found")
            return
        
        if stripe_provider.get('configured') != False:
            results.add_fail("Payment Providers", f"Stripe should be configured=false, got {stripe_provider.get('configured')}")
            return
        
        results.add_pass("Payment Providers", "Stripe provider listed with configured=false")
    
    except Exception as e:
        results.add_fail("Payment Providers", f"Exception: {str(e)}")

def test_payment_checkout(invoice_id: str):
    """Test 13: POST /api/payments/checkout - Should fail with NO_STRIPE"""
    print("\n--- Testing Payment Checkout (Expected Failure) ---")
    
    try:
        payload = {'invoiceId': invoice_id}
        response = requests.post(f"{BASE_URL}/payments/checkout", json=payload, timeout=10)
        
        # This SHOULD return 400 with NO_STRIPE code
        if response.status_code != 400:
            results.add_fail("Payment Checkout", f"Expected 400, got {response.status_code}")
            return
        
        data = response.json()
        
        if data.get('code') != 'NO_STRIPE':
            results.add_fail("Payment Checkout", f"Expected code 'NO_STRIPE', got {data.get('code')}")
            return
        
        results.add_pass("Payment Checkout", "Correctly returned 400 with code 'NO_STRIPE' (expected behavior)")
    
    except Exception as e:
        results.add_fail("Payment Checkout", f"Exception: {str(e)}")

def main():
    print("="*80)
    print("PROFITPULSE BACKEND API TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    # Test 1: Demo seed
    tenant_map = test_demo_seed()
    if not tenant_map:
        print("\n❌ CRITICAL: Demo seed failed, cannot continue")
        results.summary()
        return
    
    # Test 2: Get tenants
    test_get_tenants()
    
    # Test 3-7: For each tenant, test accounts, transactions, dashboard, reports
    for niche, tenant_id in tenant_map.items():
        print(f"\n{'='*80}")
        print(f"TESTING TENANT: {niche.upper()} (ID: {tenant_id[:8]}...)")
        print(f"{'='*80}")
        
        test_accounts(tenant_id, niche)
        entries = test_transactions(tenant_id, niche)
        dashboard = test_dashboard(tenant_id, niche)
        test_reports(tenant_id, niche)
        test_reports_csv(tenant_id, niche)
    
    # Test 8: Double-entry validation with POST
    print(f"\n{'='*80}")
    print("TESTING DOUBLE-ENTRY VALIDATION")
    print(f"{'='*80}")
    
    # Test expense transaction
    ecommerce_id = tenant_map.get('ecommerce')
    if ecommerce_id:
        expense_entry = test_post_transaction(ecommerce_id, 'ecommerce', 'expense', 'Advertising & Ad Spend', 12345)
        
        # Test income transaction
        income_entry = test_post_transaction(ecommerce_id, 'ecommerce', 'income', 'Product Sales', 54321)
    
    # Test 9: Triage - status update
    print(f"\n{'='*80}")
    print("TESTING TRANSACTION TRIAGE")
    print(f"{'='*80}")
    
    if ecommerce_id and expense_entry:
        test_patch_status(expense_entry['id'], 'reconciled')
        
        # Verify status changed
        response = requests.get(f"{BASE_URL}/transactions", params={'tenantId': ecommerce_id}, timeout=10)
        if response.status_code == 200:
            entries = response.json()
            updated = next((e for e in entries if e['id'] == expense_entry['id']), None)
            if updated and updated.get('status') == 'reconciled':
                results.add_pass("Status Verification", "Status successfully changed to 'reconciled'")
            else:
                results.add_fail("Status Verification", f"Status not updated, got {updated.get('status') if updated else 'not found'}")
    
    # Test 10: Freelancer classify
    freelancer_id = tenant_map.get('freelancer')
    if freelancer_id:
        # Get dashboard to find unsorted feed
        dashboard = test_dashboard(freelancer_id, 'freelancer')
        if dashboard and 'niche' in dashboard:
            unsorted = dashboard['niche'].get('unsortedFeed', [])
            if unsorted:
                unsorted_id = unsorted[0]['id']
                test_patch_classify(unsorted_id, 'business')
                
                # Verify classification
                dashboard_after = test_dashboard(freelancer_id, 'freelancer')
                if dashboard_after:
                    unsorted_after = dashboard_after['niche'].get('unsortedFeed', [])
                    business_after = dashboard_after['niche'].get('businessExpenses', 0)
                    
                    if len(unsorted_after) < len(unsorted):
                        results.add_pass("Classify Verification", f"Item removed from unsortedFeed (was {len(unsorted)}, now {len(unsorted_after)})")
                    else:
                        results.add_fail("Classify Verification", "Item not removed from unsortedFeed")
                    
                    if business_after > 0:
                        results.add_pass("Classify Verification", f"businessExpenses increased to {business_after}")
            else:
                results.add_warning("Classify Test", "No unsorted transactions found for freelancer")
    
    # Test 11-13: Invoicing and payments
    print(f"\n{'='*80}")
    print("TESTING INVOICING & PAYMENTS")
    print(f"{'='*80}")
    
    test_payment_providers()
    
    if ecommerce_id:
        invoice = test_invoicing(ecommerce_id, 'ecommerce')
        if invoice:
            test_payment_checkout(invoice['id'])
    
    # Final summary
    results.summary()

if __name__ == "__main__":
    main()
