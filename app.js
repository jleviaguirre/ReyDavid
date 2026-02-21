// 1. YOUR APPS SCRIPT URL
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
        populateForm(savedUser);
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
            menuUl.innerHTML += `<li><a onclick="alert('Opening ${tab.title}... Content logic coming soon!')">${tab.title}</a></li>`;
        });
        
        // 3. Logged In: See Settings and Logout
        menuUl.innerHTML += `<li><a onclick="showPage('settings')">Settings</a></li>`;
        menuUl.innerHTML += `<li><a onclick="logout()">Logout</a></li>`;
    } else {
        // 4. Logged Out: Only see Login
        menuUl.innerHTML += `<li><a onclick="showPage('login')">Login</a></li>`;
    }
}

function renderTiles(user) {
    const container = document.getElementById('home-tiles');
    container.innerHTML = ""; // Clear existing tiles

    // 1. Render _HOME Tiles (Everyone sees these)
    siteData.homeTiles.forEach(tile => {
        const tileEl = document.createElement('div');
        tileEl.className = 'tile';

        tileEl.style.backgroundColor = tile.format.bg !== "#ffffff" ? tile.format.bg : "#f0f0f0";
        tileEl.style.color = tile.format.color;
        tileEl.style.fontWeight = tile.format.weight;
        tileEl.style.fontStyle = tile.format.style;

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

        // Apply HTML Override or Template
        let rawHtmlToUse = (tile.htmlOverride && tile.htmlOverride.trim() !== "") 
            ? tile.htmlOverride 
            : (siteData.templates[tile.template] || `<h3>{{title}}</h3><p>{{contents}}</p>`);

        // Replace Placeholders
        const finalHtml = rawHtmlToUse
            .replace(/{{title}}/g, tile.title)
            .replace(/{{subtitle}}/g, tile.subtitle)
            .replace(/{{contents}}/g, tile.contents)
            .replace(/{{icon}}/g, iconHtml); 
        
        tileEl.innerHTML = finalHtml;
        tileEl.onclick = () => alert(`Clicked Home Tile: ${tile.title}... Logic coming soon!`);
        
        container.appendChild(tileEl);
    });

    // 2. Render Tab Tiles (ONLY IF LOGGED IN + PREFERENCE IS TRUE)
    if (user) {
        siteData.tabs.forEach(tab => {
            // Smart matching: "Birthday List" -> "birthday_list" to match user profile keys
            const normalizedTabName = tab.title.replace(/\s+/g, '_').toLowerCase();
            const userKeys = Object.keys(user);
            let hasPreference = false;

            // Case-insensitive check against user profile settings
            for (let key of userKeys) {
                if (key.toLowerCase() === normalizedTabName) {
                    if (user[key] === true || user[key] === "TRUE") {
                        hasPreference = true;
                    }
                    break;
                }
            }

            // Only draw the tile if they checked the box!
            if (hasPreference) {
                const tileEl = document.createElement('div');
                tileEl.className = 'tile';
                tileEl.innerHTML = `<h3>${tab.title}</h3><p>View Section</p>`;
                
                const bgColor = tab.color ? tab.color : "#003366";
                tileEl.style.backgroundColor = bgColor;
                tileEl.style.color = getContrastYIQ(bgColor);
                tileEl.style.border = `2px solid ${bgColor}`;
                
                tileEl.onclick = () => alert(`Opening ${tab.title}... Content logic coming soon!`);
                container.appendChild(tileEl);
            }
        });
    }
}

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
                localStorage.setItem('rey_david_user', JSON.stringify(result.user));
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
    document.getElementById('page-' + pageId).style.display = 'block';
    
    // Auto-close mobile menu
    const nav = document.getElementById('main-nav');
    if(nav) nav.classList.remove('active');
}

function toggleMenu() {
    document.getElementById('main-nav').classList.toggle('active');
}

// --- SETTINGS FORM ---
function populateForm(user) {
    if(document.getElementById('set-names')) document.getElementById('set-names').value = user.names || "";
    if(document.getElementById('set-lastnames')) document.getElementById('set-lastnames').value = user.lastnames || "";
    if(document.getElementById('set-phone')) document.getElementById('set-phone').value = user.phone || "";
    if(document.getElementById('set-birthday')) document.getElementById('set-birthday').value = user.birthday || "";
    
    if(document.getElementById('set-david_list')) document.getElementById('set-david_list').checked = (user.david_list === true || user.david_list === "TRUE");
    if(document.getElementById('set-david_connection')) document.getElementById('set-david_connection').checked = (user.david_connection === true || user.david_connection === "TRUE");
    if(document.getElementById('set-david_outreach')) document.getElementById('set-david_outreach').checked = (user.david_outreach === true || user.david_outreach === "TRUE");
    if(document.getElementById('set-host_meeting')) document.getElementById('set-host_meeting').checked = (user.host_monthly_meeting === true || user.host_monthly_meeting === "TRUE");
    if(document.getElementById('set-birthday_list')) document.getElementById('set-birthday_list').checked = (user.Birthday_List === true || user.Birthday_List === "TRUE");
}

async function saveSettings(event) {
    event.preventDefault(); 
    const messageEl = document.getElementById('save-message');
    messageEl.innerText = "Saving...";
    
    const savedUser = JSON.parse(localStorage.getItem('rey_david_user'));
    if (!savedUser) return;

    const payload = {
        action: "updateSettings",
        email: savedUser.email,
        names: document.getElementById('set-names').value,
        lastnames: document.getElementById('set-lastnames').value,
        phone: document.getElementById('set-phone').value,
        birthday: document.getElementById('set-birthday').value,
        david_list: document.getElementById('set-david_list').checked,
        david_connection: document.getElementById('set-david_connection').checked,
        david_outreach: document.getElementById('set-david_outreach').checked,
        host_monthly_meeting: document.getElementById('set-host_meeting').checked,
        Birthday_List: document.getElementById('set-birthday_list').checked
    };

    try {
        const response = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await response.json();
        
        if (result.status === "success") {
            messageEl.innerText = "Settings saved!";
            messageEl.style.color = "green";
            // Update local storage and repaint the UI to instantly show/hide tiles!
            localStorage.setItem('rey_david_user', JSON.stringify({...savedUser, ...payload}));
            renderUI(); 
        } else {
            messageEl.innerText = "Error: " + result.message;
        }
    } catch (error) {
        messageEl.innerText = "Network error. Could not save.";
    }
}

// Helper: Smart Contrast
function getContrastYIQ(hexcolor) {
    if (!hexcolor) return 'white';
    hexcolor = hexcolor.replace("#", "");
    if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(hex => hex + hex).join('');
    const r = parseInt(hexcolor.substr(0, 2), 16), g = parseInt(hexcolor.substr(2, 2), 16), b = parseInt(hexcolor.substr(4, 2), 16);
    return (((r * 299) + (g * 587) + (b * 114)) / 1000 >= 128) ? 'black' : 'white';
}
