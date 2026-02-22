import Header from "@/components/header";
import Hero from "@/components/hero";
import VideoDemo from "@/components/video-demo";
import Features from "@/components/features";
import Footer from "@/components/footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <VideoDemo />
        <Features />
      </main>
      <Footer />
    </>
  );
}
