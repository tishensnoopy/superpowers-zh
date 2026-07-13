import { buildMetadata } from '@/lib/seo';
import ContactForm from '@/components/sections/ContactForm';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(undefined, {
    title: '联系我们',
    description: '联系佑森小课堂，预约免费试听课程',
  });
}

export default async function ContactPage() {
  return (
    <div className="pt-[72px] min-h-screen bg-gradient-to-br from-[#FFF3E5] to-[#FFFCF8]">
      <div className="max-w-[1200px] mx-auto px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#1C2B3A] mb-4">联系我们</h1>
          <p className="text-lg text-gray-600">填写下方表单预约免费试听课程</p>
        </div>
        <ContactForm section={{
          id: 0,
          __component: 'section.contact-form',
          title: '预约免费试听',
          description: '填写下方表单，我们将尽快联系您',
          submitText: '立即预约',
        }} />
      </div>
    </div>
  );
}
