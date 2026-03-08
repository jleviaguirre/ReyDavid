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
    menuUl.innerHTML = '';

    if (!siteData.menu || siteData.menu.length === 0) return;

    // 1. Group the menu items by Category
    const menuTree = { main: [] };

    siteData.menu.forEach(item => {
        // Evaluate checkboxes safely
        const isHidden = (item.hidden === true || String(item.hidden).toUpperCase() === 'TRUE');
        const isPublic = (item.public === true || String(item.public).toUpperCase() === 'TRUE');

        // Bouncer: Skip if hidden, or if private and user is logged out
        if (isHidden) return;
        if (!user && !isPublic) return;
        
        // Hide the Login button if already logged in!
        if (user && item.page && item.page.trim().toLowerCase() === 'login') return; 

        const category = (item.category && item.category.trim() !== "") ? item.category.trim() : 'main';

        if (!menuTree[category]) menuTree[category] = [];
        menuTree[category].push(item);
    });

    // 2. Helper function to build individual links
    function buildLinkHtml(item) {
        let iconHtml = "";
        let textHtml = `<span class="menu-text">${item.name || ""}</span>`;
        let descAttr = item.description ? `title="${item.description}"` : "";

        // Handle SVG, Emoji, or Image URLs for icons
        if (item.icon) {
            let rawIcon = item.icon.trim();
            if (rawIcon.toLowerCase().startsWith("<svg")) {
                iconHtml = `<span class="menu-icon">${rawIcon}</span>`;
            } else if (rawIcon.toLowerCase().startsWith("http")) {
                iconHtml = `<img src="${rawIcon}" class="menu-icon-img" alt="icon">`;
            } else {
                iconHtml = `<span class="menu-icon">${rawIcon}</span>`; // Emoji or FontAwesome
            }
        }

        // Action routing (External URL vs App Page vs Logout)
        let href = "#";
        let onclick = "";
        let target = "";

        if (item.page) {
            let pageStr = item.page.trim();
            if (pageStr.toLowerCase() === "logout") {
                onclick = `onclick="logout(); return false;"`;
            } else if (pageStr.startsWith("http")) {
                href = pageStr;
                target = `target="_blank"`;
            } else {
                // It's a dynamic module (e.g., "library" -> "#library")
                href = `#${pageStr.replace(/\s+/g, '_').toLowerCase()}`;
            }
        }

        return `<a href="${href}" ${target} ${onclick} ${descAttr}>${iconHtml} ${textHtml}</a>`;
    }

    // 3. Render Top-Level Items
    menuTree.main.forEach(item => {
        let li = document.createElement('li');
        li.innerHTML = buildLinkHtml(item);
        menuUl.appendChild(li);
    });

    // 4. Render Dropdown Menus
    Object.keys(menuTree).forEach(category => {
        if (category === 'main') return;

        let dropLi = document.createElement('li');
        dropLi.className = "dropdown";

        // The Dropdown Trigger
        dropLi.innerHTML = `<a href="#" class="dropdown-toggle" onclick="return false;">
            <span class="menu-text">${category}</span> ▾
        </a>`;

        // The Dropdown Contents
        let dropUl = document.createElement('ul');
        dropUl.className = "dropdown-menu";

        menuTree[category].forEach(item => {
            let itemLi = document.createElement('li');
            itemLi.innerHTML = buildLinkHtml(item);
            dropUl.appendChild(itemLi);
        });

        dropLi.appendChild(dropUl);
        menuUl.appendChild(dropLi);
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
    document.getElementById('main-nav').classList.toggle('active');
}

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
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(36 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(72 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(108 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(144 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(180 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(216 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(252 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(288 50 50)" />
        <line x1="50" y1="0" x2="50" y2="25" transform="rotate(324 50 50)" />
      </g>
      
      <circle cx="50" cy="50" r="18" fill="#fff" />
    </svg>
    <div class="glow"></div>
  </div>
  <p class="loading-text">Loading ${pageName}</p>
</div>
    `;
};

// --- THE GLOBAL DATA & CACHE ENGINE ---
// This handles the loader, the memory cache, the API fetch, and error handling for EVERY page!
window.fetchDynamicData = async function (actionName, containerId, renderCallback) {
    const cacheKey = actionName + "_cache";
    const container = document.getElementById(containerId);

    // 1. INSTANT CACHE CHECK
    if (typeof siteData !== 'undefined' && siteData[cacheKey]) {
        console.log(`⚡ Loaded ${actionName} from fast cache!`);
        renderCallback(siteData[cacheKey]);
        return;
    }

    // 2. SHOW THE LOADER
    if (container) {
        const friendlyName = actionName.replace('get', ''); // Turns "getLibrary" into "Library"

        // Smart loader injection (prevents breaking HTML tables)
        if (container.tagName === 'TBODY') {
            container.innerHTML = `<tr><td colspan="100%" style="padding: 40px 0;">${window.getLoaderHtml(friendlyName)}</td></tr>`;
        } else {
            container.innerHTML = window.getLoaderHtml(friendlyName);
        }
    }

    // 3. FETCH FROM BACKEND
    try {
        const savedUser = JSON.parse(localStorage.getItem('rey_david_user'));

        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: actionName, email: savedUser ? savedUser.email : null })
        });
        const result = await response.json();

        if (result.status === "success") {
            // 4. SAVE TO CACHE
            if (typeof siteData !== 'undefined') {
                siteData[cacheKey] = result; // Save the entire response
            }
            // 5. RENDER THE UI
            renderCallback(result);
        } else {
            if (container) container.innerHTML = `<p style="color:red; text-align:center;">Error: ${result.message}</p>`;
        }
    } catch (error) {
        if (container) container.innerHTML = `<p style="color:red; text-align:center;">Network error while loading ${actionName}.</p>`;
    }
};


// --- URL HASH ROUTER ---
// Listens for the browser's Back/Forward buttons
window.addEventListener('hashchange', handleRouting);

function handleRouting() {
    const hash = window.location.hash.replace('#', '');
    const container = document.getElementById('page-dynamic');

    // --- 1. LOGIN PAGE ---
    if (hash === 'login') {
        if (typeof window.openDynamicPage === 'function') {
            window.openDynamicPage('login', false);
        }
    } 
    // --- 2. THE DYNAMIC HOME GRID (_HOME Sheet) ---
    else if (!hash || hash === 'home') {
        container.style.display = 'block';
        
        if (siteData && siteData.homeTiles) {
            let homeHtml = '<div class="tile-grid">';
            const user = JSON.parse(localStorage.getItem('rey_david_user'));

            siteData.homeTiles.forEach(tile => {
                // Check auth requirements
                const reqAuth = (tile.requires_auth === true || String(tile.requires_auth).toUpperCase() === 'TRUE');
                if (reqAuth && !user) return; // Skip private tiles if the user is not logged in

                // Apply formatting from the Google Sheet
                const bg = tile.format.bg && tile.format.bg !== '#ffffff' ? `background-color: ${tile.format.bg};` : '';
                const color = tile.format.color && tile.format.color !== '#000000' ? `color: ${tile.format.color};` : '';
                const size = tile.format.size ? `font-size: ${tile.format.size}px;` : '';
                
                // Build the tile
                if (tile.html) {
                    // If you provided custom HTML in the sheet, use it!
                    homeHtml += `<div class="tile" style="${bg} ${color}">${tile.html}</div>`;
                } else {
                    // Otherwise, use the standard layout
                    homeHtml += `
                        <div class="tile" style="${bg} ${color}">
                            ${tile.icon ? `<div style="font-size: 2em; margin-bottom: 10px;">${tile.icon}</div>` : ''}
                            <h3 style="${size} margin: 0 0 5px 0;">${tile.title}</h3>
                            ${tile.subtitle ? `<p style="font-size: 0.9em; opacity: 0.8; margin: 0 0 10px 0;">${tile.subtitle}</p>` : ''}
                            <div style="font-size: 0.95em;">${tile.contents}</div>
                        </div>
                    `;
                }
            });
            homeHtml += '</div>';
            container.innerHTML = homeHtml;
        } else {
            container.innerHTML = '<p style="text-align:center; padding: 40px;">Loading home dashboard...</p>';
        }
    } 
    // --- 3. DYNAMIC CMS PAGES (_SETTINGS Sheet) ---
    else if (siteData && siteData.settings && siteData.settings.page && siteData.settings.page[hash]) {
        const pageData = siteData.settings.page[hash];
        const isPublic = (pageData.public === true || String(pageData.public).toUpperCase() === "TRUE");
        window.openDynamicPage(hash, !isPublic);
    } 
    // --- 4. THE 404 REDIRECT ---
    else {
        if (hash !== '404') {
            // If the route doesn't exist, instantly bounce them to the 404 page!
            window.location.hash = '404';
        } else {
            // Failsafe 404 Design (In case you haven't built a custom 404 page in _SETTINGS yet)
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

window.addEventListener('scroll', function() {
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
