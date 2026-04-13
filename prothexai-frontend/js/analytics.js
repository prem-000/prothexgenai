import { apiRequest, API_BASE_URL } from './api.js';

// ---- CHART CONFIGURATION ----
const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: '#1E2F36',
            titleColor: '#fff',
            bodyColor: '#cbd5e1',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 8,
            displayColors: false,
            callbacks: {
                label: (context) => `${context.parsed.y} ${context.dataset.units || ''}`
            }
        }
    },
    scales: {
        x: {
            grid: { display: false, drawBorder: false },
            ticks: { color: '#64748b', font: { size: 10 } }
        },
        y: {
            grid: { color: '#334155', borderDash: [4, 4], drawBorder: false },
            ticks: { color: '#64748b', font: { size: 10 } }
        }
    }
};

let charts = {}; // Store chart instances

// ---- INITIALIZATION ----

async function initAnalytics() {
    setupTabSwitching();
    setupDownloadButton();

    try {
        // 1. Fetch Data
        // Using /patient/history to get raw daily metrics
        const rawData = await apiRequest('/patient/history?days=30');

        if (!rawData || rawData.length === 0) {
            showNoDataState();
            return;
        }

        // 2. Process Data
        const dailyData = processData(rawData);

        if (dailyData.length === 0) {
            showNoDataState();
            return;
        }

        // 3. Render Charts & Stats
        renderCharts(dailyData);
        updateSummaries(dailyData);

    } catch (error) {
        console.error("Analytics Init Failed", error);
        showNoDataState();
    }
}

// ---- DATA PROCESSING ----

function processData(rawData) {
    // 1. Filter Invalid Records (Zeros)
    const validRecords = rawData.filter(r => {
        // According to requirements: "Ignore records where speed, symmetry, stride, cadence = 0"
        return r.walking_speed_mps > 0 &&
            r.gait_symmetry_index > 0 &&
            r.step_length_cm > 0 &&
            r.cadence_spm > 0;
    });

    // 2. Group by Date
    const grouped = {};
    validRecords.forEach(r => {
        const dateKey = r.date || (r.timestamp ? r.timestamp.split('T')[0] : null);
        if (!dateKey) return;

        if (!grouped[dateKey]) {
            grouped[dateKey] = [];
        }

        // Pre-normalize symmetry for each record if needed
        // If symmetry <= 1, it's a ratio. Convert to %.
        // If it's stored as ratio 0.95 -> 95. If stored as 95 -> 95.
        // We do this here before aggregation to ensure averages are correct.
        let sym = r.gait_symmetry_index;
        if (sym <= 1) sym *= 100;

        grouped[dateKey].push({ ...r, gait_symmetry_index: sym });
    });

    // 3. Aggregate Daily Averages
    const aggregated = Object.keys(grouped).sort().map(date => {
        const records = grouped[date];
        const count = records.length;

        const avg = (key) => records.reduce((sum, rec) => sum + (rec[key] || 0), 0) / count;
        // Max for wear hours (cumulative usually tracked as max daily value)
        const max = (key) => Math.max(...records.map(rec => rec[key] || 0));

        return {
            date: date,
            gait_symmetry_index: avg('gait_symmetry_index'),
            walking_speed_mps: avg('walking_speed_mps'),
            step_length_cm: avg('step_length_cm'),
            cadence_spm: avg('cadence_spm'),
            daily_wear_hours: max('daily_wear_hours'),
            prosthetic_health_score: avg('prosthetic_health_score'),
            skin_temperature_c: avg('skin_temperature_c'),
            skin_moisture: avg('skin_moisture'),
            pressure_distribution_index: avg('pressure_distribution_index')
        };
    });

    return aggregated;
}

// ---- RENDERING ----

function updateSummaries(data) {
    const total = data.length;
    const avg = (key) => data.reduce((sum, d) => sum + d[key], 0) / total;

    // GAIT TAB SUMMARIES
    setSafeText('avg-sym', `${avg('gait_symmetry_index').toFixed(0)}%`);
    setSafeHTML('avg-speed', `${avg('walking_speed_mps').toFixed(2)} <span class="text-xs font-normal text-slate-500">m/s</span>`);
    setSafeHTML('avg-stride', `${avg('step_length_cm').toFixed(1)} <span class="text-xs font-normal text-slate-500">cm</span>`);
    setSafeHTML('avg-cadence', `${avg('cadence_spm').toFixed(0)} <span class="text-xs font-normal text-slate-500">spm</span>`);

    // AI INSIGHT (Simple Rule-based Update)
    const last = data[data.length - 1]; // sorted ASC
    const sym = last.gait_symmetry_index;
    const speed = last.walking_speed_mps;
    const insightText = document.getElementById('ai-insight-text');

    if (insightText) {
        if (sym > 90 && speed > 1.0) {
            insightText.textContent = "Excellent gait symmetry and speed correlation. Clinical indicators are optimal.";
        } else if (sym < 80) {
            insightText.textContent = "Symmetry deviation detected. Consider checking prosthetic fit or alignment.";
        } else {
            insightText.textContent = "Metrics are stable. Continue current activity levels.";
        }
    }
}

function renderCharts(data) {
    const labels = data.map(d => new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));

    // 1. GAIT PERFORMANCE (Dual Axis)
    createChart('chart-gait-dual', 'line', {
        labels: labels,
        datasets: [
            {
                label: 'Symmetry',
                data: data.map(d => d.gait_symmetry_index),
                borderColor: '#0EA5E9', // Blue
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 2,
                yAxisID: 'y',
                units: '%'
            },
            {
                label: 'Speed',
                data: data.map(d => d.walking_speed_mps),
                borderColor: '#ec5b13', // Orange/Primary
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 2,
                yAxisID: 'y1',
                units: 'm/s'
            }
        ]
    }, {
        scales: {
            x: commonOptions.scales.x,
            y: { ...commonOptions.scales.y, min: 0, max: 100, position: 'left' },
            y1: { ...commonOptions.scales.y, min: 0, max: 2.0, position: 'right', grid: { display: false } }
        }
    });

    // 2. WEAR HOURS (Bar)
    createChart('chart-wear-hours', 'bar', {
        labels: labels,
        datasets: [{
            label: 'Hours',
            data: data.map(d => d.daily_wear_hours),
            backgroundColor: '#1E293B',
            hoverBackgroundColor: '#ec5b13',
            borderRadius: 4,
            barThickness: 12,
            units: 'hrs'
        }]
    }, {
        scales: {
            x: commonOptions.scales.x,
            y: { ...commonOptions.scales.y, min: 0, max: 24 } // Max 24 hours
        }
    });

    // 3. HEALTH SCORE TREND (Line)
    const healthData = data.filter(d => d.prosthetic_health_score > 0);
    const healthLabels = healthData.map(d => new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));

    createChart('chart-health-trend', 'line', {
        labels: healthLabels,
        datasets: [{
            label: 'Score',
            data: healthData.map(d => d.prosthetic_health_score),
            borderColor: '#ec5b13',
            backgroundColor: 'rgba(236, 91, 19, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            units: 'pts'
        }]
    }, {
        scales: {
            x: commonOptions.scales.x,
            y: { ...commonOptions.scales.y, min: 0, max: 100 }
        }
    });

    // 4. PRESSURE & SKIN (Multi-line Dual Axis)
    createChart('chart-pressure-skin', 'line', {
        labels: labels,
        datasets: [
            {
                label: 'Pressure',
                data: data.map(d => d.pressure_distribution_index),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 3,
                yAxisID: 'y',
                units: ' index'
            },
            {
                label: 'Moisture',
                data: data.map(d => d.skin_moisture),
                borderColor: '#3b82f6',
                borderWidth: 1.5,
                borderDash: [5, 5],
                tension: 0.4,
                pointRadius: 0,
                yAxisID: 'y',
                units: '%'
            },
            {
                label: 'Temp',
                data: data.map(d => d.skin_temperature_c),
                borderColor: '#22c55e',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 3,
                yAxisID: 'y1',
                units: '°C'
            }
        ]
    }, {
        scales: {
            x: commonOptions.scales.x,
            y: {
                ...commonOptions.scales.y,
                min: 0,
                max: 1.2,
                position: 'left',
                title: { display: true, text: 'Pressure/Moisture', color: '#64748b', font: { size: 8 } }
            },
            y1: {
                ...commonOptions.scales.y,
                min: 30,
                max: 40,
                position: 'right',
                grid: { display: false },
                title: { display: true, text: 'Temperature', color: '#64748b', font: { size: 8 } }
            }
        }
    });

    // Update Pressure Clinical Insight
    updatePressureInsights(data[data.length - 1]);
}

function updatePressureInsights(last) {
    if (!last) return;

    const insightText = document.getElementById('ai-insight-text');
    const correlationLabel = document.querySelector('.text-accent-green');

    let risks = [];
    if (last.pressure_distribution_index > 1.0) risks.push("High Pressure Risk");
    if (last.skin_temperature_c > 35) risks.push("Elevated Skin Temperature");
    if (last.skin_moisture > 80) risks.push("Excessive Moisture Warning");

    if (insightText) {
        if (risks.length > 0) {
            insightText.textContent = `${risks.join(" & ")}. Recommended: Inspect stump for redness and adjust prosthetic fit immediately.`;
            insightText.parentElement.parentElement.classList.add('border-accent-red/50', 'bg-accent-red/5');
            if (correlationLabel) {
                correlationLabel.textContent = "Action Required";
                correlationLabel.className = "text-[10px] font-bold text-accent-red";
            }
        } else {
            insightText.textContent = "Skin and pressure indicators within safe range. Continued monitoring recommended.";
            insightText.parentElement.parentElement.classList.remove('border-accent-red/50', 'bg-accent-red/5');
            // Reset to defaults if needed
        }
    }
}

// ---- HELPER FUNCTIONS ----

function createChart(canvasId, type, data, extraOptions = {}) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // Destroy existing chart
    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    // Create new chart
    charts[canvasId] = new Chart(ctx, {
        type: type,
        data: data,
        options: {
            ...commonOptions,
            ...extraOptions
        }
    });
}

function showNoDataState() {
    const containers = ['content-gait', 'content-recovery', 'content-pressure'];
    containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-slate-500">
                    <span class="material-symbols-outlined text-4xl mb-2">analytics</span>
                    <p class="text-sm font-bold">No pressure data available</p>
                    <p class="text-xs uppercase tracking-widest mt-1">Submit daily metrics to see trends</p>
                </div>
            `;
        }
    });
}

function setSafeText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setSafeHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

function setupTabSwitching() {
    window.switchTab = (tab) => {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        const content = document.getElementById(`content-${tab}`);
        if (content) content.classList.remove('hidden');

        document.querySelectorAll('.tab-btn').forEach(el => {
            el.className = "flex-1 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-300 transition-all tab-btn";
        });
        const activeBtn = document.getElementById(`tab-${tab}`);
        if (activeBtn) activeBtn.className = "flex-1 py-1.5 text-xs font-bold rounded-lg bg-primary text-white shadow-sm transition-all tab-btn";

        // Resize charts when tab becomes visible (sometimes Canvas needs this)
        Object.values(charts).forEach(chart => chart.resize());
    };
}

function setupDownloadButton() {
    const btn = document.getElementById('btn-download-report');
    if (btn) {
        btn.onclick = async () => {
            try {
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Downloading...';
                btn.disabled = true;

                const token = localStorage.getItem('token');
                // Using /report/patient/download-report endpoint
                const response = await fetch('http://localhost:8000/report/patient/download-report', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) throw new Error("Download failed");

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ProthexaI_Report_${new Date().toISOString().split('T')[0]}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                btn.innerHTML = originalHTML;
                btn.disabled = false;
            } catch (e) {
                console.error(e);
                btn.textContent = "Error";
                setTimeout(() => {
                    btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">download</span> <span class="text-xs font-bold">Report</span>';
                    btn.disabled = false;
                }, 2000);
            }
        };
    }
}

// Start
initAnalytics();
