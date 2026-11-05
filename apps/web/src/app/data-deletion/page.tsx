import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Delete your data" };

// Linked from the Meta app settings as the "User data deletion" instructions URL. Keep this address.
export default function DataDeletionPage({ searchParams }: PageProps<"/data-deletion">) {
  return (
    <LegalPage title="Delete your data" updated="November 6, 2026" searchParams={searchParams}>
      <p>You can delete the information a store on this website keeps about you at any time.</p>
      <h2>If you logged in with Facebook</h2>
      <ul>
        <li>
          Open the store&apos;s <strong>My orders</strong> page, scroll to <strong>Delete my account</strong>, type DELETE and confirm. This removes your
          login, profile details and saved addresses for that store right away. Accounts are separate for each store, so repeat this for each
          store you ordered from.
        </li>
        <li>
          You can also remove this website&apos;s access from Facebook: <strong>Settings &amp; privacy → Settings → Apps and websites</strong>, then
          remove it.
        </li>
      </ul>
      <h2>If you ordered as a guest</h2>
      <p>
        Contact the store you ordered from with your order number (e.g. WEB-10001) and the mobile number you used. Your contact details will be
        deleted within 7 days.
      </p>
      <h2>What&apos;s kept</h2>
      <p>Records of past orders (items, amounts and dates) are kept for the store&apos;s business and tax records.</p>
    </LegalPage>
  );
}
