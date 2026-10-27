import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy notice · Weekend Food Hub" };

// Plain-language notice for the Data Privacy Act of 2012 (RA 10173) and Meta's Facebook Login rules.
// Have it reviewed before launch; this is a starting draft, not legal advice.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice" updated="October 27, 2026">
      <p>
        Weekend Food Hub (Purok Molmol, Tapilon, Daanbantayan, Cebu) takes food orders online for pickup and delivery. This notice explains what
        personal information we collect, why, and your rights under the Data Privacy Act of 2012.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Your name and mobile number, so we can prepare your order and contact you about it.</li>
        <li>Your delivery address and map pin, for delivery orders.</li>
        <li>GCash payment details you send us (reference number, sender name and an optional screenshot), to confirm your payment.</li>
        <li>If you log in with Facebook: your name, email address (if your account has one) and profile photo. We don&apos;t see your password or post anything.</li>
        <li>Browser notification settings, if you turn on order notifications.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To prepare, deliver and confirm payment for your orders, and to contact you about them.</li>
        <li>To save your details and addresses for next time, if you log in.</li>
        <li>To apply discounts and prevent the same discount from being used more than once.</li>
      </ul>
      <p>We don&apos;t sell your information or use it for advertising.</p>
      <h2>Who sees it</h2>
      <p>
        Only Weekend Food Hub staff who handle your order, and our delivery riders (name, number and address only). Our website runs on servers we
        manage. We use OpenStreetMap-based maps and a routing service to calculate delivery distance (only the map pin is sent).
      </p>
      <h2>How long we keep it</h2>
      <p>
        Order records are kept for our business and tax records. Saved addresses and your login stay until you delete them or your account. GCash
        screenshots are kept only as long as needed to resolve payment questions.
      </p>
      <h2>Your rights</h2>
      <p>
        You can ask to see, correct or delete your personal information, or object to how we use it. You can update your details and delete your
        account yourself on the <Link href="/account" className="underline">My account</Link> page. See{" "}
        <Link href="/data-deletion" className="underline">data deletion</Link> for other options. You may also file a complaint with the National
        Privacy Commission.
      </p>
      <h2>Contact</h2>
      <p>Message the Weekend Food Hub Facebook Page for any privacy question or request.</p>
    </LegalPage>
  );
}
