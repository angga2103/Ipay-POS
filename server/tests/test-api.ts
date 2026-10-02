import app from '../index';
import db from '../db/database';

async function testFullHybridCheckoutFlow() {
  console.log('\n======================================================');
  console.log('🛒 TESTING END-TO-END HYBRID CHECKOUT API FLOW');
  console.log('======================================================\n');

  const server = app.listen(3002);

  try {
    // 1. Verify Active Shift
    const shiftRes = await fetch('http://localhost:3002/api/shifts/active');
    const shift = await shiftRes.json();
    console.log('Active Shift:', shift.shift_number);

    // 2. Barcode Scanner lookup for physical product: Beras Ramos 5kg
    const scanBeras = await fetch('http://localhost:3002/api/products/lookup?q=8991234560010');
    const beras = await scanBeras.json();
    console.log('Scanned Retail Item:', beras.name, `Rp ${beras.selling_price}`);

    // 3. Scan Indomie Dus (Multi-UOM barcode test)
    const scanIndomieDus = await fetch('http://localhost:3002/api/products/lookup?q=8998866200226');
    const indomieDus = await scanIndomieDus.json();
    console.log('Scanned Multi-UOM Item:', indomieDus.name, `(Conversion: ${indomieDus.conversion_factor} Pcs)`, `Rp ${indomieDus.selling_price}`);

    // 4. Test PPOB Inquiry for Token PLN
    const inqRes = await fetch('http://localhost:3002/api/ppob/inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: 'PLN50', customer_no: '14234567890' }),
    });
    const inqData = await inqRes.json();
    console.log('PPOB Inquiry Result:', inqData.customer_name, `(Meter: ${inqData.meter_no})`);

    // 5. Execute Hybrid Checkout:
    // 1x Beras 5kg (Rp 70.000) + 1x Token PLN 50k (Rp 52.500)
    console.log('\nSubmitting Hybrid Checkout Order...');
    const checkoutRes = await fetch('http://localhost:3002/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shift_id: shift.id,
        cashier_id: shift.cashier_id,
        items: [
          {
            item_type: 'RETAIL',
            product_id: beras.id,
            item_name: beras.name,
            quantity: 1,
            unit_price: beras.selling_price,
            conversion_factor: 1,
          },
          {
            item_type: 'PPOB',
            ppob_sku: 'PLN50',
            ppob_target_no: '14234567890',
            ppob_customer_name: inqData.customer_name,
            unit_price: 52500,
          },
        ],
        payment_method: 'CASH',
        cash_tendered: 150000,
      }),
    });

    const checkoutData = await checkoutRes.json();
    console.log('\nCheckout Result: Invoice No:', checkoutData.order.invoice_no);
    console.log('Grand Total:', `Rp ${checkoutData.order.grand_total.toLocaleString('id-ID')}`);
    console.log('Kembalian (Change):', `Rp ${checkoutData.order.change_amount.toLocaleString('id-ID')}`);

    // 6. Print Thermal Receipt
    console.log('\n--- PRINTED THERMAL RECEIPT PREVIEW ---');
    console.log(checkoutData.receiptText);
    console.log('---------------------------------------\n');

    // 7. Verify Auto-Journaling in DB
    const lastJournal = db.prepare('SELECT * FROM journal_entries ORDER BY id DESC LIMIT 1').get() as any;
    console.log('Last Generated Auto-Journal:', lastJournal.entry_no, lastJournal.description);
    const lines = db.prepare('SELECT * FROM journal_lines WHERE journal_id = ?').all(lastJournal.id) as any[];
    console.table(lines.map(l => ({ Akun: l.account_code, Debit: l.debit, Kredit: l.credit, Memo: l.memo })));

    console.log('🎉 HYBRID CHECKOUT API & THERMAL RECEIPT SUCCESSFUL!\n');
  } finally {
    server.close();
  }
}

testFullHybridCheckoutFlow().catch(console.error);
