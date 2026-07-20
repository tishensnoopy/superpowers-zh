import { useTranslations } from 'next-intl';

export default function TeamHeader() {
  const t = useTranslations('teachers');
  const stats = [
    { value: '50+', label: t('professionalTeachers') },
    { value: '6', label: t('campusesCovered') },
    { value: '10年+', label: t('avgTeachingYears') },
    { value: '98%', label: t('parentApproval') },
  ];

  return (
    <section
      className="pt-[120px] pb-16"
      style={{
        background: 'linear-gradient(to bottom, #FFF3E5, #ffffff)',
        fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
      }}
    >
      <div className="max-w-[1400px] mx-auto px-8">
        <h1
          className="text-[var(--brand-dark,#1C2B3A)] mb-4"
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
          }}
        >
          {t('title')}
        </h1>
        <p className="text-lg text-muted-foreground mb-10 max-w-[640px]">
          {t('subtitle')}
        </p>

        <div className="flex flex-wrap gap-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="px-5 py-3 rounded-xl bg-card border border-border shadow-sm"
            >
              <span className="text-lg font-bold text-[var(--brand-primary,#F5851F)]">{`${s.value} ${s.label}`}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
