function renderSidebar(activePage) {
  const user = getUser() || {};
  const initials = (user.fullName || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  const links = [
    { page: 'dashboard', href: 'dashboard.html', icon: '&#9679;', label: 'Dashboard' },
    { page: 'records', href: 'records.html', icon: '&#128196;', label: 'Medical Records' },
    { page: 'appointments', href: 'appointments.html', icon: '&#128197;', label: 'Appointments' },
    { page: 'medications', href: 'medications.html', icon: '&#128138;', label: 'Medications' },
    { page: 'profile', href: 'profile.html', icon: '&#128100;', label: 'My Profile' },
  ];

  const linksHtml = links.map(l => `
    <a href="${l.href}" class="nav-link ${activePage === l.page ? 'active' : ''}">
      <span class="icon">${l.icon}</span> ${l.label}
    </a>
  `).join('');

  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="mark">+</div>
        <div class="name">Health Tracker</div>
      </div>
      ${linksHtml}
      <div class="sidebar-footer">
        <div class="sidebar-user">
          <strong>${escapeHtml(user.fullName || 'User')}</strong>
          ${escapeHtml(user.email || '')}
        </div>
        <button class="btn btn-outline btn-sm" style="width:100%; color:#fff; border-color: rgba(255,255,255,0.4);" onclick="logout()">Log Out</button>
      </div>
    </aside>
  `;
}
