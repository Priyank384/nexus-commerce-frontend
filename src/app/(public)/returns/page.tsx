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
import { REFUND_WORKING_DAYS, RETURN_WINDOW_DAYS } from "@/lib/content/policy";

export const metadata: Metadata = {
  title: "Returns and refunds",
  description: `How to send a Nexus Commerce garment back within ${RETURN_WINDOW_DAYS} days, what we refund and how long the money takes to return.`,
};

/**
 * Written against what the store can actually do. There is no returns endpoint, no `RETURNED`
 * order status and no refund call on the payment gateway — a paid order cannot even be cancelled
 * through the API without a refund first — so this page does not offer a button that would fail.
 * Every path it describes ends with a person reading an email, which is true today.
 */
export default function ReturnsPage() {
  return (
    <Article
      eyebrow="After you order"
      title="Returns and refunds"
      summary="A garment that does not work is a garment you should not have to keep. Here is the window, the condition we need it back in, and the one thing to know up front: returns here are handled by a person, not by a button."
    >
      <Section id="window" title="The window">
        <Paragraph>
          You have <strong>{RETURN_WINDOW_DAYS} days</strong> from the day your order is delivered
          to tell us you want to send something back. That is the whole rule; everything below is
          how we make it work.
        </Paragraph>
        <BulletList>
          <Bullet>
            Unworn and unwashed, with the tags still on. A piece that has been through a cycle will
            not go back on the shelf.
          </Bullet>
          <Bullet>
            The whole line, not part of one. A size and colour is one stock item to us, so a
            two-piece order comes back as one parcel.
          </Bullet>
          <Bullet>
            Anything the parcel got wrong — damaged in transit, the wrong size, a colour that
            looked different on screen — tell us inside the same window and we cover the return.
          </Bullet>
        </BulletList>
      </Section>

      <Section id="how" title="How to start one">
        <Paragraph>
          Write to us with your order number. It is on your confirmation email and on{" "}
          <Link href="/orders" className="underline">
            your orders page
          </Link>
          , and it is the only thing that lets us find which pieces you mean. Say what is wrong and
          whether you want your money back or a different size, and we will reply with where to
          send it.
        </Paragraph>
        <Note>
          <strong>There is no “return this order” button, on purpose.</strong> The store’s system
          can mark an order cancelled while it is still unpaid, and it can move a parcel from
          shipped to delivered, but nothing in it accepts a returned garment or issues a refund.
          Rather than show you a control that would fail, we ask you to write — and a human
          handles it.
        </Note>
      </Section>

      <Section id="money" title="What comes back to you">
        <dl className="space-y-3">
          <Fact term="The garment">
            The full amount you paid for it, taken from the price written on your order the day you
            bought it. A later sale does not reduce what we owe you, and a price rise does not
            increase what you paid.
          </Fact>
          <Fact term="Delivery">
            Nothing to refund, because there is nothing to refund — we do not charge for shipping,
            so your order total was always the price of the clothes.
          </Fact>
          <Fact term="Return postage">
            On us when the parcel was wrong — damaged, mis-picked, or a colour that did not match
            the page. When the garment is fine and it simply did not suit you, you cover the
            journey back; say so in your email and we will tell you the cheapest way to do it from
            your pincode.
          </Fact>
        </dl>
      </Section>

      <Section id="timing" title="When the money moves">
        <Paragraph>
          Refunds go back to the card, UPI id or wallet you paid with. We never ask for bank
          details by email and we will not send money to a different account than the one that
          paid us — that is a fraud pattern, not a convenience.
        </Paragraph>
        <BulletList>
          <Bullet>
            Once your parcel reaches us we check it and raise the refund the same working day.
          </Bullet>
          <Bullet>
            The payment gateway then takes {REFUND_WORKING_DAYS.min}–
            {REFUND_WORKING_DAYS.max} working days to put it back. That part is not ours to speed
            up; if it has been longer, write to us and we will chase it with the gateway on your
            behalf.
          </Bullet>
          <Bullet>
            An exchange is usually faster than a refund. If you tell us which size you want, we
            hold it and send it when your return arrives, so you are not waiting on a bank to buy
            it again.
          </Bullet>
        </BulletList>
      </Section>

      <Section id="cancelling" title="Changing your mind before it ships">
        <Paragraph>
          Until an order is marked shipped there is nothing to send back, so a cancellation is the
          easy case — write to us with the order number and we stop it. If it has been paid for,
          the money comes back the same way as any refund. If the parcel has already left, this
          page is the one to follow instead.
        </Paragraph>
      </Section>

      <Section id="exceptions" title="When we say no">
        <Paragraph>
          Rarely, and only when the piece cannot be sold again: it came back worn, washed, damaged
          by you rather than in transit, or after the window. We would rather tell you the rule than
          discover the exception in an argument, so if a return is refused we say why, and the
          garment goes back to you at our cost.
        </Paragraph>
      </Section>

      <Section id="also" title="Related pages">
        <Destinations
          links={[
            {
              href: "/shipping",
              label: "Shipping and delivery",
              note: "What it costs, where it goes and how long the parcel takes.",
            },
            {
              href: "/size-guide",
              label: "Size guide",
              note: "How to pick the size before it becomes a return.",
            },
            {
              href: "/contact",
              label: "Contact",
              note: "Where to write, and what you can do without us.",
            },
            {
              href: "/orders",
              label: "Your orders",
              note: "The order number, the status and what you paid.",
            },
          ]}
        />
      </Section>
    </Article>
  );
}
