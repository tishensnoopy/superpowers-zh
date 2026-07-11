import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import PageRenderer from './pages/PageRenderer';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<PageRenderer />} />
          <Route path="/:slug" element={<PageRenderer slug={''} />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
