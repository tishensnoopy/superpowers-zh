import { BookOpen, CheckCircle, Clock } from 'lucide-react';
import type { Section } from '../../lib/api';

export default function ProductGrid({ section }: { section: Section }) {
  const { title, description, products } = section;
  
  return (
    <section className="py-24" style={{ background: 'linear-gradient(180deg, #F8F9FF 0%, #FFFCF8 100%)' }}>
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-sm font-medium mb-5">
            <BookOpen size={14} />
            精品课程体系
          </div>
          <h2
            className="text-[#1C2B3A] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '2.25rem',
              fontWeight: 800,
            }}
          >
            {title || '科学课程，全面衔接小学学习'}
          </h2>
          <p className="text-muted-foreground text-base max-w-[560px] mx-auto leading-relaxed">
            {description || '由资深教研团队研发，严格对标小学课程标准，让孩子学得快乐、学得扎实。'}
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {(products?.data || []).map((product: any) => (
            <div key={product.id} className="col-span-12 sm:col-span-6 lg:col-span-3">
              <div className="h-full bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col">
                <div className="p-6 border-b border-border" style={{ background: '#EFF6FF' }}>
                  <div className="text-4xl mb-4">📚</div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3
                      className="text-xl font-bold text-[#1C2B3A]"
                      style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
                    >
                      {product.attributes.name}
                    </h3>
                  </div>
                  {product.attributes.categories?.data?.[0] && (
                    <span
                      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ color: '#2563EB', background: 'rgba(37,99,235,0.1)' }}
                    >
                      {product.attributes.categories.data[0].attributes.name}
                    </span>
                  )}
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                    {product.attributes.shortDescription || product.attributes.description}
                  </p>
                  {product.attributes.specs?.data && (
                    <ul className="space-y-2 flex-1">
                      {product.attributes.specs.data.map((spec: any) => (
                        <li key={spec.id} className="flex items-center gap-2 text-sm text-[#4A5568]">
                          <CheckCircle size={14} style={{ color: '#2563EB' }} className="shrink-0" />
                          {spec.attributes.name}: {spec.attributes.value}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock size={12} /> 查看详情
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
