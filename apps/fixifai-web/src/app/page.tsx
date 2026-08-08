import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import Problems from '@/components/Problems';
import HowItWorks from '@/components/HowItWorks';
import Audiences from '@/components/Audiences';
import Demo from '@/components/Demo';
import Industries from '@/components/Industries';
import Pricing from '@/components/Pricing';
import SignupForm from '@/components/SignupForm';
import Faq from '@/components/Faq';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <main>
      <Nav />
      <Hero />
      <Problems />
      <HowItWorks />
      <Audiences />
      <Demo />
      {/* dark accent band wrapping Industries + Pricing */}
      <div className="bg-gradient-to-b from-brand-dark to-[#012e2e]">
        <Industries />
        <Pricing />
      </div>
      <SignupForm />
      <Faq />
      <Footer />
    </main>
  );
}
