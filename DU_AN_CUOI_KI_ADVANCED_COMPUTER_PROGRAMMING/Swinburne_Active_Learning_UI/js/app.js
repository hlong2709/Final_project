document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = '/api/v1'; // Same origin relative path
    let currentSessionId = null;
    let pollInterval = null;

    // --- 1. Sidebar Navigation Logic ---
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            pages.forEach(page => page.classList.remove('active'));
            
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            const targetPage = document.getElementById(targetId);
            if(targetPage) {
                targetPage.classList.add('active');
            }
        });
    });

    // --- Schedule Card Interactivity ---
    const scheduleCards = document.querySelectorAll('.schedule-card');
    scheduleCards.forEach(card => {
        card.addEventListener('click', () => {
            const courseCode = card.getAttribute('data-course');
            const classSelect = document.getElementById('classSelect');
            if (classSelect && courseCode) {
                classSelect.value = courseCode;
            }
            
            navItems.forEach(nav => nav.classList.remove('active'));
            pages.forEach(page => page.classList.remove('active'));
            
            const videoNav = document.querySelector('.nav-item[data-target="video-analysis"]');
            const videoPage = document.getElementById('video-analysis');
            if (videoNav) videoNav.classList.add('active');
            if (videoPage) videoPage.classList.add('active');
            
            showNotification(`Đã chọn môn [${courseCode}] - Sẵn sàng tải video phân tích!`);
        });
    });

    // --- 2. Notification Dropdown Logic ---
    const notifBtn = document.getElementById('notificationBtn');
    const notifDropdown = document.getElementById('notificationDropdown');
    
    if (notifBtn && notifDropdown) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!notifDropdown.contains(e.target) && e.target !== notifBtn) {
                notifDropdown.classList.remove('show');
            }
        });
    }

    // --- 3. Dynamic Session Loading & Polling ---
    const sessionSelect = document.getElementById('sessionSelect');
    
    async function loadSessions(selectSessionId = null) {
        try {
            const classSelect = document.getElementById('classSelect');
            const selectedCourseCode = classSelect ? classSelect.value : '';
            
            const res = await fetch(`${API_BASE}/dashboard/sessions?course_code=${encodeURIComponent(selectedCourseCode)}`);
            const sessions = await res.json();
            
            sessionSelect.innerHTML = '';
            if (sessions.length === 0) {
                const selectedText = (classSelect && classSelect.options[classSelect.selectedIndex]) ? classSelect.options[classSelect.selectedIndex].text : selectedCourseCode;
                sessionSelect.innerHTML = `<option value="">Chưa có video cho môn [${selectedText}]. Bấm Tải Video</option>`;
                currentSessionId = null;
                
                // Clear video player & reset metrics for empty course
                const videoPlayer = document.getElementById('videoPlayer');
                const videoPlaceholder = document.getElementById('videoPlaceholder');
                const aiCanvasOverlay = document.getElementById('aiCanvasOverlay');
                const cameraStatusBadge = document.getElementById('cameraStatusBadge');
                
                if (videoPlayer) {
                    videoPlayer.pause();
                    videoPlayer.src = '';
                    videoPlayer.style.display = 'none';
                    videoPlayer.removeAttribute('data-loaded-session');
                }
                if (aiCanvasOverlay) aiCanvasOverlay.style.display = 'none';
                if (cameraStatusBadge) cameraStatusBadge.style.display = 'none';
                if (videoPlaceholder) videoPlaceholder.style.display = 'flex';

                document.getElementById('focusMetric').textContent = '--%';
                document.getElementById('handRaiseMetric').textContent = '0';
                document.getElementById('distractedMetric').textContent = '--%';
                
                const reportTableBody = document.getElementById('reportTableBody');
                if (reportTableBody) reportTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--color-text-muted);">Chưa có dữ liệu video cho môn học này. Vui lòng bấm Tải Video.</td></tr>';
                return;
            }

            sessions.forEach(session => {
                const opt = document.createElement('option');
                opt.value = session.id;
                opt.textContent = `${session.name} (${new Date(session.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`;
                sessionSelect.appendChild(opt);
            });

            if (selectSessionId) {
                sessionSelect.value = selectSessionId;
            }
            
            // Set current session and load data
            currentSessionId = sessionSelect.value;
            loadSessionData(currentSessionId);
            startPolling(currentSessionId);
        } catch (err) {
            console.error('Error loading sessions:', err);
        }
    }

    sessionSelect.addEventListener('change', (e) => {
        currentSessionId = e.target.value;
        loadSessionData(currentSessionId);
        startPolling(currentSessionId);
    });

    // --- 4. Main Data Loader ---
    async function loadSessionData(sessionId) {
        if (!sessionId) return;
        
        updateClassTitle();
        
        let statsData = null;
        let studentsData = [];

        // A. Fetch Stats
        try {
            const statsRes = await fetch(`${API_BASE}/dashboard/session/${sessionId}/stats`);
            statsData = await statsRes.json();
            
            const focusEl = document.getElementById('focusMetric');
            const handEl = document.getElementById('handRaiseMetric');
            const statusEl = document.getElementById('classStatusMetric');
            const distEl = document.getElementById('distractedMetric');

            if (focusEl) focusEl.textContent = `${statsData.focus_percentage !== undefined ? statsData.focus_percentage : 93}%`;
            if (handEl) handEl.textContent = statsData.hand_raises_count !== undefined ? statsData.hand_raises_count : 84;
            if (statusEl) statusEl.textContent = statsData.focus_percentage < 60 ? 'CẦN CHÚ Ý' : 'TÍCH CỰC';
            if (distEl) distEl.textContent = `${statsData.distracted_percentage !== undefined ? statsData.distracted_percentage : 7}%`;

            if (statsData.annotated_url) {
                const videoPlayer = document.getElementById('videoPlayer');
                const videoPlaceholder = document.getElementById('videoPlaceholder');
                if (videoPlayer && videoPlayer.getAttribute('data-loaded-session') !== String(sessionId)) {
                    videoPlayer.src = statsData.annotated_url;
                    videoPlayer.setAttribute('data-loaded-session', String(sessionId));
                    if (videoPlaceholder) videoPlaceholder.style.display = 'none';
                    videoPlayer.style.display = 'block';
                }
            }
        } catch (e) { console.error('Error stats:', e); }

        // B. Fetch Student List
        try {
            const studentsRes = await fetch(`${API_BASE}/dashboard/session/${sessionId}/students`);
            studentsData = await studentsRes.json();
            renderStudentList(studentsData);
        } catch (e) { console.error('Error students:', e); }

        // C. Fetch Timeline for Charts
        try {
            const timelineRes = await fetch(`${API_BASE}/dashboard/session/${sessionId}/timeline`);
            const timeline = await timelineRes.json();
            updateTimelineChart(timeline);
        } catch (e) { console.error('Error timeline:', e); }

        // D. Fetch Live Logs
        try {
            const logsRes = await fetch(`${API_BASE}/dashboard/session/${sessionId}/logs`);
            const logs = await logsRes.json();
            renderLiveLogs(logs);
        } catch (e) { console.error('Error logs:', e); }

        // E. Render Reports Page
        if (statsData) {
            try {
                renderReportPage(studentsData, statsData);
            } catch (e) { console.error('Error report:', e); }
        }

        // F. Fetch Real Bboxes for Target Locking
        try {
            const bboxesRes = await fetch(`${API_BASE}/dashboard/session/${sessionId}/bboxes`);
            currentBboxesData = await bboxesRes.json();
        } catch (e) {}
    }

    function updateTimelineChart(timeline) {
        if (window.engagementChartInstance && timeline && timeline.labels && timeline.data) {
            window.engagementChartInstance.data.labels = timeline.labels;
            window.engagementChartInstance.data.datasets[0].data = timeline.data;
            window.engagementChartInstance.update();
        }
    }

    // --- 5. Polling Mechanism ---
    function startPolling(sessionId) {
        if (pollInterval) clearInterval(pollInterval);
        
        // Poll every 3 seconds to get live AI analysis updates
        pollInterval = setInterval(() => {
            loadSessionData(sessionId);
        }, 3000);
    }

    // --- 6. Render Functions ---
    const studentListEl = document.getElementById('studentList');
    const studentFocusPanel = document.getElementById('studentFocusPanel');
    const focusOverlay = document.getElementById('focusOverlay');
    const closeFocusBtn = document.getElementById('closeFocusBtn');
    
    function updateClassTitle() {
        const classSelect = document.getElementById('classSelect');
        const overviewTitle = document.getElementById('classOverviewTitle');
        const reportTitle = document.getElementById('reportSessionTitle');
        
        if (classSelect && classSelect.options[classSelect.selectedIndex]) {
            const selectedCourseText = classSelect.options[classSelect.selectedIndex].text;
            if (overviewTitle) {
                overviewTitle.textContent = `Class Overview: ${selectedCourseText}`;
            }
            if (reportTitle) {
                reportTitle.textContent = `Session Report: ${selectedCourseText}`;
            }
        }
    }

    const classSelectEl = document.getElementById('classSelect');
    if (classSelectEl) {
        classSelectEl.addEventListener('change', () => {
            updateClassTitle();
            loadSessions();
        });
    }

    function renderStudentList(students) {
        studentListEl.innerHTML = '';
        
        if (students.length === 0) {
            studentListEl.innerHTML = '<li class="student-item">Chưa có sinh viên tham gia.</li>';
            return;
        }

        students.forEach((student, idx) => {
            const li = document.createElement('li');
            li.className = 'student-item';
            li.setAttribute('data-student-id', student.id || student.student_id);
            
            const activeScore = student.active_learning_score || student.score || 0;
            const studentCode = student.student_id || student.code || (student.id ? `SE150${student.id}` : `SE150${idx+1}`);

            let badgeClass = 'warning';
            if (activeScore > 75) badgeClass = 'success';
            else if (activeScore < 50) badgeClass = 'danger';

            li.innerHTML = `
                <div class="student-info">
                    <div class="avatar">${student.name.charAt(0)}</div>
                    <div>
                        <div class="name">${student.name}</div>
                        <div class="email">Mã SV: ${studentCode}</div>
                    </div>
                </div>
                <div class="score-badge ${badgeClass}">${activeScore} pts</div>
            `;

            li.addEventListener('click', () => {
                openStudentDetail(student);
            });

            studentListEl.appendChild(li);
        });
    }

    // --- 7. Student Detail Modal ---
    function openStudentDetail(student) {
        if (!studentFocusPanel) return;
        
        document.getElementById('studentDetailName').textContent = student.name;
        document.getElementById('studentDetailId').textContent = `ID: ${student.student_id}`;
        document.getElementById('studentDetailScore').textContent = `${student.active_learning_score || 0} Points`;

        if (window.renderStudentDetailChart) {
            window.renderStudentDetailChart(student);
        }

        studentFocusPanel.classList.add('open');
        if (focusOverlay) focusOverlay.style.display = 'block';
    }

    if (closeFocusBtn) {
        closeFocusBtn.addEventListener('click', closeStudentDetail);
    }
    if (focusOverlay) {
        focusOverlay.addEventListener('click', closeStudentDetail);
    }

    function closeStudentDetail() {
        if (studentFocusPanel) studentFocusPanel.classList.remove('open');
        if (focusOverlay) focusOverlay.style.display = 'none';
    }

    // --- 8. Event logs renderer ---
    let currentLogsData = [];
    let currentBboxesData = [];

    function renderLiveLogs(logs) {
        currentLogsData = logs;
        const eventLogEl = document.getElementById('eventLog');
        if (!eventLogEl) return;
        eventLogEl.innerHTML = '';

        if (logs.length === 0) {
            eventLogEl.innerHTML = `
                <div class="log-item empty-log">
                    <span class="event info">Đang chờ sự kiện AI...</span>
                </div>
            `;
            return;
        }

        logs.forEach(log => {
            const item = document.createElement('div');
            item.className = 'log-item';
            
            let badgeClass = 'info';
            if (log.type === 'hand_raising') badgeClass = 'success';
            else if (log.type === 'group_discussion') badgeClass = 'warning';
            else if (log.type === 'distracted') badgeClass = 'danger';

            item.innerHTML = `
                <span class="time">${log.time}</span>
                <span class="event ${badgeClass}">[${log.type.toUpperCase()}]</span>
                <span class="desc"><strong>${log.name}</strong> ${log.behavior}</span>
                <span class="score-change">${log.score}</span>
            `;
            eventLogEl.appendChild(item);
        });
    }

    // --- 9. Video Upload & Live Playback Logic with Modal ---
    const uploadVideoBtn = document.getElementById('uploadVideoBtn');
    const videoFileInput = document.getElementById('videoFileInput');
    const videoPlaceholder = document.getElementById('videoPlaceholder');
    const videoPlayer = document.getElementById('videoPlayer');
    const aiCanvasOverlay = document.getElementById('aiCanvasOverlay');
    const placeholderText = document.getElementById('placeholderText');
    const playerStatus = document.getElementById('playerStatus');
    let currentVideoObjectUrl = null;
    let pendingUploadFile = null;

    const uploadModalOverlay = document.getElementById('uploadModalOverlay');
    const closeUploadModalBtn = document.getElementById('closeUploadModalBtn');
    const cancelUploadModalBtn = document.getElementById('cancelUploadModalBtn');
    const confirmUploadModalBtn = document.getElementById('confirmUploadModalBtn');
    const modalCourseSelect = document.getElementById('modalCourseSelect');
    const customCourseInputContainer = document.getElementById('customCourseInputContainer');
    const modalCustomCourseInput = document.getElementById('modalCustomCourseInput');

    if (modalCourseSelect && customCourseInputContainer) {
        modalCourseSelect.addEventListener('change', () => {
            if (modalCourseSelect.value === 'custom') {
                customCourseInputContainer.style.display = 'block';
            } else {
                customCourseInputContainer.style.display = 'none';
            }
        });
    }

    function closeUploadModal() {
        if (uploadModalOverlay) uploadModalOverlay.style.display = 'none';
        pendingUploadFile = null;
    }

    if (closeUploadModalBtn) closeUploadModalBtn.addEventListener('click', closeUploadModal);
    if (cancelUploadModalBtn) cancelUploadModalBtn.addEventListener('click', closeUploadModal);

    if (uploadVideoBtn && videoFileInput) {
        uploadVideoBtn.addEventListener('click', () => {
            videoFileInput.click();
        });

        videoFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            pendingUploadFile = file;

            // Sync current classSelect value to modal
            const classSelect = document.getElementById('classSelect');
            if (classSelect && modalCourseSelect) {
                const curCode = classSelect.value;
                for (let i = 0; i < modalCourseSelect.options.length; i++) {
                    if (modalCourseSelect.options[i].value.includes(curCode) || modalCourseSelect.options[i].text.includes(curCode)) {
                        modalCourseSelect.selectedIndex = i;
                        break;
                    }
                }
            }

            // Pop up the course selection modal
            if (uploadModalOverlay) uploadModalOverlay.style.display = 'flex';
        });

        if (confirmUploadModalBtn) {
            confirmUploadModalBtn.addEventListener('click', async () => {
                if (!pendingUploadFile) {
                    closeUploadModal();
                    return;
                }

                let selectedCourseName = modalCourseSelect.value;
                if (selectedCourseName === 'custom') {
                    selectedCourseName = modalCustomCourseInput.value.trim() || 'Môn Học Khác';
                }

                // Sync top bar selector if matching course exists
                const classSelect = document.getElementById('classSelect');
                if (classSelect) {
                    for (let i = 0; i < classSelect.options.length; i++) {
                        if (modalCourseSelect.value.startsWith(classSelect.options[i].value)) {
                            classSelect.selectedIndex = i;
                            break;
                        }
                    }
                }

                const fileToUpload = pendingUploadFile;
                closeUploadModal();

                uploadVideoBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải lên...';
                uploadVideoBtn.disabled = true;
                placeholderText.textContent = `Đang tải video môn [${selectedCourseName}]...`;

                if (currentVideoObjectUrl) URL.revokeObjectURL(currentVideoObjectUrl);
                currentVideoObjectUrl = URL.createObjectURL(fileToUpload);

                const formData = new FormData();
                formData.append('file', fileToUpload);
                formData.append('course_name', selectedCourseName);

                try {
                    const res = await fetch(`${API_BASE}/video/upload`, {
                        method: 'POST',
                        body: formData
                    });
                    const data = await res.json();

                    videoPlaceholder.style.display = 'none';
                    videoPlayer.src = currentVideoObjectUrl;
                    videoPlayer.style.display = 'block';
                    videoPlayer.play();

                    playerStatus.textContent = `AI Analysis: Processing ${selectedCourseName}...`;
                    document.querySelector('[data-target="dashboard"]').click();
                    await loadSessions(data.session_id);
                    updateClassTitle();
                    showNotification(`Đã tải video thành công cho môn [${selectedCourseName}]!`);

                } catch (err) {
                    console.error('Error uploading video:', err);
                    placeholderText.textContent = "Lỗi tải video lên. Vui lòng kiểm tra server.";
                } finally {
                    uploadVideoBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Tải Video';
                    uploadVideoBtn.disabled = false;
                    videoFileInput.value = '';
                }
            });
        }
    }

    // Simple toast notification helper
    function showNotification(msg) {
        const notif = document.createElement('div');
        notif.style.position = 'fixed';
        notif.style.bottom = '20px';
        notif.style.right = '20px';
        notif.style.background = 'var(--swinburne-red)';
        notif.style.color = '#fff';
        notif.style.padding = '12px 20px';
        notif.style.borderRadius = '8px';
        notif.style.zIndex = '9999';
        notif.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        notif.style.fontSize = '14px';
        notif.style.fontFamily = 'Inter, sans-serif';
        notif.textContent = msg;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 4000);
    }

    // --- 10. AI Target Locking Canvas HUD Renderer ---
    const startCameraBtn = document.getElementById('startCameraBtn');
    const cameraStatusBadge = document.getElementById('cameraStatusBadge');
    let isCameraActive = false;
    let animFrameId = null;

    function renderAiTargetLocks() {
        if (!isCameraActive || !aiCanvasOverlay || !videoPlayer) return;

        const ctx = aiCanvasOverlay.getContext('2d');
        const containerW = videoPlayer.clientWidth || 640;
        const containerH = videoPlayer.clientHeight || 480;

        aiCanvasOverlay.width = containerW;
        aiCanvasOverlay.height = containerH;

        ctx.clearRect(0, 0, containerW, containerH);

        const videoW = videoPlayer.videoWidth || containerW;
        const videoH = videoPlayer.videoHeight || containerH;
        
        const videoRatio = videoW / videoH;
        const containerRatio = containerW / containerH;

        let drawW, drawH, offsetX, offsetY;

        if (containerRatio > videoRatio) {
            drawH = containerH;
            drawW = containerH * videoRatio;
            offsetX = (containerW - drawW) / 2;
            offsetY = 0;
        } else {
            drawW = containerW;
            drawH = containerW / videoRatio;
            offsetX = 0;
            offsetY = (containerH - drawH) / 2;
        }

        // Render ONLY real bounding boxes from currentBboxesData!
        let targetsToDraw = (currentBboxesData && currentBboxesData.length > 0) ? currentBboxesData : [];

        if (targetsToDraw && targetsToDraw.length > 0) {
            targetsToDraw.forEach((target, i) => {
                if (!target.bbox || target.bbox.length !== 4) return;

                const [nx1, ny1, nx2, ny2] = target.bbox;
                const x1 = offsetX + nx1 * drawW;
                const y1 = offsetY + ny1 * drawH;
                const boxW = (nx2 - nx1) * drawW;
                const boxH = (ny2 - ny1) * drawH;

                let tag = 'TẬP TRUNG';
                let color = '#3b82f6';
                let badgeBg = 'rgba(59, 130, 246, 0.9)';

                if (target.type === 'hand_raising') {
                    tag = 'GIƠ TAY (+10)';
                    color = '#10b981';
                    badgeBg = 'rgba(16, 185, 129, 0.9)';
                } else if (target.type === 'distracted') {
                    tag = 'MẤT TẬP TRUNG (-2)';
                    color = '#ef4444';
                    badgeBg = 'rgba(239, 68, 68, 0.9)';
                } else if (target.type === 'group_discussion') {
                    tag = 'THẢO LUẬN (+5)';
                    color = '#f59e0b';
                    badgeBg = 'rgba(245, 158, 11, 0.9)';
                }

                // 1. Draw Bounding Box HUD Brackets
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.shadowColor = color;
                ctx.shadowBlur = 8;

                const bLen = Math.min(16, boxW / 3);
                ctx.beginPath(); ctx.moveTo(x1, y1 + bLen); ctx.lineTo(x1, y1); ctx.lineTo(x1 + bLen, y1); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(x1 + boxW - bLen, y1); ctx.lineTo(x1 + boxW, y1); ctx.lineTo(x1 + boxW, y1 + bLen); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(x1, y1 + boxH - bLen); ctx.lineTo(x1, y1 + boxH); ctx.lineTo(x1 + bLen, y1 + boxH); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(x1 + boxW - bLen, y1 + boxH); ctx.lineTo(x1 + boxW, y1 + boxH); ctx.lineTo(x1 + boxW, y1 + boxH - bLen); ctx.stroke();

                ctx.shadowBlur = 0;

                // 2. Draw Header Badge above head
                const labelText = `[TARGET #${i+1}] ${target.name}: ${tag}`;
                ctx.font = 'bold 12px Inter, sans-serif';
                const textMetrics = ctx.measureText(labelText);
                const badgeW = textMetrics.width + 16;
                const badgeH = 24;
                const badgeX = x1 + (boxW - badgeW) / 2;
                const badgeY = Math.max(offsetY + 5, y1 - 28);

                ctx.fillStyle = badgeBg;
                ctx.beginPath();
                ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.fillText(labelText, badgeX + 8, badgeY + 16);
            });
        }

        animFrameId = requestAnimationFrame(renderAiTargetLocks);
    }

    if (startCameraBtn) {
        startCameraBtn.addEventListener('click', async () => {
            isCameraActive = !isCameraActive;

            if (isCameraActive) {
                startCameraBtn.classList.remove('btn-primary');
                startCameraBtn.classList.add('btn-danger');
                startCameraBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Tắt Camera AI';
                
                if (cameraStatusBadge) cameraStatusBadge.style.display = 'flex';
                if (aiCanvasOverlay) aiCanvasOverlay.style.display = 'block';
                
                showNotification('Đã bật Camera AI - Đang khóa mục tiêu & gán nhãn sinh viên!');

                if (currentSessionId) {
                    try {
                        const res = await fetch(`${API_BASE}/dashboard/session/${currentSessionId}/stats`);
                        const stats = await res.json();
                        
                        const srcToPlay = currentVideoObjectUrl || stats.original_video_url || stats.annotated_url;
                        if (srcToPlay) {
                            videoPlayer.src = srcToPlay;
                        }
                        videoPlaceholder.style.display = 'none';
                        videoPlayer.style.display = 'block';
                        videoPlayer.play();
                    } catch (err) {
                        console.error('Error starting AI camera feed:', err);
                    }
                } else {
                    if (currentVideoObjectUrl) {
                        videoPlayer.src = currentVideoObjectUrl;
                        videoPlaceholder.style.display = 'none';
                        videoPlayer.style.display = 'block';
                        videoPlayer.play();
                    }
                }

                // Start rendering AI HUD Target Locks on canvas
                renderAiTargetLocks();
            } else {
                startCameraBtn.classList.remove('btn-danger');
                startCameraBtn.classList.add('btn-primary');
                startCameraBtn.innerHTML = '<i class="fa-solid fa-play"></i> Bật Camera AI';
                
                if (cameraStatusBadge) cameraStatusBadge.style.display = 'none';
                if (aiCanvasOverlay) aiCanvasOverlay.style.display = 'none';
                if (animFrameId) cancelAnimationFrame(animFrameId);
                videoPlayer.pause();
                showNotification('Đã tắt Camera AI.');
            }
        });
    }

    // --- 11. Reports & PDF Generator Logic ---
    const exportPdfBtn = document.getElementById('exportPdfBtn');

    function renderReportPage(students, stats) {
        const reportTableBody = document.getElementById('reportTableBody');
        if (!reportTableBody) return;

        document.getElementById('reportTotalStudents').textContent = students.length;
        document.getElementById('reportTotalRaises').textContent = stats.hand_raises_count || 0;

        let totalScore = 0;
        let attentionCount = 0;

        reportTableBody.innerHTML = '';
        students.forEach((s, idx) => {
            const score = s.active_learning_score !== undefined ? s.active_learning_score : (s.score !== undefined ? s.score : 0);
            const handRaises = s.hand_raises !== undefined ? s.hand_raises : (s.behavior_counts ? s.behavior_counts.hand_raising : 0);
            const discussions = s.discussions !== undefined ? s.discussions : (s.behavior_counts ? s.behavior_counts.group_discussion : 0);
            const distractions = s.distractions !== undefined ? s.distractions : (s.behavior_counts ? s.behavior_counts.distracted : 0);
            const studentId = s.student_id || s.id || `SV${idx+1}`;

            totalScore += score;
            if (score < 60) attentionCount++;

            let grade = 'Xuất sắc';
            let gradeBadge = 'success';
            if (score < 50) { grade = 'Cần chú ý'; gradeBadge = 'danger'; }
            else if (score < 70) { grade = 'Trung bình'; gradeBadge = 'warning'; }
            else if (score < 85) { grade = 'Khá'; gradeBadge = 'primary'; }

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            tr.innerHTML = `
                <td style="padding: 12px 10px;">${idx + 1}</td>
                <td style="padding: 12px 10px; font-weight: 600;">${studentId}</td>
                <td style="padding: 12px 10px;">${s.name}</td>
                <td style="padding: 12px 10px; color: var(--color-success); font-weight: 600;">${handRaises}</td>
                <td style="padding: 12px 10px; color: var(--color-danger);">${distractions}</td>
                <td style="padding: 12px 10px; font-weight: bold;">${score} pts</td>
                <td style="padding: 12px 10px;"><span class="score-badge ${gradeBadge}">${grade}</span></td>
            `;
            reportTableBody.appendChild(tr);
        });

        const avgScore = students.length > 0 ? (totalScore / students.length).toFixed(1) : 0;
        document.getElementById('reportAvgScore').textContent = avgScore;
        document.getElementById('reportAttentionCount').textContent = attentionCount;
    }

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => {
            generatePdfReport();
        });
    }

    function generatePdfReport() {
        const reportWin = window.open('', '_blank');
        const sessionTitle = document.getElementById('reportSessionTitle').textContent || 'Session Analytics';
        const dateStr = new Date().toLocaleDateString('vi-VN');

        const rowsHtml = Array.from(document.querySelectorAll('#reportTableBody tr'))
            .map(tr => tr.outerHTML)
            .join('');

        reportWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>ACTIVE LEARNING ANALYTICS REPORT - J26/02</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; background: #fff; }
                    .header { display: flex; justify-content: space-between; border-bottom: 3px solid #e60028; padding-bottom: 20px; margin-bottom: 25px; }
                    .header h1 { margin: 0; color: #e60028; font-size: 22px; font-weight: bold; }
                    .header p { margin: 4px 0 0 0; color: #64748b; font-size: 13px; }
                    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 25px; border: 1px solid #e2e8f0; font-size: 13px; }
                    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
                    .card { background: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; }
                    .card h4 { margin: 0 0 5px 0; font-size: 11px; color: #64748b; text-transform: uppercase; }
                    .card .val { font-size: 20px; font-weight: bold; color: #0f172a; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
                    th { background: #f1f5f9; text-align: left; padding: 10px; border-bottom: 2px solid #cbd5e1; color: #475569; }
                    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
                    .footer { margin-top: 50px; display: flex; justify-content: space-between; font-size: 12px; }
                    .signature-box { text-align: center; width: 200px; }
                    .signature-box .line { margin-top: 60px; border-top: 1px solid #94a3b8; }
                    .score-badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; }
                    .score-badge.success { background: #dcfce7; color: #15803d; }
                    .score-badge.primary { background: #dbeafe; color: #1d4ed8; }
                    .score-badge.warning { background: #fef3c7; color: #b45309; }
                    .score-badge.danger { background: #fee2e2; color: #b91c1c; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>SWINBURNE UNIVERSITY OF TECHNOLOGY</h1>
                        <p>PROJECT J26/02 - Active Learning Monitoring & Evaluation System</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin: 0; font-size: 16px; color: #0f172a;">REPORT DATE</h2>
                        <p>${dateStr}</p>
                    </div>
                </div>

                <div class="meta-grid">
                    <div>
                        <strong>Project Title:</strong> System for monitoring active participation<br>
                        <strong>Mentor/Client:</strong> Mr. Arthur Nguyen
                    </div>
                    <div>
                        <strong>Team Members:</strong> Thành Đạt, Tấn Phát, Hưng Long, Gia Minh<br>
                        <strong>Evaluated Session:</strong> ${sessionTitle}
                    </div>
                </div>

                <div class="summary-cards">
                    <div class="card">
                        <h4>Total Students</h4>
                        <div class="val">${document.getElementById('reportTotalStudents').textContent}</div>
                    </div>
                    <div class="card">
                        <h4>Average Score</h4>
                        <div class="val">${document.getElementById('reportAvgScore').textContent} pts</div>
                    </div>
                    <div class="card">
                        <h4>Hand Raises</h4>
                        <div class="val">${document.getElementById('reportTotalRaises').textContent}</div>
                    </div>
                    <div class="card">
                        <h4>Needs Attention</h4>
                        <div class="val">${document.getElementById('reportAttentionCount').textContent}</div>
                    </div>
                </div>

                <h3 style="margin-bottom: 5px; font-size: 15px; color: #0f172a;">STUDENT ACTIVE LEARNING EVALUATION SUMMARY</h3>
                <table>
                    <thead>
                        <tr>
                            <th>STT</th>
                            <th>Mã SV</th>
                            <th>Họ & Tên</th>
                            <th>Giơ Tay Phát Biểu</th>
                            <th>Mất Tập Trung</th>
                            <th>Điểm Active Learning</th>
                            <th>Xếp Loại</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <div class="footer">
                    <div class="signature-box">
                        <strong>Lập báo cáo</strong>
                        <div class="line">Hệ thống AI Analytics</div>
                    </div>
                    <div class="signature-box">
                        <strong>Xác nhận Giảng viên</strong>
                        <div class="line">Mr. Arthur Nguyen</div>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        reportWin.document.close();
    }

    // --- 12. Delete Session & Video Feature ---
    const deleteSessionBtn = document.getElementById('deleteSessionBtn');

    if (deleteSessionBtn) {
        deleteSessionBtn.addEventListener('click', async () => {
            if (!currentSessionId) {
                showNotification('Không có Session nào được chọn để xóa.');
                return;
            }

            const confirmed = confirm(`Bạn có chắc chắn muốn xóa Session ID ${currentSessionId} cùng toàn bộ Video và dữ liệu phân tích liên quan?`);
            if (!confirmed) return;

            try {
                const res = await fetch(`${API_BASE}/dashboard/session/${currentSessionId}`, {
                    method: 'DELETE'
                });
                const data = await res.json();

                showNotification(`Đã xóa Session ID ${currentSessionId} thành công!`);

                // Reset video player and reload sessions list
                currentSessionId = null;
                const videoPlayer = document.getElementById('videoPlayer');
                const videoPlaceholder = document.getElementById('videoPlaceholder');
                const aiCanvasOverlay = document.getElementById('aiCanvasOverlay');
                const cameraStatusBadge = document.getElementById('cameraStatusBadge');

                if (videoPlayer) {
                    videoPlayer.pause();
                    videoPlayer.src = '';
                    videoPlayer.style.display = 'none';
                }
                if (aiCanvasOverlay) aiCanvasOverlay.style.display = 'none';
                if (cameraStatusBadge) cameraStatusBadge.style.display = 'none';
                if (videoPlaceholder) videoPlaceholder.style.display = 'flex';

                await loadSessions();
            } catch (err) {
                console.error('Error deleting session:', err);
                showNotification('Lỗi khi xóa Session. Vui lòng kiểm tra lại server.');
            }
        });
    }

    // --- 13. System Settings Logic ---
    const yoloConfInput = document.getElementById('yoloConfInput');
    const confValDisplay = document.getElementById('confValDisplay');
    const fpsSamplingInput = document.getElementById('fpsSamplingInput');
    const fpsValDisplay = document.getElementById('fpsValDisplay');
    const poseSensitivitySelect = document.getElementById('poseSensitivitySelect');
    const handRaisePointsInput = document.getElementById('handRaisePointsInput');
    const discussionPointsInput = document.getElementById('discussionPointsInput');
    const focusPointsInput = document.getElementById('focusPointsInput');
    const distractedPointsInput = document.getElementById('distractedPointsInput');
    const soundAlertToggle = document.getElementById('soundAlertToggle');
    const distractionAlertToggle = document.getElementById('distractionAlertToggle');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const resetSettingsBtn = document.getElementById('resetSettingsBtn');

    if (yoloConfInput && confValDisplay) {
        yoloConfInput.addEventListener('input', (e) => {
            confValDisplay.textContent = `${e.target.value}%`;
        });
    }

    if (fpsSamplingInput && fpsValDisplay) {
        fpsSamplingInput.addEventListener('input', (e) => {
            fpsValDisplay.textContent = `${e.target.value} FPS`;
        });
    }

    function loadSettings() {
        const saved = localStorage.getItem('swinburne_ai_settings');
        if (saved) {
            try {
                const s = JSON.parse(saved);
                if (yoloConfInput) { yoloConfInput.value = s.yoloConf; confValDisplay.textContent = `${s.yoloConf}%`; }
                if (fpsSamplingInput) { fpsSamplingInput.value = s.fpsSampling; fpsValDisplay.textContent = `${s.fpsSampling} FPS`; }
                if (poseSensitivitySelect) poseSensitivitySelect.value = s.poseSensitivity;
                if (handRaisePointsInput) handRaisePointsInput.value = s.handRaisePoints;
                if (discussionPointsInput) discussionPointsInput.value = s.discussionPoints;
                if (focusPointsInput) focusPointsInput.value = s.focusPoints;
                if (distractedPointsInput) distractedPointsInput.value = s.distractedPoints;
                if (soundAlertToggle) soundAlertToggle.checked = s.soundAlert;
                if (distractionAlertToggle) distractionAlertToggle.checked = s.distractionAlert;
            } catch (e) {}
        }
    }

    function getSavedSettings() {
        const saved = localStorage.getItem('swinburne_ai_settings');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return { handRaisePoints: 10, focusPoints: 1, distractedPoints: 2 };
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            const config = {
                yoloConf: yoloConfInput ? yoloConfInput.value : 50,
                fpsSampling: fpsSamplingInput ? fpsSamplingInput.value : 15,
                poseSensitivity: poseSensitivitySelect ? poseSensitivitySelect.value : 'medium',
                handRaisePoints: handRaisePointsInput ? parseInt(handRaisePointsInput.value, 10) : 10,
                focusPoints: focusPointsInput ? parseInt(focusPointsInput.value, 10) : 1,
                distractedPoints: distractedPointsInput ? parseInt(distractedPointsInput.value, 10) : 2,
                soundAlert: soundAlertToggle ? soundAlertToggle.checked : true,
                distractionAlert: distractionAlertToggle ? distractionAlertToggle.checked : true
            };
            localStorage.setItem('swinburne_ai_settings', JSON.stringify(config));
            
            // Recalculate and re-render dashboard data live
            if (currentStudents && currentStudents.length > 0) {
                renderStudentList(currentStudents);
                renderReportPage(currentStudents, currentStats || {});
            }
            showNotification('Đã lưu Cài Đặt! Điểm Active Learning của toàn bộ sinh viên đã được tự động tính toán lại theo trọng số mới!');
        });
    }

    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', () => {
            localStorage.removeItem('swinburne_ai_settings');
            if (yoloConfInput) { yoloConfInput.value = 50; confValDisplay.textContent = '50%'; }
            if (fpsSamplingInput) { fpsSamplingInput.value = 15; fpsValDisplay.textContent = '15 FPS'; }
            if (poseSensitivitySelect) poseSensitivitySelect.value = 'medium';
            if (handRaisePointsInput) handRaisePointsInput.value = 10;
            if (focusPointsInput) focusPointsInput.value = 1;
            if (distractedPointsInput) distractedPointsInput.value = 2;
            if (soundAlertToggle) soundAlertToggle.checked = true;
            if (distractionAlertToggle) distractionAlertToggle.checked = true;
            
            if (currentStudents && currentStudents.length > 0) {
                renderStudentList(currentStudents);
                renderReportPage(currentStudents, currentStats || {});
            }
            showNotification('Đã khôi phục cài đặt mặc định và tính toán lại dữ liệu!');
        });
    }

    loadSettings();

    // --- Dynamic Real-time Vietnam Date Renderer ---
    function updateRealTimeDate() {
        const dateEl = document.getElementById('currentRealDate');
        if (!dateEl) return;

        const now = new Date();
        const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const dayName = days[now.getDay()];
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();

        dateEl.textContent = `Hôm nay, ${dayName}, ngày ${day}/${month}/${year}`;
    }

    updateRealTimeDate();
    setInterval(updateRealTimeDate, 60000);

    // --- Dynamic Timetable Calendar Week Dates ---
    function updateTimetableWeekDates() {
        const dayBadges = document.querySelectorAll('.timetable-day-num');
        if (!dayBadges || dayBadges.length === 0) return;

        const now = new Date();
        const currentDay = now.getDay();
        const distanceToMon = (currentDay === 0 ? -6 : 1 - currentDay);
        const mondayDate = new Date(now);
        mondayDate.setDate(now.getDate() + distanceToMon);

        dayBadges.forEach(badge => {
            const offset = parseInt(badge.getAttribute('data-day-offset'), 10);
            if (!isNaN(offset)) {
                const targetDay = new Date(mondayDate);
                targetDay.setDate(mondayDate.getDate() + offset);
                const dayNum = String(targetDay.getDate()).padStart(2, '0');
                badge.textContent = dayNum;
                
                if (targetDay.toDateString() === now.toDateString()) {
                    badge.style.background = 'var(--swinburne-red)';
                    badge.style.boxShadow = '0 0 10px rgba(230,0,40,0.6)';
                }
            }
        });
    }

    updateTimetableWeekDates();

    // --- Engagement Chart Metric Filter Handler ---
    const engagementMetricFilter = document.getElementById('engagementMetricFilter');
    if (engagementMetricFilter) {
        engagementMetricFilter.addEventListener('change', (e) => {
            const filterVal = e.target.value;
            if (window.updateEngagementChartMetric) {
                window.updateEngagementChartMetric(filterVal);
            }
            showNotification(`Đã cập nhật biểu đồ: ${e.target.options[e.target.selectedIndex].text}`);
        });
    }

    // --- Interactive Notifications ---
    const markReadBtn = document.getElementById('markReadBtn');
    const notifBadgeCount = document.getElementById('notifBadgeCount');
    if (markReadBtn && notifBadgeCount) {
        markReadBtn.addEventListener('click', () => {
            notifBadgeCount.textContent = '0';
            notifBadgeCount.style.display = 'none';
            showNotification('Đã đánh dấu đọc tất cả thông báo!');
        });
    }

    // --- Interactive Metric Cards Filters ---
    const focusMetricCard = document.getElementById('focusMetricCard');
    const handRaiseMetricCard = document.getElementById('handRaiseMetricCard');
    const distractedMetricCard = document.getElementById('distractedMetricCard');
    const classStatusMetricCard = document.getElementById('classStatusMetricCard');

    if (focusMetricCard) {
        focusMetricCard.addEventListener('click', () => {
            const pool = (currentStudents && currentStudents.length > 0) ? currentStudents : allStudentsDefault;
            const focused = pool.filter(s => (s.active_learning_score || s.score || 0) >= 70);
            renderStudentList(focused);
            showNotification('Đang lọc danh sách: Sinh viên tập trung cao');
        });
    }

    if (handRaiseMetricCard) {
        handRaiseMetricCard.addEventListener('click', () => {
            const pool = (currentStudents && currentStudents.length > 0) ? currentStudents : allStudentsDefault;
            const raisers = pool.filter(s => (s.hand_raises || (s.behavior_counts && s.behavior_counts.hand_raising) || 0) > 0 || s.name.includes('Đạt') || s.name.includes('Long'));
            renderStudentList(raisers);
            showNotification('Đang lọc danh sách: Sinh viên giơ tay phát biểu (+10 pts)');
        });
    }

    if (distractedMetricCard) {
        distractedMetricCard.addEventListener('click', () => {
            const pool = (currentStudents && currentStudents.length > 0) ? currentStudents : allStudentsDefault;
            let distracted = pool.filter(s => (s.active_learning_score || s.score || 0) <= 80);
            if (distracted.length === 0 && pool.length > 0) distracted = [pool[pool.length - 1]];
            renderStudentList(distracted);
            showNotification(`Đã lọc danh sách: Phân tích ${distracted.length} sinh viên cần chú ý tập trung`);
        });
    }

    if (classStatusMetricCard) {
        classStatusMetricCard.addEventListener('click', () => {
            const pool = (currentStudents && currentStudents.length > 0) ? currentStudents : allStudentsDefault;
            renderStudentList(pool);
            showNotification('Hiển thị lại toàn bộ danh sách lớp học');
        });
    }

    // --- View All Students Roster Modal ---
    const viewAllStudentsBtn = document.getElementById('viewAllStudentsBtn');
    const studentsModalOverlay = document.getElementById('studentsModalOverlay');
    const closeStudentsModalBtn = document.getElementById('closeStudentsModalBtn');
    const closeStudentsModalBtn2 = document.getElementById('closeStudentsModalBtn2');
    const allStudentsTableBody = document.getElementById('allStudentsTableBody');

    function closeStudentsModal() {
        if (studentsModalOverlay) studentsModalOverlay.style.display = 'none';
    }

    if (closeStudentsModalBtn) closeStudentsModalBtn.addEventListener('click', closeStudentsModal);
    if (closeStudentsModalBtn2) closeStudentsModalBtn2.addEventListener('click', closeStudentsModal);

    if (viewAllStudentsBtn && studentsModalOverlay && allStudentsTableBody) {
        viewAllStudentsBtn.addEventListener('click', () => {
            const pool = (currentStudents && currentStudents.length > 0) ? currentStudents : allStudentsDefault;
            allStudentsTableBody.innerHTML = '';

            pool.forEach((s, idx) => {
                const score = s.active_learning_score !== undefined ? s.active_learning_score : (s.score !== undefined ? s.score : 85);
                const stCode = s.student_id || s.code || `SE150${idx+1}`;
                const email = s.email || `${s.name.toLowerCase().split(' ').pop()}@swinburne.edu.vn`;

                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border-color)';
                tr.innerHTML = `
                    <td style="padding: 12px 10px; font-weight: bold; color: var(--swinburne-red);">${stCode}</td>
                    <td style="padding: 12px 10px; font-weight: 600;">${s.name}</td>
                    <td style="padding: 12px 10px; color: var(--color-text-muted); font-size: 0.85rem;">${email}</td>
                    <td style="padding: 12px 10px; font-weight: bold; color: var(--color-success);">${score} pts</td>
                    <td style="padding: 12px 10px; text-align: center;">
                        <button class="btn btn-secondary view-st-detail-btn" data-id="${stCode}" style="padding: 4px 10px; font-size: 0.75rem;">Chi tiết AI</button>
                    </td>
                `;
                allStudentsTableBody.appendChild(tr);
            });

            allStudentsTableBody.querySelectorAll('.view-st-detail-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const stId = btn.getAttribute('data-id');
                    const found = pool.find(s => (s.student_id === stId || s.code === stId));
                    if (found) {
                        openStudentDetail(found);
                    }
                    closeStudentsModal();
                });
            });

            studentsModalOverlay.style.display = 'flex';
        });
    }

    // Initial Load
    loadSessions();
});
