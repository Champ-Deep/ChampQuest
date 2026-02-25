import LeftPanel from './LeftPanel';
import CenterPanel from './CenterPanel';
import RightPanel from './RightPanel';

export default function DashboardLayout() {
  return (
    <div className="dashboard-grid">
      <LeftPanel />
      <CenterPanel />
      <RightPanel />
    </div>
  );
}
