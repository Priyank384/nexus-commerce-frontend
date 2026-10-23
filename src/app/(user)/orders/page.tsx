import { OrdersView } from "@/components/orders/orders-view";

export const metadata = { title: "Orders" };
export const instant = false;

export default function OrdersPage() {
  return <OrdersView />;
}
