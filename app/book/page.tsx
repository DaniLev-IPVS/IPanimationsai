import type { Metadata } from "next";
import { Header, StickyCta, Footer } from "@/components/Chrome";
import { Hero, ClientLogos, Testimonials, WorkAndAbout } from "@/components/Sections";
import Character from "@/components/character/Character";
import { brand } from "@/content/site";

export const metadata: Metadata = {
  title: `Book a call — ${brand.name}`,
  alternates: { canonical: "/book" },
};

/** The landing page: the form up top, then the client logos, quotes and work. */
export default function BookPage() {
  return (
    <>
      <Header />
      <main id="main">
        <Hero mode="form" />
        <ClientLogos />
        <Testimonials />
        <WorkAndAbout />
      </main>
      <Footer />
      <StickyCta />
      <Character />
    </>
  );
}
