(function () {
    "use strict";

    // Variables globales d'état partagées (exposées sur window)
    window.isRunning = false;
    window.stageLogs = {};
    window._errorStages = new Set();
    window._updatedOutputs = new Set();
    window._stageTimers = {};
    window._toastInterval = null;
    window._nodeBadgeEls = {};

    window._commitList = [];
    window._commitIndex = 0;
    window._isHistoryMode = false;

    window._versionHistory = [];
    window._versionIndex = -1;
    window._currentFilePath = null;
    window._currentFileType = null;
    window._currentFileExists = true;
    window._pipelineData = null;

    // ─── Fetch pipeline data ───
    window.fetchPipeline = async function () {
        const res = await fetch('api/pipeline');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    };

    // ─── File history loader ───
    window.loadFileHistory = async function (filePath) {
        try {
            const res = await fetch(`api/file/history?path=${encodeURIComponent(filePath)}`);
            const data = await res.json();
            window._versionHistory = data.commits || [];
        } catch {
            window._versionHistory = [];
        }
    };

    // ─── Load version content ───
    window.loadVersionContent = async function () {
        const body = document.getElementById('modal-body');
        body.innerHTML = '<div class="loading-overlay" style="position:relative;min-height:200px;"><div class="loading-spinner"></div></div>';

        const filePath = window._currentFilePath;
        const fileType = window._currentFileType;

        try {
            if (window._versionIndex === -1) {
                // Load current version (from disk)
                switch (fileType) {
                    case 'csv': await window.renderCSV(filePath); break;
                    case 'image': window.renderImage(filePath); break;
                    case 'pdf': window.renderPDF(filePath); break;
                    case 'text': await window.renderText(filePath); break;
                    default: body.innerHTML = '<div class="file-not-found"><div class="file-not-found-icon">📦</div><div class="file-not-found-text">Binary file</div></div>';
                }
                return;
            }

            const commit = window._versionHistory[window._versionIndex].hash;

            if (fileType === 'csv') {
                const res = await fetch(`api/file/at-commit?path=${encodeURIComponent(filePath)}&commit=${commit}`);
                const data = await res.json();
                if (data.error) { body.innerHTML = `<div class="file-not-found"><div class="file-not-found-icon">🕰️</div><div class="file-not-found-text">${data.error}</div></div>`; return; }
                window._csvData = data;
                window._csvSortCol = null; window._csvSortAsc = true;
                const toolbar = document.getElementById('modal-toolbar');
                const search = document.getElementById('modal-search');
                const stats = document.getElementById('modal-stats');
                toolbar.style.display = 'flex';
                search.value = '';
                stats.textContent = `${data.total} rows · ${data.columns.length} cols`;
                window.renderCSVTable('');
            } else if (fileType === 'image') {
                body.innerHTML = `<div class="image-viewer"><img src="api/file/at-commit?path=${encodeURIComponent(filePath)}&commit=${commit}" alt="${filePath}"></div>`;
            } else if (fileType === 'text') {
                const res = await fetch(`api/file/at-commit?path=${encodeURIComponent(filePath)}&commit=${commit}`);
                const data = await res.json();
                if (data.error) { body.innerHTML = `<div class="file-not-found"><div class="file-not-found-icon">🕰️</div><div class="file-not-found-text">${data.error}</div></div>`; return; }
                if (filePath.endsWith('.json')) {
                    try {
                        const parsed = JSON.parse(data.content);
                        body.innerHTML = `<div class="text-viewer">${JSON.stringify(parsed, null, 2)}</div>`;
                    } catch { body.innerHTML = `<div class="text-viewer">${window.escapeHtml(data.content)}</div>`; }
                } else {
                    body.innerHTML = `<div class="text-viewer">${window.escapeHtml(data.content)}</div>`;
                }
            } else if (fileType === 'pdf') {
                body.innerHTML = `<div class="pdf-viewer"><iframe src="api/file/at-commit?path=${encodeURIComponent(filePath)}&commit=${commit}"></iframe></div>`;
            } else {
                body.innerHTML = '<div class="file-not-found"><div class="file-not-found-icon">📦</div><div class="file-not-found-text">Preview not available for this version</div></div>';
            }
        } catch (err) {
            body.innerHTML = `<div class="file-not-found"><div class="file-not-found-icon">💥</div><div class="file-not-found-text">Error: ${err.message}</div></div>`;
        }
    };

    // ─── Run Pipeline / Stage ───
    window.runPipeline = async function (stage = null) {
        if (window.isRunning) return;
        window.isRunning = true;
        window._uiLaunchedRun = true;

        const allBtn = document.getElementById('btn-run-all');
        const stageBtn = document.getElementById('btn-run-stage');
        const stopBtn = document.getElementById('btn-stop');
        allBtn.classList.add('running');
        allBtn.disabled = true;
        stageBtn.classList.add('running');
        stageBtn.disabled = true;
        stopBtn.classList.add('visible');

        // Clear previous logs, error states, and updated outputs
        window._errorStages.clear();
        window._updatedOutputs.clear();
        window._stageTimers = {};
        window.clearAllNodeBadges();
        if (!stage) {
            window.stageLogs = {};
        } else {
            window.stageLogs[stage] = '';
        }

        const label = stage ? `Running: ${stage}` : 'Running pipeline…';
        window.showToast(label, 'running');

        // Build SSE URL
        let url = 'api/run-stream?';
        if (stage) url += `stage=${encodeURIComponent(stage)}&`;
        url += 'force=false';

        try {
            const res = await fetch(url);
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let pipelineSuccess = true;
            let pipelineCancelled = false;
            let failedStage = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                let eventType = null;
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7).trim();
                    } else if (line.startsWith('data: ') && eventType) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            handleSSEEvent(eventType, data);
                        } catch (e) { }
                        eventType = null;
                    }
                }
            }

            function handleSSEEvent(type, data) {
                switch (type) {
                    case 'stage_start':
                        if (!window.stageLogs[data.stage]) window.stageLogs[data.stage] = '';
                        window._stageTimers[data.stage] = { start: Date.now(), duration: null };
                        // Live elapsed timer in toast
                        if (window._toastInterval) clearInterval(window._toastInterval);
                        window._toastInterval = setInterval(() => {
                            const t = window._stageTimers[data.stage];
                            if (t && !t.duration) {
                                const elapsed = window.formatElapsed(Date.now() - t.start);
                                window._currentRunningStage = data.stage;
                                document.getElementById('toast-text').textContent = `Running: ${data.stage} (${elapsed}…)`;
                            }
                        }, 1000);
                        break;

                    case 'stage_skip':
                        if (!window.stageLogs[data.stage]) window.stageLogs[data.stage] = '';
                        window.stageLogs[data.stage] += `[skipped — no changes]\n`;
                        break;

                    case 'log':
                        if (data.stage && data.line !== undefined) {
                            if (!window.stageLogs[data.stage]) window.stageLogs[data.stage] = '';
                            window.stageLogs[data.stage] += data.line + '\n';

                            if (window.stageLogs[data.stage].length > 200000) {
                                window.stageLogs[data.stage] = "... (logs truncated) ...\n" + window.stageLogs[data.stage].slice(-190000);
                            }
                        }
                        if (data.stage && data.stage === window.selectedStage) {
                            const logPre = document.querySelector('.sidebar-logs-content');
                            if (logPre) {
                                if (!logPre.dataset.updatePending) {
                                    logPre.dataset.updatePending = 'true';
                                    requestAnimationFrame(() => {
                                        logPre.textContent = window.stageLogs[data.stage];
                                        logPre.scrollTop = logPre.scrollHeight;
                                        logPre.dataset.updatePending = '';
                                    });
                                }
                            }
                        }
                        break;

                    case 'stage_done':
                        if (window._stageTimers[data.stage]) {
                            window._stageTimers[data.stage].duration = Date.now() - window._stageTimers[data.stage].start;
                        }
                        if (window._toastInterval) { clearInterval(window._toastInterval); window._toastInterval = null; }
                        if (!data.success) {
                            pipelineSuccess = false;
                            failedStage = data.stage;
                            window._errorStages.add(data.stage);
                        }
                        // Mark outputs as updated for badge display
                        if (data.success && window.cy) {
                            const n = window.cy.getElementById(data.stage);
                            if (n.length) {
                                const allFiles = [...(n.data('outs') || []), ...(n.data('metrics') || []), ...(n.data('plots') || [])];
                                allFiles.forEach(o => {
                                    const p = typeof o === 'string' ? o : o.path;
                                    if (p) window._updatedOutputs.add(p);
                                });
                                if (allFiles.some(o => { const p = typeof o === 'string' ? o : o.path; return p && window.isInspectable(p); })) {
                                    window.addNodeBadge(data.stage);
                                }
                            }
                        }
                        break;

                    case 'done':
                        pipelineSuccess = data.success;
                        pipelineCancelled = data.cancelled || false;
                        if (data.failed_stages && data.failed_stages.length > 0) {
                            failedStage = data.failed_stages.join(', ');
                        } else if (data.failed_stage) {
                            failedStage = data.failed_stage;
                        }
                        break;
                }
            }

            // Final toast
            if (pipelineSuccess) {
                window.showToast('Pipeline completed ✓', 'success');
            } else if (pipelineCancelled) {
                window.showToast('Pipeline cancelled ✗', 'error');
            } else {
                window.showToast(`Failed: ${failedStage || 'unknown stage'}`, 'error');
            }
            setTimeout(window.hideToast, 4000);
            
            // Reset button state
            window.isRunning = false;
            window._uiLaunchedRun = false;
            allBtn.classList.remove('running');
            allBtn.disabled = false;
            stageBtn.classList.remove('running');
            stageBtn.disabled = false;
            stopBtn.classList.remove('visible');
            
            // Stop animations
            if (window.cy) window.cy.nodes().forEach(n => {
                if (n.scratch('_animating')) window.stopSingleNodeAnimation(n.id());
            });

        } catch (err) {
            window.showToast('Error: ' + err.message, 'error');
            setTimeout(window.hideToast, 5000);
            window.isRunning = false;
            window._uiLaunchedRun = false;
            allBtn.classList.remove('running');
            allBtn.disabled = false;
            stageBtn.classList.remove('running');
            stageBtn.disabled = false;
            stopBtn.classList.remove('visible');
        }
    };

    // Heartbeat Ping Loop for Self-destruction
    function pingHeartbeat() {
        fetch('api/heartbeat')
            .then(res => {
                if (!res.ok) console.warn('Heartbeat failed');
            })
            .catch(err => console.error('Heartbeat connection error:', err));
    }
    pingHeartbeat();
    setInterval(pingHeartbeat, 5000);

})();
