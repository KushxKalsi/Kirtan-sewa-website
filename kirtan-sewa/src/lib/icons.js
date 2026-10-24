import { Music, Sunrise, Sunset, Flame, BookOpen, Heart, Star, Sparkles, Moon, Sun, Flower2, Bell, Hand, Users, MicVocal, Drum, Feather } from 'lucide-react';

export const SERVICE_ICONS = {
  music: Music,
  sunrise: Sunrise,
  sunset: Sunset,
  flame: Flame,
  book: BookOpen,
  heart: Heart,
  star: Star,
  sparkles: Sparkles,
  moon: Moon,
  sun: Sun,
  flower: Flower2,
  bell: Bell,
  hand: Hand,
  sangat: Users,
  mic: MicVocal,
  drum: Drum,
  feather: Feather,
};

export const serviceIcon = (name) => SERVICE_ICONS[name] || Music;
