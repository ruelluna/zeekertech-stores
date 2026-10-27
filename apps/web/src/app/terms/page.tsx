import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms · Weekend Food Hub" };

// Starting draft of the ordering terms; review before launch.
export default function TermsPage() {
  return (
    <LegalPage title="Ordering terms" updated="October 27, 2026">
      <h2>Orders and payment</h2>
      <ul>
        <li>Orders are paid by GCash. We start cooking only after we confirm your payment.</li>
        <li>
          Dishes marked “subject to availability” and market-price items (like paluto) are confirmed by us first. You pay only after we confirm
          availability and the final price, and you can cancel if something changed.
        </li>
        <li>Please pay the exact amount shown and send the GCash reference number on your order page.</li>
      </ul>
      <h2>Pickup and delivery</h2>
      <ul>
        <li>Delivery is available within mainland Daanbantayan only. We can&apos;t deliver to Malapascua or Carnaza.</li>
        <li>The delivery fee is based on distance from our kitchen in Tapilon and is shown before you order. In rare cases we may adjust it and will tell you first.</li>
        <li>Our ordering hours are shown on the menu. The last pickup and delivery time is closing time.</li>
      </ul>
      <h2>Cancellations and refunds</h2>
      <ul>
        <li>You can cancel online until you send your payment.</li>
        <li>After payment, message our Facebook Page. If we can&apos;t fulfill a paid order, we refund the full amount by GCash.</li>
      </ul>
      <h2>Discounts</h2>
      <p>The welcome discount is for one first order per customer. We may remove a discount that was used more than once before confirming your payment.</p>
    </LegalPage>
  );
}
