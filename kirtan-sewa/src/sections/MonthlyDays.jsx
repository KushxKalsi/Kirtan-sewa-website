import { useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarHeart, Moon, Sun, Sparkle } from "lucide-react";
import SplitText from "../components/SplitText";
import Reveal from "../components/Reveal";
import { useSite } from "../components/SiteContext";
import { prettyDate } from "../lib/date";
import { ease } from "../lib/motion";
import { countdown } from "./Gurpurab";

const KINDS = [
  { id: "sangrand", icon: Sun, about: "The first day of the desi month" },
  { id: "pooranmashi", icon: Moon, about: "The full moon day" },
  { id: "dasvin", icon: Sparkle, about: "The tenth day of the bright moon" },
];
const MORE = 3; // dates listed under the next one

/** Sangrand, Pooranmashi and Dasvin: the next day of each, and the ones after it, to book kirtan for. */
export default function MonthlyDays({ onBookDate, focusId }) {
  const { site } = useSite();
  const today = site?.today;
  const byKind = useMemo(() => {
    const days = (site?.gurpurabs || []).filter((g) => g.monthly);
    return KINDS.map((k) => ({
      ...k,
      days: days.filter((g) => g.kind === k.id),
    })).filter((k) => k.days.length);
  }, [site]);
  // Opened from a notification for one of these days (the home page scrolls here): its card is outlined.
  const focused =
    focusId && byKind.find((k) => k.days.some((g) => g.id === focusId))?.id;

  if (!byKind.length || !today) return null;

  return (
    <section id="monthly-days" className="section monthly-days">
      <div className="container">
        <div className="section-head">
          <Reveal>
            <span className="eyebrow">Every month</span>
            <span className="gurmukhi-sub">ਸੰਗਰਾਂਦ · ਪੂਰਨਮਾਸ਼ੀ · ਦਸਵੀਂ</span>
          </Reveal>
          <SplitText
            className="section-title"
            text="Sangrand, Pooranmashi and Dasvin"
            highlight={[0, 3]}
          />
        </div>

        <div className="md-grid">
          {byKind.map((k, i) => {
            const [next, ...rest] = k.days;
            const Icon = k.icon;
            return (
              <motion.article
                key={k.id}
                id={`md-${k.id}`}
                className={`md-card glass k-${k.id} ${
                  focused === k.id ? "focused" : ""
                }`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.6, ease, delay: i * 0.08 }}
              >
                <header className="md-head">
                  <span className="md-icon">
                    <Icon size={20} />
                  </span>
                  <div>
                    <strong>
                      {next.kindLabel}{" "}
                      <span className="gurmukhi">· {next.kindGurmukhi}</span>
                    </strong>
                    <small>{k.about}</small>
                  </div>
                </header>
                <div className="md-next">
                  <span className="gp-item-date">
                    <strong>{prettyDate(next.date, "d")}</strong>
                    {prettyDate(next.date, "MMM")}
                  </span>
                  <div>
                    <p className="md-name">
                      {next.name} {next.kindLabel}{" "}
                      {next.gurmukhi && (
                        <span className="gurmukhi">· {next.gurmukhi}</span>
                      )}
                    </p>
                    <p className="md-when">
                      {prettyDate(next.date, "EEEE")} ·{" "}
                      {countdown(next.date, today)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onBookDate(next.date)}
                >
                  <CalendarHeart size={16} /> Book kirtan for this day
                </button>
                {rest.length > 0 && (
                  <ul className="md-more">
                    {rest.slice(0, MORE).map((g) => (
                      <li key={g.id}>
                        <button
                          type="button"
                          onClick={() => onBookDate(g.date)}
                          title="Book kirtan for this day"
                        >
                          <span>{prettyDate(g.date, "EEE, d MMM")}</span>
                          <small>{g.name}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
