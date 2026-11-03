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
import {
  DELIVERY_ESTIMATE_WORKING_DAYS,
  DISPATCH_WITHIN_WORKING_DAYS,
} from "@/lib/content/policy";

export const metadata: Metadata = {
  title: "Shipping and delivery",
  description:
    "What Nexus Commerce charges for delivery, where it ships, how long a parcel takes and what each order status means.",
};

/**
 * The numbers here are ours to promise; the behaviour is not. Dispatch and delivery windows are
 * operational commitments, so they live in the policy file with the returns window. What the
 * order can actually be — pending, shipped, delivered, cancelled — is set by the fulfilment team
 * and enforced by the API, and there is no courier tracking number stored anywhere, so this page
 * describes the status it can show rather than a live trace it cannot.
 */
export default function ShippingPage() {
  return (
    <Article
      eyebrow="After you order"
      title="Shipping and delivery"
      summary="Nothing is added to your total for delivery. Here is what that buys, where the parcel can go, and what each status on your order page actually means."
    >
      <Section id="cost" title="What it costs">
        <Paragraph>
          <strong>Free, and not as a promotion.</strong> The total you approve at checkout is the
          price of the garments — no delivery fee, no handling charge, no small-order surcharge.
          We would rather raise a price than dress it up as a shipping cost you only notice at the
          last step.
        </Paragraph>
        <Note>
          This is what the store does today, not what it plans to do: the order total is the sum of
          the line items and there is no shipping charge in the checkout at all. If that ever
          changes, this page changes on the same day the checkout does.
        </Note>
      </Section>

      <Section id="where" title="Where we ship">
        <Paragraph>
          Within India. Every address we accept is checked the same way: a recipient name, a phone
          number the courier can actually call, a building and a street, a city, a state and a
          postcode. There is no pincode serviceability list to fail you on before you pay — if the
          form accepts your address, we can send to it.
        </Paragraph>
        <BulletList>
          <Bullet>
            Overseas delivery is not what this store is set up for. The checkout will take a
            two-letter country code without arguing, but nothing outside India has ever left from
            here — so if that is where the parcel needs to go, write to us before you pay and we
            will tell you honestly whether we can.
          </Bullet>
          <Bullet>
            One address per order. A parcel can only go to one place, so split a gift across two
            orders if it needs to arrive separately.
          </Bullet>
          <Bullet>
            You can save addresses to your account and pick one at checkout instead of typing it
            again; the order keeps the copy it was placed with, so an edit later never rewrites
            what a courier was given.
          </Bullet>
        </BulletList>
      </Section>

      <Section id="when" title="When it leaves and when it lands">
        <dl className="space-y-3">
          <Fact term="Dispatch">
            Within {DISPATCH_WITHIN_WORKING_DAYS} working days of a completed payment. A Friday
            evening order is usually packed the following Monday; a festival week or a heavy
            catalogue launch is the exception we will tell you about rather than let you discover.
          </Fact>
          <Fact term="Delivery">
            {DELIVERY_ESTIMATE_WORKING_DAYS.min}–
            {DELIVERY_ESTIMATE_WORKING_DAYS.max} working days after dispatch anywhere in the
            country. Metros sit at the short end; the far north, the north-east and island
            territories sit at the long end, because that is where the courier network thins out.
          </Fact>
          <Fact term="Working days">
            Sundays and public holidays are not counted, in either direction, and no delivery
            promise is a same-day one.
          </Fact>
        </dl>
      </Section>

      <Section id="statuses" title="What each status means">
        <p className="text-muted-foreground">
          These are the four states your order can hold, on the{" "}
          <Link href="/orders" className="underline">
            orders page
          </Link>{" "}
          and in your confirmation email. They move forward only.
        </p>
        <dl className="space-y-3">
          <Fact term="Pending">
            Paid, packed or being packed. Nothing is wrong; the parcel simply has not left yet.
          </Fact>
          <Fact term="Shipped">
            It has physically gone. Our fulfilment team sets this by hand when the courier collects,
            so it can lag the truck by a few hours — if it still says pending two working days
            after you paid, that is worth a message to us.
          </Fact>
          <Fact term="Delivered">
            Signed for. The order closes at this point and becomes a record rather than something
            that can still be edited, so tell us about anything wrong with the parcel while you are
            still inside the returns window.
          </Fact>
          <Fact term="Cancelled">
            Stopped before it left, and the pieces it held went straight back on the shelf for
            someone else to buy.
          </Fact>
        </dl>
      </Section>

      <Section id="tracking" title="Tracking a parcel">
        <Paragraph>
          The store shows the status, not a live map. We do not hold a tracking number against your
          order yet, which means the honest answer to “where is it” is a person looking it up with
          your order number — write to us and we will do that the same working day.
        </Paragraph>
        <BulletList>
          <Bullet>
            The phone number on the address is the one the delivery rider calls. Put a number that
            reaches you, not a landline nobody answers at 3pm.
          </Bullet>
          <Bullet>
            If a rider could not find you, the parcel is normally re-attempted once. Tell us quickly
            and we will chase it rather than let it sit at the local depot until it is sent back.
          </Bullet>
          <Bullet>
            A parcel returned to us because nobody met the delivery is not a lost order. It comes
            back, we refund you for it once we have it, and you can place it again with a better
            address.
          </Bullet>
        </BulletList>
      </Section>

      <Section id="packaging" title="What arrives">
        <Paragraph>
          Each piece in its own sleeve with the tags attached, the invoice in the parcel rather than
          only in your email, and no price sticker on the outside. Gifts are not wrapped — say so
          before it dispatches and we will do what we can, but it is a person reading your note
          rather than a checkout option.
        </Paragraph>
      </Section>

      <Section id="also" title="Related pages">
        <Destinations
          links={[
            {
              href: "/returns",
              label: "Returns and refunds",
              note: "What to do if the parcel arrives wrong or does not suit.",
            },
            {
              href: "/size-guide",
              label: "Size guide",
              note: "Pick the size once, before anything has to travel back.",
            },
            {
              href: "/contact",
              label: "Contact",
              note: "Where to write when the status has not moved.",
            },
            {
              href: "/orders/claim",
              label: "Claim a guest order",
              note: "Move an order you bought without an account into your history.",
            },
          ]}
        />
      </Section>
    </Article>
  );
}
