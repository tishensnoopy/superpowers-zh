import type { Section } from '@/lib/api';

export default function ProductComparison({ section }: { section: Section }) {
  const { title, products, specs } = section;

  const productData = products?.data || [];
  const specData = specs?.data || [];

  return (
    <section className="py-24 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="text-center mb-16">
          <h2
            className="text-[#1C2B3A] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '2.25rem',
              fontWeight: 800,
            }}
          >
            {title || '产品对比'}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full bg-card rounded-2xl border border-border">
            <thead>
              <tr>
                <th className="p-4 text-left font-bold text-[#1C2B3A] bg-muted/50">规格</th>
                {productData.map((product: any) => (
                  <th key={product.id} className="p-4 text-center font-bold text-[#1C2B3A] bg-muted/50 min-w-[200px]">
                    {product.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {specData.map((spec: any) => {
                const specName = spec.name;
                return (
                  <tr key={spec.id} className="border-t border-border">
                    <td className="p-4 text-muted-foreground">{specName}</td>
                    {productData.map((product: any) => {
                      const productSpec = product.specs?.find(
                        (s: any) => s.name === specName
                      );
                      return (
                        <td key={product.id} className="p-4 text-center">
                          {productSpec?.value || '-'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
