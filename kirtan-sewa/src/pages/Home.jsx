import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Hero from '../sections/Hero';
import About from '../sections/About';
import Gurpurab from '../sections/Gurpurab';
import MonthlyDays from '../sections/MonthlyDays';
import { useSite } from '../components/SiteContext';
import Services from '../sections/Services';
import Booking from '../sections/Booking';
import SewaFeed from '../sections/SewaFeed';
import Testimonials from '../sections/Testimonials';
import Contact from '../sections/Contact';
import { scrollToId } from '../lib/scroll';

export default function Home({ ready }) {
  const [preselect, setPreselect] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  // Tapped a Gurpurab notification (/?gurpurab=id): open that day in the carousel, or for Sangrand / Pooranmashi /
  // Dasvin, go to the monthly days.
  const { site } = useSite();
  const [gurpurabId] = useState(() => new URLSearchParams(window.location.search).get('gurpurab'));
  const monthly = !!site?.gurpurabs?.find((g) => g.id === gurpurabId)?.monthly;
  useEffect(() => {
    if (!gurpurabId || !ready || !site) return;
    const t = setTimeout(() => scrollToId(monthly ? 'monthly-days' : 'gurpurab'), 600);
    return () => clearTimeout(t);
  }, [gurpurabId, ready, site, monthly]);
  const bookDate = (date) => setPreselect({ date, n: Date.now() });

  // Arriving from another page with a section to jump to.
  useEffect(() => {
    const id = location.state?.scrollTo;
    const emergency = location.state?.emergency;
    if (!id && !emergency) return;
    if (emergency) setPreselect({ emergency: true, n: Date.now() }); // Booking opens today and scrolls itself
    // Clearing the state re-runs this effect, so the timer is intentionally not cancelled.
    else setTimeout(() => scrollToId(id), 500);
    navigate('.', { replace: true, state: null });
  }, [location.state, navigate]);

  return (
    <main>
      <Hero ready={ready} />
      <Gurpurab focusId={gurpurabId} onBookDate={bookDate} />
      <MonthlyDays focusId={gurpurabId} onBookDate={bookDate} />
      <About />
      <Services onBook={(id, categoryId) => setPreselect({ id, categoryId, n: Date.now() })} />
      <Booking preselect={preselect} />
      <SewaFeed />
      <Testimonials />
      <Contact />
    </main>
  );
}
