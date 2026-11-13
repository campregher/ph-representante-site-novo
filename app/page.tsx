import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import BusinessModels from "@/components/BusinessModels";
import Brands from "@/components/Brands";
import Services from "@/components/Services";
import YouTubeVideos from "@/components/YouTubeVideos";
import LeadForm from "@/components/LeadForm";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

export default function Home() {
  return (
    <main className="bg-dark-900 overflow-x-hidden">
      <Navbar />
      <Hero />
      <About />
      <BusinessModels />
      <Brands />
      <Services />
      <YouTubeVideos />
      <LeadForm />
      <Testimonials />
      <FAQ />
      <Footer />
      <WhatsAppButton />
    </main>
  );
}
