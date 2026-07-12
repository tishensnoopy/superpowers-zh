import dynamic from 'next/dynamic';
import type { Section } from '@/lib/api';
import Hero from '@/components/sections/Hero';
import Advantages from '@/components/sections/Advantages';
import RichText from '@/components/sections/RichText';
import ProductGrid from '@/components/sections/ProductGrid';
import ProductComparison from '@/components/sections/ProductComparison';
import Features from '@/components/sections/Features';
import Team from '@/components/sections/Team';
import Testimonials from '@/components/sections/Testimonials';
import Faq from '@/components/sections/Faq';
import Gallery from '@/components/sections/Gallery';
import FloatingButton from '@/components/sections/FloatingButton';

const ContactForm = dynamic(() => import('@/components/sections/ContactForm'), {
  loading: () => <div className="h-96 animate-pulse bg-gray-100 rounded" />,
  ssr: true,
});

const componentMap: Record<string, React.ComponentType<{ section: Section }>> = {
  'section.hero': Hero,
  'section.advantages': Advantages,
  'section.rich-text': RichText,
  'section.product-grid': ProductGrid,
  'section.product-comparison': ProductComparison,
  'section.features': Features,
  'section.team': Team,
  'section.testimonials': Testimonials,
  'section.contact-form': ContactForm,
  'section.faq': Faq,
  'section.gallery': Gallery,
  'section.floating-button': FloatingButton,
};

export default function SectionRenderer({ section }: { section: Section }) {
  const Component = componentMap[section.__component];

  if (!Component) {
    console.warn(`Unknown component: ${section.__component}`);
    return null;
  }

  return <Component section={section} />;
}

export function getComponentName(component: string): string {
  const map: Record<string, string> = {
    'section.hero': 'Hero',
    'section.advantages': 'Advantages',
    'section.rich-text': 'Rich Text',
    'section.product-grid': 'Product Grid',
    'section.product-comparison': 'Product Comparison',
    'section.features': 'Features',
    'section.team': 'Team',
    'section.testimonials': 'Testimonials',
    'section.contact-form': 'Contact Form',
    'section.faq': 'FAQ',
    'section.gallery': 'Gallery',
    'section.floating-button': 'Floating Button',
  };
  return map[component] || component;
}
