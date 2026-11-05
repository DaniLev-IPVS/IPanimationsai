import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { brand } from "@/content/site";

export const metadata: Metadata = {
  title: `Terms of Service — ${brand.name}`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  const mail = <a href={`mailto:${brand.email}`}>{brand.email}</a>;
  return (
    <LegalPage title="Terms of Service" updated="November 5, 2026">
      <p>
        These terms cover your use of {brand.domain} and the basics of how we work with clients. {brand.name} is the
        animation studio of IP Ventures, based in Miami, Florida (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By using this site
        you agree to them. Questions go to {mail}.
      </p>

      <h2>Using this website</h2>
      <p>
        You can browse the site and contact us through it. Please don&rsquo;t misuse it: no attempts to break or overload
        it, no spam or automated submissions, and no false information in the form. The site and everything on it are
        provided &ldquo;as is&rdquo;.
      </p>

      <h2>Our work on this site</h2>
      <p>
        The videos, characters, artwork and text on this site belong to us or to the clients we made them for, and are
        shown with permission. Client names and logos belong to their owners and appear only to show who we&rsquo;ve worked
        with. Please don&rsquo;t copy, download or reuse any of it without written permission.
      </p>

      <h2>Enquiries and quotes</h2>
      <p>
        Sending the form or booking a call doesn&rsquo;t commit you or us to anything. Any prices or timelines we mention
        before a written proposal are estimates.
      </p>

      <h2>Projects</h2>
      <p>
        Every project is covered by its own written proposal or agreement, which sets out the scope, price, payment
        schedule, revision rounds, timeline and who owns what. If that agreement and these terms ever disagree, the
        agreement wins. Unless it says otherwise:
      </p>
      <ul>
        <li>
          <strong>Ownership.</strong> Once you&rsquo;ve paid in full, you own the final delivered video(s). Our working
          files, tools and methods stay ours.
        </li>
        <li>
          <strong>Your materials.</strong> You confirm you have the rights to anything you send us to use (logos, footage,
          music, characters, scripts) and you stay the owner of it.
        </li>
        <li>
          <strong>Showing the work.</strong> We may show finished work in our portfolio and marketing after it&rsquo;s
          public, unless we&rsquo;ve agreed to keep it private.
        </li>
        <li>
          <strong>How we make it.</strong> We choose the technique for each job: frame by frame, rigged, 3D or AI-assisted.
          AI-assisted work is directed, edited and finished by our team.
        </li>
      </ul>

      <h2>Liability</h2>
      <p>
        We work carefully, but to the extent the law allows, we aren&rsquo;t liable for indirect or consequential losses,
        such as lost profits, arising from your use of this site or our services, and our total liability for a project is
        limited to the amount you paid us for it.
      </p>

      <h2>Links to other sites</h2>
      <p>This site links to services such as YouTube and Meta. We aren&rsquo;t responsible for their content or practices.</p>

      <h2>Privacy</h2>
      <p>
        How we handle your information is explained in our <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the State of Florida, USA. Any dispute will be handled in the courts of
        Miami-Dade County, Florida.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms. The date at the top shows when they last changed.</p>

      <h2>Contact</h2>
      <p>
        {brand.name} (IP Ventures), Miami, Florida. {mail}
      </p>
    </LegalPage>
  );
}
