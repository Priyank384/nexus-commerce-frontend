export default function LoginPage() {
  return (
    <section className="max-w-sm mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Log in</h1>
      <p className="text-muted-foreground text-sm">
        Auth form ships in Phase 1. BFF endpoint: <code>POST /api/auth/login</code>.
      </p>
    </section>
  );
}
