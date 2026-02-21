
        // 1. YOUR APPS SCRIPT URL
        const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx6YoLahuA2UEON2r7RqT_Tym2soKTSfDXC2dzORSI36Oxc4igQ_cRf_d-Yj5fH2RaSVQ/exec";

        // --- UI & Routing Functions ---
        function toggleMenu() {
            document.getElementById('main-nav').classList.toggle('active');
        }

        function showPage(pageId) {
            document.getElementById('page-home').style.display = 'none';
            document.getElementById('page-login').style.display = 'none';
            document.getElementById('page-settings').style.display = 'none';
            
            document.getElementById('page-' + pageId).style.display = 'block';
            document.getElementById('main-nav').classList.remove('active'); // Close mobile menu
        }

        function updateMenuForLoggedInUser(user) {
            document.getElementById('nav-login').style.display = 'none';
            document.getElementById('nav-settings').style.display = 'block';
            document.getElementById('nav-logout').style.display = 'block';
            document.getElementById('welcome-user').innerText = `Welcome, ${user.names || user.email}`;
            
            populateForm(user);
        }

        // Fills the form with data from Google Sheets
        function populateForm(user) {
            document.getElementById('set-names').value = user.names || "";
            document.getElementById('set-lastnames').value = user.lastnames || "";
            document.getElementById('set-phone').value = user.phone || "";
            document.getElementById('set-birthday').value = user.birthday || "";
            
            // Match the exact sheet headers!
            document.getElementById('set-david_list').checked = (user.david_list === true || user.david_list === "TRUE");
            document.getElementById('set-david_connection').checked = (user.david_connection === true || user.david_connection === "TRUE");
            document.getElementById('set-david_outreach').checked = (user.david_outreach === true || user.david_outreach === "TRUE");
            document.getElementById('set-host_meeting').checked = (user.host_monthly_meeting === true || user.host_monthly_meeting === "TRUE");
            document.getElementById('set-birthday_list').checked = (user.birthday_list === true || user.birthday_list === "TRUE");
        }

        // --- Authentication & Data Functions ---

        // Request a link (Sends POST to Apps Script)
        async function requestMagicLink() {
            const emailInput = document.getElementById('user-email').value;
            const messageEl = document.getElementById('login-message');

            if (!emailInput) {
                messageEl.innerText = "Please enter a valid email address.";
                messageEl.style.color = "red";
                return;
            }

            messageEl.innerText = "Generating secure link... please wait.";
            messageEl.style.color = "blue";

            try {
                const response = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: "requestMagicLink", email: emailInput })
                });

                const result = await response.json();

                if (result.status === "success") {
                    messageEl.innerText = "Success! Please check your email for the login link.";
                    messageEl.style.color = "green";
                    document.getElementById('user-email').value = ""; 
                } else {
                    messageEl.innerText = "Error: " + result.message;
                    messageEl.style.color = "red";
                }
            } catch (error) {
                messageEl.innerText = "Network error. Please try again.";
                messageEl.style.color = "red";
            }
        }

        // Check for token on page load (Sends GET to Apps Script)
        async function checkUrlForToken() {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');

            if (token) {
                showPage('login');
                document.getElementById('login-message').innerText = "Verifying your secure link... please wait.";
                document.getElementById('login-message').style.color = "blue";

                try {
                    const response = await fetch(`${SCRIPT_URL}?token=${token}`);
                    const result = await response.json();

                    if (result.status === "success") {
                        localStorage.setItem('rey_david_user', JSON.stringify(result.user));
                        window.history.replaceState({}, document.title, window.location.pathname);
                        updateMenuForLoggedInUser(result.user);
                        showPage('settings');
                    } else {
                        document.getElementById('login-message').innerText = "Link expired or invalid. Please request a new one.";
                        document.getElementById('login-message').style.color = "red";
                    }
                } catch (error) {
                    document.getElementById('login-message').innerText = "Verification failed. Please try again.";
                    document.getElementById('login-message').style.color = "red";
                }
            } else {
                const savedUser = localStorage.getItem('rey_david_user');
                if (savedUser) {
                    updateMenuForLoggedInUser(JSON.parse(savedUser));
                }
            }
        }

        // Saves the form data back to Google Sheets
async function saveSettings(event) {
            event.preventDefault(); 
            
            const messageEl = document.getElementById('save-message');
            messageEl.innerText = "Saving...";
            messageEl.style.color = "blue";
            
            const savedUser = JSON.parse(localStorage.getItem('rey_david_user'));
            if (!savedUser) return;

            // Build the payload with your exact sheet headers!
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
                birthday_list: document.getElementById('set-birthday_list').checked
            };

            try {
                const response = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                
                if (result.status === "success") {
                    messageEl.innerText = "Settings saved successfully!";
                    messageEl.style.color = "green";
                    localStorage.setItem('rey_david_user', JSON.stringify({...savedUser, ...payload}));
                } else {
                    messageEl.innerText = "Error: " + result.message;
                    messageEl.style.color = "red";
                }
            } catch (error) {
                messageEl.innerText = "Network error. Could not save.";
                messageEl.style.color = "red";
            }
        }
        
        function logout() {
            localStorage.removeItem('rey_david_user');
            
            document.getElementById('nav-login').style.display = 'block';
            document.getElementById('nav-settings').style.display = 'none';
            document.getElementById('nav-logout').style.display = 'none';
            
            showPage('home');
            alert("Logged out successfully.");
        }

// Run both authentication check AND load the home data on load
window.onload = async () => {
    checkUrlForToken();
    loadHomeData();
};

async function loadHomeData() {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "getHomeData" })
        });
        const data = await response.json();
        
        if (data.status === "success") {
            renderTiles(data);
        }
    } catch (error) {
        document.getElementById('home-tiles').innerHTML = "<p>Failed to load content.</p>";
    }
}

function renderTiles(data) {
    const container = document.getElementById('home-tiles');
    container.innerHTML = ""; // Clear "Loading..."

    // 1. Render Tab Tiles
    data.tabs.forEach(tab => {
        const tileEl = document.createElement('div');
        tileEl.className = 'tile';
        tileEl.innerHTML = `<h3>${tab.title}</h3><p>View Section</p>`;
        
        // Define the background color (fallback to your dark blue)
        const bgColor = tab.color ? tab.color : "#003366";
        tileEl.style.backgroundColor = bgColor;
        
        // ✨ THE TRICK: Automatically set the text color based on the background!
        tileEl.style.color = getContrastYIQ(bgColor);
        
        // Keep the border matching the background
        tileEl.style.border = `2px solid ${bgColor}`;
        
        tileEl.onclick = () => alert(`Loading ${tab.title}... (We will build this later!)`);
        container.appendChild(tileEl);
    });

    // 2. Render _HOME Tiles
    data.homeTiles.forEach(tile => {
        const tileEl = document.createElement('div');
        tileEl.className = 'tile';

        // RULE 1: If HTML override exists, wrap it in a tile and ignore the rest
        if (tile.htmlOverride && tile.htmlOverride.trim() !== "") {
            tileEl.innerHTML = tile.htmlOverride;
        } 
// RULE 2: Use Template from _SETTINGS
        else {
            tileEl.style.backgroundColor = tile.format.bg !== "#ffffff" ? tile.format.bg : "#f0f0f0";
            tileEl.style.color = tile.format.color;
            tileEl.style.fontWeight = tile.format.weight;
            tileEl.style.fontStyle = tile.format.style;

            let templateHtml = data.templates[tile.template];
            
            if (templateHtml) {
                // 1. Determine what kind of Icon we have
                let iconHtml = "";
                if (tile.icon) {
                    let rawIcon = tile.icon.trim();
                    if (rawIcon.toLowerCase().startsWith("<svg")) {
                        // It's raw SVG! Add width/height to make it fit the container
                        iconHtml = rawIcon.replace("<svg", '<svg style="width: 100%; height: 100%;"');
                    } else if (rawIcon.toLowerCase().startsWith("http")) {
                        // It's an image URL!
                        iconHtml = `<img src="${rawIcon}" alt="icon" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                    } else {
                        // Fallback (e.g., if you paste an Emoji like 📅)
                        iconHtml = `<span style="font-size: 2rem;">${rawIcon}</span>`;
                    }
                }

                // 2. Replace all placeholders
                templateHtml = templateHtml.replace(/{{title}}/g, tile.title)
                                           .replace(/{{subtitle}}/g, tile.subtitle)
                                           .replace(/{{contents}}/g, tile.contents)
                                           .replace(/{{icon}}/g, iconHtml); // <-- Add Icon replacement
                
                tileEl.innerHTML = templateHtml;
            } else {
                tileEl.innerHTML = `<h3>${tile.title}</h3><p><em>${tile.subtitle}</em></p><p>${tile.contents}</p>`;
            }
        }        
        container.appendChild(tileEl);
    });
}

// Helper function to automatically pick black or white text based on background color
function getContrastYIQ(hexcolor) {
    // If no color is provided, default to a dark background expecting white text
    if (!hexcolor) return 'white';
    
    // Remove the '#' if it's there
    hexcolor = hexcolor.replace("#", "");
    
    // Convert 3-char hex to 6-char (e.g., #FFF to #FFFFFF)
    if (hexcolor.length === 3) {
        hexcolor = hexcolor.split('').map(function (hex) { return hex + hex; }).join('');
    }
    
    // Convert to Red, Green, Blue integers
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    
    // Calculate the brightness (YIQ formula)
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    // If it's 128 or higher, the background is light, so use black text. Otherwise, white text.
    return (yiq >= 128) ? 'black' : 'white';
}
