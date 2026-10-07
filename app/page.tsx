import { Header, StickyCta, Footer } from "@/components/Chrome";
import { Hero, Ticker, Testimonials, WorkAndAbout } from "@/components/Sections";
import Character from "@/components/character/Character";

export default function Home() {
  return (
    <>
      <Header />
      <main id="main">
        <Hero />
        <Ticker />
        <Testimonials />
        <WorkAndAbout />
      </main>
      <Footer />
      <StickyCta />
      <Character />
    </>
  );
}
