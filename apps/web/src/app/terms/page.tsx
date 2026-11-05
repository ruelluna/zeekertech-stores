import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Ordering terms" };

// Starting draft of the ordering terms for every store on the site; review before marketing to more stores.
export default function TermsPage({ searchParams }: PageProps<"/terms">) {
  return (
    <LegalPage title="Ordering terms" updated="November 6, 2026" searchParams={searchParams}>
      <p>
        This website is run by Zeeker Tech for independent local stores. When you order, you buy from the store whose menu you ordered from. That
        store prepares your order, confirms your payment and handles refunds.
      </p>
      <h2>Orders and payment</h2>
      <ul>
        <li>Orders are paid to the store by GCash. The store starts preparing your order only after it confirms your payment.</li>
        <li>
          Items marked “subject to availability” and market-price items are confirmed by the store first. You pay only after it confirms
          availability and the final price, and you can cancel if something changed.
        </li>
        <li>Please pay the exact amount shown and send the GCash reference number on your order page.</li>
      </ul>
      <h2>Pickup, delivery and advance orders</h2>
      <ul>
        <li>Each store sets its own ordering hours, pickup and delivery times, and delivery area. They&apos;re shown on its menu and at checkout.</li>
        <li>
          Made-to-order items need the advance notice shown on the item. If your order has one, the whole order is ready on the date you choose
          at checkout.
        </li>
        <li>
          The delivery fee is based on distance from the store and is shown before you order. In rare cases the store may adjust it and will
          tell you first.
        </li>
      </ul>
      <h2>Cancellations and refunds</h2>
      <ul>
        <li>You can cancel online until you send your payment.</li>
        <li>After payment, contact the store. If a store can&apos;t fulfill a paid order, it refunds the full amount by GCash.</li>
      </ul>
      <h2>Discounts</h2>
      <p>
        A welcome discount is for one first order per customer at that store. A store may remove a discount that was used more than once before
        confirming your payment.
      </p>
    </LegalPage>
  );
}
