import { useState } from 'react';
import { LayoutDashboard, Package, Upload, FileText, Activity } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import UploadPage from './pages/UploadPage';
import Reports from './pages/Reports';
import ActivityPage from './pages/ActivityPage';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'upload', label: 'Upload Data', icon: Upload },
  { id: 'reports', label: 'Daily Report', icon: FileText },
  { id: 'activity', label: 'Activity Log', icon: Activity },
];

function App() {
  const [page, setPage] = useState('dashboard');

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={setPage} />;
      case 'products': return <Products />;
      case 'upload': return <UploadPage />;
      case 'reports': return <Reports />;
      case 'activity': return <ActivityPage />;
      default: return <Dashboard onNavigate={setPage} />;
    }
  };

  return (
    <>
      <Toaster position="top-right" toastOptions={{ className: 'toast-custom', duration: 3000 }} />
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>📦 InvenTrack</h2>
          <span>Inventory Manager</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => (
            <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
              <n.icon size={18} /> {n.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        {renderPage()}
      </main>
    </>
  );
}

export default App;
