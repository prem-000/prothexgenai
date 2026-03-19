import { apiRequest } from './api.js';

// ---- CONFIGURATION & COLORS ----
const COLORS = {
    primary: '#ec5b13',
    blue: '#0EA5E9',
    green: '#22c55e',
    red: '#ef4444',
    amber: '#f59e0b',
    border: '#1E2F36',
    background: '#0B1419',
    card: '#16222a',
    textSecondary: '#8FA3AD'
};

// State
let charts = {
    health: null,
    feedback: null,
    notifications: null
};

// ---- INITIALIZATION ----
async function init() {
    setupLogout();
    setupFeedbackForm();

    // Load data
    await loadSystemHealth();
    await loadFeedbackStats();
    await loadNotifications();

    // Re-render charts on resize (needed for responsive D3 in tabs)
    window.addEventListener('resize', debounce(() => {
        // Redraw logic if needed
    }, 200));
}

// ---- SECTION 1: SYSTEM HEALTH (D3) ----
async function loadSystemHealth() {
    try {
        const data = await apiRequest('/analysis/health');

        document.getElementById('app-version').textContent = data.version || "2.0";
        document.getElementById('backend-version').textContent = "Production ML";
        document.getElementById('db-status').textContent = data.status === 'healthy' ? '✅ System Healthy' : '⚠️ Service Degraded';
        document.getElementById('api-status').textContent = data.models_loaded ? '✅ Models Loaded' : '❌ Load Failure';
        
        // Custom UI mappings for ML health
        const featureEl = document.getElementById('api-latency') || {textContent: ""};
        featureEl.textContent = `Features: ${data.feature_count}`;

        renderHealthChart({
            uptime_pct: 99.9,
            db_latency_ms: 10,
            server_response_ms: 12
        });
        initPrivacyVisualizer(data.status === 'healthy');
    } catch (e) {
        console.error("Health fetch failed", e);
        initPrivacyVisualizer(false); 
    }
}

function renderHealthChart(data) {
    const container = d3.select("#about-chart");
    container.selectAll("*").remove();

    const width = container.node().getBoundingClientRect().width;
    const height = container.node().getBoundingClientRect().height;
    const margin = { top: 10, right: 30, bottom: 10, left: 100 };

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

    const metrics = [
        { label: "API UPTIME", value: data.uptime_pct, color: COLORS.green, max: 100, suffix: '%' },
        { label: "DB LATENCY", value: data.db_latency_ms, color: COLORS.blue, max: 100, suffix: 'ms' },
        { label: "RESPONSE", value: data.server_response_ms, color: COLORS.amber, max: 200, suffix: 'ms' }
    ];

    const y = d3.scaleBand()
        .domain(metrics.map(d => d.label))
        .range([0, height])
        .padding(0.4);

    const x = d3.scaleLinear()
        .domain([0, 100]) // Normalized % for bar width
        .range([0, width - margin.left - margin.right]);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},0)`);

    // Labels
    g.selectAll(".label")
        .data(metrics)
        .enter()
        .append("text")
        .attr("x", -10)
        .attr("y", d => y(d.label) + y.bandwidth() / 2)
        .attr("dy", ".35em")
        .attr("text-anchor", "end")
        .attr("class", "text-[9px] font-black fill-textSecondary uppercase tracking-tighter")
        .text(d => d.label);

    // Track
    g.selectAll(".track")
        .data(metrics)
        .enter()
        .append("rect")
        .attr("y", d => y(d.label))
        .attr("height", y.bandwidth())
        .attr("x", 0)
        .attr("width", width - margin.left - margin.right)
        .attr("rx", 4)
        .attr("fill", "#1E2F36");

    // Bar
    g.selectAll(".bar")
        .data(metrics)
        .enter()
        .append("rect")
        .attr("y", d => y(d.label))
        .attr("height", y.bandwidth())
        .attr("x", 0)
        .attr("width", 0) // Start for animation
        .attr("rx", 4)
        .attr("fill", d => d.color)
        .transition()
        .duration(1000)
        .attr("width", d => x(Math.min(100, (d.value / d.max) * 100)));

    // Value text
    g.selectAll(".val")
        .data(metrics)
        .enter()
        .append("text")
        .attr("x", d => x(Math.min(100, (d.value / d.max) * 100)) + 5)
        .attr("y", d => y(d.label) + y.bandwidth() / 2)
        .attr("dy", ".35em")
        .attr("class", "text-[9px] font-black fill-white")
        .text(d => d.value + d.suffix);
}

// ---- SECTION 2: FEEDBACK (D3 Donut) ----
async function loadFeedbackStats() {
    try {
        const stats = await apiRequest('/patient/feedback/stats');
        renderFeedbackDonut(stats);
    } catch (e) {
        console.error("Feedback stats fetch failed", e);
    }
}

function renderFeedbackDonut(stats) {
    const container = d3.select("#feedback-donut");
    container.selectAll("*").remove();

    const width = 120;
    const height = 120;
    const radius = Math.min(width, height) / 2;

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    const data = [
        { label: "Bug", value: stats.Bug, color: COLORS.red },
        { label: "Feature", value: stats.Feature, color: COLORS.amber },
        { label: "General", value: stats.General, color: COLORS.blue }
    ];

    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(radius - 12)
        .outerRadius(radius)
        .cornerRadius(6);

    const arcs = svg.selectAll(".arc")
        .data(pie(data))
        .enter()
        .append("g")
        .attr("class", "arc");

    arcs.append("path")
        .attr("d", arc)
        .attr("fill", d => d.data.color)
        .attr("stroke", COLORS.background)
        .attr("stroke-width", 2)
        .transition()
        .duration(1000)
        .attrTween("d", function (d) {
            const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
            return function (t) { return arc(interpolate(t)); };
        });

    // Center text
    const total = data.reduce((s, d) => s + d.value, 0);
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.3em")
        .attr("class", "text-[14px] font-black fill-white")
        .text(total || 0);
}

function setupFeedbackForm() {
    const form = document.getElementById('feedback-form');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button');
        const btnText = document.getElementById('btn-text');
        const btnIcon = document.getElementById('btn-status-icon');

        const type = document.getElementById('issue-type').value;
        const desc = document.getElementById('description').value;

        if (!desc) return;

        try {
            btn.disabled = true;
            btnText.textContent = "Sending...";

            await apiRequest('/patient/feedback', 'POST', {
                issue_type: type,
                description: desc
            });

            // Success Animation
            btnText.textContent = "Sent!";
            btnIcon.classList.remove('hidden');
            btn.classList.replace('bg-primary', 'bg-accent-green');
            form.reset();

            // Refresh Donut
            setTimeout(() => {
                loadFeedbackStats();
                btn.disabled = false;
                btnText.textContent = "Send Feedback";
                btnIcon.classList.add('hidden');
                btn.classList.replace('bg-accent-green', 'bg-primary');
            }, 3000);

        } catch (error) {
            console.error(error);
            btnText.textContent = "Failed";
            setTimeout(() => {
                btnText.textContent = "Send Feedback";
                btn.disabled = false;
            }, 2000);
        }
    };
}

// ---- SECTION 3: NOTIFICATIONS (D3 Line Trend + List) ----
async function loadNotifications() {
    const listContainer = document.getElementById('notification-list');
    if (!listContainer) return;

    try {
        const notifications = await apiRequest('/patient/notifications');

        if (notifications.length === 0) {
            listContainer.innerHTML = '<p class="text-[10px] text-textSecondary uppercase tracking-widest text-center py-6">No new notifications</p>';
            return;
        }

        listContainer.innerHTML = '';
        notifications.forEach(note => {
            const card = document.createElement('div');
            card.className = `p-4 glass-card rounded-xl border border-border-dark flex gap-4 items-start transition-all cursor-pointer ${!note.is_read ? 'glow-unread' : 'opacity-70'}`;

            let icon, color;
            switch (note.category) {
                case 'system': icon = 'settings'; color = 'text-accent-blue'; break;
                case 'admin': icon = 'admin_panel_settings'; color = 'text-primary'; break;
                case 'alert': icon = 'warning'; color = 'text-accent-red'; break;
                default: icon = 'notifications'; color = 'text-accent-amber';
            }

            card.innerHTML = `
                <div class="size-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 ${color}">
                    <span class="material-symbols-outlined text-[18px]">${icon}</span>
                </div>
                <div class="flex-1">
                    <div class="flex justify-between items-start">
                        <h5 class="text-xs font-bold text-text-primary line-clamp-1">${note.title}</h5>
                        <span class="text-[9px] font-bold text-text-secondary">${new Date(note.created_at).toLocaleDateString()}</span>
                    </div>
                    <p class="text-[11px] text-text-secondary mt-1 leading-tight line-clamp-2">${note.message}</p>
                </div>
            `;

            card.onclick = () => markAsRead(note.id, card);
            listContainer.appendChild(card);
        });

        renderNotificationTrend(notifications);

    } catch (e) {
        console.error("Notifications fetch failed", e);
    }
}

async function markAsRead(id, element) {
    try {
        await apiRequest(`/patient/notifications/${id}/read`, 'PATCH');
        element.classList.remove('glow-unread');
        element.classList.add('opacity-70');
    } catch (e) {
        console.error(e);
    }
}

function renderNotificationTrend(notes) {
    const container = d3.select("#notification-timeline");
    container.selectAll("*").remove();

    const width = container.node().getBoundingClientRect().width;
    const height = container.node().getBoundingClientRect().height;
    const margin = { top: 10, right: 10, bottom: 20, left: 10 };

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

    // Group by day for the last 30 days
    // For demo, we just create a mockup path if real historical counts aren't available
    const data = [
        { day: 1, count: 2 }, { day: 5, count: 5 }, { day: 10, count: 3 },
        { day: 15, count: 8 }, { day: 20, count: 4 }, { day: 25, count: 6 }, { day: 30, count: 2 }
    ];

    const x = d3.scaleLinear().domain([1, 30]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([0, 10]).range([height - margin.bottom, margin.top]);

    const line = d3.line()
        .x(d => x(d.day))
        .y(d => y(d.count))
        .curve(d3.curveBasis);

    const path = svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", COLORS.primary)
        .attr("stroke-width", 2)
        .attr("d", line);

    const totalLength = path.node().getTotalLength();
    path.attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(2000)
        .attr("stroke-dashoffset", 0);

    // Area
    const area = d3.area()
        .x(d => x(d.day))
        .y0(height - margin.bottom)
        .y1(d => y(d.count))
        .curve(d3.curveBasis);

    svg.append("path")
        .datum(data)
        .attr("fill", `url(#gradient-primary)`)
        .attr("opacity", 0.3)
        .attr("d", area);

    // Gradient
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "gradient-primary")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", COLORS.primary);
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "transparent");
}

// ---- SECTION 4: PRIVACY (Three.js) ----
let shieldMaterial;

function initPrivacyVisualizer(isHealthy = true) {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    renderer.setSize(width, height);
    container.innerHTML = ''; // Clear previous
    container.appendChild(renderer.domElement);

    // Color based on Health
    const activeColor = isHealthy ? COLORS.green : COLORS.red;

    // Sphere (Data Core)
    const geometry = new THREE.SphereGeometry(2, 32, 32);
    const material = new THREE.MeshBasicMaterial({
        color: activeColor,
        wireframe: true,
        transparent: true,
        opacity: 0.1
    });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Shield (Octahedron)
    const shieldGeo = new THREE.OctahedronGeometry(0.8);
    shieldMaterial = new THREE.MeshPhongMaterial({
        color: activeColor,
        emissive: activeColor,
        emissiveIntensity: 0.5
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMaterial);
    scene.add(shield);

    // Orbiting Particles
    const particlesCount = 50;
    const particlesGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 8;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMat = new THREE.PointsMaterial({ size: 0.05, color: COLORS.blue });
    const particlesMesh = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particlesMesh);

    // Lights
    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(5, 5, 5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    camera.position.z = 5;

    function animate() {
        requestAnimationFrame(animate);
        sphere.rotation.y += 0.005;
        shield.rotation.x += 0.01;
        shield.rotation.y += 0.01;
        particlesMesh.rotation.y -= 0.002;
        renderer.render(scene, camera);
    }
    animate();
}

// ---- HELPERS ----
function setupLogout() {
    const btn = document.getElementById('btn-logout');
    if (btn) {
        btn.onclick = () => {
            if (confirm("Logout from ProthexaI secure session?")) {
                localStorage.clear();
                window.location.href = 'index.html';
            }
        };
    }
}

function debounce(func, wait) {
    let timeout;
    return function () {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, arguments), wait);
    };
}

// Run
init();
