import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import PageRenderer from './pages/PageRenderer';
import AppointmentSuccess from './pages/AppointmentSuccess';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><PageRenderer /></Layout>} />
        <Route path="/:slug" element={<Layout><PageRenderer slug={''} /></Layout>} />
        <Route path="/appointment-success" element={<AppointmentSuccess />} />
      </Routes>
    </BrowserRouter>
  );
}
