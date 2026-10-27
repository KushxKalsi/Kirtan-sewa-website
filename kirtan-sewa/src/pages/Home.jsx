import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Hero from '../sections/Hero';
import About from '../sections/About';
import Gurpurab from '../sections/Gurpurab';
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
  // Tapped a Gurpurab notification (/?gurpurab=id): open that day in the carousel.
  const [gurpurabId] = useState(() => new URLSearchParams(window.location.search).get('gurpurab'));
  useEffect(() => {
    if (!gurpurabId || !ready) return;
    const t = setTimeout(() => scrollToId('gurpurab'), 600);
    return () => clearTimeout(t);
  }, [gurpurabId, ready]);

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
      <Gurpurab focusId={gurpurabId} onBookDate={(date) => setPreselect({ date, n: Date.now() })} />
      <About />
      <Services onBook={(id, categoryId) => setPreselect({ id, categoryId, n: Date.now() })} />
      <Booking preselect={preselect} />
      <Gallery />
      <Testimonials />
      <Contact />
    </main>
  );
}
