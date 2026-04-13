import { apiRequest, API_BASE_URL } from './api.js';
import { drawGauge } from './gauge.js';
import { DualAxisCorrelationChart } from './correlationChart.js';
import { RecoveryChart } from './recoveryChart.js';
import { PressureHeatmap } from './heatmap.js';

// Elements
const greeting = document.getElementById('user-greeting');
const aiSummary = document.getElementById('ai-summary');
const alertsList = document.getElementById('alerts-list');
const lastUpdated = document.getElementById('last-updated');

// Modal Logic
const modal = document.getElementById('upload-modal');
const btnUpload = document.getElementById('btn-upload');
const btnClose = document.getElementById('close-modal');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

btnUpload.onclick = () => { modal.style.display = 'flex'; };
btnClose.onclick = () => { modal.style.display = 'none'; };
window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

dropZone.onclick = () => fileInput.click();
dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
dropZone.ondragleave = () => dropZone.classList.remove('dragover');
dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleUpload(e.dataTransfer.files[0]);
};

// Manual Entry Modal Logic
const manualModal = document.getElementById('manual-modal');
const btnManual = document.getElementById('btn-manual');
const btnCloseManual = document.getElementById('close-manual');
const manualForm = document.getElementById('manual-form');

btnManual.onclick = () => { manualModal.style.display = 'flex'; };
btnCloseManual.onclick = () => { manualModal.style.display = 'none'; };
window.onclick = (e) => {
    if (e.target === modal) modal.style.display = 'none';
    if (e.target === manualModal) manualModal.style.display = 'none';
};

function validateInput(data) {
    if (!data.step_length || !data.cadence || !data.speed || !data.symmetry || 
        !data.temperature || !data.moisture || !data.pressure || !data.wear_hours) {
        throw new Error("All clinical fields are required.");
    }

    if (data.symmetry < 0 || data.symmetry > 1) {
        throw new Error("Clinical Error: Symmetry must be between 0 and 1.");
    }

    if (data.pressure < 0) {
        throw new Error("Clinical Error: Pressure cannot be negative.");
    }

    if (data.wear_hours < 0 || data.wear_hours > 24) {
        throw new Error("Clinical Error: Wear hours must be between 0 and 24.");
    }

    if (data.step_length <= 0 || data.cadence <= 0 || data.speed <= 0) {
        throw new Error("Clinical Error: Movement metrics must be positive.");
    }
}

manualForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('manual-status');
    const submitBtn = manualForm.querySelector('button[type="submit"]');

    const payload = {
        step_length: parseFloat(document.getElementById('step_length').value),
        cadence: parseFloat(document.getElementById('cadence').value),
        speed: parseFloat(document.getElementById('walking_speed').value),
        symmetry: parseFloat(document.getElementById('gait_symmetry').value),
        temperature: parseFloat(document.getElementById('skin_temp').value),
        moisture: parseFloat(document.getElementById('skin_moisture').value),
        pressure: parseFloat(document.getElementById('pressure_dist').value),
        wear_hours: parseFloat(document.getElementById('wear_hours').value)
    };

    try {
        // Validation Layer
        validateInput(payload);

        statusEl.textContent = 'Analyzing Biometrics...';
        statusEl.style.color = 'var(--text-muted)';
        submitBtn.disabled = true;

        const result = await apiRequest('/analysis/analyze', 'POST', payload);
        
        statusEl.textContent = `✓ ML Analysis Success! Risk: ${result.risk_level}`;
        statusEl.style.color = 'var(--green)';

        setTimeout(() => {
            manualModal.style.display = 'none';
            manualForm.reset();
            submitBtn.disabled = false;
            loadDashboard(); // Refresh
        }, 1500);
    } catch (error) {
        statusEl.textContent = '✗ Analysis Blocked: ' + error.message;
        statusEl.style.color = 'var(--red)';
        submitBtn.disabled = false;
    }
});

fileInput.onchange = (e) => handleUpload(e.target.files[0]);

async function handleUpload(file) {
    if (!file) return;
    const status = document.getElementById('upload-status');
    status.textContent = 'Uploading...';

    // Check type
    if (!file.name.endsWith('.csv')) {
        status.textContent = 'Error: Only .csv files allowed.';
        status.style.color = 'var(--red)';
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE_URL}/patient/upload-gait`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || 'Upload failed');
        }

        status.textContent = 'Analysis complete!';
        status.style.color = 'var(--green)';
        setTimeout(() => {
            modal.style.display = 'none';
            loadDashboard(); 
        }, 1500);

    } catch (err) {
        status.textContent = 'Validation failed: ' + err.message;
        status.style.color = 'var(--red)';
    }
}

async function updateHealthScore(patientId, existingScore = null) {
    try {
        let score = existingScore;
        let riskLevel = null;

        if (score === null && patientId) {
            const data = await apiRequest(`/patient/daily_metrics/${patientId}/latest`);
            score = data.prosthetic_health_score;
            riskLevel = data.risk_level;
        }

        // Default to 0 if nothing found
        if (score === null || score === undefined) score = 0;
        
        // Fallback risk level calculation if not provided by backend
        const riskText = riskLevel || (score >= 85 ? 'Low' : score >= 60 ? 'Moderate' : 'High');
        
        const scoreVal = document.getElementById('health-score-val');
        const gaugeArc = document.getElementById('gauge-arc');
        const statusBadge = document.getElementById('health-status-badge');

        if (!scoreVal || !gaugeArc || !statusBadge) return;

        scoreVal.textContent = Math.round(score);

        let riskColor;
        
        switch (riskText) {
            case 'Low': riskColor = '#22c55e'; break;
            case 'Moderate': riskColor = '#f59e0b'; break;
            case 'High': riskColor = '#ef4444'; break;
            default: riskColor = '#0EA5E9';
        }

        // SVG dashoffset: 125.66 is full semi-circle length for radius 40
        const offset = 125.66 - (score / 100 * 125.66);
        gaugeArc.style.strokeDashoffset = offset;
        gaugeArc.style.stroke = riskColor;
        scoreVal.style.color = riskColor;

        if (statusBadge) {
            statusBadge.textContent = `Status: ${riskText} Risk`;
            statusBadge.style.color = riskColor;
            statusBadge.style.backgroundColor = `${riskColor}1A`; // 10% opacity
        }

    } catch (e) {
        console.error("Failed to update health score gauge", e);
    }
}

// Logic to load dashboard
async function loadDashboard() {
    try {
        const data = await apiRequest('/patient/dashboard', 'GET');

        // 1. Basic Info
        greeting.textContent = `Welcome back, ${data.patient_name}`;

        // 2. Health Score - Prefer data from dashboard object first
        const token = localStorage.getItem('token');
        const decoded = parseJwt(token);
        const patientId = decoded?.patient_id;

        await updateHealthScore(patientId, data.latest_health_score);

        // 2. Update Stats (Symmetry & Speed)
        if (data.trends && data.trends.symmetry && data.trends.symmetry.length > 0) {
            let lastSym = data.trends.symmetry[data.trends.symmetry.length - 1];
            if (lastSym <= 1) lastSym *= 100;
            const lastSpeed = data.trends.walking_speed[data.trends.walking_speed.length - 1];
            const symEl = document.getElementById('stat-symmetry');
            if (symEl) symEl.textContent = lastSym.toFixed(0) + "%";
            const speedEl = document.getElementById('stat-speed');
            if (speedEl) speedEl.textContent = lastSpeed.toFixed(1);
        }

        // 3. AI Summary
        if (data.analysis && !data.analysis.includes("temporarily unavailable")) {
            aiSummary.textContent = data.analysis;
        } else {
            aiSummary.textContent = data.analysis || "No recent AI analysis available. Submit your first daily metrics to get started!";
        }

        // 4. Alerts
        alertsList.innerHTML = '';
        if (data.recent_alerts && data.recent_alerts.length > 0) {
            data.recent_alerts.forEach(alert => {
                const div = document.createElement('div');
                div.className = 'alert-item alert-warning';
                div.innerHTML = `⚠️ ${alert}`;
                alertsList.appendChild(div);
            });
        }

        // 5. New Analytics Charts Integration
        if (data.trends && data.trends.symmetry) {
            const count = data.trends.symmetry.length;
            const correlationData = [];
            const today = new Date();
            for (let i = 0; i < count; i++) {
                const d = new Date();
                d.setDate(today.getDate() - (count - 1 - i));
                correlationData.push({
                    date: d.toISOString().split('T')[0],
                    gait_symmetry_index: data.trends.symmetry[i] * 100,
                    walking_speed_mps: data.trends.walking_speed[i]
                });
            }
            const correlationChart = new DualAxisCorrelationChart("#correlation-chart");
            correlationChart.render(correlationData);
            const recoveryData = data.trends.health_score.map((val, i) => ({
                date: correlationData[i].date,
                health_score: val
            }));
            const recoveryChart = new RecoveryChart("#recovery-chart");
            recoveryChart.render(recoveryData);
            const heatmap = new PressureHeatmap("#heatmap-chart");
            const basePressure = (data.trends.pressure_distribution[count - 1] || 0.8) * 100;
            const fillMap = () => Array.from({ length: 72 }, () => Math.max(0, Math.min(100, basePressure + (Math.random() * 20 - 10))));
            heatmap.render({ left: fillMap(), right: fillMap() });
        }

        // 6. Calendar - Real Data Calculation
        await renderCalendar(data);

    } catch (error) {
        console.error("Dashboard load failed", error);
        aiSummary.textContent = "Failed to load dashboard. " + (error.message || "Please check your profile and try again.");
    }
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

async function renderCalendar(dashboardData) {
    const container = document.getElementById('calendar-grid-container');
    if (!container) return;
    container.innerHTML = '';

    const todayDate = new Date();
    const currentDay = todayDate.getDate();
    const currentMonthStr = todayDate.toISOString().slice(0, 7); // YYYY-MM
    const daysInMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1).getDay();
    const startOffset = (firstDay + 6) % 7;

    // 1. Get patient_id from token
    const token = localStorage.getItem('token');
    const decoded = parseJwt(token);
    let patientId = decoded ? decoded.patient_id : null;

    // Fallback: If not in token (not logged in after change), fetch profile
    if (!patientId) {
        try {
            const profile = await apiRequest('/patient/profile');
            patientId = profile.id;
        } catch (e) {
            console.error("Could not resolve patient_id for calendar");
            return;
        }
    }

    // 2. Fetch monthly records
    let records = [];
    try {
        records = await apiRequest(`/patient/daily_metrics/${patientId}?month=${currentMonthStr}`);
    } catch (e) {
        console.error("Failed to fetch monthly metrics", e);
    }

    // 3. Build a date map (YYYY-MM-DD -> boolean)
    const attendanceMap = {};
    records.forEach(record => {
        const isValid =
            record.walking_speed_mps > 0 &&
            record.gait_symmetry_index > 0 &&
            record.step_length_cm > 0 &&
            record.cadence_spm > 0;

        if (isValid) {
            attendanceMap[record.date] = true;
        }
    });

    let attendedCount = 0;

    // Render Tiles
    for (let i = 0; i < startOffset; i++) {
        const empty = document.createElement('div');
        empty.className = 'aspect-square rounded bg-transparent';
        container.appendChild(empty);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const tile = document.createElement('div');
        tile.className = 'aspect-square rounded flex items-center justify-center text-xs font-bold transition-all cursor-default';
        tile.textContent = i;

        const formattedDate = `${currentMonthStr}-${String(i).padStart(2, '0')}`;

        if (i === currentDay) {
            tile.classList.add('border-2', 'border-accent-blue', 'relative');
        }

        if (attendanceMap[formattedDate]) {
            tile.classList.add('bg-[#22c55e]', 'text-white'); // Green
            if (i <= currentDay) attendedCount++;
        } else if (i < currentDay) {
            tile.classList.add('bg-[#ef4444]/30', 'text-[#ef4444]'); // Red
        } else {
            tile.classList.add('bg-slate-50', 'dark:bg-slate-900', 'text-slate-600', 'dark:text-slate-600');
        }

        container.appendChild(tile);
    }

    // 4. Update Compliance Percentage
    const bar = document.getElementById('compliance-progress');
    const pctEl = document.getElementById('compliance-pct');
    if (bar && pctEl) {
        const progress = currentDay > 0 ? Math.round((attendedCount / currentDay) * 100) : 0;
        bar.style.width = `${progress}%`;
        pctEl.textContent = `${progress}%`;
        bar.style.backgroundColor = '#22c55e'; // Ensure progress bar is green
    }

    // 5. Update Today Status Card
    const todayIcon = document.getElementById('today-icon');
    const todayTitle = document.getElementById('today-title');
    const todayScore = document.getElementById('today-score');
    const todayCard = document.getElementById('today-status-card');

    const todayFormatted = todayDate.toISOString().slice(0, 10);
    if (attendanceMap[todayFormatted]) {
        if (todayTitle) todayTitle.textContent = "Today: Submitted";
        if (todayScore) {
            todayScore.textContent = (dashboardData.latest_health_score || 0).toFixed(0);
            todayScore.className = "text-xl font-black text-green-600 dark:text-green-400";
        }
        if (todayIcon) {
            todayIcon.textContent = "check_circle";
            todayIcon.parentElement.className = "size-12 rounded-lg bg-[#22c55e] flex items-center justify-center text-white shrink-0 shadow-lg shadow-green-500/20";
        }
        if (todayCard) {
            todayCard.className = "bg-green-50/50 dark:bg-green-500/5 rounded-xl p-4 border-2 border-[#22c55e]/30 dark:border-[#22c55e]/20 flex items-center gap-4";
        }
    } else {
        if (todayTitle) todayTitle.textContent = "Today: Pending";
        if (todayCard) {
            todayCard.className = "bg-slate-50 dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700 flex items-center gap-4 border-l-4 border-l-[#ef4444]";
        }
    }
}

// Logout (if present in this view)
const contentLogout = document.getElementById('btn-logout');
if (contentLogout) {
    contentLogout.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });
}

// Report Download Logic
const btnDownload = document.getElementById('btn-download-report');
if (btnDownload) {
    btnDownload.addEventListener('click', async () => {
        await downloadReport();
    });
}

// Dedicated Download Function
async function downloadReport() {
    const btnDownload = document.getElementById('btn-download-report');
    const originalContent = btnDownload ? btnDownload.innerHTML : '';

    if (btnDownload) {
        btnDownload.innerHTML = '<span class="material-symbols-outlined animate-spin text-[14px]">progress_activity</span> Downloading...';
        btnDownload.disabled = true;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/report/patient/download-report`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error("Download failed: " + errText);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "ProthexaI_Report.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        if (btnDownload) {
            btnDownload.innerHTML = originalContent;
            btnDownload.disabled = false;
        }

    } catch (error) {
        console.error("Download error:", error);
        if (btnDownload) {
            btnDownload.textContent = "Error";
            btnDownload.classList.add('text-red-500', 'border-red-500');
            setTimeout(() => {
                btnDownload.innerHTML = originalContent;
                btnDownload.classList.remove('text-red-500', 'border-red-500');
                btnDownload.disabled = false;
            }, 3000);
        }
    }
}

// Init
loadDashboard();
