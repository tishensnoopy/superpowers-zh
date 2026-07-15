const stats = [
  { value: '50+', label: '专业教师' },
  { value: '6', label: '校区覆盖' },
  { value: '10年+', label: '平均教龄' },
  { value: '98%', label: '家长好评' },
];

export default function TeamHeader() {
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
          className="text-[#1C2B3A] mb-4"
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
          }}
        >
          师资团队
        </h1>
        <p className="text-lg text-muted-foreground mb-10 max-w-[640px]">
          专业教师阵容 用心陪伴成长
        </p>

        <div className="flex flex-wrap gap-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="px-5 py-3 rounded-xl bg-card border border-border shadow-sm"
            >
              <span className="text-lg font-bold text-[#F5851F]">{`${s.value} ${s.label}`}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
