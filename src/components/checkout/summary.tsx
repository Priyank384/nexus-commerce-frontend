import Image from "next/image";
import { formatPrice } from "@/lib/catalog/format";

export type SummaryLine = {
  key: string;
  name?: string;
  image?: string;
  variant?: string;
  quantity?: number;
  amount?: number;
};

export type AddressLike = {
  recipientName?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export function AddressSummary({ address }: { address: AddressLike | null | undefined }) {
  if (!address) return null;
  return (
    <address className="text-sm not-italic leading-6">
      <p>{address.recipientName}</p>
      <p className="text-muted-foreground">
        {[address.line1, address.line2].filter(Boolean).join(", ")}
      </p>
      <p className="text-muted-foreground">
        {[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}
      </p>
      <p className="text-muted-foreground">{address.country === "IN" ? "India" : address.country}</p>
      <p className="mt-1 text-muted-foreground">{address.phone}</p>
    </address>
  );
}

export function CheckoutSummary({ lines, total }: { lines: SummaryLine[]; total: number }) {
  return (
    <aside aria-labelledby="checkout-summary-heading" className="border p-6">
      <h2 id="checkout-summary-heading" className="label-caps text-muted-foreground">
        Order summary
      </h2>
      <ul className="mt-4 divide-y">
        {lines.map((line) => (
          <li key={line.key} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <div className="relative w-12 shrink-0">
              <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                {line.image ? (
                  <Image src={line.image} alt="" fill sizes="48px" className="object-cover" />
                ) : null}
              </div>
              <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-[10px] tabular-nums text-background">
                {line.quantity ?? 0}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{line.name}</p>
              {line.variant ? (
                <p className="label-caps mt-1 text-muted-foreground">{line.variant}</p>
              ) : null}
            </div>
            <p className="text-sm tabular-nums">{formatPrice(line.amount)}</p>
          </li>
        ))}
      </ul>
      <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums">{formatPrice(total)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Delivery</dt>
          <dd>Free</dd>
        </div>
        <div className="flex justify-between border-t pt-3 text-base">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatPrice(total)}</dd>
        </div>
      </dl>
      <p className="mt-1.5 text-xs text-muted-foreground">Prices include all taxes.</p>
    </aside>
  );
}
