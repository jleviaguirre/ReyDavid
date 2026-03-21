// 1. YOUR APPS SCRIPT URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx6YoLahuA2UEON2r7RqT_Tym2soKTSfDXC2dzORSI36Oxc4igQ_cRf_d-Yj5fH2RaSVQ/exec";

// 2. GLOBAL STATE: This holds your CMS data while the user navigates
let siteData = { tabs: [], homeTiles: [], templates: {} };

// 3. INITIALIZATION: Run this the moment the app opens
window.onload = async () => {
    await loadHomeData();  // Step A: Get all the CMS data
    await checkUrlForToken(); // Step B: Check if they are logging in
    renderUI(); // Step C: Paint the screen!
};

function applyGlobalSettings(settings) {
    if (!settings) return;

    // 1. Meta Data (SEO & Browser Tabs)
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

    // 2. Theme & CSS Styles
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

    // 3. Components (Header & Footer Overrides)
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

    // 4. Custom Head Component (Fonts, Analytics, Global Scripts)
    if (settings.component && settings.component.head) {
        // Step A: Remove any previously injected head elements to prevent duplicates on reload
        document.querySelectorAll('[data-cms-head="true"]').forEach(el => el.remove());

        // Step B: Create a fragment (This allows <script> tags to actually execute!)
        const fragment = document.createRange().createContextualFragment(settings.component.head);

        // Step C: Tag each new element so we can find it later for the cleanup step
        Array.from(fragment.childNodes).forEach(node => {
            if (node.nodeType === 1) { // If it is an actual HTML element
                node.setAttribute('data-cms-head', 'true');
            }
        });

        // Step D: Inject it into the <head> of the document!
        document.head.appendChild(fragment);
    }
}

// --- DATA FETCHING ---
async function loadHomeData() {
    try {
        const savedUser = JSON.parse(localStorage.getItem('rey_david_user'));
        const userEmail = savedUser ? savedUser.email : null;

        // Show loader in the main dynamic container while downloading the CMS blueprint
        const container = document.getElementById('page-dynamic');
        if (container) {
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

            renderUI(); // Paints the menu

            // ✨ Magic Step: Now that data is loaded, let the Hash Router decide what to show!
            handleRouting();
        }

    } catch (error) {
        document.getElementById('page-dynamic').innerHTML = "<p style='text-align:center;'>Failed to load CMS content.</p>";
    }
}

// --- CORE RENDERING ENGINE ---
function renderUI() {
    const savedUser = JSON.parse(localStorage.getItem('rey_david_user'));
    renderMenu(savedUser);

    // ✨ Fire the router so it reads the URL on hard refresh!
    handleRouting();
}

function renderMenu(user) {
    const menuUl = document.getElementById('menu-items');
    const bottomNav = document.getElementById('bottom-app-nav');

    if (menuUl) menuUl.innerHTML = '';
    if (bottomNav) bottomNav.innerHTML = '';

    if (!siteData.menu || siteData.menu.length === 0) return;

    const menuTree = { main: [] };
    const appNavItems = []; // ✨ Holds the bottom menu items

    siteData.menu.forEach(item => {
        const isHidden = (item.hidden === true || String(item.hidden).toUpperCase() === 'TRUE');
        const isPublic = (item.public === true || String(item.public).toUpperCase() === 'TRUE');
        const isAppMenu = (item.app === true || String(item.app).toUpperCase() === 'TRUE');

        if (isHidden) return;
        if (!user && !isPublic) return;
        if (user && item.page && item.page.trim().toLowerCase() === 'login') return;

        // Split logic: Does it go top or bottom?
        if (isAppMenu) {
            appNavItems.push(item);
        } else {
            const category = (item.category && item.category.trim() !== "") ? item.category.trim() : 'main';
            if (!menuTree[category]) menuTree[category] = [];
            menuTree[category].push(item);
        }
    });

    // --- Helper: Generate Link Data ---
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

    // --- 1. BUILD TOP NAVIGATION ---
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

    // --- 2. BUILD BOTTOM APP NAVIGATION ---
    if (bottomNav && appNavItems.length > 0) {
        let bottomHtml = "";
        appNavItems.forEach(item => {
            const route = getRoutingData(item);
            let iconHtml = '<i class="fa fa-circle"></i>'; // Default fallback

            if (item.icon) {
                let rawIcon = item.icon.trim();
                // We don't wrap these in extra spans, we put them directly inside .bottom-nav-icon so CSS can strictly control them
                if (rawIcon.toLowerCase().startsWith("http")) {
                    iconHtml = `<img src="${rawIcon}" alt="${item.name}">`;
                } else {
                    iconHtml = rawIcon;
                }
            }

            // data-nav-target is used by the router to highlight the correct item
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

// --- BOTTOM NAV ANIMATION ENGINE ---
function updateBottomNavState() {
    const hash = window.location.hash.replace('#', '') || 'home';
    const items = document.querySelectorAll('#bottom-menu-items li');
    const indicator = document.getElementById('nav-indicator');

    if (!items.length || !indicator) return;

    items.forEach(li => {
        const a = li.querySelector('a');
        if (li.dataset.hash === hash) {
            a.classList.add('active');

            // Math for the sliding indicator!
            const ul = document.getElementById('bottom-menu-items');
            const leftPos = li.offsetLeft; // Where the item starts
            const width = li.offsetWidth;  // How wide the item is

            indicator.style.width = `${width}px`;
            indicator.style.transform = `translateX(${leftPos}px)`;

            // Auto-scroll the nav horizontally if the item is off-screen
            ul.scrollTo({ left: leftPos - (ul.offsetWidth / 2) + (width / 2), behavior: 'smooth' });
        } else {
            a.classList.remove('active');
        }
    });
}

// --- THE DYNAMIC ROUTER ---
window.openDynamicPage = function (pageTitle, updateHash = true) {
    const pageKey = pageTitle.replace(/\s+/g, '_').toLowerCase();
    const user = JSON.parse(localStorage.getItem('rey_david_user')); // Get current user

    if (updateHash) {
        window.location.hash = pageKey;
    }

    if (typeof siteData !== 'undefined' && siteData.settings && siteData.settings.page && siteData.settings.page[pageKey]) {
        const pageData = siteData.settings.page[pageKey];

        // Handle both simple strings (old way) and objects (new way with public flag)
        const rawCode = typeof pageData === 'string' ? pageData : (pageData.value || pageData.html || "");
        const isPublic = typeof pageData === 'object' && (pageData.public === true || String(pageData.public).toUpperCase() === 'TRUE');

        // 🛡️ THE ACCESS GATE: If no user AND the page isn't public (and it's not the home page)
        if (!user && !isPublic && pageKey !== 'home') {
            window.location.hash = 'login';
            showPage('login', false);
            return; // Stop execution!
        }

        const container = document.getElementById('page-dynamic');
        container.innerHTML = window.getLoaderHtml(pageTitle);
        showPage('dynamic', false);

        setTimeout(() => {
            container.innerHTML = `<div id="dynamic-module-content"></div>`;
            renderDynamicModule(rawCode, 'dynamic-module-content');
        }, 10);
    } else {
        console.log(`Almost there! Please add a row in _SETTINGS -> category: page | name: ${pageKey}`);
        showPage('home');
    }
};

// --- AUTHENTICATION ---
async function checkUrlForToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {

        const container = document.getElementById('page-dynamic');
        if (container) {
            container.style.display = 'block';
            container.innerHTML = window.getLoaderHtml("secure link");
        }

        try {
            const response = await fetch(`${SCRIPT_URL}?token=${token}`);
            const result = await response.json();

            if (result.status === "success") {
                localStorage.setItem('rey_david_user', JSON.stringify(result.user));
                await loadHomeData();
                window.history.replaceState({}, document.title, window.location.pathname);

                if (typeof window.openDynamicPage === 'function') {
                    window.location.hash = 'settings';
                    window.openDynamicPage('settings', false);
                }
            } else {
                document.getElementById('login-message').innerText = "Link expired. Please request a new one.";
            }
        } catch (error) {
            document.getElementById('login-message').innerText = "Verification failed.";
        }
    }
}


function logout() {
    localStorage.removeItem('rey_david_user');
    window.location.hash = 'home'; // ✨ Reset the URL to home
    renderUI();
}

// --- UI HELPERS ---
function showPage(pageId, updateHash = true) {
    if (updateHash && pageId !== 'dynamic') {
        window.location.hash = pageId;
    }

    const loginPage = document.getElementById('page-login');
    if (loginPage) loginPage.style.display = 'none';

    const dynamicPage = document.getElementById('page-dynamic');
    if (dynamicPage) dynamicPage.style.display = 'none';

    // Show the requested page
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) targetPage.style.display = 'block';

    const nav = document.getElementById('main-nav');
    if (nav) nav.classList.remove('active');
}

function toggleMenu() {
    const nav = document.getElementById('main-nav');
    nav.classList.toggle('active');
}

// Close menu when a link inside it is clicked
document.getElementById('main-nav').addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
        document.getElementById('main-nav').classList.remove('active');
    }
});

function renderDynamicModule(rawCode, targetContainerId) {
    const container = document.getElementById(targetContainerId);
    if (!container || !rawCode) return;

    container.innerHTML = rawCode;

    const scripts = container.querySelectorAll('script');
    scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
        });
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });
}

function getContrastYIQ(hexcolor) {
    if (!hexcolor) return 'white';
    hexcolor = hexcolor.replace("#", "");
    if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(hex => hex + hex).join('');
    const r = parseInt(hexcolor.substr(0, 2), 16), g = parseInt(hexcolor.substr(2, 2), 16), b = parseInt(hexcolor.substr(4, 2), 16);
    return (((r * 299) + (g * 587) + (b * 114)) / 1000 >= 128) ? 'black' : 'white';
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

    // Phase 1: INSTANT RENDER FROM CACHE
    const cachedString = localStorage.getItem(cacheKey);
    if (cachedString) {
        try {
            const cachedData = JSON.parse(cachedString);
            renderCallback(cachedData);
        } catch (e) {
            console.error("Cache parsing error", e);
        }
    }

    // Phase 2 & 3: BACKGROUND FETCH & UPDATE
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
        console.error(`[SWR] Fetch failed for ${action}.`, error);
        if (!cachedString && containerId) {
            const container = document.getElementById(containerId);
            if (container) container.innerHTML = '<p style="text-align:center; color: #f44336;">Error de red.</p>';
        }
    }
};

// ✨ Optional but helpful: A global helper to wipe a specific cache when you save/delete data
window.clearCacheFor = function (action) {
    localStorage.removeItem('cache_' + action);
};


// --- URL HASH ROUTER ---
// Listens for the browser's Back/Forward buttons
window.addEventListener('hashchange', handleRouting);

function handleRouting() {
    // 1. Instantly close the top mobile menu on ANY navigation
    const nav = document.getElementById('main-nav');
    if (nav && nav.classList.contains('active')) {
        nav.classList.remove('active');
    }

    // 2. Determine the current page
    let hash = window.location.hash.replace('#', '');
    if (!hash) hash = 'home'; // Default to home

    // 3. Highlight the active Bottom Menu item
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        if (item.getAttribute('data-nav-target') === hash) {
            item.classList.add('active');
            // Auto-scroll the menu so the active item is always perfectly visible
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            item.classList.remove('active');
        }
    });

    const container = document.getElementById('page-dynamic');

    // --- ROUTE 1: LOGIN PAGE ---
    if (hash === 'login') {
        if (typeof window.openDynamicPage === 'function') {
            window.openDynamicPage('login', false);
        }
    }
    // --- ROUTE 2: THE DYNAMIC HOME INJECTOR (_HOME Sheet) ---
    else if (hash === 'home') {
        container.style.display = 'block';

        if (siteData && siteData.homeTiles) {
            let homeHtml = '';
            const user = JSON.parse(localStorage.getItem('rey_david_user'));

            siteData.homeTiles.forEach(tile => {
                // Check auth requirements
                const reqAuth = (tile.requires_auth === true || String(tile.requires_auth).toUpperCase() === 'TRUE');
                if (reqAuth && !user) return; // Skip private rows if the user is not logged in

                // Inject the exact raw code from the spreadsheet, with ZERO extra wrappers!
                if (tile.html) {
                    homeHtml += tile.html;
                } else if (tile.contents) {
                    homeHtml += tile.contents; // Fallback in case some rows use a 'contents' column
                }
            });

            container.innerHTML = homeHtml;
        } else {
            // ✨ The glowing Skeleton Loader for the Home Page
            container.innerHTML = `
                <style>
                    .skel-wrapper { display: flex; flex-direction: column; gap: 15px; padding: 10px 0; }
                    .skel-box { background: #e2e8f0; border-radius: 12px; position: relative; overflow: hidden; }
                    /* The glowing shimmer effect */
                    .skel-box::after {
                        content: ""; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
                        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
                        animation: shimmer 1.2s infinite ease-in-out;
                    }
                    @keyframes shimmer { 100% { left: 200%; } }
                    
                    /* Skeleton Shapes */
                    .skel-hero { height: 180px; width: 100%; }
                    .skel-row { display: flex; gap: 15px; }
                    .skel-half { height: 140px; flex: 1; }
                </style>
                <div class="skel-wrapper">
                    <div class="skel-box skel-hero"></div>
                    <div class="skel-row">
                        <div class="skel-box skel-half"></div>
                        <div class="skel-box skel-half"></div>
                    </div>
                    <div class="skel-box skel-hero" style="height: 100px;"></div>
                </div>
            `;
        }
    }
    // --- ROUTE 3: DYNAMIC CMS PAGES (_SETTINGS Sheet) ---
    else if (siteData && siteData.settings && siteData.settings.page && siteData.settings.page[hash]) {
        const pageData = siteData.settings.page[hash];
        const isPublic = (pageData.public === true || String(pageData.public).toUpperCase() === "TRUE");
        window.openDynamicPage(hash, !isPublic);
    }
    // --- ROUTE 4: THE 404 REDIRECT ---
    else {
        if (hash !== '404') {
            window.location.hash = '404';
        } else {
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

//not being used instead we updated the fetchDynamicData engine
window.fetchWithSWR = async function (action, cacheKey, renderCallback) {
    // Phase 1: INSTANT RENDER (The "Stale" part)
    const cachedString = localStorage.getItem(cacheKey);
    if (cachedString) {
        try {
            const cachedData = JSON.parse(cachedString);
            renderCallback(cachedData); // Instantly paint the screen!
        } catch (e) {
            console.error("Cache parsing error", e);
        }
    } else {
        // If no cache exists, you could optionally show a loader here
        console.log(`[SWR] No cache found for ${cacheKey}. Fetching fresh...`);
    }

    // Phase 2: BACKGROUND FETCH (The "Revalidate" part)
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: action })
        });
        const freshData = await response.json();

        // Phase 3: COMPARE AND UPDATE
        const freshString = JSON.stringify(freshData);

        if (freshString !== cachedString) {
            localStorage.setItem(cacheKey, freshString); // Save new data permanently
            renderCallback(freshData); // Re-render the screen with new data
            console.log(`[SWR] ${cacheKey} was updated in the background.`);
        } else {
            console.log(`[SWR] ${cacheKey} is already up to date.`);
        }
    } catch (error) {
        console.error(`[SWR] Background fetch failed for ${action}. User is viewing offline cache.`, error);
    }
};

// =========================================
// SMART SCROLL HEADER LOGIC
// =========================================
let lastScrollTop = 0;
const header = document.querySelector('header');

window.addEventListener('scroll', function () {
    // Get current scroll position
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const nav = document.getElementById('main-nav');

    // Check if the mobile menu is open
    if (nav && nav.classList.contains('active')) {
        // If they scroll more than 10 pixels, assume they want to view the page and close the menu!
        if (Math.abs(scrollTop - lastScrollTop) > 10) {
            nav.classList.remove('active');
        } else {
            // Ignore tiny accidental jitters so the menu stays open
            return;
        }
    }

    // If scrolling DOWN, and we have scrolled past the header's height...
    if (scrollTop > lastScrollTop && scrollTop > 70) {
        // Hide the header by pushing it up off the screen
        header.style.top = "-100px";
    } else {
        // If scrolling UP, bring it back down!
        header.style.top = "0";
    }

    // Update the last scroll position for the next movement
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
});
