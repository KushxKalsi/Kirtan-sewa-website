import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Hero from '../sections/Hero';
import About from '../sections/About';
import Services from '../sections/Services';
import Booking from '../sections/Booking';
import Gallery from '../sections/Gallery';
import Testimonials from '../sections/Testimonials';
import Contact from '../sections/Contact';
import { scrollToId } from '../lib/scroll';

export default function Home({ ready }) {
  const [preselect, setPreselect] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Arriving from another page with a section to jump to.
  useEffect(() => {
    const id = location.state?.scrollTo;
    if (!id) return;
    // Clearing the state re-runs this effect, so the timer is intentionally not cancelled.
    setTimeout(() => scrollToId(id), 500);
    navigate('.', { replace: true, state: null });
  }, [location.state, navigate]);

  return (
    <main>
      <Hero ready={ready} />
      <About />
      <Services onBook={(id, categoryId) => setPreselect({ id, categoryId, n: Date.now() })} />
      <Booking preselect={preselect} />
      <Gallery />
      <Testimonials />
      <Contact />
    </main>
  );
}
