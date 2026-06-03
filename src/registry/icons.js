/**
 * icons.js
 *
 * Maps string icon ids to Lucide React components.
 * This is the bridge between JSON-serializable config (which can't hold
 * function references) and React render code.
 *
 * The AI uses iconId strings in config. The render engine looks up the
 * actual component here. To add a new icon: import it and add to ICON_REGISTRY.
 */

import {
  CalendarDays, FileText, Megaphone, Hash, MessageSquare,
  Users, BarChart2, TrendingUp, TrendingDown, Star,
  Layers, FolderPlus, BookOpen, Zap, Globe, Lock,
  Bell, Search, Heart, Target, Award, Flame,
  PieChart, Activity, Briefcase, Coffee, Mic,
  Video, Image, Link, Tag, Bookmark,
} from "lucide-react";

export const ICON_REGISTRY = {
  // Section icons
  CalendarDays,
  FileText,
  Megaphone,
  Hash,
  MessageSquare,
  Users,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Star,
  Layers,
  FolderPlus,
  BookOpen,
  Zap,
  Globe,
  Lock,
  Bell,
  Search,
  Heart,
  Target,
  Award,
  Flame,
  PieChart,
  Activity,
  Briefcase,
  Coffee,
  Mic,
  Video,
  Image,
  Link,
  Tag,
  Bookmark,
};

/**
 * Resolve an iconId string to a Lucide React component.
 * Falls back to Hash if the id is not found.
 */
export function resolveIcon(iconId) {
  return ICON_REGISTRY[iconId] ?? Hash;
}

/**
 * All icons available for the section builder / AI to pick from.
 * Grouped by category for UI display.
 */
export const ICON_OPTIONS = [
  { id: "Hash",         label: "Channel",    group: "content"   },
  { id: "Star",         label: "Featured",   group: "content"   },
  { id: "CalendarDays", label: "Schedule",   group: "content"   },
  { id: "FileText",     label: "Updates",    group: "content"   },
  { id: "Megaphone",    label: "Announce",   group: "content"   },
  { id: "BookOpen",     label: "Education",  group: "content"   },
  { id: "BarChart2",    label: "Stats",      group: "analytics" },
  { id: "TrendingUp",   label: "Signals",    group: "analytics" },
  { id: "PieChart",     label: "Portfolio",  group: "analytics" },
  { id: "Activity",     label: "Activity",   group: "analytics" },
  { id: "Users",        label: "Community",  group: "social"    },
  { id: "MessageSquare",label: "Chat",       group: "social"    },
  { id: "Heart",        label: "Favorites",  group: "social"    },
  { id: "Globe",        label: "Public",     group: "social"    },
  { id: "Target",       label: "Goals",      group: "personal"  },
  { id: "Award",        label: "Badges",     group: "personal"  },
  { id: "Flame",        label: "Streak",     group: "personal"  },
  { id: "Zap",          label: "Quick",      group: "personal"  },
];
