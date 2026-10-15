import test from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase, insertOrder } from "./database.mjs";

test("migration idempotente bloqueia gravação pública e preserva snapshots históricos", async () => {
  const db = await createTestDatabase();
  try {
    for (const role of ["anon", "authenticated"]) {
      const result = await db.query(`select has_table_privilege($1, 'orders', 'INSERT') as allowed`, [role]);
      assert.equal(result.rows[0].allowed, false);
      await db.exec(`set role ${role}`);
      await assert.rejects(() => db.exec("insert into orders (items, subtotal, total) values ('[]', 1, 1)"));
      await db.exec("reset role");
    }
    const order = await insertOrder(db, { items: [{ unitPrice: 1299, quantity: 1, totalPrice: 1299 }],
      subtotal: 1299, total: 1299, whatsapp_payload: { messagePreview: "R$ 12,99" } });
    assert.equal(order.items[0].unitPrice, 1299);
    for (const sql of ["items = '[]'", "subtotal = 1499", "total = 1", "whatsapp_payload = '{}'" ]) {
      await assert.rejects(() => db.query(`update orders set ${sql} where id = $1`, [order.id]));
    }
    await db.query("update orders set status = 'Em preparo', delivery_fee = 500, total = subtotal + 500, print_status = 'printed' where id = $1", [order.id]);
    const saved = (await db.query("select * from orders where id = $1", [order.id])).rows[0];
    assert.equal(saved.total, 1799);
    assert.equal(saved.items[0].unitPrice, 1299);
    assert.equal(saved.print_status, "printed");
  } finally { await db.close(); }
});
