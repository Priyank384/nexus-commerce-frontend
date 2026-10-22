export default function OrdersPlaceholder() {
  return (
    <section>
      <h1 className="text-2xl font-semibold mb-2">My orders</h1>
      <p className="text-muted-foreground">
        Order list ships in Phase 4. Backend: <code>GET /api/v1/orders/me</code>.
      </p>
    </section>
  );
}
