import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import UploadSection from "@/components/dashboard/UploadSection";
import VideosTable from "@/components/dashboard/VideosTable";
import SettingsSection from "@/components/dashboard/SettingsSection";

const Dashboard = () => {
  const [activeSection, setActiveSection] = useState<string>("upload");

  const renderSection = () => {
    switch (activeSection) {
      case "upload":
        return <UploadSection />;
      case "videos":
        return <VideosTable />;
      case "settings":
        return <SettingsSection />;
      default:
        return <UploadSection />;
    }
  };

  return (
    <DashboardLayout activeSection={activeSection} onSectionChange={setActiveSection}>
      {renderSection()}
    </DashboardLayout>
  );
};

export default Dashboard;
