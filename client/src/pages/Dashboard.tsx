import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import SmartUploadSection from "@/components/dashboard/SmartUploadSection";
import VideosManagement from "@/components/dashboard/VideosManagement";
import Clients from "@/pages/Clients";
import SettingsSection from "@/components/dashboard/SettingsSection";
import OverviewSection from "@/components/dashboard/OverviewSection";

const Dashboard = () => {
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [replaceVideoId, setReplaceVideoId] = useState<string | null>(null);

  useEffect(() => {
    // Check URL parameters for tab and replaceVideoId
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    const videoId = urlParams.get('replaceVideoId');
    
    if (tab) {
      setActiveSection(tab);
    }
    
    if (videoId) {
      setReplaceVideoId(videoId);
    }
  }, []);

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return <OverviewSection onSectionChange={setActiveSection} />;
      case "upload":
        return <SmartUploadSection replaceVideoId={replaceVideoId} />;
      case "videos":
        return <VideosManagement />;
      case "clients":
        return <Clients />;
      case "settings":
        return <SettingsSection />;
      default:
        return <OverviewSection onSectionChange={setActiveSection} />;
    }
  };

  return (
    <DashboardLayout activeSection={activeSection} onSectionChange={setActiveSection}>
      {renderSection()}
    </DashboardLayout>
  );
};

export default Dashboard;
