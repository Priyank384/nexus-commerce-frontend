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
import { SUPPORT_RESPONSE_WORKING_HOURS, supportEmail } from "@/lib/content/policy";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "How to reach Nexus Commerce about an order, a return or a garment, and what you can settle yourself without waiting for us.",
};

/**
 * There is no contact form, because there is nowhere for one to send: the API has no inquiries
 * endpoint, and a form that quietly drops a message is worse on a trust page than an honest
 * address. So the page publishes the one configured destination — and, if the operator has not
 * set NEXT_PUBLIC_SUPPORT_EMAIL, says so instead of inventing an inbox a shopper writes to twice.
 */
export default function ContactPage() {
  const email = supportEmail();

  return (
    <Article
      eyebrow="Talk to us"
      title="Contact"
      summary="Most order questions have an answer that does not involve waiting for a person. Start with the list below; if none of them is your question, here is how to reach us and what to write so we can answer in one reply."
    >
      <Section id="self" title="You probably do not need us for this">
        <BulletList>
          <Bullet>
            <Link href="/orders" className="underline">
              Where is my order?
            </Link>{" "}
            The status, the address it went to and what you paid are all on that page — including
            for an order you placed before you had an account, once you have claimed it.
          </Bullet>
          <Bullet>
            <Link href="/orders/claim" className="underline">
              I bought as a guest and cannot find the order.
            </Link>{" "}
            The link in your confirmation email moves it onto your account. Nothing is lost if you
            never signed in at checkout.
          </Bullet>
          <Bullet>
            <Link href="/forgot-password" className="underline">
              I cannot sign in.
            </Link>{" "}
            The reset link arrives by email within a minute and works once. We do not reset
            passwords over a message, and nobody who asks you to send one is us.
          </Bullet>
          <Bullet>
            <Link href="/account" className="underline">
              My address or phone changed.
            </Link>{" "}
            Edit it yourself. An order already placed keeps the address it was sent with, which is
            what you want — a change on your account should not silently rewrite a parcel in
            transit.
          </Bullet>
          <Bullet>
            <Link href="/size-guide" className="underline">
              Which size?
            </Link>{" "}
            The guide is written against what the catalogue actually knows, rather than a chart it
            cannot back up.
          </Bullet>
        </BulletList>
      </Section>

      <Section id="email" title="Writing to us">
        {email ? (
          <>
            <Paragraph>
              One address, and it is a person reading it:{" "}
              <a
                href={`mailto:${encodeURIComponent(email)}?subject=Nexus%20Commerce%20order%20 enquiry`}
                className="font-medium text-foreground underline underline-offset-4 break-all"
              >
                {email}
              </a>
              . We aim to reply within {SUPPORT_RESPONSE_WORKING_HOURS} working hours — sooner on a
              parcel that has gone to the wrong city.
            </Paragraph>
            <p className="text-xs text-muted-foreground">
              Use the subject line your confirmation email came with if you have it. It is the
              fastest way for a message to find the order behind it.
            </p>
          </>
        ) : (
          <Note>
            This store has no published support address yet — the deployment has not set one, and we
            will not print an address nobody reads. Everything in the list above works today, and an
            account can be created at{" "}
            <Link href="/register" className="underline">
              /register
            </Link>{" "}
            so future orders stay findable without email.
          </Note>
        )}
      </Section>

      <Section id="detail" title="What to put in the message">
        <dl className="space-y-3">
          <Fact term="Your order number">
            The fastest thing you can include. Without it we are searching by an email address, and
            a guest order may exist under a spelling you have since corrected.
          </Fact>
          <Fact term="What you expected">
            “The blue one, size medium” tells us more than “wrong item”. A photo of what arrived is
            better still, and if the parcel was crushed in transit keep it — the courier needs the
            packaging as much as you need a refund.
          </Fact>
          <Fact term="What you want">
            Say which of these would settle it: a refund, the other size, or a replacement sent
            now. We can do all three, and guessing which you prefer wastes a reply.
          </Fact>
        </dl>
      </Section>

      <Section id="never" title="What we will never ask you for">
        <BulletList>
          <Bullet>
            Your password, or the reset link from an email. A real request for either is us being
            impersonated — reply nothing and tell us.
          </Bullet>
          <Bullet>
            Card numbers or an OTP. Payment happens in the checkout, once, through the gateway — we
            hold none of it, so nobody here can “take your details over the phone”.
          </Bullet>
          <Bullet>
            A fee to release your own refund. Money you are owed does not require money you pay.
          </Bullet>
        </BulletList>
      </Section>

      <Section id="also" title="Related pages">
        <Destinations
          links={[
            {
              href: "/returns",
              label: "Returns and refunds",
              note: "The window, the condition and how long the money takes.",
            },
            {
              href: "/shipping",
              label: "Shipping and delivery",
              note: "Dispatch times, coverage and what each status means.",
            },
            {
              href: "/orders",
              label: "Your orders",
              note: "Status, address and totals without asking anyone.",
            },
            {
              href: "/products",
              label: "The catalogue",
              note: "Fabric, care and fit notes on every piece.",
            },
          ]}
        />
      </Section>
    </Article>
  );
}
