import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { HostPage } from './pages/HostPage';
import { KitchenSinkPage } from './pages/KitchenSinkPage';
import { PlayPage } from './pages/PlayPage';
import { PrintCardsPage } from './pages/PrintCardsPage';
import { SetupPage } from './pages/SetupPage';
import { StagePage } from './pages/StagePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/host" replace />} />
        <Route path="/host" element={<HostPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/stage" element={<StagePage />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/join" element={<Navigate to="/play" replace />} />
        <Route path="/print-cards" element={<PrintCardsPage />} />
        <Route path="/kitchen-sink" element={<KitchenSinkPage />} />
        <Route path="*" element={<Navigate to="/host" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
