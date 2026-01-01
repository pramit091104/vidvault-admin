import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import SmartUploadSection from "@/components/dashboard/SmartUploadSection";
import VideosTable from "@/components/dashboard/VideosTable";
import Clients from "@/pages/Clients";
import SettingsSection from "@/components/dashboard/SettingsSection";
import OverviewSection from "@/components/dashboard/OverviewSection";

const Dashboard = () => {
  const [activeSection, setActiveSection] = useState<string>("overview");

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return <OverviewSection onSectionChange={setActiveSection} />;
      case "upload":
        return <SmartUploadSection />;
      case "videos":
        return <VideosTable />;
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
