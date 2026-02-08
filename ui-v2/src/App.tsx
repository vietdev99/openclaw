import { Routes, Route } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Agents } from "@/pages/Agents";
import { Channels } from "@/pages/Channels";
import { Dashboard } from "@/pages/Dashboard";
import { OAuthCallback } from "@/pages/OAuthCallback";
import { Providers } from "@/pages/Providers";
import { Settings } from "@/pages/Settings";

function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <Sidebar />
      <main className="ml-56 p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
