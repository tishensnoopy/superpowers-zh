import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import PageRenderer from './pages/PageRenderer';
import PageRendererWithSlug from './pages/PageRendererWithSlug';
import AppointmentSuccess from './pages/AppointmentSuccess';
import CourseDetailPage from './pages/CourseDetailPage';
import CoursesPage from './pages/CoursesPage';
import NewsDetailPage from './pages/NewsDetailPage';
import NewsListPage from './pages/NewsListPage';
import FaqPage from './pages/FaqPage';
import TeamPage from './components/team/TeamPage';
import CampusOverviewPage from './pages/CampusOverviewPage';
import CampusDetailPage from './pages/CampusDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><PageRenderer /></Layout>} />
        <Route path="/team" element={<Layout><TeamPage /></Layout>} />
        <Route path="/campuses" element={<Layout><CampusOverviewPage /></Layout>} />
        <Route path="/campuses/:slug" element={<Layout><CampusDetailPage /></Layout>} />
        <Route path="/courses" element={<Layout><CoursesPage /></Layout>} />
        <Route path="/courses/:slug" element={<Layout><CourseDetailPage /></Layout>} />
        <Route path="/news" element={<Layout><NewsListPage /></Layout>} />
        <Route path="/news/:slug" element={<Layout><NewsDetailPage /></Layout>} />
        <Route path="/faq" element={<Layout><FaqPage /></Layout>} />
        <Route path="/:slug" element={<Layout><PageRendererWithSlug /></Layout>} />
        <Route path="/appointment-success" element={<AppointmentSuccess />} />
      </Routes>
    </BrowserRouter>
  );
}
