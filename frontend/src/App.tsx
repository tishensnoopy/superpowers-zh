import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import PageRenderer from './pages/PageRenderer';
import PageRendererWithSlug from './pages/PageRendererWithSlug';
import AppointmentSuccess from './pages/AppointmentSuccess';
import CourseDetailPage from './pages/CourseDetailPage';
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
        <Route path="/:slug" element={<Layout><PageRendererWithSlug /></Layout>} />
        <Route path="/courses/:slug" element={<Layout><CourseDetailPage /></Layout>} />
        <Route path="/appointment-success" element={<AppointmentSuccess />} />
      </Routes>
    </BrowserRouter>
  );
}
