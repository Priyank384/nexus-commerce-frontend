import type { Metadata } from "next";
import Link from "next/link";
import {
  Article,
  Bullet,
  BulletList,
  Destinations,
  Fact,
  Note,
  Paragraph,
  Section,
} from "@/components/content/article";
import { getFacetSizes } from "@/lib/catalog/server";
import {
  FIT_TABLE,
  ONE_SIZE_LABEL,
  RETURN_WINDOW_DAYS,
  SIZE_LADDER,
} from "@/lib/content/policy";

export const metadata: Metadata = {
  title: "Size guide",
  description:
    "How Nexus Commerce sizes work, what S, M, L and XL mean across the catalogue, and how to choose one without a fitting room.",
};

/**
 * Two live facts and one honest boundary. The size list is read from the catalogue rather than
 * typed in, so the page cannot claim a size the store has stopped selling. The measurement table
 * is the grading blocks the product page's fit dialog already quotes — imported from the same
 * module, because two pages answering "what is a size M" differently is worse than no table. What
 * the page refuses to imply is that those are measurements of the garment in the photograph; the
 * catalogue stores a size as a label on a variant, and nothing more.
 *
 * Declared blocking because it does read: the size list comes from the live catalogue, so the
 * route cannot be prerendered at build time — the same reason the other data-backed pages set this.
 */
export const instant = false;

export default async function SizeGuidePage() {
  // A catalogue outage must not take an advice page down with it: the fallback is the ladder the
  // store actually sells, so the page degrades to slightly stale rather than to an error.
  const sold = await getFacetSizes().catch(() => []);
  const sizes = sold.length
    ? sold
    : ([...SIZE_LADDER, ONE_SIZE_LABEL] as string[]);
  const oneSizeOnly = sizes.length === 1 && sizes[0] === ONE_SIZE_LABEL;

  return (
    <Article
      eyebrow="Before you buy"
      title="Size guide"
      summary="A size on this site is a label the store can put on a parcel, not a measurement it can guarantee. Here is what each one means across the catalogue, how to choose between two, and what to do when you guessed wrong."
    >
      <Section id="sizes" title="The sizes we sell">
        <Paragraph>
          {oneSizeOnly
            ? "Everything in the catalogue right now is a single size."
            : `Most garments come in ${sizes
                .filter((size) => size !== ONE_SIZE_LABEL)
                .join(", ")}.`}{" "}
          Accessories and anything cut to fit one shape — a beanie, a scarf, a wrap — are sold as{" "}
          <span className="text-foreground">{ONE_SIZE_LABEL}</span>, which means there is no
          smaller version of it, not that it is missing from the page.
        </Paragraph>
        <ul className="flex flex-wrap gap-2" aria-label="Sizes available in the catalogue">
          {sizes.map((size) => (
            <li key={size}>
              <Link
                href={`/products?sizes=${encodeURIComponent(size.toLowerCase())}`}
                className="inline-flex min-w-11 items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {size}
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Each one opens the catalogue filtered to pieces that have that size in stock.
        </p>
      </Section>

      <Section id="blocks" title="What each size measures">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left label-caps text-muted-foreground">
              <th className="py-2 font-normal">Size</th>
              <th className="py-2 font-normal">Chest, flat</th>
              <th className="py-2 font-normal">Body length</th>
            </tr>
          </thead>
          <tbody>
            {FIT_TABLE.map((row) => (
              <tr key={row.size} className="border-b last:border-0">
                <td className="py-2 text-foreground">{row.size}</td>
                <td className="py-2 text-muted-foreground">{row.chest}</td>
                <td className="py-2 text-muted-foreground">{row.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Note>
          These are the measurements of the blocks our sizes are graded from — the same numbers the
          fit dialog on every product page quotes. They are not measurements of the garment in the
          photograph, because nothing in the catalogue records those: a piece is listed with a size
          label, a fabric and a colour, and the two are not the same number.
        </Note>
        <Paragraph>
          What that means in practice: use the table to read a chest measurement against your own,
          then let the fabric have the last word. The same size M cut from a heavyweight twill and
          from a fine jersey sit differently on the same body, and only the product page says which
          one you are looking at.
        </Paragraph>
      </Section>

      <Section id="limits" title="What this page cannot tell you">
        <Paragraph>
          There is no per-garment measurement here — no one piece laid on a table and measured at
          the hem, sleeve and shoulder. When two pieces in the same size fit differently, that is
          the gap, and the honest way to close it is the reviews on each product page — which only
          a shopper with a paid order can write — rather than a chart we could not back up. See{" "}
          <Link href="/products" className="underline">
            the catalogue
          </Link>
          .
        </Paragraph>
      </Section>

      <Section id="choose" title="How to choose a size without a fitting room">
        <BulletList>
          <Bullet>
            <strong>Start from a garment you already own</strong> that fits the way you want this
            one to. Hold it against the product photo rather than against your body: the piece on
            the model is described by its fabric and cut, and the same letter in a different cut is
            a different fit.
          </Bullet>
          <Bullet>
            <strong>Read the fabric.</strong> Linen and cotton twill have no stretch in them, so a
            snug size stays snug. A knit gives, and gives more after a few wears. If a piece is
            described as non-stretch and you are between sizes, take the larger one.
          </Bullet>
          <Bullet>
            <strong>Read the reviews.</strong> The store only accepts a review from an order that
            was actually paid for, so the people describing fit have worn the piece — a review that
            says “runs small” is worth more than any chart we could print.
          </Bullet>
          <Bullet>
            <strong>Check the care.</strong> Natural fibres relax in a hot wash. If the care notes
            say cold wash and line dry, the fit you see in month one is the fit you keep; if it does
            not, size with that in mind.
          </Bullet>
          <Bullet>
            <strong>Buy the two you are unsure between.</strong> An order is one parcel, and
            returning one of two pieces costs you nothing but the postage. That is cheaper than
            wearing the wrong size for a year.
          </Bullet>
        </BulletList>
      </Section>

      <Section id="measure" title="If you want to measure yourself">
        <Paragraph>
          There is nothing on our pages to measure yourself <em>against</em>, but the numbers are
          still the best way to talk to us when a size goes wrong — quote them and we can usually
          tell you which of our pieces would have fit.
        </Paragraph>
        <dl className="space-y-3">
          <Fact term="Chest">
            Around the fullest part, under the arms, with the tape level and you breathing normally.
            Not the widest part of your back — the middle of your ribs.
          </Fact>
          <Fact term="Waist">
            Where you would put a belt, not where your waistband sits if you wear trousers low.
          </Fact>
          <Fact term="Hips">
            The widest part of your seat, standing with your feet together.
          </Fact>
          <Fact term="Shoulder to hem">
            Down the front of your body from the bony point of your shoulder. This is the one that
            tells you whether a “regular length” garment is going to sit on your waist or below it.
          </Fact>
        </dl>
      </Section>

      <Section id="wrong" title="When the size is wrong">
        <Paragraph>
          It happens more often than any guide can prevent. You have{" "}
          <strong>{RETURN_WINDOW_DAYS} days</strong> from delivery to tell us, and the{" "}
          <Link href="/returns" className="underline">
            returns page
          </Link>{" "}
          covers how to exchange for the other size rather than refund and reorder. Keep the tags
          on until you have tried it on, and try it on over the clothes you would actually wear it
          with.
        </Paragraph>
      </Section>

      <Section id="also" title="Related pages">
        <Destinations
          links={[
            {
              href: "/products",
              label: "The catalogue",
              note: "Filter by size, colour and department.",
            },
            {
              href: "/returns",
              label: "Returns and refunds",
              note: "What to do when the size was the wrong guess.",
            },
            {
              href: "/shipping",
              label: "Shipping and delivery",
              note: "How long the right size takes to reach you.",
            },
            {
              href: "/contact",
              label: "Contact",
              note: "Ask us about a specific piece before you buy it.",
            },
          ]}
        />
      </Section>
    </Article>
  );
}
