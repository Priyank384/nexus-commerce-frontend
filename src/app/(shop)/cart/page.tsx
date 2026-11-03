import { CartView } from "@/components/cart/cart-view";

export const metadata = { title: "Your bag" };
export const instant = false;

export default function CartPage() {
  return <CartView />;
}
