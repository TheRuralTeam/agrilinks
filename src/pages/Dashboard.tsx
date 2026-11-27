import { Navigate } from 'react-router-dom';

// Legacy route kept as a safe redirect; the actual analytics dashboard is permission-gated.
const Dashboard = () => <Navigate to="/admindashboard" replace />;

export default Dashboard;
