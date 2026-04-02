// 1. YOUR APPS SCRIPT URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx6YoLahuA2UEON2r7RqT_Tym2soKTSfDXC2dzORSI36Oxc4igQ_cRf_d-Yj5fH2RaSVQ/exec";

// ✨ CAPTURAR REDIRECCIÓN DESDE EL CORREO (MAGIC LINK)
const urlParams = new URLSearchParams(window.location.search);
const destParam = urlParams.get('dest');
if (destParam) {
    sessionStorage.setItem('returnAfterLogin', destParam);
}

// 2. GLOBAL STATE
let siteData = { tabs: [], homeTiles: [], templates: {} };

// 3. INITIALIZATION: Run this the moment the app opens
window.onload = async () => {
    // ✨ FIX: Orden estricto de ejecución para evitar sobrescribir rutas
    await checkUrlForToken(); // A. Valida el token y ajusta la ruta destino
    await loadHomeData();     // B. Descarga CMS y dibuja la UI a la ruta correcta
};

function applyGlobalSettings(settings) {
    if (!settings) return;
    if (settings.meta) {
        if (settings.meta.title) document.title = settings.meta.title;
        if (settings.meta.description) {
            let descTag = document.querySelector('meta[name="description"]');
            if (!descTag) {
                descTag = document.createElement('meta');
                descTag.name = "description";
                document.head.appendChild(descTag);
            }
            descTag.content = settings.meta.description;
        }
        if (settings.meta.favicon) {
            let favTag = document.querySelector('link[rel="icon"]');
            if (!favTag) {
                favTag = document.createElement('link');
                favTag.rel = "icon";
                document.head.appendChild(favTag);
            }
            favTag.href = settings.meta.favicon;
        }
    }
    if (settings.theme) {
        let customStyleTag = document.getElementById('dynamic-theme-styles');
        if (!customStyleTag) {
            customStyleTag = document.createElement('style');
            customStyleTag.id = 'dynamic-theme-styles';
            document.head.appendChild(customStyleTag);
        }
        let cssContent = "";
        if (settings.theme.css_variables) cssContent += settings.theme.css_variables + "\n";
        if (settings.theme.global_css) cssContent += settings.theme.global_css + "\n";
        customStyleTag.innerHTML = cssContent;
    }
    if (settings.component) {
        if (settings.component.header) {
            let headerEl = document.getElementById('dynamic-header');
            if (!headerEl) {
                headerEl = document.createElement('div');
                headerEl.id = 'dynamic-header';
                document.body.insertBefore(headerEl, document.body.firstChild);
            }
            headerEl.innerHTML = settings.component.header;
        }
        if (settings.component.footer) {
            let footerEl = document.getElementById('dynamic-footer');
            if (!footerEl) {
                footerEl = document.createElement('div');
                footerEl.id = 'dynamic-footer';
                document.body.appendChild(footerEl);
            }
            footerEl.innerHTML = settings.component.footer;
        }
    }
    if (settings.component && settings.component.head) {
        document.querySelectorAll('[data-cms-head="true"]').forEach(el => el.remove());
        const fragment = document.createRange().createContextualFragment(settings.component.head);
        Array.from(fragment.childNodes).forEach(node => {
            if (node.nodeType === 1) { node.setAttribute('data-cms-head', 'true'); }
        });
        document.head.appendChild(fragment);
    }
}

// --- DATA FETCHING ---
async function loadHomeData() {
    try {
        const savedUser = JSON.parse(localStorage.getItem('rey_david_user'));
        const userEmail = savedUser ? savedUser.email : null;

        const container = document.getElementById('page-dynamic');
        if (container && window.location.hash !== '#login') {
            container.style.display = 'block';
            container.innerHTML = window.getLoaderHtml("...");
        }

        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "getHomeData", email: userEmail })
        });
        const data = await response.json();

        if (data.status === "denied") {
            localStorage.removeItem('rey_david_user');
            alert("Your access has been revoked. Please contact an administrator.");
            window.location.reload();
            return;
        }

        if (data.status === "success") {
            siteData = data;
            applyGlobalSettings(siteData.settings);

            if (data.userProfile) localStorage.setItem('rey_david_user', JSON.stringify(data.userProfile));
            if (data.blueprint) localStorage.setItem('rey_david_blueprint', JSON.stringify(data.blueprint));

            // ✨ FIX: RenderUI dibujará el menú y automáticamente lanzará el Route correcto
            renderUI(); 
        }
    } catch (error) {
        document.getElementById('page-dynamic').innerHTML = "<p style='text-align:center;'>Failed to load CMS content.</p>";
    }
}

// --- CORE RENDERING ENGINE ---
function renderUI() {
    const savedUser = JSON.parse(localStorage.getItem('rey_david_user'));
    renderMenu(savedUser);
    handleRouting(); // Ejecuta el enrutador
}

function renderMenu(user) {
    const menuUl = document.getElementById('menu-items');
    const bottomNav = document.getElementById('bottom-app-nav');

    if (menuUl) menuUl.innerHTML = '';
    if (bottomNav) bottomNav.innerHTML = '';

    if (!siteData.menu || siteData.menu.length === 0) return;

    const menuTree = { main: [] };
    const appNavItems = [];

    siteData.menu.forEach(item => {
        const isHidden = (item.hidden === true || String(item.hidden).toUpperCase() === 'TRUE');
        const isPublic = (item.public === true || String(item.public).toUpperCase() === 'TRUE');
        const isAppMenu = (item.app === true || String(item.app).toUpperCase() === 'TRUE');

        if (isHidden) return;
        if (!user && !isPublic) return;
        if (user && item.page && item.page.trim().toLowerCase() === 'login') return;

        if (isAppMenu) {
            appNavItems.push(item);
        } else {
            const category = (item.category && item.category.trim() !== "") ? item.category.trim() : 'main';
            if (!menuTree[category]) menuTree[category] = [];
            menuTree[category].push(item);
        }
    });

    function getRoutingData(item) {
        let href = "#";
        let onclick = "";
        let target = "";
        let pageKey = "";

        if (item.page) {
            let pageStr = item.page.trim();
            if (pageStr.toLowerCase() === "logout") {
                onclick = `onclick="logout(); return false;"`;
            } else if (pageStr.startsWith("http")) {
                href = pageStr;
                target = `target="_blank"`;
            } else {
                pageKey = pageStr.replace(/\s+/g, '_').toLowerCase();
                href = `#${pageKey}`;
            }
        }
        return { href, onclick, target, pageKey };
    }

    function buildTopLinkHtml(item, route) {
        let iconHtml = "";
        if (item.icon) {
            let rawIcon = item.icon.trim();
            if (rawIcon.toLowerCase().startsWith("<svg")) iconHtml = `<span class="menu-icon">${rawIcon}</span>`;
            else if (rawIcon.toLowerCase().startsWith("http")) iconHtml = `<img src="${rawIcon}" class="menu-icon-img" alt="icon">`;
            else iconHtml = `<span class="menu-icon">${rawIcon}</span>`;
        }
        let descAttr = item.description ? `title="${item.description}"` : "";
        return `<a href="${route.href}" ${route.target} ${route.onclick} ${descAttr}>${iconHtml} <span class="menu-text">${item.name || ""}</span></a>`;
    }

    menuTree.main.forEach(item => {
        let li = document.createElement('li');
        li.innerHTML = buildTopLinkHtml(item, getRoutingData(item));
        menuUl.appendChild(li);
    });

    Object.keys(menuTree).forEach(category => {
        if (category === 'main') return;
        let dropLi = document.createElement('li');
        dropLi.className = "dropdown";
        dropLi.innerHTML = `<a href="#" class="dropdown-toggle" onclick="return false;"><span class="menu-text">${category}</span> ▾</a>`;
        let dropUl = document.createElement('ul');
        dropUl.className = "dropdown-menu";
        menuTree[category].forEach(item => {
            let itemLi = document.createElement('li');
            itemLi.innerHTML = buildTopLinkHtml(item, getRoutingData(item));
            dropUl.appendChild(itemLi);
        });
        dropLi.appendChild(dropUl);
        menuUl.appendChild(dropLi);
    });

    if (bottomNav && appNavItems.length > 0) {
        let bottomHtml = "";
        appNavItems.forEach(item => {
            const route = getRoutingData(item);
            let iconHtml = '<i class="fa fa-circle"></i>';
            if (item.icon) {
                let rawIcon = item.icon.trim();
                if (rawIcon.toLowerCase().startsWith("http")) {
                    iconHtml = `<img src="${rawIcon}" alt="${item.name}">`;
                } else {
                    iconHtml = rawIcon;
                }
            }
            bottomHtml += `
                <a href="${route.href}" ${route.target} ${route.onclick} class="bottom-nav-item" data-nav-target="${route.pageKey}">
                    <div class="bottom-nav-icon">${iconHtml}</div>
                    <span class="bottom-nav-text">${item.name || ""}</span>
                </a>
            `;
        });
        bottomNav.innerHTML = bottomHtml;
    }
}

// --- DYNAMIC ROUTER ---
window.openDynamicPage = function (pageTitle, updateHash = true) {
    const pageKey = pageTitle.replace(/\s+/g, '_').toLowerCase();
    const user = JSON.parse(localStorage.getItem('rey_david_user'));

    if (updateHash) { window.location.hash = pageKey; }

    if (typeof siteData !== 'undefined' && siteData.settings && siteData.settings.page && siteData.settings.page[pageKey]) {
        const pageData = siteData.settings.page[pageKey];
        const rawCode = typeof pageData === 'string' ? pageData : (pageData.value || pageData.html || "");
        const isPublic = typeof pageData === 'object' && (pageData.public === true || String(pageData.public).toUpperCase() === 'TRUE');

        if (!user && !isPublic && pageKey !== 'home') {
            sessionStorage.setItem('returnAfterLogin', pageKey);
            window.location.hash = 'login';
            showPage('login', false);
            return; 
        }

        const container = document.getElementById('page-dynamic');
        container.innerHTML = window.getLoaderHtml(pageTitle);
        showPage('dynamic', false);

        setTimeout(() => {
            container.innerHTML = `<div id="dynamic-module-content"></div>`;
            renderDynamicModule(rawCode, 'dynamic-module-content');
        }, 10);
    } else {
        console.log(`Página no encontrada: ${pageKey}`);
        showPage('home');
    }
};

// --- AUTHENTICATION (REBUILT FOR STABILITY) ---
async function checkUrlForToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
        const container = document.getElementById('page-dynamic');
        if (container) {
            container.style.display = 'block';
            container.innerHTML = window.getLoaderHtml("validando acceso");
        }

        try {
            // Pedimos validación al backend
            const response = await fetch(`${SCRIPT_URL}?token=${token}`);
            const result = await response.json();

            if (result.status === "success") {
                // Guardamos al usuario
                localStorage.setItem('rey_david_user', JSON.stringify(result.user));
                
                // Limpiamos la URL sin recargar la página (borra el ?token=123&dest=settings)
                window.history.replaceState({}, document.title, window.location.pathname);

                // ✨ FIX: Leemos el destino guardado y preparamos el Hash
                const intendedPage = sessionStorage.getItem('returnAfterLogin');
                if (intendedPage) {
                    sessionStorage.removeItem('returnAfterLogin');
                    window.location.hash = intendedPage;
                } else {
                    window.location.hash = 'home';
                }
            } else {
                alert("El enlace ha expirado o es inválido. Por favor, solicita uno nuevo.");
            }
        } catch (error) {
            console.error("Token error", error);
            alert("Error de conexión al validar el acceso.");
        }
    }
}

function logout() {
    localStorage.removeItem('rey_david_user');
    window.location.hash = 'home';
    renderUI();
}

// --- UI HELPERS ---
function showPage(pageId, updateHash = true) {
    if (updateHash && pageId !== 'dynamic') window.location.hash = pageId;
    const loginPage = document.getElementById('page-login');
    if (loginPage) loginPage.style.display = 'none';
    const dynamicPage = document.getElementById('page-dynamic');
    if (dynamicPage) dynamicPage.style.display = 'none';
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) targetPage.style.display = 'block';
    const nav = document.getElementById('main-nav');
    if (nav) nav.classList.remove('active');
}

function toggleMenu() {
    const nav = document.getElementById('main-nav');
    nav.classList.toggle('active');
}

document.getElementById('main-nav').addEventListener('click', (e) => {
    if (e.target.tagName === 'A') document.getElementById('main-nav').classList.remove('active');
});

function renderDynamicModule(rawCode, targetContainerId) {
    const container = document.getElementById(targetContainerId);
    if (!container || !rawCode) return;
    container.innerHTML = rawCode;
    const scripts = container.querySelectorAll('script');
    scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });
}

// --- GLOBAL UI HELPERS ---
window.getLoaderHtml = function (pageName = "content") {
    return `
<div class="loader-wrapper">
  <div class="sacred-container">
    <svg class="monstrance" viewBox="0 0 100 100">
      <g class="rays" stroke="#fff" stroke-width="1" stroke-linecap="butt">
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(0 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(30 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(60 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(90 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(120 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(150 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(180 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(210 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(240 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(270 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(300 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(330 50 50)" />
      </g>
      <circle cx="50" cy="50" r="18" fill="#fff" />
    </svg>
    <div class="glow"></div>
  </div>
  <p class="loading-text">Loading ${pageName}</p>
</div>
    `;
};

window.fetchDynamicData = async function (action, containerId, renderCallback) {
    const cacheKey = 'cache_' + action;
    const cachedString = localStorage.getItem(cacheKey);
    if (cachedString) {
        try { renderCallback(JSON.parse(cachedString)); } catch (e) {}
    }
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: action })
        });
        const freshData = await response.json();
        const freshString = JSON.stringify(freshData);
        if (freshString !== cachedString) {
            localStorage.setItem(cacheKey, freshString);
            renderCallback(freshData);
        }
    } catch (error) {
        if (!cachedString && containerId) {
            const container = document.getElementById(containerId);
            if (container) container.innerHTML = '<p style="text-align:center; color: #f44336;">Error de red.</p>';
        }
    }
};

window.clearCacheFor = function (action) {
    localStorage.removeItem('cache_' + action);
};

// --- URL HASH ROUTER ---
window.addEventListener('hashchange', handleRouting);

function handleRouting() {
    const nav = document.getElementById('main-nav');
    if (nav && nav.classList.contains('active')) nav.classList.remove('active');

    let hash = window.location.hash.replace('#', '');
    if (!hash) hash = 'home'; 

    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        if (item.getAttribute('data-nav-target') === hash) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            item.classList.remove('active');
        }
    });

    const container = document.getElementById('page-dynamic');

    if (hash === 'login') {
        if (typeof window.openDynamicPage === 'function') window.openDynamicPage('login', false);
    }
    else if (hash === 'home') {
        container.style.display = 'block';
        if (siteData && siteData.homeTiles) {
            let homeHtml = '';
            const user = JSON.parse(localStorage.getItem('rey_david_user'));
            siteData.homeTiles.forEach(tile => {
                const reqAuth = (tile.requires_auth === true || String(tile.requires_auth).toUpperCase() === 'TRUE');
                if (reqAuth && !user) return; 
                if (tile.html) homeHtml += tile.html;
                else if (tile.contents) homeHtml += tile.contents;
            });
            container.innerHTML = homeHtml;
        } else {
            container.innerHTML = `
                <style>
                    .skel-wrapper { display: flex; flex-direction: column; gap: 15px; padding: 10px 0; }
                    .skel-box { background: #e2e8f0; border-radius: 12px; position: relative; overflow: hidden; }
                    .skel-box::after {
                        content: ""; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
                        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
                        animation: shimmer 1.2s infinite ease-in-out;
                    }
                    @keyframes shimmer { 100% { left: 200%; } }
                    .skel-hero { height: 180px; width: 100%; }
                    .skel-row { display: flex; gap: 15px; }
                    .skel-half { height: 140px; flex: 1; }
                </style>
                <div class="skel-wrapper">
                    <div class="skel-box skel-hero"></div>
                    <div class="skel-row"><div class="skel-box skel-half"></div><div class="skel-box skel-half"></div></div>
                    <div class="skel-box skel-hero" style="height: 100px;"></div>
                </div>
            `;
        }
    }
    else if (siteData && siteData.settings && siteData.settings.page && siteData.settings.page[hash]) {
        const pageData = siteData.settings.page[hash];
        const isPublic = (pageData.public === true || String(pageData.public).toUpperCase() === "TRUE");
        window.openDynamicPage(hash, !isPublic);
    }
    else {
        if (hash !== '404') { window.location.hash = '404'; } 
        else {
            container.style.display = 'block';
            container.innerHTML = `
                <div style="text-align:center; padding: 60px 20px;">
                    <h1 style="color:#003366; font-size:5em; margin:0;">404</h1>
                    <h2 style="color:#333; margin-top:10px;">Page Not Found</h2>
                    <p style="color:#666;">The page you are looking for does not exist or has been moved.</p>
                    <button onclick="window.location.hash='home'" style="background:#003366; color:white; padding:12px 25px; border:none; border-radius:5px; cursor:pointer; margin-top:20px; font-weight:bold;">Return Home</button>
                </div>
            `;
        }
    }
}

// =========================================
// SMART SCROLL HEADER LOGIC
// =========================================
let lastScrollTop = 0;
const header = document.querySelector('header');
window.addEventListener('scroll', function () {
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const nav = document.getElementById('main-nav');
    if (nav && nav.classList.contains('active')) {
        if (Math.abs(scrollTop - lastScrollTop) > 10) nav.classList.remove('active');
        else return;
    }
    if (scrollTop > lastScrollTop && scrollTop > 70) header.style.top = "-100px";
    else header.style.top = "0";
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
});

//notification badge
window.updateDeviceBadge = async function(hasNewItems) {
    if ('setAppBadge' in navigator) {
        try {
            if (hasNewItems) await navigator.setAppBadge(); 
            else await navigator.clearAppBadge();
        } catch (error) {}
    }
};