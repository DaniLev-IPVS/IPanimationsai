import Stage from "@/components/Stage";
import { Header, Footer } from "@/components/Chrome";
import { Hero, Testimonials, Reel, Closing } from "@/components/Sections";

export default function Home() {
  return (
    <>
      <Stage />
      <Header />
      <main>
        <Hero />
        <Testimonials />
        <Reel />
        <Closing />
      </main>
      <Footer />
    </>
  );
}
