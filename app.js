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
            
            // Refresh user profile and form blueprint directly from the page load
            if (data.userProfile) localStorage.setItem('rey_david_user', JSON.stringify(data.userProfile));
            if (data.blueprint) localStorage.setItem('rey_david_blueprint', JSON.stringify(data.blueprint));
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

    // 1. Render _HOME Tiles
    siteData.homeTiles.forEach(tile => {
        
        // ✨ NEW: Auth Check
        // If the tile requires auth, AND the user is not logged in, skip rendering this tile!
        const needsAuth = (tile.requires_auth === true || tile.requires_auth === "TRUE");
        if (needsAuth && !user) {
            return; // Escapes this loop iteration and moves to the next tile
        }

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
    const container = document.getElementById('dynamic-form-fields');
    if (!container) return;
    container.innerHTML = ""; // Clear out the old form

    const blueprint = JSON.parse(localStorage.getItem('rey_david_blueprint'));
    if (!blueprint) return;

    blueprint.headers.forEach(key => {
        const val = user[key];
        
        let note = blueprint.descriptions[key] || "";
        let type = blueprint.types[key]; // Usually "text" or "checkbox"
        let customAttrs = {};
        let tagName = "input"; // Default to an <input> tag

        // 2. ✨ THE UPGRADED SMART PARSER ✨
        // Now looks for [input ...] OR [textarea ...]
        const tagMatch = note.match(/^\[(input|textarea)\s*(.*?)\]\s*([\s\S]*)$/i);
        
        if (tagMatch) {
            tagName = tagMatch[1].toLowerCase(); // Grabs "input" or "textarea"
            const attrString = tagMatch[2]; 
            note = tagMatch[3]; // The rest is the description
            
            const attrRegex = /([a-zA-Z-]+)=(?:'([^']*)'|"([^"]*)"|([^\s]*))/g;
            let match;
            while ((match = attrRegex.exec(attrString)) !== null) {
                const attrName = match[1];
                const attrValue = match[2] || match[3] || match[4];
                customAttrs[attrName] = attrValue;
            }
            
            if (customAttrs['type']) {
                type = customAttrs['type'];
            }
        }

        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = "20px";

        const label = document.createElement('label');
        label.style.fontWeight = "bold";
        label.style.display = type === "checkbox" ? "inline-block" : "block";
        label.style.marginBottom = "5px";
        label.innerText = type === "checkbox" ? ` ${key}` : key; 

        // CREATE THE FIELD DYNAMICALLY (Input OR Textarea)
        const field = document.createElement(tagName);
        field.id = `dyn-${key}`;
        field.className = "dynamic-input"; // Keeps it linked to your save mechanism
        field.dataset.key = key; 
        
        // Only set the 'type' attribute if it's an actual input tag
        if (tagName === "input") {
            field.type = type;
        }

        // Apply all custom attributes (like rows, placeholder, style)
        for (const [attrName, attrValue] of Object.entries(customAttrs)) {
            if (attrName !== 'type') { 
                if (attrName === 'style') {
                    field.style.cssText = attrValue;
                } else {
                    field.setAttribute(attrName, attrValue);
                }
            }
        }

        // Logic for Checkboxes vs Text/Date/Textareas
        if (type === "checkbox") {
            field.checked = (val === true || val === "TRUE");
            label.prepend(field);
            wrapper.appendChild(label);
        } else {
            field.value = val || "";
            // Default styling so it looks nice if you don't provide custom styles
            if (!customAttrs['style']) {
                field.style.width = "100%";
                field.style.padding = "10px";
                field.style.boxSizing = "border-box";
                field.style.fontFamily = "inherit";
            }
            wrapper.appendChild(label);
            wrapper.appendChild(field);
        }

        // Add the Description Note
        if (note.trim() !== "") {
            const noteSpan = document.createElement('span');
            noteSpan.style.fontSize = "0.85em";
            noteSpan.style.color = "gray";
            noteSpan.style.display = "block";
            noteSpan.style.marginTop = "4px";
            noteSpan.style.marginLeft = type === "checkbox" ? "25px" : "0";
            noteSpan.innerText = note.trim();
            wrapper.appendChild(noteSpan);
        }

        container.appendChild(wrapper);
    });
}

async function saveSettings(event) {
    event.preventDefault(); 
    const messageEl = document.getElementById('save-message');
    messageEl.innerText = "Saving...";
    messageEl.style.color = "blue";
    
    const savedUser = JSON.parse(localStorage.getItem('rey_david_user'));
    if (!savedUser) return;

    // Dynamically scoop up all the values from the form!
    const updates = {};
    document.querySelectorAll('.dynamic-input').forEach(input => {
        const key = input.dataset.key;
        updates[key] = input.type === "checkbox" ? input.checked : input.value;
    });

    const payload = {
        action: "updateSettings",
        email: savedUser.email,
        updates: updates // Send the whole dynamic object
    };

    try {
        const response = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await response.json();
        
        if (result.status === "success") {
            messageEl.innerText = "Profile saved!";
            messageEl.style.color = "green";
            localStorage.setItem('rey_david_user', JSON.stringify({...savedUser, ...updates}));
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
