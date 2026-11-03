import { CheckoutView } from "@/components/checkout/checkout-view";

export const metadata = { title: "Checkout" };
export const instant = false;

export default function CheckoutPage() {
  return <CheckoutView />;
}
