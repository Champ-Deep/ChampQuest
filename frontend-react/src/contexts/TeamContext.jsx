import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { API } from '../utils/api';
import { useAuth } from './AuthContext';

const TeamContext = createContext(null);

export function TeamProvider({ children }) {
  const { user, token } = useAuth();
  const [currentTeam, setCurrentTeam] = useState(null);
  const [userTeams, setUserTeams] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({});
  const [activity, setActivity] = useState([]);
  const [kudos, setKudos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const refreshRef = useRef(null);

  const loadTeams = useCallback(async () => {
    if (!token) return;
    try {
      const teams = await API.getTeams();
      setUserTeams(teams);
      return teams;
    } catch (e) {
      console.error('Failed to load teams:', e);
      return [];
    }
  }, [token]);

  useEffect(() => {
    if (user && token) loadTeams();
  }, [user, token, loadTeams]);

  const loadData = useCallback(async () => {
    if (!currentTeam) return;
    const teamId = currentTeam.id;
    setIsLoading(true);
    try {
      const [taskData, members, teamStats, activityFeed, kudosFeed] = await Promise.all([
        API.getTasks(teamId),
        API.getTeamMembers(teamId),
        API.getTeamStats(teamId),
        API.getActivityFeed(teamId),
        API.getKudos(teamId),
      ]);
      setTasks(taskData);
      setTeamMembers(members);
      setStats(teamStats);
      setActivity(activityFeed);
      setKudos(kudosFeed);
    } catch (e) {
      console.error('Failed to load team data:', e);
    } finally {
      setIsLoading(false);
    }
  }, [currentTeam]);

  const selectTeam = useCallback(async (team) => {
    API.setTeam(team.id);
    setCurrentTeam(team);
  }, []);

  // Refresh data when team changes
  useEffect(() => {
    if (currentTeam) {
      loadData();
      // Set up 30-second refresh
      if (refreshRef.current) clearInterval(refreshRef.current);
      refreshRef.current = setInterval(loadData, 30000);
      return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
    }
  }, [currentTeam, loadData]);

  const leaveTeam = useCallback(() => {
    if (refreshRef.current) clearInterval(refreshRef.current);
    setCurrentTeam(null);
    setTasks([]);
    setTeamMembers([]);
    setStats({});
    setActivity([]);
    setKudos([]);
  }, []);

  const refreshTasks = useCallback(async () => {
    if (!currentTeam) return;
    try {
      const taskData = await API.getTasks(currentTeam.id);
      setTasks(taskData);
    } catch (e) {
      console.error('Failed to refresh tasks:', e);
    }
  }, [currentTeam]);

  return (
    <TeamContext.Provider value={{
      currentTeam, userTeams, teamMembers, tasks, stats, activity, kudos, isLoading,
      selectTeam, leaveTeam, loadTeams, loadData, refreshTasks,
      setTasks, setKudos, setActivity,
    }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used within TeamProvider');
  return ctx;
}
