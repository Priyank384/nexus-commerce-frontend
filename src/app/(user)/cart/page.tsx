export default function CartPlaceholder() {
  return (
    <section>
      <h1 className="text-2xl font-semibold mb-2">Your bag</h1>
      <p className="text-muted-foreground">
        Adding to a bag works from any product page; the full cart with quantity controls ships
        in Phase 4. Backend: <code>/api/v1/cart/**</code>.
      </p>
    </section>
  );
}
