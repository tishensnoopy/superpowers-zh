import type { Section } from '../lib/api';
import Hero from './sections/Hero';
import Advantages from './sections/Advantages';
import RichText from './sections/RichText';
import ProductGrid from './sections/ProductGrid';
import ProductComparison from './sections/ProductComparison';
import Features from './sections/Features';
import Team from './sections/Team';
import Testimonials from './sections/Testimonials';
import ContactForm from './sections/ContactForm';
import Faq from './sections/Faq';
import Gallery from './sections/Gallery';
import FloatingButton from './sections/FloatingButton';

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
