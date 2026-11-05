import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { brand } from "@/content/site";

export const metadata: Metadata = {
  title: `Privacy Policy — ${brand.name}`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  const mail = <a href={`mailto:${brand.email}`}>{brand.email}</a>;
  return (
    <LegalPage title="Privacy Policy" updated="November 5, 2026">
      <p>
        {brand.name} is the animation studio of IP Ventures, based in Miami, Florida (&ldquo;we&rdquo;, &ldquo;us&rdquo;).
        This policy explains what we collect when you visit {brand.domain} or get in touch with us, what we do with it, and
        the choices you have. Questions go to {mail}.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>What you tell us.</strong> When you fill in our form: your name, email, phone number, budget range, what
          the project is for, and anything you write in the notes. If we talk on a call, by email or by text, we keep notes
          of what we discussed.
        </li>
        <li>
          <strong>How you found us.</strong> If you arrive from one of our ads, the link carries the campaign, ad set, ad and
          placement it came from. We keep that for your visit and attach it to your enquiry.
        </li>
        <li>
          <strong>Basic technical data.</strong> Like every website, ours receives your IP address, browser and device type
          and the pages you load. Our host keeps standard server logs.
        </li>
      </ul>

      <h2>Cookies and the Meta Pixel</h2>
      <p>
        We use the Meta Pixel and Meta&rsquo;s Conversions API to measure how our ads perform. They record events such as a
        page view, starting the form and sending it, and may set Meta cookies (such as <code>_fbp</code> and{" "}
        <code>_fbc</code>) in your browser. When you send the form, we share your email, phone number and name with Meta in
        hashed (scrambled) form, together with your IP address and browser, so Meta can match the enquiry to an ad click.
        Meta processes this under its own{" "}
        <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">
          privacy policy
        </a>
        . You can control ad personalisation in your{" "}
        <a href="https://www.facebook.com/adpreferences/" target="_blank" rel="noopener noreferrer">
          Meta ad preferences
        </a>{" "}
        and block or clear cookies in your browser. We don&rsquo;t use any other advertising or analytics cookies.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To reply to your enquiry, set up a call and quote for your project.</li>
        <li>To make and deliver the work if you hire us, and to send invoices.</li>
        <li>To follow up by email, phone or text about your enquiry.</li>
        <li>
          If your budget is below the size of project we take on, to add you to our newsletter instead. Every newsletter has
          an unsubscribe link.
        </li>
        <li>To measure and improve our ads and our website.</li>
      </ul>
      <p>We don&rsquo;t sell your personal information, and we don&rsquo;t use it for anything unrelated to the above.</p>

      <h2>Text messages</h2>
      <p>
        If you give us your phone number, we may call or text you about your enquiry. How often varies with the
        conversation. Message and data rates may apply. Reply STOP to stop texts at any time, or HELP for help. We do not
        share your phone number or text-messaging consent with third parties for their own marketing.
      </p>

      <h2>Who we share it with</h2>
      <p>Only the services we use to run the studio, and only what they need:</p>
      <ul>
        <li>Vercel, which hosts this website.</li>
        <li>Zapier and Notion, where enquiries are logged and tracked.</li>
        <li>Our email, phone and messaging providers, to talk to you.</li>
        <li>Meta, for ad measurement as described above.</li>
        <li>The animators and freelancers on your project, when you hire us and they need the brief.</li>
      </ul>
      <p>We may also share information if the law requires it, or to protect our rights.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep enquiries and project records for as long as they are useful for the relationship and for our business
        records, then delete them. You can ask us to delete yours sooner.
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You can ask us what we hold about you, correct it, or have it deleted, and you can unsubscribe from emails or reply
        STOP to texts at any time. Depending on where you live (for example in the EU, the UK or California) you may have
        further rights under local law. Email {mail} and we will reply within 30 days.
      </p>

      <h2>Security</h2>
      <p>
        We use reputable providers and limit access to the people who need it. No system is perfectly secure, but we take
        reasonable care to protect your information.
      </p>

      <h2>Children</h2>
      <p>Our services are for businesses and adults. We don&rsquo;t knowingly collect information from children under 13.</p>

      <h2>Changes</h2>
      <p>
        If we change this policy, we&rsquo;ll update this page and the date at the top. Significant changes will be made
        clear here.
      </p>

      <h2>Contact</h2>
      <p>
        {brand.name} (IP Ventures), Miami, Florida. {mail}
      </p>
    </LegalPage>
  );
}
