import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { LibraryView } from './views/LibraryView.jsx';
import { ReaderView } from './views/ReaderView.jsx';

function LibraryRoute() {
  const navigate = useNavigate();
  return <LibraryView onOpenBook={(id) => navigate(`/read/${id}`)} />;
}

/**
 * Enrutador principal.
 * Se usa HashRouter para que la PWA funcione servida desde cualquier origen
 * o empaquetada como app de escritorio (Tauri/Electron) sin configuración extra.
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LibraryRoute />} />
        <Route path="/read/:bookId" element={<ReaderView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
