import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Data deletion · Weekend Food Hub" };

// Linked from the Meta app settings as the "User data deletion" instructions URL.
export default function DataDeletionPage() {
  return (
    <LegalPage title="Delete your data" updated="October 27, 2026">
      <p>You can delete the information Weekend Food Hub keeps about you at any time.</p>
      <h2>If you logged in with Facebook</h2>
      <ul>
        <li>
          Go to <Link href="/account" className="underline">My account</Link>, scroll to <strong>Delete my account</strong>, type DELETE and confirm.
          This removes your login, profile details and saved addresses right away.
        </li>
        <li>
          You can also remove Weekend Food Hub from Facebook: <strong>Settings &amp; privacy → Settings → Apps and websites</strong>, then remove it.
        </li>
      </ul>
      <h2>If you ordered as a guest</h2>
      <p>Message the Weekend Food Hub Facebook Page with your order number (e.g. WEB-10001) and the mobile number you used. We&apos;ll delete your contact details within 7 days.</p>
      <h2>What we keep</h2>
      <p>Records of past orders (items, amounts and dates) are kept for our business and tax records.</p>
    </LegalPage>
  );
}
