import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import TrustStrip from '@/components/TrustStrip';
import Features from '@/components/Features';
import HowItWorks from '@/components/HowItWorks';
import Verticals from '@/components/Verticals';
import Pricing from '@/components/Pricing';
import FinalCTA from '@/components/FinalCTA';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <main className="relative overflow-x-clip">
      <Nav />
      <Hero />
      <TrustStrip />
      <Features />
      <HowItWorks />
      <Verticals />
      <Pricing />
      <FinalCTA />
      <Footer />
    </main>
  );
}
