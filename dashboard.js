document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. LIVE CLOCK & GREETING
    // ==========================================
    function updateClock() {
        const clockEl = document.getElementById('liveClockDisplay');
        if (!clockEl) return;

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const timeStr = now.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        clockEl.innerText = `${dateStr} · ${timeStr}`;
    }
    updateClock();
    setInterval(updateClock, 1000);

    // ==========================================
    // 2. LEAFLET MAP INITIALIZATION
    // ==========================================
    let mapInstance = null;
    let markerInstance = null;

    function initLeafletPicker() {
        const defaultLat = 14.5453;
        const defaultLng = 120.5739;

        const mapContainer = document.getElementById('incidentMapPicker');
        if (!mapContainer) return;

        if (!mapInstance) {
            mapInstance = L.map('incidentMapPicker').setView([defaultLat, defaultLng], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(mapInstance);

            markerInstance = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(mapInstance);

            const latInput = document.getElementById('incidentLat');
            const lngInput = document.getElementById('incidentLng');

            if (latInput) latInput.value = defaultLat.toFixed(6);
            if (lngInput) lngInput.value = defaultLng.toFixed(6);

            markerInstance.on('dragend', function () {
                const pos = markerInstance.getLatLng();
                if (latInput) latInput.value = pos.lat.toFixed(6);
                if (lngInput) lngInput.value = pos.lng.toFixed(6);
            });

            mapInstance.on('click', function (e) {
                markerInstance.setLatLng(e.latlng);
                if (latInput) latInput.value = e.latlng.lat.toFixed(6);
                if (lngInput) lngInput.value = e.latlng.lng.toFixed(6);
            });
        }

        setTimeout(() => {
            if (mapInstance) mapInstance.invalidateSize();
        }, 200);
    }

    // ==========================================
    // 3. ENCODE CASE MODAL CONTROLS
    // ==========================================
    const encodeModal = document.getElementById('encodeModal');
    const btnOpenEncode = document.querySelector('.btn-encode-case');
    const btnQuickEncode = document.getElementById('btnQuickEncode');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancelModal = document.getElementById('btnCancelModal');

    function openModal() {
        if (encodeModal) {
            encodeModal.style.display = 'flex';
            initLeafletPicker();
        }
    }

    function closeModal() {
        if (encodeModal) encodeModal.style.display = 'none';
    }

    if (btnOpenEncode) btnOpenEncode.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
    if (btnQuickEncode) btnQuickEncode.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

    // ==========================================
    // 4. ENCODE FORM DIRECT SUBMISSION
    // ==========================================
    const encodeForm = document.getElementById('encodeCaseForm');
    const totalCasesSubtext = document.getElementById('totalCasesSubtext');
    const countPending = document.getElementById('countPending');
    const countCritical = document.getElementById('countCritical');
    const caseListContainer = document.getElementById('caseListContainer');
    const activityTimelineContainer = document.getElementById('activityTimelineContainer');
    const urgentBanner = document.getElementById('urgentBanner');

    if (encodeForm) {
        encodeForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const latVal = parseFloat(document.getElementById('incidentLat')?.value) || 14.545300;
            const lngVal = parseFloat(document.getElementById('incidentLng')?.value) || 120.573900;

            const payload = {
                complainantName: document.getElementById('complainantName')?.value || 'Walk-In Resident',
                complainantPhone: document.getElementById('complainantPhone')?.value || '09000000000',
                purok: document.getElementById('purokSelect')?.value || 'Sitio Masaya',
                streetAddress: document.getElementById('streetAddress')?.value || '',
                incidentTitle: document.getElementById('incidentTitle')?.value || 'New Incident Report',
                incidentCategory: document.getElementById('incidentCategory')?.value || 'General Incident',
                priorityLevel: document.getElementById('priorityLevel')?.value || 'Medium',
                incidentNarrative: document.getElementById('incidentNarrative')?.value || 'Blotter intake notes logged.',
                lat: latVal,
                lng: lngVal
            };

            try {
                const response = await fetch('api/encode_case.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const text = await response.text();
                let result;
                try {
                    result = JSON.parse(text);
                } catch (jsonErr) {
                    console.error('Server Raw Response:', text);
                    alert('Backend Response Error: ' + text);
                    return;
                }

                if (result.success) {
                    const item = result.data;

                    let curPending = parseInt(countPending?.innerText || '0', 10);
                    let curCritical = parseInt(countCritical?.innerText || '0', 10);

                    if (item.priority === 'Critical') {
                        if (countCritical) countCritical.innerText = curCritical + 1;
                        if (urgentBanner) urgentBanner.style.display = 'flex';
                    } else {
                        if (countPending) countPending.innerText = curPending + 1;
                    }

                    if (caseListContainer) {
                        const emptyCases = caseListContainer.querySelector('.empty-state-box');
                        if (emptyCases) emptyCases.remove();

                        const priorityClass = item.priority.toLowerCase();
                        const newCaseHtml = `
                            <div class="case-item">
                                <div class="case-meta">
                                    <h4>${item.title}</h4>
                                    <span class="case-subtext">${item.reference_number} · ${item.complainant}</span>
                                </div>
                                <div class="case-tags">
                                    <span class="badge badge-${priorityClass}">${item.priority}</span>
                                    <span class="pill pill-pending">Pending</span>
                                    <button class="btn-suggest"> Suggest</button>
                                </div>
                            </div>
                        `;
                        caseListContainer.insertAdjacentHTML('afterbegin', newCaseHtml);
                    }

                    if (activityTimelineContainer) {
                        const emptyActivity = activityTimelineContainer.querySelector('.empty-state-box');
                        if (emptyActivity) emptyActivity.remove();

                        const dotClass = item.priority === 'Critical' ? 'act-red' : 'act-blue';
                        const newActivityHtml = `
                            <div class="activity-entry">
                                <span class="act-dot ${dotClass}"></span>
                                <div class="act-details">
                                    <p class="act-text"><strong>${item.reference_number}</strong> encoded — ${item.category}</p>
                                    <span class="act-time">Just now</span>
                                </div>
                            </div>
                        `;
                        activityTimelineContainer.insertAdjacentHTML('afterbegin', newActivityHtml);
                    }

                    encodeForm.reset();
                    closeModal();
                    loadDashboardData();
                    fetchNotifications();
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (err) {
                console.error('Fetch Error:', err);
                alert('Could not connect to server: ' + err.message);
            }
        });
    }

    // ==========================================
    // 5. AI SUGGEST ENGINE & ACTION EXECUTION
    // ==========================================
    const suggestModal = document.getElementById('suggestModal');
    const btnCloseSuggestModal = document.getElementById('btnCloseSuggestModal');
    const btnDismissSuggest = document.getElementById('btnDismissSuggest');
    const btnApplyAction = document.getElementById('btnApplyAction');
    const suggestCaseRef = document.getElementById('suggestCaseRef');
    const suggestClassification = document.getElementById('suggestClassification');
    const suggestPriority = document.getElementById('suggestPriority');
    const suggestRecommendation = document.getElementById('suggestRecommendation');
    const sopList = document.getElementById('sopList');

    let currentSuggestRef = '';
    let currentClassification = '';

    function closeSuggest() {
        if (suggestModal) suggestModal.style.display = 'none';
    }

    if (btnCloseSuggestModal) btnCloseSuggestModal.addEventListener('click', closeSuggest);
    if (btnDismissSuggest) btnDismissSuggest.addEventListener('click', closeSuggest);

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-suggest');
        if (!btn) return;

        const caseItem = btn.closest('.case-item');
        if (!caseItem) return;

        const title = caseItem.querySelector('h4')?.innerText || 'Incident';
        const subtext = caseItem.querySelector('.case-subtext')?.innerText || '';
        const refNumber = subtext.split('·')[0].trim();
        const badge = caseItem.querySelector('.badge')?.innerText || 'Medium';

        currentSuggestRef = refNumber;

        let recommendation = '';
        let sops = [];
        let classificationTag = 'RESOLVABLE AT BRGY';

        if (title.toLowerCase().includes('altercation') || badge === 'Critical' || badge === 'High') {
            classificationTag = 'PEACE & ORDER / DISPATCH';
            recommendation = 'Incident requires immediate Tanod field verification and blotter documentation. If weapons or severe injury are present, transfer to PNP.';
            sops = [
                'Dispatch 2 Duty Barangay Tanods to secure area.',
                'Record complainant and respondent statements in blotter.',
                'Check resident registry for prior infractions.'
            ];
        } else if (title.toLowerCase().includes('dispute') || title.toLowerCase().includes('noise')) {
            classificationTag = 'LUPON MEDIATION';
            recommendation = 'Eligible for Amicable Settlement under Katarungang Pambarangay. Issue notice to summon respondent for First Hearing.';
            sops = [
                'Issue Form KP 7 (Notice of Hearing) to both parties.',
                'Schedule conciliation with Punong Barangay / Lupon.',
                'Mediate within 15 days before issuing Certificate to File Action.'
            ];
        } else {
            classificationTag = 'STANDARD INTAKE';
            recommendation = 'Log under monitoring. Route to respective barangay committee for administrative review.';
            sops = [
                'Verify complainant contact information.',
                'Assign case tracking officer.',
                'Set reminder for 48-hour follow-up.'
            ];
        }

        currentClassification = classificationTag;

        if (suggestCaseRef) suggestCaseRef.innerText = `${refNumber} — ${title}`;
        if (suggestClassification) suggestClassification.innerText = classificationTag;
        if (suggestPriority) suggestPriority.innerText = `Priority: ${badge}`;
        if (suggestRecommendation) suggestRecommendation.innerText = recommendation;
        if (sopList) sopList.innerHTML = sops.map(s => `<li>${s}</li>`).join('');

        if (suggestModal) suggestModal.style.display = 'flex';
    });

    if (btnApplyAction) {
        btnApplyAction.addEventListener('click', async () => {
            if (!currentSuggestRef) return;

            btnApplyAction.disabled = true;
            btnApplyAction.innerText = 'Executing...';

            try {
                const response = await fetch('api/execute_action.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reference_number: currentSuggestRef,
                        action_type: currentClassification.includes('LUPON') ? 'LUPON' : 'DISPATCH'
                    })
                });

                const result = await response.json();

                if (result.success) {
                    const allCases = document.querySelectorAll('.case-item');
                    allCases.forEach(item => {
                        if (item.innerText.includes(currentSuggestRef)) {
                            const pill = item.querySelector('.pill');
                            if (pill) {
                                pill.className = `pill pill-${result.new_status.toLowerCase().replace('_', '-')}`;
                                pill.innerText = result.new_status.replace('_', ' ');
                            }
                        }
                    });

                    if (activityTimelineContainer) {
                        const emptyBox = activityTimelineContainer.querySelector('.empty-state-box');
                        if (emptyBox) emptyBox.remove();

                        const logHtml = `
                            <div class="activity-entry">
                                <span class="act-dot act-purple"></span>
                                <div class="act-details">
                                    <p class="act-text"><strong>${currentSuggestRef}</strong> action executed — dispatched tanods</p>
                                    <span class="act-time">Just now</span>
                                </div>
                            </div>
                        `;
                        activityTimelineContainer.insertAdjacentHTML('afterbegin', logHtml);
                    }

                    closeSuggest();
                    loadDashboardData();
                } else {
                    alert('Action failed: ' + result.message);
                }
            } catch (err) {
                console.error('Execute action error:', err);
                alert('Server connection error.');
            } finally {
                btnApplyAction.disabled = false;
                btnApplyAction.innerText = 'Execute Action';
            }
        });
    }

    // Dismiss modals when clicking on background
    window.addEventListener('click', (e) => {
        if (e.target === encodeModal) closeModal();
        if (e.target === suggestModal) closeSuggest();
    });

    // ==========================================
    // NOTIFICATION BELL & SIDEBAR BADGE SYNC
    // ==========================================
    const bellBtn = document.getElementById('bellBtn');
    const bellDot = document.getElementById('bellDot');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationList = document.getElementById('notificationList');
    const notifBadgeSummary = document.getElementById('notifBadgeSummary');
    const sidebarUrgentBadge = document.getElementById('sidebarUrgentBadge');
    const sidebarSpamBadge = document.getElementById('sidebarSpamBadge');

    // Toggle dropdown
    if (bellBtn && notificationDropdown) {
        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = notificationDropdown.style.display === 'block';
            notificationDropdown.style.display = isVisible ? 'none' : 'block';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!notificationDropdown.contains(e.target) && e.target !== bellBtn) {
                notificationDropdown.style.display = 'none';
            }
        });
    }

    async function fetchNotifications() {
        try {
            const res = await fetch('api/get_notifications.php');
            const data = await res.json();
            if (!data.success) return;

            const counts = data.counts;

            // 1. Update the notification bell badge count
            if (bellDot) {
                if (counts.total > 0) {
                    bellDot.innerText = counts.total;
                    bellDot.style.display = 'inline-flex';
                } else {
                    bellDot.style.display = 'none';
                }
            }

            if (notifBadgeSummary) {
                notifBadgeSummary.innerText = `${counts.total} Total`;
            }

            // 2. Sync Left Sidebar Badges
            if (sidebarUrgentBadge) {
                const urgentTotal = counts.critical + counts.high;
                sidebarUrgentBadge.innerText = urgentTotal;
                sidebarUrgentBadge.style.display = urgentTotal > 0 ? 'inline-block' : 'none';
            }
            if (sidebarSpamBadge) {
                sidebarSpamBadge.innerText = counts.spam;
                sidebarSpamBadge.style.display = counts.spam > 0 ? 'inline-block' : 'none';
            }

            // 3. Render popup list with explicit labels & routing
            if (notificationList) {
                if (!data.notifications || data.notifications.length === 0) {
                    notificationList.innerHTML = `
                        <div style="text-align: center; padding: 24px 12px; color: #94a3b8;">
                            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 6px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                            <p style="font-size: 0.8rem; margin: 0;">All caught up! No active alerts.</p>
                        </div>
                    `;
                    return;
                }

                notificationList.innerHTML = '';
                data.notifications.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'notif-card-item';
                    row.style.cssText = `
                        padding: 10px 12px;
                        border-radius: 8px;
                        cursor: pointer;
                        background: #f8fafc;
                        border-left: 4px solid ${item.border_color};
                        border-top: 1px solid #f1f5f9;
                        border-right: 1px solid #f1f5f9;
                        border-bottom: 1px solid #f1f5f9;
                        transition: all 0.2s ease;
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                    `;

                    row.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.65rem; font-weight: 800; color: ${item.badge_color}; letter-spacing: 0.5px;">${item.category_label}</span>
                            <span style="font-size: 0.72rem; color: #94a3b8;">Click to view &rarr;</span>
                        </div>
                        <div style="font-size: 0.84rem; font-weight: 700; color: #0f172a; line-height: 1.2;">${item.title}</div>
                        <div style="font-size: 0.74rem; color: #64748b;">${item.subtext}</div>
                    `;

                    row.addEventListener('mouseenter', () => {
                        row.style.background = '#f1f5f9';
                        row.style.transform = 'translateX(2px)';
                    });
                    row.addEventListener('mouseleave', () => {
                        row.style.background = '#f8fafc';
                        row.style.transform = 'none';
                    });

                    // Navigation routing on click
                    row.addEventListener('click', () => {
                        notificationDropdown.style.display = 'none';
                        window.location.href = item.target_url;

                        const hash = item.target_url.split('#')[1];
                        if (hash) {
                            const targetEl = document.getElementById(hash);
                            if (targetEl) {
                                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                targetEl.style.transition = 'box-shadow 0.3s ease';
                                targetEl.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.4)';
                                setTimeout(() => { targetEl.style.boxShadow = 'none'; }, 2000);
                            }
                        }
                    });

                    notificationList.appendChild(row);
                });
            }
        } catch (err) {
            console.warn('Notifications fetch skipped:', err);
        }
    }

    fetchNotifications();
    setInterval(fetchNotifications, 8000);

    // ==========================================
    // 6. SESSION, USER PROFILE & LOGOUT
    // ==========================================
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const authToken = localStorage.getItem('authToken');

        // If not logged in, redirect to login page immediately
        if (!currentUser || !authToken) {
            window.location.href = 'index.html';
            return;
        }

        const nameDisplay = document.getElementById('userNameDisplay');
        const roleDisplay = document.getElementById('userRoleDisplay');
        const avatar = document.getElementById('userAvatar');
        const welcomeHeading = document.getElementById('welcomeHeading');

        const fullName = currentUser.full_name || currentUser.username || 'User';
        const role = (currentUser.role || 'OFFICER').toUpperCase();

        // 1. Update Sidebar
        if (nameDisplay) nameDisplay.innerText = fullName;
        if (roleDisplay) {
            roleDisplay.innerText = role.charAt(0) + role.slice(1).toLowerCase();
            roleDisplay.className = `user-role-pill role-${role.toLowerCase()}`;
        }
        if (avatar) {
            const initials = fullName
                .split(' ')
                .filter(w => w.length > 0)
                .map(w => w[0].toUpperCase())
                .slice(0, 2)
                .join('');
            avatar.innerText = initials || 'BL';
        }

        // 2. Dynamic Time-of-Day Greeting
        if (welcomeHeading) {
            const currentHour = new Date().getHours();
            let greeting = 'Good evening';
            if (currentHour >= 5 && currentHour < 12) {
                greeting = 'Good morning';
            } else if (currentHour >= 12 && currentHour < 18) {
                greeting = 'Good afternoon';
            }
            // Display greeting with first name
            const firstName = fullName.split(' ')[0] || 'Official';
            welcomeHeading.innerText = `${greeting}, ${firstName}`;
        }

    } catch (e) {
        console.warn('Session parse error:', e);
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = 'index.html';
        });
    }
    // ==========================================
    // 7. INCIDENT TREND CHART
    // ==========================================
    try {
        const ctx = document.getElementById('incidentTrendChart');
        if (ctx && typeof Chart !== 'undefined') {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
                    datasets: [
                        {
                            label: 'Total Reports',
                            data: [0, 0, 0, 0, 0, 0],
                            borderColor: '#0b1528',
                            backgroundColor: 'transparent',
                            tension: 0.4,
                            borderWidth: 2.5,
                            pointRadius: 3,
                            pointBackgroundColor: '#0b1528'
                        },
                        {
                            label: 'Resolved',
                            data: [0, 0, 0, 0, 0, 0],
                            borderColor: '#10b981',
                            backgroundColor: 'transparent',
                            tension: 0.4,
                            borderWidth: 2,
                            pointRadius: 3,
                            pointBackgroundColor: '#10b981'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
                        y: { min: 0, max: 10, ticks: { stepSize: 2, color: '#94a3b8', font: { size: 11 } }, grid: { color: '#f1f5f9' } }
                    }
                }
            });
        }
    } catch (chartErr) {
        console.warn('Chart initialization skipped:', chartErr);
    }

    // ==========================================
    // 8. INITIAL DATA LOADER FROM DATABASE
    // ==========================================
    async function loadDashboardData() {
        try {
            const response = await fetch('api/get_dashboard_stats.php');
            const result = await response.json();

            if (!result.success) return;

            const counts = result.counts;

            const countPendingEl = document.getElementById('countPending');
            const countProgressEl = document.getElementById('countProgress');
            const countResolutionEl = document.getElementById('countResolution');
            const countResolvedEl = document.getElementById('countResolved');
            const countCriticalEl = document.getElementById('countCritical');

            if (countPendingEl) countPendingEl.innerText = counts.pending;
            if (countProgressEl) countProgressEl.innerText = counts.in_progress;
            if (countResolutionEl) countResolutionEl.innerText = counts.for_resolution;
            if (countResolvedEl) countResolvedEl.innerText = counts.resolved;
            if (countCriticalEl) countCriticalEl.innerText = counts.critical;

            if (totalCasesSubtext) {
                totalCasesSubtext.innerText = `${counts.total} total cases · Brgy. Duale`;
            }

            if (counts.critical > 0 && urgentBanner) {
                urgentBanner.style.display = 'flex';
                const bannerTitle = document.getElementById('urgentBannerTitle');
                if (bannerTitle) bannerTitle.innerText = `${counts.critical} critical case${counts.critical > 1 ? 's' : ''} require immediate attention`;
            } else if (urgentBanner) {
                urgentBanner.style.display = 'none';
            }

            if (caseListContainer && result.recent_cases.length > 0) {
                caseListContainer.innerHTML = '';
                result.recent_cases.forEach(item => {
                    const statusClass = item.status.toLowerCase().replace('_', '-');
                    const isCritical = item.status === 'CRITICAL';
                    const badgeClass = isCritical ? 'badge-critical' : 'badge-medium';
                    const badgeLabel = isCritical ? 'Critical' : 'Standard';

                    const html = `
                        <div class="case-item">
                            <div class="case-meta">
                                <h4>${item.incident_type}</h4>
                                <span class="case-subtext">${item.reference_number} · ${item.purok || 'Sitio Masaya'}</span>
                            </div>
                            <div class="case-tags">
                                <span class="badge ${badgeClass}">${badgeLabel}</span>
                                <span class="pill pill-${statusClass}">${item.status.replace('_', ' ')}</span>
                                <button class="btn-suggest"> Suggest</button>
                            </div>
                        </div>
                    `;
                    caseListContainer.insertAdjacentHTML('beforeend', html);
                });
            }
        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
        }
    }

    loadDashboardData();
});