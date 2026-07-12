import type { Section } from '@/lib/api';

export default function RichText({ section }: { section: Section }) {
  const { title, content, alignment = 'left' } = section;

  const alignClasses: Record<string, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <section className="py-24 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className={`max-w-4xl mx-auto ${alignClasses[alignment] || alignClasses.left}`}>
          {title && (
            <h2
              className="text-[#1C2B3A] mb-6"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: '2rem',
                fontWeight: 800,
              }}
            >
              {title}
            </h2>
          )}
          <div
            className="text-muted-foreground text-lg leading-relaxed"
            dangerouslySetInnerHTML={{ __html: content || '' }}
          />
        </div>
      </div>
    </section>
  );
}
