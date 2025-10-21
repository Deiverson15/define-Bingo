// personali/frontend/js/admin.js

document.addEventListener('DOMContentLoaded', () => {
  const adminContent = document.getElementById('admin-main-content'); 

  if (adminContent) {
      adminContent.classList.remove('hidden');
      document.body.style.overflow = 'auto'; 
  }

  const user = Auth.getUser();

  const socket = io(SOCKET_URL);
  socket.on('connect', () => UI.toast('Conectado al servidor', 'success'));
  socket.on('disconnect', () => UI.toast('Desconectado del servidor', 'error'));
  
  socket.on('dashboard_update', () => {
    console.log("📢 Recibido 'dashboard_update', recargando todos los datos.");
    fetchAllAdminData(); 
  });
  
  socket.on('notifications_update', (counts) => {
      console.log('📢 Notificaciones recibidas:', counts);
      updateBadges(counts);
  });
  
  function updateBadges(counts) {
      if (!counts) return;
      const badgeMapping = {
          'badge-tickets': counts.tickets, 'badge-pagos': counts.pagos,
          'badge-juegos': counts.juegos, 'badge-sorteos': counts.sorteos,
          'badge-resultados': counts.resultados,
      };
      for (const badgeId in badgeMapping) {
          const badgeElement = document.getElementById(badgeId);
          if (badgeElement) {
              const count = badgeMapping[badgeId] || 0;
              badgeElement.textContent = count > 0 ? count : '';
          }
      }
  }

  const navLinks = { dashboard: document.getElementById('nav-dashboard'), tickets: document.getElementById('nav-tickets'), juegos: document.getElementById('nav-juegos'), sorteo: document.getElementById('nav-sorteo'), ganador: document.getElementById('nav-ganador'), reportes: document.getElementById('nav-reportes'), pagos: document.getElementById('nav-pagos'), resultados: document.getElementById('nav-resultados'), sessions: document.getElementById('nav-sessions') };
  const sections = { dashboard: document.getElementById('section-dashboard'), tickets: document.getElementById('section-tickets'), juegos: document.getElementById('section-juegos'), sorteo: document.getElementById('section-sorteo'), ganador: document.getElementById('section-ganador'), reportes: document.getElementById('section-reportes'), pagos: document.getElementById('section-pagos'), resultados: document.getElementById('section-resultados'), sessions: document.getElementById('section-sessions') };
  
  function switchTab(targetTab) {
    Object.values(sections).forEach(section => section && section.classList.add('hidden'));
    if (sections[targetTab]) sections[targetTab].classList.remove('hidden');
    Object.values(navLinks).forEach(link => link && link.classList.remove('nav-link-active'));
    if (navLinks[targetTab]) navLinks[targetTab].classList.add('nav-link-active');
    
    // LÍNEA AÑADIDA: Forzar la renderización de íconos en cada cambio de pestaña
    if (window.lucide) {
      lucide.createIcons();
    }
    
    document.dispatchEvent(new CustomEvent('tabChanged', { detail: { activeTab: targetTab } }));
  }
  
  Object.keys(navLinks).forEach(key => {
    if (navLinks[key]) navLinks[key].addEventListener('click', (e) => { e.preventDefault(); switchTab(key); });
  });

  const safeSetText = (id, text) => {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  };
  safeSetText('welcome-message', `Bienvenido de nuevo, ${user.username}`);
  document.getElementById('logout-button-sidebar')?.addEventListener('click', () => { Auth.logout(); window.location.href = 'index.html'; });

  async function fetchAllAdminData() {
    try {
        const [ticketsResponse, gananciasResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/api/admin/tickets`),
            fetch(`${API_BASE_URL}/api/admin/ganancias/stats`)
        ]);

        if (ticketsResponse.ok) {
            const allTickets = await ticketsResponse.json();
            document.dispatchEvent(new CustomEvent('globalTicketsLoaded', { detail: { tickets: allTickets } }));
        }

        if (gananciasResponse.ok) {
            const stats = await gananciasResponse.json();
            safeSetText('ganancias-hoy', `${stats.gananciasHoy} Bs`);
            safeSetText('ganancias-semana', `${stats.gananciasSemana} Bs`);
            safeSetText('ganancias-mes', `${stats.gananciasMes} Bs`);
        }

    } catch (error) {
        console.error('Error al cargar datos del dashboard:', error);
        UI.toast('No se pudieron cargar los datos del panel', 'error');
    }
  }

  fetchAllAdminData();
});

const UI = {
    openModal: (id) => document.getElementById(id)?.classList.remove('hidden'),
    closeModal: (id) => document.getElementById(id)?.classList.add('hidden'),
    toast: (msg, type = "info") => {
        if (window.Swal && Swal.mixin) {
            const T = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3500, timerProgressBar: true });
            T.fire({ icon: type, title: msg, background: '#0a1322', color: '#e6f1ef' });
        } else { console.log(`[${type.toUpperCase()}] ${msg}`); }
    },
    toggleActionsMenu: (event) => {
        event.stopPropagation();
        const menu = event.currentTarget.nextElementSibling;
        document.querySelectorAll('.actions-menu').forEach(m => { if (m !== menu) m.classList.add('hidden'); });
        menu.classList.toggle('hidden');
    }
};

document.addEventListener('click', () => {
  document.querySelectorAll('.actions-menu').forEach(menu => menu.classList.add('hidden'));
});