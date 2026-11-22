import { createBrowserRouter } from 'react-router-dom'
import { App } from './App'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireRole } from '../features/auth/RequireRole'
import { TycoonPage } from '../features/tycoon/TycoonPage'
import { StaffResultPage } from '../features/results/StaffResultPage'
import { LeaderboardPage } from '../features/leaderboard/LeaderboardPage'
import { OrganizerDashboardPage } from '../features/organizer/OrganizerDashboardPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'login', element: <LoginPage /> },
      {
        element: <RequireRole allow={['team']} />,
        children: [{ path: 'team', element: <TycoonPage /> }],
      },
      {
        element: <RequireRole allow={['staff', 'organizer']} />,
        children: [{ path: 'staff', element: <StaffResultPage /> }],
      },
      {
        element: <RequireRole allow={['organizer']} />,
        children: [{ path: 'organizer', element: <OrganizerDashboardPage /> }],
      },
      {
        element: <RequireRole allow={['team', 'staff', 'organizer']} />,
        children: [{ path: 'leaderboard', element: <LeaderboardPage /> }],
      },
    ],
  },
])

function LandingPage() {
  return <main className="landing"><h1>Rally Tycoon</h1><p>Pos fisik membangun bisnis digital secara real-time.</p></main>
}
