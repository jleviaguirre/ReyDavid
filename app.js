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

    // 4. Layout Overrides (For the Home Tiles container)
    if (settings.layout && settings.layout.home_container) {
        const homeTiles = document.getElementById('home-tiles');
        if (homeTiles) {
            homeTiles.style.cssText = settings.layout.home_container;
        }
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
            container.innerHTML = window.getLoaderHtml("✡︎");
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

    // 1. Base Menu
    menuUl.innerHTML += `<li><a href="#home">Home</a></li>`;

    if (user) {
        // 2. Dynamic Modules (Formats "Monthly Meetings" to "#monthly_meetings")
        siteData.tabs.forEach(tab => {
            const normalizedTabName = tab.title.replace(/\s+/g, '_').toLowerCase();
            menuUl.innerHTML += `<li><a href="#${normalizedTabName}">${tab.title}</a></li>`;
        });
        
        // 3. User Settings & Logout
        menuUl.innerHTML += `<li><a href="#settings">Settings</a></li>`;
        
        // Logout stays an onclick because it performs an action, not a navigation
        menuUl.innerHTML += `<li><a href="#" onclick="logout(); return false;">Logout</a></li>`;
    } else {
        // 4. Logged Out State
        menuUl.innerHTML += `<li><a href="#login">Login</a></li>`;
    }
}


// --- THE DYNAMIC ROUTER ---
window.openDynamicPage = function(pageTitle, updateHash = true) {
    const pageKey = pageTitle.replace(/\s+/g, '_').toLowerCase(); 

    // ✨ Push to the URL bar so it can be bookmarked/refreshed!
    if (updateHash) {
        window.location.hash = pageKey;
    }

    if (typeof siteData !== 'undefined' && siteData.settings && siteData.settings.page && siteData.settings.page[pageKey]) {
        const rawCode = siteData.settings.page[pageKey];
        const container = document.getElementById('page-dynamic');
        
        container.innerHTML = window.getLoaderHtml(pageTitle);
        showPage('dynamic', false); // Tell showPage NOT to overwrite our hash

        setTimeout(() => {
            container.innerHTML = `<div id="dynamic-module-content"></div>`;
            renderDynamicModule(rawCode, 'dynamic-module-content');
        }, 10);
    } else {
        top.location = "./#404";
        console.log(`Almost there! Please add a row in _SETTINGS -> category: page | name: ${pageKey}`);
        //#showPage('home'); // Fallback if page doesn't exist
    }
};

// --- AUTHENTICATION ---
async function checkUrlForToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
        showPage('login');
        document.getElementById('login-message').innerText = "Verifying secure link...";
        
        try {
            const response = await fetch(`${SCRIPT_URL}?token=${token}`);
            const result = await response.json();

            if (result.status === "success") {
                localStorage.setItem('rey_david_user', JSON.stringify(result.user));
                await loadHomeData(); 
                window.history.replaceState({}, document.title, window.location.pathname);
                
                if (typeof window.openDynamicPage === 'function') {
                    window.openDynamicPage('settings'); 
                }
            } else {
                document.getElementById('login-message').innerText = "Link expired. Please request a new one.";
            }
        } catch (error) {
            document.getElementById('login-message').innerText = "Verification failed.";
        }
    }
}

async function requestMagicLink() {
    const emailInput = document.getElementById('user-email').value;
    const messageEl = document.getElementById('login-message');
    if (!emailInput) return;

    messageEl.innerText = "Generating link... please wait.";
    messageEl.style.color = "blue";

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "requestMagicLink", email: emailInput })
        });
        const result = await response.json();
        
        if (result.status === "success") {
            messageEl.innerText = "Success! Check your email.";
            messageEl.style.color = "green";
        } else {
            messageEl.innerText = "Error: " + result.message;
            messageEl.style.color = "red";
        }
    } catch (error) {
        messageEl.innerText = "Network error.";
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
    if(nav) nav.classList.remove('active');
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
window.getLoaderHtml = function(pageName = "content") {
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
window.fetchDynamicData = async function(actionName, containerId, renderCallback) {
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

    if (hash === 'login') {
        showPage('login', false);
    } else if (!hash || hash === 'home') {
        // ✨ Treat Home just like Library or Directory!
        if (typeof window.openDynamicPage === 'function') {
            window.openDynamicPage('home', false);
        }
    } else {
        const prettyTitle = hash.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (typeof window.openDynamicPage === 'function') {
            window.openDynamicPage(prettyTitle, false);
        }
    }
}
