import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy notice" };

// Plain-language notice for the Data Privacy Act of 2012 (RA 10173) and Meta's Facebook Login rules, for every
// store on the site: each store is responsible for its customers' information, and Zeeker Tech runs the website
// for them. Have it reviewed before marketing to more stores; this is a starting draft, not legal advice.
export default function PrivacyPage({ searchParams }: PageProps<"/privacy">) {
  return (
    <LegalPage title="Privacy notice" updated="November 6, 2026" searchParams={searchParams}>
      <p>
        This ordering website is run by Zeeker Tech for independent local stores. Each store sells its own products and is responsible for its
        orders and for the personal information you give it when you order. Zeeker Tech runs the website and keeps that information on the
        store&apos;s behalf. This notice explains what is collected, why, and your rights under the Data Privacy Act of 2012.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Your name and mobile number, so the store can prepare your order and contact you about it.</li>
        <li>Your delivery address and map pin, for delivery orders.</li>
        <li>GCash payment details you send (reference number, sender name and an optional screenshot), to confirm your payment.</li>
        <li>If you log in with Facebook: your name, email address (if your account has one) and profile photo. We don&apos;t see your password or post anything.</li>
        <li>Browser notification settings, if you turn on order notifications.</li>
      </ul>
      <h2>How it&apos;s used</h2>
      <ul>
        <li>To prepare, deliver and confirm payment for your orders, and to contact you about them.</li>
        <li>To save your details and addresses for next time, if you log in.</li>
        <li>To apply discounts and prevent the same discount from being used more than once.</li>
      </ul>
      <p>Your information isn&apos;t sold or used for advertising.</p>
      <h2>Who sees it</h2>
      <p>
        Only the staff of the store you ordered from who handle your order, and its delivery riders (name, number and address only). Each store
        sees only its own customers and orders. Customer accounts are separate for each store. Zeeker Tech can access the data only to run and
        support the website. The website runs on servers Zeeker Tech manages. OpenStreetMap-based maps and a routing service calculate delivery
        distance, and OpenStreetMap fills in your address when you tap “Use my location” (only the map pin is sent).
      </p>
      <h2>How long it&apos;s kept</h2>
      <p>
        Order records are kept for the store&apos;s business and tax records. Saved addresses and your login stay until you delete them or your
        account. GCash screenshots are kept only as long as needed to resolve payment questions.
      </p>
      <h2>Your rights</h2>
      <p>
        You can ask to see, correct or delete your personal information, or object to how it&apos;s used. You can update your details and delete
        your account yourself on the store&apos;s My orders page. See <Link href="/data-deletion" className="underline">data deletion</Link> for other
        options. You may also file a complaint with the National Privacy Commission.
      </p>
      <h2>Contact</h2>
      <p>
        Contact the store you ordered from for any privacy question or request. Its contact details are at the bottom of its menu page and at
        the top of this page when you open it from the store.
      </p>
    </LegalPage>
  );
}
