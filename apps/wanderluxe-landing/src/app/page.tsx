import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import TrustStrip from '@/components/TrustStrip';
import Destinations from '@/components/Destinations';
import Configurator from '@/components/Configurator';
import HowItWorks from '@/components/HowItWorks';
import Testimonials from '@/components/Testimonials';
import FinalCTA from '@/components/FinalCTA';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Nav />
      <main className="relative overflow-x-clip bg-sand-50 pt-0">
        <Hero />
        <TrustStrip />
        <Destinations />
        <Configurator />
        <HowItWorks />
        <Testimonials />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
