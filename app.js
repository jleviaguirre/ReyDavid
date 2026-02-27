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

        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "getHomeData", email: userEmail })
        });
        const data = await response.json();
        
        // SECURITY TRAP
        if (data.status === "denied") {
            localStorage.removeItem('rey_david_user');
            alert("Your access has been revoked. Please contact an administrator.");
            window.location.reload(); 
            return;
        }

        if (data.status === "success") {
            siteData = data;
            
            applyGlobalSettings(siteData.settings);
            
            // INJECT THE DYNAMIC HOME PAGE CANVAS
            if (siteData.settings && siteData.settings.page && siteData.settings.page.home) {
                renderDynamicModule(siteData.settings.page.home, 'page-home');
            } else {
                document.getElementById('page-home').innerHTML = '<div id="home-tiles" style="display: flex; flex-wrap: wrap; gap: 20px;"></div>';
            }

            // Save User & Blueprint to memory
            if (data.userProfile) localStorage.setItem('rey_david_user', JSON.stringify(data.userProfile));
            if (data.blueprint) localStorage.setItem('rey_david_blueprint', JSON.stringify(data.blueprint));
            
            renderUI(); 
        }
        
    } catch (error) {
        document.getElementById('home-tiles').innerHTML = "<p>Failed to load CMS content.</p>";
    }
}

// --- CORE RENDERING ENGINE ---
function renderUI() {
    const savedUser = JSON.parse(localStorage.getItem('rey_david_user'));
    renderMenu(savedUser);
    renderTiles(savedUser);
}

function renderMenu(user) {
    const menuUl = document.getElementById('menu-items');
    menuUl.innerHTML = ''; 

    menuUl.innerHTML += `<li><a onclick="showPage('home')">Home</a></li>`;

    if (user) {
        siteData.tabs.forEach(tab => {
            menuUl.innerHTML += `<li><a href="#" onclick="window.openDynamicPage('${tab.title}')">${tab.title}</a></li>`;
        });
        
        menuUl.innerHTML += '<li><a onclick="window.openDynamicPage(\'settings\')">Settings</a></li>';
        menuUl.innerHTML += `<li><a onclick="logout()">Logout</a></li>`;
    } else {
        menuUl.innerHTML += `<li><a onclick="showPage('login')">Login</a></li>`;
    }
}

function renderTiles(user) {
    const container = document.getElementById('home-tiles');
    if (!container) return; 
    container.innerHTML = ""; 

    // Render Tab Tiles (Modules) ONLY if logged in
    if (user && siteData.tabs) {
        siteData.tabs.forEach(tab => {
            const normalizedTabName = tab.title.replace(/\s+/g, '_').toLowerCase();
            const userKeys = Object.keys(user);
            let hasPreference = false;

            for (let key of userKeys) {
                if (key.toLowerCase() === normalizedTabName) {
                    if (user[key] === true || user[key] === "TRUE") {
                        hasPreference = true;
                    }
                    break;
                }
            }

            if (hasPreference) {
                const tileEl = document.createElement('div');
                tileEl.className = 'tile';
                
                // Clean, standardized navigation tiles
                tileEl.innerHTML = `
                    <h3 style="margin: 0 0 8px 0; font-size: 1.2rem;">${tab.title}</h3>
                    <p style="margin: 0; font-size: 0.9em; opacity: 0.85;">Open Module &rarr;</p>
                `;
                
                const bgColor = tab.color ? tab.color : "#003366";
                tileEl.style.backgroundColor = bgColor;
                tileEl.style.color = getContrastYIQ(bgColor);
                tileEl.style.border = `none`;
                tileEl.style.borderRadius = `10px`;
                tileEl.style.boxShadow = `0 4px 10px rgba(0,0,0,0.1)`;
                tileEl.style.transition = `transform 0.2s ease`;
                tileEl.style.cursor = `pointer`;
                tileEl.style.padding = `20px`;
                
                // Hover effect
                tileEl.onmouseover = () => tileEl.style.transform = "translateY(-4px)";
                tileEl.onmouseout = () => tileEl.style.transform = "translateY(0)";
                
                tileEl.onclick = () => window.openDynamicPage(tab.title);
                container.appendChild(tileEl);
            }
        });
    } else if (!user) {
        container.innerHTML = "<p style='text-align:center; width:100%; color:#666;'>Please log in to view your dashboard.</p>";
    }
}

// --- THE DYNAMIC ROUTER ---
window.openDynamicPage = function(pageTitle) {
    const pageKey = pageTitle.replace(/\s+/g, '_').toLowerCase(); 

    if (typeof siteData !== 'undefined' && siteData.settings && siteData.settings.page && siteData.settings.page[pageKey]) {
        const rawCode = siteData.settings.page[pageKey];

        let container = document.getElementById('page-dynamic');
        if (!container) {
            container = document.createElement('div');
            container.id = 'page-dynamic';
            container.style.display = 'none';
            
            const mainWrapper = document.getElementById('page-home').parentNode;
            if (mainWrapper) {
                mainWrapper.appendChild(container);
            } else {
                document.body.appendChild(container);
            }
        }

        container.innerHTML = `<div id="dynamic-module-content"></div>`;
        renderDynamicModule(rawCode, 'dynamic-module-content');
        showPage('dynamic');
    } else {
        console.log(`Almost there! Please add a row in _SETTINGS -> category: page | name: ${pageKey}`);
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
    renderUI(); 
    showPage('home');
    alert("Logged out successfully.");
}

// --- UI HELPERS ---
function showPage(pageId) {
    const homePage = document.getElementById('page-home');
    if (homePage) homePage.style.display = 'none';

    const loginPage = document.getElementById('page-login');
    if (loginPage) loginPage.style.display = 'none';
    
    const dynamicPage = document.getElementById('page-dynamic');
    if (dynamicPage) dynamicPage.style.display = 'none';

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
          <svg class="sacred-loader" viewBox="0 0 50 50">
            <circle class="ring" cx="25" cy="25" r="20"></circle>
            <circle class="dot" cx="25" cy="5" r="5"></circle>
          </svg>
          <p class="loading-text">Loading ${pageName}...</p>
        </div>
    `;
};
