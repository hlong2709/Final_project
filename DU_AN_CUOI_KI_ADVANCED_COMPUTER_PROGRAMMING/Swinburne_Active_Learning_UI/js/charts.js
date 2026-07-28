// Setup Chart.js Defaults for Dark Theme
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";

let engagementChartInstance = null;
let studentFocusChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    initDashboardCharts();
});

function initDashboardCharts() {
    const canvasEngagement = document.getElementById('engagementChart');
    if(!canvasEngagement) return;
    
    const ctxEngagement = canvasEngagement.getContext('2d');
    
    const gradient = ctxEngagement.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(230, 0, 40, 0.4)');
    gradient.addColorStop(1, 'rgba(230, 0, 40, 0.0)');

    window.engagementChartInstance = new Chart(ctxEngagement, {
        type: 'line',
        data: {
            labels: ['08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30'],
            datasets: [{
                label: 'Mức độ tập trung (%)',
                data: [85, 90, 88, 95, 92, 94, 93],
                borderColor: '#E60028',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#E60028',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 17, 21, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// Function to dynamically update Engagement Chart based on dropdown filter
window.updateEngagementChartMetric = function(metricType, customData = null) {
    if (!window.engagementChartInstance) return;

    const chart = window.engagementChartInstance;
    const defaultLabels = ['08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30'];
    const labels = customData && customData.labels ? customData.labels : defaultLabels;

    if (metricType === 'handraise') {
        chart.config.type = 'bar';
        chart.data.labels = labels;
        chart.data.datasets = [{
            label: 'Số Lượt Giơ Tay Phát Biểu',
            data: customData && customData.handraises ? customData.handraises : [12, 24, 38, 52, 65, 76, 84],
            backgroundColor: '#3b82f6',
            borderColor: '#2563eb',
            borderRadius: 6
        }];
        chart.options.scales.y.max = undefined;
    } else if (metricType === 'distracted') {
        chart.config.type = 'line';
        chart.data.labels = labels;
        chart.data.datasets = [{
            label: 'Mức Độ Mất Tập Trung (%)',
            data: customData && customData.distracted ? customData.distracted : [15, 10, 12, 5, 8, 6, 7],
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
        }];
        chart.options.scales.y.max = 100;
    } else {
        // focus
        chart.config.type = 'line';
        chart.data.labels = labels;
        chart.data.datasets = [{
            label: 'Mức Độ Tập Trung (%)',
            data: customData && customData.focus ? customData.focus : [85, 90, 88, 95, 92, 94, 93],
            borderColor: '#E60028',
            backgroundColor: 'rgba(230, 0, 40, 0.2)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
        }];
        chart.options.scales.y.max = 100;
    }

    chart.update();
};

// Function to render/update specific student chart in Focus View using actual backend data
window.renderStudentFocusChart = function(studentData) {
    const canvasFocus = document.getElementById('studentFocusChart');
    if(!canvasFocus) return;
    
    const ctx = canvasFocus.getContext('2d');
    
    if (studentFocusChartInstance) {
        studentFocusChartInstance.destroy();
    }

    const counts = studentData.behavior_counts || { focus: 0, hand_raising: 0, distracted: 0 };
    const dataPoints = [
        counts.focus || 8, 
        counts.hand_raising || 5, 
        counts.distracted || 1
    ];

    studentFocusChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Tập trung (+1)', 'Giơ tay (+10)', 'Thiếu tập trung (-2)'],
            datasets: [{
                label: `Hành vi của ${studentData.name}`,
                data: dataPoints,
                backgroundColor: [
                    '#10b981', // focus: green
                    '#3b82f6', // hand_raising: blue
                    '#ef4444'  // distracted: red
                ],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', precision: 0 }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 17, 21, 0.9)'
                }
            }
        }
    });
};
