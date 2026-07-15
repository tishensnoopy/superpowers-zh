import { useParams } from 'react-router-dom';
import PageRenderer from './PageRenderer';

export default function PageRendererWithSlug() {
  const { slug } = useParams<{ slug: string }>();
  return <PageRenderer slug={slug} />;
}
