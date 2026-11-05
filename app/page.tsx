import { Header, StickyCta, Footer } from "@/components/Chrome";
import { Hero, Testimonials, WorkAndAbout, AboutUs } from "@/components/Sections";
import Character from "@/components/character/Character";
import { bookCall } from "@/content/site";

/** The homepage: a button to /book where the form used to be, and About us at the end. */
export default function Home() {
  return (
    <>
      <Header bookHref="/book" bookLabel={bookCall.short} />
      <main id="main">
        <Hero mode="cta" />
        <Testimonials />
        <WorkAndAbout bookHref="/book" bookLabel={bookCall.short} />
        <AboutUs />
      </main>
      <Footer bookHref="/book" bookLabel={bookCall.short} />
      <StickyCta href="/book" label={bookCall.short} />
      <Character />
    </>
  );
}
