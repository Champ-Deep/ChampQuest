/**
 * Champ Quest Multi-Team API Client (ES Module)
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
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  },

  isAdmin() {
    return this.currentUser?.globalRole === 'superadmin' ||
           (this.currentTeamId && this.userTeamRole === 'admin');
  },

  isSuperadmin() {
    return this.currentUser?.globalRole === 'superadmin';
  },

  // ============ AUTH ============
  async register(email, password, displayName) {
    const res = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Registration failed'); }
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
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Login failed'); }
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
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to send reset link'); }
    return res.json();
  },

  async resetPassword(token, newPassword) {
    const res = await fetch(`${this.baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to reset password'); }
    return res.json();
  },

  async getMe() {
    if (!this.token) throw new Error('Not logged in');
    const res = await fetch(`${this.baseUrl}/auth/me`, { headers: this.getHeaders() });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to get user'); }
    const user = await res.json();
    this.currentUser = user;
    localStorage.setItem('champUser', JSON.stringify(user));
    return user;
  },

  async updateProfile(updates) {
    const res = await fetch(`${this.baseUrl}/auth/me/profile`, {
      method: 'PATCH', headers: this.getHeaders(), body: JSON.stringify(updates)
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to update profile'); }
    return res.json();
  },

  async setTheme(theme) {
    const res = await fetch(`${this.baseUrl}/auth/me/theme`, {
      method: 'PATCH', headers: this.getHeaders(), body: JSON.stringify({ theme })
    });
    return res.json();
  },

  // ============ TEAMS ============
  async getTeams() {
    const res = await fetch(`${this.baseUrl}/teams`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to get teams');
    return res.json();
  },

  async joinTeamByCode(code) {
    const res = await fetch(`${this.baseUrl}/teams/join-code`, {
      method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ code })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to join team'); }
    return res.json();
  },

  async createTeam(name) {
    const res = await fetch(`${this.baseUrl}/teams`, {
      method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ name })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to create team'); }
    return res.json();
  },

  async getTeamMembers(teamId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/members`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to get team members');
    return res.json();
  },

  async updateMemberRole(teamId, userId, role) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/members/${userId}/role`, {
      method: 'PATCH', headers: this.getHeaders(), body: JSON.stringify({ role })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to update role'); }
    return res.json();
  },

  async removeTeamMember(teamId, userId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/members/${userId}`, {
      method: 'DELETE', headers: this.getHeaders()
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to remove member'); }
    return res.json();
  },

  async getTeamStats(teamId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/stats`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to get team stats');
    return res.json();
  },

  async getActivityFeed(teamId, limit = 20) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/activity?limit=${limit}`, { headers: this.getHeaders() });
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
      method: 'POST', headers: this.getHeaders(), body: JSON.stringify(task)
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to create task'); }
    return res.json();
  },

  async completeTask(teamId, taskId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/tasks/${taskId}/complete`, {
      method: 'POST', headers: this.getHeaders()
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to complete task'); }
    return res.json();
  },

  async uncompleteTask(teamId, taskId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/tasks/${taskId}/uncomplete`, {
      method: 'POST', headers: this.getHeaders()
    });
    return res.json();
  },

  async deleteTask(teamId, taskId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/tasks/${taskId}`, {
      method: 'DELETE', headers: this.getHeaders()
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to delete task'); }
    return res.json();
  },

  async updateTask(teamId, taskId, updates) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/tasks/${taskId}`, {
      method: 'PATCH', headers: this.getHeaders(), body: JSON.stringify(updates)
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to update task'); }
    return res.json();
  },

  async assignTask(teamId, taskId, assignedTo) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/tasks/${taskId}/assign`, {
      method: 'PATCH', headers: this.getHeaders(), body: JSON.stringify({ assignedTo })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to assign task'); }
    return res.json();
  },

  // ============ ANALYTICS ============
  async getWeeklyAnalytics(teamId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/analytics/weekly`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to get weekly analytics');
    return res.json();
  },

  async getMonthlyAnalytics(teamId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/analytics/monthly`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to get monthly analytics');
    return res.json();
  },

  async getAnalyticsHistory(teamId, limit = 10) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/analytics/history?limit=${limit}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to get analytics history');
    return res.json();
  },

  // ============ TASK STATUS ============
  async updateTaskStatus(teamId, taskId, status, blockerNote) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/tasks/${taskId}/status`, {
      method: 'PATCH', headers: this.getHeaders(), body: JSON.stringify({ status, blockerNote })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to update status'); }
    return res.json();
  },

  async getOverdueTasks(teamId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/tasks/overdue`, { headers: this.getHeaders() });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to get overdue tasks'); }
    return res.json();
  },

  // ============ TASK COMMENTS ============
  async getTaskComments(teamId, taskId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/tasks/${taskId}/comments`, { headers: this.getHeaders() });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to get comments'); }
    return res.json();
  },

  async addTaskComment(teamId, taskId, content) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/tasks/${taskId}/comments`, {
      method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ content })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to add comment'); }
    return res.json();
  },

  // ============ KUDOS ============
  async sendKudos(teamId, toUserId, message, emoji) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/kudos`, {
      method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ toUserId, message, emoji })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to send kudos'); }
    return res.json();
  },

  async getKudos(teamId, limit = 10) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/kudos?limit=${limit}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to get kudos');
    return res.json();
  },

  // ============ TEAM SETTINGS ============
  async getTeamSettings(teamId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/settings`, { headers: this.getHeaders() });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to get settings'); }
    return res.json();
  },

  async updateTeamSettings(teamId, settings) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/settings`, {
      method: 'PATCH', headers: this.getHeaders(), body: JSON.stringify(settings)
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to update settings'); }
    return res.json();
  },

  async testWebhook(teamId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/settings/test-webhook`, {
      method: 'POST', headers: this.getHeaders()
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Webhook test failed'); }
    return res.json();
  },

  async generateIncomingWebhook(teamId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/settings/incoming-webhook`, {
      method: 'POST', headers: this.getHeaders()
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to generate webhook'); }
    return res.json();
  },

  async disableIncomingWebhook(teamId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/settings/incoming-webhook`, {
      method: 'DELETE', headers: this.getHeaders()
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to disable webhook'); }
    return res.json();
  },

  // ============ CHALLENGES ============
  async getChallenges(teamId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/challenges`, { headers: this.getHeaders() });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to get challenges'); }
    return res.json();
  },

  async getAllChallenges(teamId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/challenges/all`, { headers: this.getHeaders() });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to get challenges'); }
    return res.json();
  },

  async createChallenge(teamId, challenge) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/challenges`, {
      method: 'POST', headers: this.getHeaders(), body: JSON.stringify(challenge)
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to create challenge'); }
    return res.json();
  },

  async updateChallenge(teamId, id, updates) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/challenges/${id}`, {
      method: 'PATCH', headers: this.getHeaders(), body: JSON.stringify(updates)
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to update challenge'); }
    return res.json();
  },

  async deleteChallenge(teamId, id) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/challenges/${id}`, {
      method: 'DELETE', headers: this.getHeaders()
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to delete challenge'); }
    return res.json();
  },

  async completeChallenge(teamId, id) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/challenges/${id}/complete`, {
      method: 'POST', headers: this.getHeaders()
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to complete challenge'); }
    return res.json();
  },

  // ============ ADMIN ============
  async getAdminTeams() {
    const res = await fetch(`${this.baseUrl}/admin/teams`, { headers: this.getHeaders() });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to get teams'); }
    return res.json();
  },

  async getAdminUsers(limit = 100, offset = 0) {
    const res = await fetch(`${this.baseUrl}/admin/users?limit=${limit}&offset=${offset}`, { headers: this.getHeaders() });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to get users'); }
    return res.json();
  },

  async getAdminAnalytics() {
    const res = await fetch(`${this.baseUrl}/admin/analytics`, { headers: this.getHeaders() });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to get analytics'); }
    return res.json();
  },

  async updateUserGlobalRole(userId, globalRole) {
    const res = await fetch(`${this.baseUrl}/admin/users/${userId}/role`, {
      method: 'PATCH', headers: this.getHeaders(), body: JSON.stringify({ globalRole })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to update role'); }
    return res.json();
  },

  async deleteTeam(teamId) {
    const res = await fetch(`${this.baseUrl}/admin/teams/${teamId}`, {
      method: 'DELETE', headers: this.getHeaders()
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to delete team'); }
    return res.json();
  },

  // ============ MEMBER ROLES ============
  async updateMemberFunctionalRole(teamId, userId, memberRole) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/members/${userId}/member-role`, {
      method: 'PATCH', headers: this.getHeaders(), body: JSON.stringify({ memberRole })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to update functional role'); }
    return res.json();
  },

  async getConfig() {
    const res = await fetch(`${this.baseUrl}/config`);
    if (!res.ok) throw new Error('Failed to get config');
    return res.json();
  },

  // ============ SPRINTS ============
  async getSprints(teamId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/sprints`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to get sprints');
    return res.json();
  },

  async createSprint(teamId, sprint) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/sprints`, {
      method: 'POST', headers: this.getHeaders(), body: JSON.stringify(sprint)
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to create sprint'); }
    return res.json();
  },

  async getSprintDetail(teamId, sprintId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/sprints/${sprintId}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to get sprint detail');
    return res.json();
  },

  async updateSprint(teamId, sprintId, updates) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/sprints/${sprintId}`, {
      method: 'PATCH', headers: this.getHeaders(), body: JSON.stringify(updates)
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to update sprint'); }
    return res.json();
  },

  async addTaskToSprint(teamId, sprintId, taskId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/sprints/${sprintId}/tasks`, {
      method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ taskId })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to add task to sprint'); }
    return res.json();
  },

  async removeTaskFromSprint(teamId, sprintId, taskId) {
    const res = await fetch(`${this.baseUrl}/teams/${teamId}/sprints/${sprintId}/tasks/${taskId}`, {
      method: 'DELETE', headers: this.getHeaders()
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to remove task from sprint'); }
    return res.json();
  },

  // ============ AI ============
  async aiChat(teamId, messages) {
    const res = await fetch(`${this.baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { ...this.getHeaders(), 'X-Team-Id': teamId },
      body: JSON.stringify({ messages })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'AI chat failed'); }
    return res;
  },

  async aiParseTasks(teamId, text) {
    const res = await fetch(`${this.baseUrl}/ai/parse-tasks`, {
      method: 'POST',
      headers: { ...this.getHeaders(), 'X-Team-Id': teamId },
      body: JSON.stringify({ text })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'AI parse failed'); }
    return res.json();
  }
};

export { API };
export default API;
