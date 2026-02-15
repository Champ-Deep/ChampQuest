/**
 * Champ Quest Multi-Team API Client
 * JWT Auth + Multi-Team Support
 */
const API = {
  baseUrl: '/api',
  token: null,
  currentUser: null,
  currentTeamId: null,

  init() {
    const token = localStorage.getItem('champToken');
    const user = localStorage.getItem('champUser');
    const teamId = localStorage.getItem('champTeamId');

    if (token && user) {
      this.token = token;
      this.currentUser = JSON.parse(user);
      this.currentTeamId = teamId;
      return { token, user: this.currentUser, teamId: this.currentTeamId };
    }
    return null;
  },

  saveSession(token, user, teamId = null) {
    this.token = token;
    this.currentUser = user;
    if (teamId) {
      this.currentTeamId = teamId;
      localStorage.setItem('champTeamId', teamId);
    }
    localStorage.setItem('champToken', token);
    localStorage.setItem('champUser', JSON.stringify(user));
  },

  clearSession() {
    this.token = null;
    this.currentUser = null;
    this.currentTeamId = null;
    localStorage.removeItem('champToken');
    localStorage.removeItem('champUser');
    localStorage.removeItem('champTeamId');
  },

  setTeam(teamId) {
    this.currentTeamId = teamId;
    localStorage.setItem('champTeamId', teamId);
  },

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  },

  isAdmin() {
    return this.currentUser?.globalRole === 'superadmin' ||
           (this.currentTeamId && this.userTeamRole === 'admin');
  },

  isSuperadmin() {
    return this.currentUser?.globalRole === 'superadmin';
  },

  async register(email, password, displayName) {
    const res = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Registration failed');
    }
    const data = await res.json();
    this.saveSession(data.token, data.user);
    return data;
  },

  async login(email, password) {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    this.saveSession(data.token, data.user);
    return data;
  },

  async forgotPassword(email) {
    const res = await fetch(`${this.baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to send reset link');
    }
    return res.json();
  },

  async resetPassword(token, newPassword) {
    const res = await fetch(`${this.baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reset password');
    }
    return res.json();
  },

  async getMe() {
    if (!this.token) throw new Error('Not logged in');
    const res = await fetch(`${this.baseUrl}/auth/me`, {
      headers: this.getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to get user');
    }
    const user = await res.json();
    this.currentUser = user;
    localStorage.setItem('champUser', JSON.stringify(user));
    return user;
  },

  async setTheme(theme) {
    const res = await fetch(`${this.baseUrl}/auth/me/theme`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ theme })
    });
    return res.json();
  },

  // ============ TEAMS ============
  async getTeams() {
    const res = await fetch(`${this.baseUrl}/teams`, {
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to get teams');
    return res.json();
  },

  async joinTeamByCode(code) {
    const res = await fetch(`${this.baseUrl}/teams/join-code`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ code })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to join team');
    }
    return res.json();
  },

  async createTeam(name) {
    const res = await fetch(`${this.baseUrl}/teams`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create team');
    }
    return res.json();
  },

  async getTeamMembers(teamId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/members`, {
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to get team members');
    return res.json();
  },

  async updateMemberRole(teamId, userId, role) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/members/${userId}/role`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ role })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update role');
    }
    return res.json();
  },

  async removeTeamMember(teamId, userId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to remove member');
    }
    return res.json();
  },

  async getTeamStats(teamId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/stats`, {
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to get team stats');
    return res.json();
  },

  async getActivityFeed(teamId, limit = 20) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/activity?limit=${limit}`, {
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to get activity feed');
    return res.json();
  },

  // ============ TASKS ============
  async getTasks(teamId, filter = null) {
    let url = `${this.baseUrl}/teams/${teamId}/tasks`;
    if (filter === 'mine') url += '?filter=mine';
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to get tasks');
    return res.json();
  },

  async createTask(teamId, task) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/tasks`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(task)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create task');
    }
    return res.json();
  },

  async completeTask(teamId, taskId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to complete task');
    }
    return res.json();
  },

  async uncompleteTask(teamId, taskId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/tasks/${taskId}/uncomplete`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return res.json();
  },

  async deleteTask(teamId, taskId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete task');
    }
    return res.json();
  },

  async updateTask(teamId, taskId, updates) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update task');
    }
    return res.json();
  },

  async assignTask(teamId, taskId, assignedTo) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/tasks/${taskId}/assign`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ assignedTo })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to assign task');
    }
    return res.json();
  },

  // ============ ANALYTICS ============
  async getWeeklyAnalytics(teamId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/analytics/weekly`, {
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to get weekly analytics');
    return res.json();
  },

  async getMonthlyAnalytics(teamId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/analytics/monthly`, {
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to get monthly analytics');
    return res.json();
  },

  async getAnalyticsHistory(teamId, limit = 10) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/analytics/history?limit=${limit}`, {
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error('Failed to get analytics history');
    return res.json();
  },

  async generateSnapshot(teamId, period) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/analytics/snapshot`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ period })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to generate snapshot');
    }
    return res.json();
  },

  // ============ ADMIN ============
  async getAdminTeams() {
    const res = await fetch(`${this.baseUrl}/admin/teams`, {
      headers: this.getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to get teams');
    }
    return res.json();
  },

  async getAdminUsers(limit = 100, offset = 0) {
    const res = await fetch(`${this.baseUrl}/admin/users?limit=${limit}&offset=${offset}`, {
      headers: this.getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to get users');
    }
    return res.json();
  },

  async getAdminAnalytics() {
    const res = await fetch(`${this.baseUrl}/admin/analytics`, {
      headers: this.getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to get analytics');
    }
    return res.json();
  },

  async getAdminTeamDetails(teamId) {
    const res = await fetch(`${this.baseUrl}/admin/team/${teamId}`, {
      headers: this.getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to get team details');
    }
    return res.json();
  },

  async migrateFromJson() {
    const res = await fetch(`${this.baseUrl}/admin/migrate-from-json`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Migration failed');
    }
    return res.json();
  },

  async updateUserGlobalRole(userId, globalRole) {
    const res = await fetch(`${this.baseUrl}/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ globalRole })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update role');
    }
    return res.json();
  },

  async deleteTeam(teamId) {
    const res = await fetch(`${this.baseUrl}/admin/teams/${teamId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete team');
    }
    return res.json();
  },

  async getConfig() {
    const res = await fetch(`${this.baseUrl}/config`);
    if (!res.ok) throw new Error('Failed to get config');
    return res.json();
  },

  async getHealth() {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  }
};

window.API = API;