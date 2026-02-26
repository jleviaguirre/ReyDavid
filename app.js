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
                // Insert right at the top of the body
                document.body.insertBefore(headerEl, document.body.firstChild);
            }
            headerEl.innerHTML = settings.component.header;
        }
        
        if (settings.component.footer) {
            let footerEl = document.getElementById('dynamic-footer');
            if (!footerEl) {
                footerEl = document.createElement('div');
                footerEl.id = 'dynamic-footer';
                // Append right at the bottom of the body
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
        // Check if someone is currently logged in locally
        const savedUser = JSON.parse(localStorage.getItem('rey_david_user'));
        const userEmail = savedUser ? savedUser.email : null;

        // Send the email to the backend so it can check _DENY_ACCESS
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "getHomeData", email: userEmail })
        });
        const data = await response.json();
        
        // SECURITY TRAP: The backend flagged this user!
        if (data.status === "denied") {
            localStorage.removeItem('rey_david_user'); // Wipe their session
            alert("Your access has been revoked. Please contact an administrator.");
            window.location.reload(); // Instantly refresh the page to clear the UI
            return;
        }

        if (data.status === "success") {
            siteData = data;
            
            // 1. Apply Global Meta/Theme settings
            applyGlobalSettings(siteData.settings);
            
            // ✨ 2. INJECT THE DYNAMIC HOME PAGE CANVAS
            // Check if your Google Sheet has a custom Home layout
            if (siteData.settings && siteData.settings.page && siteData.settings.page.home) {
                renderDynamicModule(siteData.settings.page.home, 'page-home');
            } else {
                // Fallback: If you delete the setting, it ensures the tiles still have a place to go
                document.getElementById('page-home').innerHTML = '<div id="home-tiles" style="display: flex; flex-wrap: wrap; gap: 20px;"></div>';
            }

            // 3. Save User & Blueprint to memory
            if (data.userProfile) localStorage.setItem('rey_david_user', JSON.stringify(data.userProfile));
            if (data.blueprint) localStorage.setItem('rey_david_blueprint', JSON.stringify(data.blueprint));
            
            // 4. NOW draw the tiles (into whatever layout was just injected!)
            renderUI(); 
        }
        
    } catch (error) {
        document.getElementById('home-tiles').innerHTML = "<p>Failed to load CMS content.</p>";
    }
}

// --- CORE RENDERING ENGINE ---
function renderUI() {
    // Check if we have a saved, authenticated user
    const savedUser = JSON.parse(localStorage.getItem('rey_david_user'));
    
    renderMenu(savedUser);
    renderTiles(savedUser);
    
    if (savedUser) {
        document.getElementById('welcome-user').innerText = `Welcome, ${savedUser.names || savedUser.email}`;
    }
}

function renderMenu(user) {
    const menuUl = document.getElementById('menu-items');
    menuUl.innerHTML = ''; // Clear existing menu

    // 1. Base Menu (Everyone sees this)
    menuUl.innerHTML += `<li><a onclick="showPage('home')">Home</a></li>`;

    if (user) {
        // 2. Logged In: See ALL dynamic tabs (Permissions)
        siteData.tabs.forEach(tab => {
            menuUl.innerHTML += `<li><a href="#" onclick="openDynamicPage('${tab.title}')">${tab.title}</a></li>`;
        });
        
        // 3. Logged In: See Settings and Logout
        menuUl.innerHTML += '<li><a onclick="window.openDynamicPage(\'settings\')">Settings</a></li>';
        menuUl.innerHTML += `<li><a onclick="logout()">Logout</a></li>`;
    } else {
        // 4. Logged Out: Only see Login
        menuUl.innerHTML += `<li><a onclick="showPage('login')">Login</a></li>`;
    }
}

function renderTiles(user) {
    const container = document.getElementById('home-tiles');
    if (!container) return; 
    container.innerHTML = ""; // Clear existing tiles

    // 1. Render _HOME Tiles
    if (siteData.homeTiles) {
        siteData.homeTiles.forEach(tile => {
            
            // Auth Check
            const needsAuth = (tile.requires_auth === true || tile.requires_auth === "TRUE");
            if (needsAuth && !user) {
                return; // Skip rendering this tile
            }

            const tileEl = document.createElement('div');
            tileEl.className = 'tile';

            // ✨ THE FORMATTING FIX ✨
            // Only force spreadsheet styles if the HTML override is blank
            if (!tile.html || tile.html.trim() === "") {
                tileEl.style.backgroundColor = tile.format.bg !== "#ffffff" ? tile.format.bg : "#f0f0f0";
                tileEl.style.color = tile.format.color;
                tileEl.style.fontWeight = tile.format.weight;
                tileEl.style.fontStyle = tile.format.style;
                if (tile.format.size) {
                    tileEl.style.fontSize = tile.format.size + "pt"; 
                }
            }

            // Process Icon
            let iconHtml = "";
            if (tile.icon) {
                let rawIcon = tile.icon.trim();
                if (rawIcon.toLowerCase().startsWith("<svg")) {
                    iconHtml = rawIcon.replace("<svg", '<svg style="width: 100%; height: 100%;"');
                } else if (rawIcon.toLowerCase().startsWith("http")) {
                    iconHtml = `<img src="${rawIcon}" alt="icon" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                } else {
                    iconHtml = `<span style="font-size: 2rem;">${rawIcon}</span>`;
                }
            }

            // Apply HTML Override or use the basic fallback layout
            let rawHtmlToUse = (tile.html && tile.html.trim() !== "") 
                ? tile.html 
                : `<h3 style="margin-top:0;">{{title}}</h3><p style="margin-bottom:0;">{{contents}}</p>`;

            // Replace Placeholders
            const finalHtml = rawHtmlToUse
                .replace(/{{title}}/g, tile.title)
                .replace(/{{subtitle}}/g, tile.subtitle)
                .replace(/{{contents}}/g, tile.contents)
                .replace(/{{icon}}/g, iconHtml); 
            
            tileEl.innerHTML = finalHtml;
            tileEl.onclick = () => openDynamicPage(tile.title);
            
            container.appendChild(tileEl);
        });
    }

    // 2. Render Tab Tiles (ONLY IF LOGGED IN + PREFERENCE IS TRUE)
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
                tileEl.innerHTML = `<h3>${tab.title}</h3><p>View Section</p>`;
                
                const bgColor = tab.color ? tab.color : "#003366";
                tileEl.style.backgroundColor = bgColor;
                tileEl.style.color = getContrastYIQ(bgColor);
                tileEl.style.border = `2px solid ${bgColor}`;
                
                tileEl.onclick = () => openDynamicPage(tab.title);
                container.appendChild(tileEl);
            }
        });
    }
} // <-- END OF renderTiles

// ✨ THE DYNAMIC ROUTER ✨
function openDynamicPage(pageTitle) {
    // Convert "Members Directory" into "members_directory"
    const pageKey = pageTitle.replace(/\s+/g, '_').toLowerCase(); 

    // Make sure siteData and settings exist before trying to read them
    if (typeof siteData !== 'undefined' && siteData.settings && siteData.settings.page && siteData.settings.page[pageKey]) {
        const rawCode = siteData.settings.page[pageKey];

        let container = document.getElementById('page-dynamic');
        if (!container) {
            container = document.createElement('div');
            container.id = 'page-dynamic';
            container.style.display = 'none';
            
            // ✨ THE FIX: Inject this right next to the Home Page so it stays inside your main .container!
            const mainWrapper = document.getElementById('page-home').parentNode;
            if (mainWrapper) {
                mainWrapper.appendChild(container);
            } else {
                document.body.appendChild(container); // Fallback
            }
        }

        container.innerHTML = `
            <div id="dynamic-module-content"></div>
        `;

        
        renderDynamicModule(rawCode, 'dynamic-module-content');
        
        // Pass 'dynamic' instead of 'page-dynamic'
        showPage('dynamic');
    } else {
        alert(`Almost there! Please add a row in _SETTINGS -> category: page | name: ${pageKey}`);
    }
};

// --- AUTHENTICATION & ROUTING ---
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
                // Save user and descriptions to local storage
                localStorage.setItem('rey_david_user', JSON.stringify(result.user));
                localStorage.setItem('rey_david_descriptions', JSON.stringify(result.descriptions));
                
                window.history.replaceState({}, document.title, window.location.pathname);
                showPage('settings'); // Go to settings on first fresh login
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
    renderUI(); // Automatically repaints the screen to hide private stuff!
    showPage('home');
    alert("Logged out successfully.");
}

// --- UI HELPERS ---
function showPage(pageId) {
    document.getElementById('page-home').style.display = 'none';
    document.getElementById('page-login').style.display = 'none';
    document.getElementById('page-settings').style.display = 'none';
    
    // Ensure page-dynamic exists before trying to hide it
    let dynamicPage = document.getElementById('page-dynamic');
    if (dynamicPage) {
        dynamicPage.style.display = 'none';
    }

    document.getElementById('page-' + pageId).style.display = 'block';
    
    // Auto-close mobile menu
    const nav = document.getElementById('main-nav');
    if(nav) nav.classList.remove('active');
}

function toggleMenu() {
    document.getElementById('main-nav').classList.toggle('active');
}

function renderDynamicModule(rawCode, targetContainerId) {
    const container = document.getElementById(targetContainerId);
    if (!container || !rawCode) return;
    
    // 1. Inject HTML and CSS
    container.innerHTML = rawCode;

    // 2. The Browser Security Bypass (Execute JS)
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


// Helper: Smart Contrast
function getContrastYIQ(hexcolor) {
    if (!hexcolor) return 'white';
    hexcolor = hexcolor.replace("#", "");
    if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(hex => hex + hex).join('');
    const r = parseInt(hexcolor.substr(0, 2), 16), g = parseInt(hexcolor.substr(2, 2), 16), b = parseInt(hexcolor.substr(4, 2), 16);
    return (((r * 299) + (g * 587) + (b * 114)) / 1000 >= 128) ? 'black' : 'white';
}
