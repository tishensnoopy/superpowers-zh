interface CategoryFilterProps {
  categories: { id: number; attributes?: { slug: string; name: string }; slug?: string; name?: string }[];
  selected: string | null;
  onChange: (slug: string | null) => void;
}

function normalizeCategory(cat: CategoryFilterProps['categories'][number]) {
  if (cat.attributes) {
    return { id: cat.id, slug: cat.attributes.slug, name: cat.attributes.name };
  }
  return { id: cat.id, slug: cat.slug!, name: cat.name! };
}

export default function CategoryFilter({ categories, selected, onChange }: CategoryFilterProps) {
  const chipClass = (active: boolean) =>
    [
      'inline-flex items-center justify-center px-4 py-2 text-sm font-medium cursor-pointer',
      'rounded-full border transition-all whitespace-nowrap',
      active
        ? 'text-white border-transparent shadow-md'
        : 'bg-card text-[#4A5568] border-border hover:shadow-sm hover:border-[#F5851F] hover:text-[#F5851F]',
    ].join(' ');

  const activeStyle = (active: boolean): React.CSSProperties =>
    active ? { background: 'linear-gradient(135deg, #F5851F, #FF6B35)' } : {};

  return (
    <div
      className="flex flex-wrap gap-2"
      style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
    >
      <button
        type="button"
        className={chipClass(selected === null)}
        style={activeStyle(selected === null)}
        onClick={() => onChange(null)}
      >
        全部
      </button>
      {categories.map((cat) => {
        const { id, slug, name } = normalizeCategory(cat);
        const isActive = selected === slug;
        return (
          <button
            key={id}
            type="button"
            className={chipClass(isActive)}
            style={activeStyle(isActive)}
            onClick={() => onChange(slug)}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
