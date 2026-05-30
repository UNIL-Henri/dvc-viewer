(function () {
    "use strict";

    window.STATE_LABELS = {
        valid: 'Valid',
        needs_rerun: 'Needs rerun',
        failed: 'Failed',
        never_run: 'Never run',
        running: 'Running',
        frozen: 'Frozen',
    };

    window.FILE_ICONS = {
        csv: '📊', image: '🖼️', pdf: '📕', text: '📄', binary: '📦',
    };

    window.INSPECTABLE_EXTS = ['.csv', '.tsv', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.pdf', '.json', '.yaml', '.yml', '.txt', '.md', '.log', '.jsonl'];
    window.isInspectable = (path) => window.INSPECTABLE_EXTS.some(ext => path.toLowerCase().endsWith(ext));

    // ─── Sidebar detail ───
    window.showDetail = function (data) {
        document.getElementById('sidebar-empty').style.display = 'none';
        const detail = document.getElementById('sidebar-detail');
        detail.style.display = 'block';

        document.getElementById('detail-name').textContent = data.id;

        const badge = document.getElementById('detail-badge');
        const isFrozen = data.frozen;
        badge.textContent = isFrozen ? 'Frozen' : window.STATE_LABELS[data.state];
        badge.className = 'state-badge ' + (isFrozen ? 'frozen' : data.state);

        document.getElementById('detail-cmd').textContent = data.cmd || '(no command)';

        const sections = document.getElementById('detail-sections');
        sections.innerHTML = '';

        const addFileSection = (title, items, cls = '', clickable = false) => {
            if (!items || items.length === 0) return;
            const sec = document.createElement('div');
            sec.className = 'sidebar-section';
            sec.innerHTML = `<div class="section-title">${title}</div>`;
            const ul = document.createElement('ul');
            ul.className = 'file-list';
            for (const item of items) {
                const path = typeof item === 'string' ? item : item.path;
                const status = typeof item === 'string' ? 'unknown' : (item.status || 'unknown');
                const canInspect = clickable && window.isInspectable(path);
                const isNew = window._updatedOutputs.has(path);
                const li = document.createElement('li');
                li.className = 'file-item' + (cls ? ' ' + cls : '') + ` status-${status}` + (canInspect ? ' inspectable' : '') + (canInspect && isNew ? ' has-update' : '');
                const dot = document.createElement('span');
                dot.className = `status-dot ${status}`;
                li.appendChild(dot);
                li.appendChild(document.createTextNode(path));
                if (canInspect) {
                    li.addEventListener('click', (e) => {
                        e.stopPropagation();
                        window._updatedOutputs.delete(path);
                        li.classList.remove('has-update');
                        window.openFileInspector(path);
                    });
                }
                ul.appendChild(li);
            }
            sec.appendChild(ul);
            sections.appendChild(sec);
        };

        const addSection = (title, items, cls = '') => {
            if (!items || items.length === 0) return;
            const sec = document.createElement('div');
            sec.className = 'sidebar-section';
            sec.innerHTML = `<div class="section-title">${title}</div>`;
            const ul = document.createElement('ul');
            ul.className = 'file-list';
            for (const item of items) {
                const li = document.createElement('li');
                li.className = 'file-item' + (cls ? ' ' + cls : '');
                li.textContent = item;
                ul.appendChild(li);
            }
            sec.appendChild(ul);
            sections.appendChild(sec);
        };

        addFileSection('Metrics', data.metrics, 'metric', true);
        addFileSection('Plots', data.plots, 'plot', true);
        addFileSection('Dependencies', data.deps, '', false);
        addFileSection('Outputs', data.outs, '', true);
        addSection('Parameters', data.params, 'param');

        // Hydra Config Accordion
        if (data.hydra_config) {
            const acc = document.createElement('div');
            acc.className = 'accordion sidebar-section';
            acc.style.padding = '0';
            acc.style.borderBottom = '1px solid var(--border)';

            const header = document.createElement('div');
            header.className = 'accordion-header';
            header.innerHTML = `
                <div class="accordion-header-left">
                    <span class="section-title">⚙️ Hydra Config</span>
                </div>
                <span class="accordion-chevron">▶</span>
            `;

            const body = document.createElement('div');
            body.className = 'accordion-body';

            const content = document.createElement('div');
            content.className = 'accordion-content';
            content.innerHTML = `<div class="hydra-loading"><div class="mini-spinner"></div>Loading config…</div>`;
            body.appendChild(content);

            let loaded = false;

            header.addEventListener('click', () => {
                acc.classList.toggle('open');
                if (!loaded && acc.classList.contains('open')) {
                    loaded = true;
                    loadHydraParams(data.hydra_config, content);
                }
            });

            async function loadHydraParams(configPath, container) {
                try {
                    const res = await fetch(`api/hydra-config?path=${encodeURIComponent(configPath)}`);
                    const result = await res.json();
                    if (result.error) {
                        container.innerHTML = `<div class="hydra-loading" style="color:#ef4444;">❌ ${window.escapeHtml(result.error)}</div>`;
                        return;
                    }

                    const params = result.params || [];
                    const sources = result.sources || [configPath];

                    const originals = {};
                    params.forEach(p => {
                        originals[p.key] = p.value;
                    });

                    container.innerHTML = '';

                    const inputRegistry = {};

                    function renderParam(param, parentEl) {
                        const row = document.createElement('div');
                        row.className = 'hydra-param';

                        const keyLabel = document.createElement('span');
                        keyLabel.className = 'hydra-param-key';
                        keyLabel.textContent = param.shortKey;
                        keyLabel.title = param.key;
                        row.appendChild(keyLabel);

                        if (param.type === 'bool') {
                            const toggle = document.createElement('label');
                            toggle.className = 'hydra-toggle';
                            const cb = document.createElement('input');
                            cb.type = 'checkbox';
                            cb.checked = !!param.value;
                            const track = document.createElement('span');
                            track.className = 'hydra-toggle-track';
                            const thumb = document.createElement('span');
                            thumb.className = 'hydra-toggle-thumb';
                            toggle.appendChild(cb);
                            toggle.appendChild(track);
                            toggle.appendChild(thumb);
                            row.appendChild(toggle);
                            cb.addEventListener('change', checkChanges);
                            inputRegistry[param.key] = { getValue: () => cb.checked, source: param.source || configPath };
                        } else if (param.type === 'list') {
                            const listSpan = document.createElement('span');
                            listSpan.className = 'hydra-list-value';
                            listSpan.textContent = JSON.stringify(param.value);
                            listSpan.title = 'Lists cannot be edited inline';
                            row.appendChild(listSpan);
                        } else if (param.type === 'null') {
                            const nullSpan = document.createElement('span');
                            nullSpan.className = 'hydra-null-value';
                            nullSpan.textContent = 'null';
                            row.appendChild(nullSpan);
                        } else {
                            const input = document.createElement('input');
                            input.className = 'hydra-param-input';
                            input.type = (param.type === 'int' || param.type === 'float') ? 'number' : 'text';
                            if (param.type === 'float') input.step = 'any';
                            input.value = param.value ?? '';
                            input.addEventListener('input', () => {
                                const orig = String(originals[param.key] ?? '');
                                input.classList.toggle('modified', input.value !== orig);
                                checkChanges();
                            });
                            row.appendChild(input);
                            inputRegistry[param.key] = { getValue: () => input.value, source: param.source || configPath };
                        }

                        const typeBadge = document.createElement('span');
                        typeBadge.className = 'hydra-param-type';
                        typeBadge.textContent = param.type;
                        row.appendChild(typeBadge);

                        parentEl.appendChild(row);
                    }

                    for (const sourcePath of sources) {
                        const sourceParams = params.filter(p => (p.source || configPath) === sourcePath);
                        if (sourceParams.length === 0) continue;

                        const sourceDiv = document.createElement('div');
                        sourceDiv.style.marginBottom = '8px';
                        const sourceHeader = document.createElement('div');
                        sourceHeader.className = 'hydra-config-path';
                        const basename = sourcePath.split('/').pop();
                        sourceHeader.innerHTML = `📁 <span class="path-text" title="${window.escapeHtml(sourcePath)}">${window.escapeHtml(basename)}</span>`;
                        sourceDiv.appendChild(sourceHeader);

                        const groups = {};
                        const topLevel = [];
                        sourceParams.forEach(p => {
                            const dotIdx = p.key.indexOf('.');
                            if (dotIdx > -1) {
                                const group = p.key.substring(0, dotIdx);
                                if (!groups[group]) groups[group] = [];
                                groups[group].push({ ...p, shortKey: p.key.substring(dotIdx + 1) });
                            } else {
                                topLevel.push({ ...p, shortKey: p.key });
                            }
                        });

                        topLevel.forEach(p => renderParam(p, sourceDiv));
                        for (const [groupName, groupParams] of Object.entries(groups)) {
                            const groupDiv = document.createElement('div');
                            groupDiv.className = 'hydra-group';
                            const groupHeader = document.createElement('div');
                            groupHeader.className = 'hydra-group-header';
                            groupHeader.textContent = groupName;
                            groupDiv.appendChild(groupHeader);
                            groupParams.forEach(p => renderParam(p, groupDiv));
                            sourceDiv.appendChild(groupDiv);
                        }

                        container.appendChild(sourceDiv);
                    }

                    const actions = document.createElement('div');
                    actions.className = 'hydra-actions';

                    const status = document.createElement('span');
                    status.className = 'hydra-status';

                    const saveBtn = document.createElement('button');
                    saveBtn.className = 'hydra-save-btn';
                    saveBtn.innerHTML = '💾 Save';
                    saveBtn.disabled = true;

                    actions.appendChild(status);
                    actions.appendChild(saveBtn);
                    container.appendChild(actions);

                    function checkChanges() {
                        let hasChanges = false;
                        for (const [key, reg] of Object.entries(inputRegistry)) {
                            const current = reg.getValue();
                            const orig = originals[key];
                            if (String(current) !== String(orig ?? '')) {
                                hasChanges = true;
                                break;
                            }
                        }
                        saveBtn.disabled = !hasChanges;
                        if (hasChanges) {
                            status.className = 'hydra-status unsaved';
                            status.textContent = '● Unsaved changes';
                        } else {
                            status.className = 'hydra-status';
                            status.textContent = '';
                        }
                    }

                    saveBtn.addEventListener('click', async () => {
                        const changedParams = {};
                        for (const [key, reg] of Object.entries(inputRegistry)) {
                            const current = reg.getValue();
                            const orig = originals[key];
                            if (String(current) !== String(orig ?? '')) {
                                changedParams[key] = { value: current, source: reg.source };
                            }
                        }
                        if (Object.keys(changedParams).length === 0) return;

                        saveBtn.disabled = true;
                        saveBtn.innerHTML = '⏳ Saving…';
                        status.className = 'hydra-status';
                        status.textContent = '';

                        try {
                            const putRes = await fetch('api/hydra-config', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ path: configPath, params: changedParams }),
                            });
                            const putData = await putRes.json();

                            if (putData.success) {
                                for (const [key, val] of Object.entries(changedParams)) {
                                    originals[key] = val.value;
                                }
                                container.querySelectorAll('.hydra-param-input.modified').forEach(el => el.classList.remove('modified'));
                                saveBtn.innerHTML = '✅ Saved!';
                                saveBtn.classList.add('saved');
                                status.className = 'hydra-status';
                                status.textContent = '';
                                setTimeout(() => {
                                    saveBtn.innerHTML = '💾 Save';
                                    saveBtn.classList.remove('saved');
                                    saveBtn.disabled = true;
                                }, 2000);
                            } else {
                                saveBtn.innerHTML = '💾 Save';
                                saveBtn.disabled = false;
                                status.className = 'hydra-status error';
                                status.textContent = putData.error || 'Save failed';
                            }
                        } catch (err) {
                            saveBtn.innerHTML = '💾 Save';
                            saveBtn.disabled = false;
                            status.className = 'hydra-status error';
                            status.textContent = 'Network error';
                        }
                    });

                } catch (err) {
                    container.innerHTML = `<div class="hydra-loading" style="color:#ef4444;">❌ Failed to load config</div>`;
                }
            }

            acc.appendChild(header);
            acc.appendChild(body);
            sections.appendChild(acc);
        }

        // Execution Logs section
        const stageId = data.id;
        const logs = window.stageLogs[stageId];
        const timer = window._stageTimers[stageId];
        const durationStr = timer && timer.duration ? ` · ${window.formatElapsed(timer.duration)}` : '';
        const logsDiv = document.createElement('div');
        logsDiv.className = 'sidebar-logs';
        if (logs && logs.trim()) {
            logsDiv.innerHTML = `
                <div class="sidebar-logs-header">
                    <span class="sidebar-logs-title">Execution Logs<span class="sidebar-logs-duration">${durationStr}</span></span>
                    <button class="sidebar-logs-copy" data-stage="${stageId}">📋 Copy</button>
                </div>
                <pre class="sidebar-logs-content">${window.escapeHtml(logs)}</pre>
            `;
            logsDiv.querySelector('.sidebar-logs-copy').addEventListener('click', () => {
                navigator.clipboard.writeText(window.stageLogs[stageId] || '').then(() => {
                    const btn = logsDiv.querySelector('.sidebar-logs-copy');
                    btn.textContent = '✅ Copied!';
                    setTimeout(() => btn.textContent = '📋 Copy', 2000);
                });
            });
        } else {
            logsDiv.innerHTML = `
                <div class="sidebar-logs-header">
                    <span class="sidebar-logs-title">Execution Logs</span>
                </div>
                <div class="sidebar-logs-empty">No execution logs yet</div>
            `;
        }
        
        const logsContainer = document.getElementById('sidebar-logs-container');
        logsContainer.innerHTML = '';
        logsContainer.appendChild(logsDiv);

        // Setup Freeze Button
        const btnFreeze = document.getElementById('btn-freeze-stage');
        btnFreeze.querySelector('.freeze-text').textContent = isFrozen ? 'Unfreeze' : 'Freeze';

        let ancestorFrozen = false;
        if (window.cy) {
            const node = window.cy.getElementById(data.id);
            if (node.length) {
                const ancestors = node.predecessors('node');
                ancestorFrozen = ancestors.some(n => n.data('frozen'));
            }
        }

        if (isFrozen && ancestorFrozen) {
            btnFreeze.disabled = true;
            btnFreeze.title = "Cannot unfreeze: parent stage is frozen";
            btnFreeze.style.opacity = "0.5";
            btnFreeze.style.background = 'rgba(96, 165, 250, 0.25)';
            btnFreeze.style.cursor = 'not-allowed';
        } else {
            btnFreeze.disabled = false;
            btnFreeze.title = isFrozen ? "Unfreeze this stage and descendants" : "Freeze this stage and descendants";
            btnFreeze.style.opacity = "1";
            btnFreeze.style.background = isFrozen ? 'rgba(96, 165, 250, 0.25)' : 'rgba(96, 165, 250, 0.1)';
            btnFreeze.style.cursor = 'pointer';
        }

        const newBtn = btnFreeze.cloneNode(true);
        btnFreeze.parentNode.replaceChild(newBtn, btnFreeze);

        newBtn.addEventListener('click', async () => {
            if (newBtn.disabled) return;
            newBtn.disabled = true;
            const originalText = newBtn.querySelector('.freeze-text').textContent;
            newBtn.querySelector('.freeze-text').textContent = 'Updating...';

            try {
                const res = await fetch('api/stage/freeze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stage: data.id, frozen: !isFrozen }),
                });
                const resData = await res.json();

                if (resData.error) {
                    alert('Error: ' + resData.error);
                    newBtn.querySelector('.freeze-text').textContent = originalText;
                } else {
                    window.showToast(`Stage ${data.id} ${!isFrozen ? 'frozen' : 'unfrozen'}`, 'success');
                    window.pollPipeline();
                }
            } catch (err) {
                alert('Network error: ' + err);
                newBtn.querySelector('.freeze-text').textContent = originalText;
            } finally {
                newBtn.disabled = false;
            }
        });
    };

    window.clearDetail = function () {
        document.getElementById('sidebar-empty').style.display = 'flex';
        document.getElementById('sidebar-detail').style.display = 'none';
        if (window._pipelineData) window.renderNodeList(window._pipelineData);
    };

    // ─── Progress bar state ───
    let _runStartTime = null;
    let _stageCompletionTimes = [];
    let _lastCompletedCount = 0;

    window.updateProgressBar = function (data) {
        const container = document.getElementById('progress-bar-container');
        if (!data.is_running || !data.progress) {
            container.classList.remove('visible');
            _runStartTime = null;
            _stageCompletionTimes = [];
            _lastCompletedCount = 0;
            return;
        }

        container.classList.add('visible');
        const { total, completed } = data.progress;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

        if (!_runStartTime) {
            _runStartTime = Date.now();
            _lastCompletedCount = completed;
        }

        if (completed > _lastCompletedCount) {
            const now = Date.now();
            for (let i = 0; i < completed - _lastCompletedCount; i++) {
                _stageCompletionTimes.push(now);
            }
            _lastCompletedCount = completed;
        }

        document.getElementById('progress-fill').style.width = pct + '%';
        document.getElementById('progress-label').textContent = `Stage ${completed} / ${total}`;
        document.getElementById('progress-percent').textContent = pct + '%';

        const stagesCompletedDuringRun = completed - (_lastCompletedCount - _stageCompletionTimes.length);
        const elapsed = Date.now() - _runStartTime;
        const remaining = total - completed;

        if (_stageCompletionTimes.length > 0 && remaining > 0) {
            const avgTimePerStage = elapsed / _stageCompletionTimes.length;
            const etaMs = avgTimePerStage * remaining;
            const etaDate = new Date(Date.now() + etaMs);
            const etaStr = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const remainMin = Math.ceil(etaMs / 60000);
            document.getElementById('progress-eta').textContent = `ETA ${etaStr}`;
            document.getElementById('progress-remaining').textContent = `~${remainMin}min`;
        } else if (remaining > 0) {
            document.getElementById('progress-eta').textContent = 'Calculating...';
            document.getElementById('progress-remaining').textContent = '';
        } else {
            document.getElementById('progress-eta').textContent = 'Done!';
            document.getElementById('progress-remaining').textContent = '';
        }
    };

    window.renderNodeList = function (data) {
        window.updateProgressBar(data);
        const list = document.getElementById('sidebar-node-list');
        const scrollPos = list.scrollTop;
        list.innerHTML = '';

        const filter = (document.getElementById('sidebar-search')?.value || '').toLowerCase();
        const order = data.execution_order || data.nodes.map(n => n.id);

        let nextUpId = data.is_running ? data.running_stage : null;
        if (!nextUpId) {
            for (const nodeName of order) {
                const node = data.nodes.find(n => n.id === nodeName);
                if (node && node.state !== 'valid' && node.state !== 'running' && !node.frozen) {
                    nextUpId = nodeName;
                    break;
                }
            }
        }
        for (const nodeName of order) {
            const node = data.nodes.find(n => n.id === nodeName);
            if (!node) continue;

            if (filter && !nodeName.toLowerCase().includes(filter)) continue;

            const stateFilter = document.getElementById('sidebar-status-filter')?.value || 'all';
            if (stateFilter !== 'all') {
                if (stateFilter === 'frozen' && !node.frozen) continue;
                if (stateFilter !== 'frozen' && node.state !== stateFilter) continue;
            }

            const li = document.createElement('li');
            const isNext = nodeName === nextUpId;
            const isFrozen = node.frozen;
            li.className = 'sidebar-node-item' + (isNext ? ' next-up' : '') + (isFrozen ? ' frozen' : '');

            let prefix = '';
            if (isFrozen) prefix = '<span style="margin-right:4px">❄️</span>';
            else if (isNext) prefix = (data.is_running && nodeName === data.running_stage ? '<span style="margin-right:4px">⚡</span>' : '<span style="margin-right:4px">⏳</span>');

            li.innerHTML = `
                <span class="node-name">${prefix}${nodeName}</span>
                <span class="node-status-badge ${isFrozen ? 'frozen' : node.state}">${isFrozen ? 'Frozen' : window.STATE_LABELS[node.state]}</span>
            `;
            li.addEventListener('click', () => {
                const cyNode = window.cy.getElementById(nodeName);
                if (cyNode.length) {
                    window.selectedStage = nodeName;
                    window.showDetail(cyNode.data());
                    window.highlightNeighborhood(cyNode);
                    window.removeNodeBadge(nodeName);

                    window.cy.animate({
                        center: { eles: cyNode },
                        zoom: 1.5,
                        duration: 500,
                        easing: 'ease-out-cubic'
                    });
                }
            });
            list.appendChild(li);
        }
        list.scrollTop = scrollPos;
    };

    window.updateStats = function (data) {
        const counts = { valid: 0, needs_rerun: 0, never_run: 0, running: 0 };
        for (const n of data.nodes) counts[n.state] = (counts[n.state] || 0) + 1;

        const bar = document.getElementById('stats-bar');
        let html = `
            <div class="stat-chip"><span class="count">${data.nodes.length}</span> stages</div>
            <div class="stat-chip"><span class="count">${data.edges.length}</span> edges</div>
            <div class="stat-chip"><span class="count" style="color: var(--state-valid)">${counts.valid}</span> valid</div>
            <div class="stat-chip"><span class="count" style="color: var(--state-rerun)">${counts.needs_rerun}</span> needs rerun</div>
            <div class="stat-chip"><span class="count" style="color: var(--state-never)">${counts.never_run}</span> never run</div>`;
        if (counts.running > 0) {
            html += `\n            <div class="stat-chip"><span class="count" style="color: #818cf8">${counts.running}</span> running</div>`;
        }
        bar.innerHTML = html;
    };

    // Polling
    let _prevIsRunning = false;
    let _prevRunningStage = null;
    let _pollTimer = null;
    window._uiLaunchedRun = false;

    window.startPolling = function () {
        if (_pollTimer) return;
        _pollTimer = setInterval(window.pollPipeline, 1000);
    };

    window.stopPolling = function () {
        if (_pollTimer) {
            clearInterval(_pollTimer);
            _pollTimer = null;
        }
    };

    window.pollPipeline = async function () {
        if (window._isHistoryMode) return;
        try {
            const data = await window.fetchPipeline();
            if (data.error) return;
            window._pipelineData = data;

            const nowRunning = data.is_running || false;
            const nowStage = data.running_stage || null;

            let structureChanged = false;
            if (!window.cy || window.cy.nodes().length === 0) {
                structureChanged = true;
            } else {
                const cyNodeIds = new Set(window.cy.nodes().map(n => n.id()));
                const apiNodeIds = new Set(data.nodes.map(n => n.id));
                if (cyNodeIds.size !== apiNodeIds.size || [...apiNodeIds].some(id => !cyNodeIds.has(id))) {
                    structureChanged = true;
                }
            }
            if (structureChanged) {
                const elements = window.buildElements(data);
                if (window.cy) window.cy.destroy();
                window.initGraph(elements);
                window.updateStats(data);
                return;
            }

            const allBtn = document.getElementById('btn-run-all');
            const stageBtn = document.getElementById('btn-run-stage');
            const stopBtn = document.getElementById('btn-stop');

            if (nowRunning && !_prevIsRunning && !window._uiLaunchedRun) {
                window.isRunning = true;
                allBtn.classList.add('running');
                allBtn.disabled = true;
                stageBtn.disabled = true;
                stopBtn.classList.add('visible');
                window.showToast(nowStage ? `Running: ${nowStage}` : 'Pipeline running…', 'running');
            }

            if (nowRunning && nowStage !== _prevRunningStage) {
                if (_prevRunningStage) {
                    window.stopSingleNodeAnimation(_prevRunningStage, true);
                }
                if (window.cy) window.cy.nodes().forEach(n => {
                    if (n.id() !== nowStage && n.scratch('_animating')) {
                        window.stopSingleNodeAnimation(n.id());
                    }
                });
                if (nowStage) {
                    window.startSingleNodeAnimation(nowStage);
                    window.showToast(`Running: ${nowStage}`, 'running');
                }
            }

            if (!nowRunning && _prevIsRunning) {
                window.isRunning = false;
                allBtn.classList.remove('running');
                allBtn.disabled = false;
                stageBtn.disabled = false;
                stopBtn.classList.remove('visible');
                if (window.cy) window.cy.nodes().forEach(n => {
                    if (n.scratch('_animating')) {
                        window.stopSingleNodeAnimation(n.id());
                    }
                });
                if (!window._uiLaunchedRun) {
                    window.showToast('Pipeline completed', 'success');
                    setTimeout(window.hideToast, 4000);
                }
                window._uiLaunchedRun = false;
            }

            _prevIsRunning = nowRunning;
            _prevRunningStage = nowStage;

            for (const node of data.nodes) {
                const cyNode = window.cy.getElementById(node.id);
                if (!cyNode.length) continue;

                const prevState = cyNode.data('state');
                cyNode.data({
                    deps: node.deps,
                    outs: node.outs,
                    metrics: node.metrics,
                    plots: node.plots,
                    frozen: node.frozen || false,
                    hydra_config: node.hydra_config || null,
                    hydra_config_exists: node.hydra_config_exists || false,
                });

                if (cyNode.scratch('_animating')) {
                    cyNode.data('state', node.state);
                    continue;
                }

                if (prevState !== node.state) {
                    const sc = window.STATE_COLORS[node.state] || window.STATE_COLORS.never_run;
                    cyNode.removeStyle();
                    cyNode.data({
                        state: node.state,
                        bgColor: sc.bg,
                        borderColor: sc.border,
                        textColor: sc.text,
                        glowColor: sc.glow,
                    });
                }
            }

            window.updateStats(data);

            if (window.selectedStage) {
                const updatedNode = data.nodes.find(n => n.id === window.selectedStage);
                if (updatedNode) {
                    const badge = document.getElementById('detail-badge');
                    if (badge) {
                        badge.textContent = window.STATE_LABELS[updatedNode.state];
                        badge.className = 'state-badge ' + updatedNode.state;
                    }
                }
            } else {
                window.renderNodeList(data);
            }
        } catch (err) { }
    };

    // Boot
    window.boot = async function () {
        const loading = document.getElementById('loading');
        try {
            const data = await window.fetchPipeline();
            if (data.error) throw new Error(data.error);

            const elements = window.buildElements(data);
            window._pipelineData = data;
            
            if (data.read_only) {
                document.body.classList.add('read-only-mode');
            }
            window.initGraph(elements);
            window.updateStats(data);
            window.renderNodeList(data);

            if (data.is_running && data.running_stage) {
                window.isRunning = true;
                document.getElementById('btn-run-all').classList.add('running');
                document.getElementById('btn-run-all').disabled = true;
                document.getElementById('btn-run-stage').disabled = true;
                document.getElementById('btn-stop').classList.add('visible');
                window.startSingleNodeAnimation(data.running_stage);
                window.showToast(`Running: ${data.running_stage}`, 'running');
                _prevIsRunning = true;
                _prevRunningStage = data.running_stage;
            }

            window.startPolling();

            try {
                const cRes = await fetch('api/commits?limit=100');
                const cData = await cRes.json();
                window._commitList = cData.commits || [];
                if (window._commitList.length > 0) {
                    window._commitIndex = 0;
                    window.updateCommitNav();
                    document.getElementById('commit-nav').style.display = 'flex';
                }
            } catch (e) {
                console.warn('Could not load commit list:', e);
            }

            setTimeout(() => loading.classList.add('hidden'), 400);
        } catch (err) {
            console.error('[BOOT ERROR]', err.message, err.stack);
            loading.innerHTML = `
                <div class="error-container">
                    <div class="error-icon">💥</div>
                    <div class="error-title">Failed to load pipeline</div>
                    <div class="error-message">${err.message}</div>
                </div>
            `;
        }
    };

    // Version Nav
    window.updateVersionNav = function () {
        const nav = document.getElementById('version-nav');
        const prevBtn = document.getElementById('version-prev');
        const nextBtn = document.getElementById('version-next');
        const msg = document.getElementById('version-msg');
        const meta = document.getElementById('version-meta');
        const counter = document.getElementById('version-counter');

        if (window._versionHistory.length === 0) {
            nav.classList.remove('active');
            return;
        }

        nav.classList.add('active');

        if (window._versionIndex === -1) {
            msg.innerHTML = '<span class="version-current-badge">CURRENT</span> Working tree';
            meta.textContent = 'Live file on disk';
        } else {
            const commit = window._versionHistory[window._versionIndex];
            msg.textContent = commit.message;
            const shortHash = commit.hash.substring(0, 8);
            const dateStr = commit.date.split(' ').slice(0, 2).join(' ');
            meta.textContent = `${shortHash} · ${commit.author} · ${dateStr}`;
        }

        const total = window._versionHistory.length + 1;
        const pos = window._versionIndex + 2;
        counter.textContent = `${pos}/${total}`;

        prevBtn.disabled = (window._versionIndex >= window._versionHistory.length - 1);
        nextBtn.disabled = window._currentFileExists ? (window._versionIndex === -1) : (window._versionIndex === 0);
    };

    window.navigateVersion = async function (direction) {
        const newIndex = window._versionIndex + direction;
        if (newIndex < -1 || newIndex >= window._versionHistory.length) return;

        window._versionIndex = newIndex;
        window.updateVersionNav();
        await window.loadVersionContent();
    };

    // File Inspector
    window.openFileInspector = async function (filePath) {
        const overlay = document.getElementById('modal-overlay');
        const body = document.getElementById('modal-body');
        const toolbar = document.getElementById('modal-toolbar');
        const search = document.getElementById('modal-search');

        body.innerHTML = '<div class="loading-overlay" style="position:relative;min-height:200px;"><div class="loading-spinner"></div></div>';
        toolbar.style.display = 'none';
        search.value = '';
        overlay.classList.add('visible');

        window._currentFilePath = filePath;
        window._versionHistory = [];
        window._versionIndex = -1;
        window._currentFileType = null;
        window._currentFileExists = true;
        document.getElementById('version-nav').classList.remove('active');

        try {
            const _historyCommit = window._isHistoryMode ? window._commitList[window._commitIndex]?.hash : null;

            const [infoRes, _] = await Promise.all([
                fetch(`api/file/info?path=${encodeURIComponent(filePath)}`),
                window.loadFileHistory(filePath),
            ]);
            const info = await infoRes.json();

            document.getElementById('modal-filename').textContent = info.name || filePath;
            document.getElementById('modal-badge').textContent = (info.extension || '').replace('.', '').toUpperCase();
            document.getElementById('modal-icon').textContent = window.FILE_ICONS[info.type] || '📄';
            window._currentFileType = info.type;
            window._currentFileExists = info.exists;

            window.updateVersionNav();

            if (!info.exists) {
                if (window._versionHistory.length > 0) {
                    window._versionIndex = 0;
                    window.updateVersionNav();
                    await window.loadVersionContent();
                    return;
                } else {
                    body.innerHTML = `
                        <div class="file-not-found">
                            <div class="file-not-found-icon">🔍</div>
                            <div class="file-not-found-text">File not found (output not yet generated?)</div>
                            <div class="file-not-found-path">${filePath}</div>
                        </div>`;
                    return;
                }
            }

            if (_historyCommit && window._versionHistory.length > 0) {
                const histIdx = window._versionHistory.findIndex(v => v.hash === _historyCommit);
                if (histIdx >= 0) {
                    window._versionIndex = histIdx;
                    window.updateVersionNav();
                    await window.loadVersionContent(_historyCommit);
                    return;
                }
            }

            switch (info.type) {
                case 'csv': await window.renderCSV(filePath); break;
                case 'image': window.renderImage(filePath); break;
                case 'pdf': window.renderPDF(filePath); break;
                case 'text': await window.renderText(filePath); break;
                default:
                    body.innerHTML = `
                        <div class="file-not-found">
                            <div class="file-not-found-icon">📦</div>
                            <div class="file-not-found-text">Binary file — preview not available</div>
                            <div class="file-not-found-path">${filePath}</div>
                        </div>`;
            }
        } catch (err) {
            body.innerHTML = `
                <div class="file-not-found">
                    <div class="file-not-found-icon">💥</div>
                    <div class="file-not-found-text">Error loading file: ${err.message}</div>
                </div>`;
        }
    };

    // CSV Renderer
    window._csvData = null;
    window._csvSortCol = null;
    window._csvSortAsc = true;

    window.renderCSV = async function (filePath) {
        const toolbar = document.getElementById('modal-toolbar');
        const search = document.getElementById('modal-search');
        const stats = document.getElementById('modal-stats');

        const res = await fetch(`api/file/csv?path=${encodeURIComponent(filePath)}`);
        window._csvData = await res.json();
        window._csvSortCol = null;
        window._csvSortAsc = true;

        toolbar.style.display = 'flex';
        stats.textContent = `${window._csvData.total} rows × ${window._csvData.columns.length} cols`;

        search.oninput = () => window.renderCSVTable(search.value.toLowerCase());
        window.renderCSVTable('');
    };

    window.renderCSVTable = function (filter) {
        const body = document.getElementById('modal-body');
        let rows = window._csvData.rows;

        if (filter) {
            rows = rows.filter(row =>
                Object.values(row).some(v => (v || '').toLowerCase().includes(filter))
            );
        }

        if (window._csvSortCol !== null) {
            const col = window._csvData.columns[window._csvSortCol];
            rows = [...rows].sort((a, b) => {
                let va = a[col] || '', vb = b[col] || '';
                const na = parseFloat(va), nb = parseFloat(vb);
                if (!isNaN(na) && !isNaN(nb)) return window._csvSortAsc ? na - nb : nb - na;
                return window._csvSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
            });
        }

        const isNumeric = (val) => val !== '' && !isNaN(parseFloat(val));

        let html = '<div class="csv-table-wrap"><table class="csv-table"><thead><tr>';
        window._csvData.columns.forEach((col, i) => {
            const sorted = window._csvSortCol === i;
            const arrow = sorted ? (window._csvSortAsc ? '▲' : '▼') : '▲';
            html += `<th class="${sorted ? 'sorted' : ''}" data-col="${i}">${col}<span class="sort-arrow">${arrow}</span></th>`;
        });
        html += '</tr></thead><tbody>';

        const displayRows = rows.slice(0, 500);
        for (const row of displayRows) {
            html += '<tr>';
            for (const col of window._csvData.columns) {
                const val = row[col] || '';
                html += `<td class="${isNumeric(val) ? 'numeric' : ''}">${val}</td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table></div>';

        if (rows.length > 500) {
            html += `<div style="padding:12px 24px;font-size:12px;color:var(--text-muted);">Showing 500 of ${rows.length} rows</div>`;
        }

        body.innerHTML = html;

        document.getElementById('modal-stats').textContent =
            filter ? `${rows.length} of ${window._csvData.total} rows` : `${window._csvData.total} rows × ${window._csvData.columns.length} cols`;

        body.querySelectorAll('.csv-table th').forEach(th => {
            th.addEventListener('click', () => {
                const col = parseInt(th.dataset.col);
                if (window._csvSortCol === col) window._csvSortAsc = !window._csvSortAsc;
                else { window._csvSortCol = col; window._csvSortAsc = true; }
                window.renderCSVTable(document.getElementById('modal-search').value.toLowerCase());
            });
        });
    };

    window.renderImage = function (filePath) {
        const body = document.getElementById('modal-body');
        body.innerHTML = `<div class="image-viewer"><img src="api/file/raw?path=${encodeURIComponent(filePath)}" alt="${filePath}"></div>`;
    };

    window.renderPDF = function (filePath) {
        const body = document.getElementById('modal-body');
        body.innerHTML = `<div class="pdf-viewer"><iframe src="api/file/raw?path=${encodeURIComponent(filePath)}"></iframe></div>`;
    };

    window.renderText = async function (filePath) {
        const body = document.getElementById('modal-body');
        const res = await fetch(`api/file/text?path=${encodeURIComponent(filePath)}`);
        const data = await res.json();

        if (filePath.endsWith('.json')) {
            try {
                const parsed = JSON.parse(data.content);
                body.innerHTML = `<div class="text-viewer">${JSON.stringify(parsed, null, 2)}</div>`;
            } catch {
                body.innerHTML = `<div class="text-viewer">${window.escapeHtml(data.content)}</div>`;
            }
        } else {
            body.innerHTML = `<div class="text-viewer">${window.escapeHtml(data.content)}</div>`;
        }
    };

    window.escapeHtml = function (str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

    // Modal Events
    document.getElementById('modal-close').addEventListener('click', () => {
        document.getElementById('modal-overlay').classList.remove('visible');
    });
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            document.getElementById('modal-overlay').classList.remove('visible');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.getElementById('modal-overlay').classList.remove('visible');
        }
    });

    // Version Nav Click events
    document.getElementById('version-prev').addEventListener('click', () => window.navigateVersion(1));
    document.getElementById('version-next').addEventListener('click', () => window.navigateVersion(-1));

    // Toast helpers
    window.showToast = function (text, type = 'running') {
        const toast = document.getElementById('exec-toast');
        const spinner = document.getElementById('toast-spinner');
        const icon = document.getElementById('toast-icon');
        document.getElementById('toast-text').textContent = text;

        let cls = 'exec-toast active';
        if (type !== 'running') cls += ' ' + type;
        else cls += ' running';
        toast.className = cls;

        spinner.style.display = type === 'running' ? 'block' : 'none';
        icon.style.display = type !== 'running' ? 'inline' : 'none';
        icon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : '';

        toast.onclick = () => {
            if (type === 'running' && window._currentRunningStage && window.cy) {
                const node = window.cy.getElementById(window._currentRunningStage);
                if (node.length) {
                    window.selectedStage = window._currentRunningStage;
                    window.showDetail(node.data());
                    window.highlightNeighborhood(node);
                    window.removeNodeBadge(window._currentRunningStage);
                    window.cy.animate({
                        center: { eles: node },
                        zoom: 1.5,
                        duration: 600,
                        easing: 'ease-out-cubic'
                    });
                }
            }
        };
    };

    window.hideToast = function () {
        document.getElementById('exec-toast').classList.remove('active');
        if (window._toastInterval) { clearInterval(window._toastInterval); window._toastInterval = null; }
    };

    window.formatElapsed = function (ms) {
        const s = Math.floor(ms / 1000);
        if (s < 60) return `${s}s`;
        const m = Math.floor(s / 60);
        const rs = s % 60;
        if (m < 60) return `${m}m ${rs.toString().padStart(2, '0')}s`;
        const h = Math.floor(m / 60);
        const rm = m % 60;
        return `${h}h ${rm.toString().padStart(2, '0')}m`;
    };

    // Run All button
    document.getElementById('btn-run-all').addEventListener('click', () => window.runPipeline(null));

    // Run Stage button
    document.getElementById('btn-run-stage').addEventListener('click', () => {
        if (window.selectedStage) window.runPipeline(window.selectedStage);
    });

    // Stop button
    document.getElementById('btn-stop').addEventListener('click', async () => {
        try {
            await fetch('api/stop', { method: 'POST' });
            if (window.cy) window.cy.nodes().forEach(n => {
                if (n.scratch('_animating')) {
                    window.stopSingleNodeAnimation(n.id());
                }
            });
            window.isRunning = false;
            const allBtn = document.getElementById('btn-run-all');
            const stageBtn = document.getElementById('btn-run-stage');
            const stopBtn = document.getElementById('btn-stop');
            allBtn.classList.remove('running');
            allBtn.disabled = false;
            stageBtn.classList.remove('running');
            stageBtn.disabled = false;
            stopBtn.classList.remove('visible');
            window._prevIsRunning = false;
            window._prevRunningStage = null;
            window._uiLaunchedRun = false;
            window.showToast('Pipeline stopped ✗', 'error');
            setTimeout(window.hideToast, 4000);
        } catch (e) {
            console.error('Failed to stop pipeline:', e);
        }
    });

    // Commit Navigation Logic
    window.updateCommitNav = function () {
        if (window._commitList.length === 0) return;
        const commit = window._commitList[window._commitIndex];
        const hashEl = document.getElementById('commit-hash');
        const msgEl = document.getElementById('commit-msg');
        const badgeEl = document.getElementById('commit-badge');
        const olderBtn = document.getElementById('commit-older');
        const newerBtn = document.getElementById('commit-newer');

        hashEl.textContent = commit.short_hash;
        msgEl.textContent = commit.message;
        msgEl.title = `${commit.message} — ${commit.author} (${commit.date})`;

        olderBtn.disabled = window._commitIndex >= window._commitList.length - 1;
        newerBtn.disabled = window._commitIndex <= 0;

        if (window._commitIndex === 0) {
            badgeEl.textContent = 'HEAD';
            badgeEl.className = 'commit-badge-head';
        } else {
            badgeEl.textContent = 'HISTORY';
            badgeEl.className = 'commit-badge-history';
        }
    };

    window.navigateToCommit = async function (index) {
        if (index < 0 || index >= window._commitList.length) return;
        window._commitIndex = index;
        window.updateCommitNav();

        if (index === 0) {
            window._isHistoryMode = false;
            document.body.classList.remove('history-mode');
            const data = await window.fetchPipeline();
            if (!data.error) {
                window._pipelineData = data;
                const elements = window.buildElements(data);
                window.initGraph(elements);
                window.updateStats(data);
                window.renderNodeList(data);
            }
            window.startPolling();
        } else {
            window._isHistoryMode = true;
            document.body.classList.add('history-mode');
            window.stopPolling();

            const commit = window._commitList[index];
            try {
                const res = await fetch(`api/pipeline/at-commit?commit=${commit.hash}`);
                const data = await res.json();
                if (data.error) {
                    window.showToast(`Error: ${data.error}`, 'error');
                    setTimeout(window.hideToast, 4000);
                    return;
                }
                window._pipelineData = data;
                const elements = window.buildElements(data);
                window.initGraph(elements);
                window.updateStats(data);
                window.renderNodeList(data);
            } catch (e) {
                window.showToast(`Failed to load commit: ${e.message}`, 'error');
                setTimeout(window.hideToast, 4000);
            }
        }
    };

    document.getElementById('commit-older').addEventListener('click', () => {
        window.navigateToCommit(window._commitIndex + 1);
    });

    document.getElementById('commit-newer').addEventListener('click', () => {
        window.navigateToCommit(window._commitIndex - 1);
    });

    // Sidebar Resize logic
    (function () {
        const handle = document.getElementById('sidebar-resize');
        const sidebar = document.getElementById('sidebar');
        let startX, startW;

        const searchInput = document.getElementById('sidebar-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                if (window._pipelineData) window.renderNodeList(window._pipelineData);
            });
        }

        const statusFilter = document.getElementById('sidebar-status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                if (window._pipelineData) window.renderNodeList(window._pipelineData);
            });
        }

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startX = e.clientX;
            startW = sidebar.offsetWidth;
            handle.classList.add('active');
            sidebar.style.transition = 'none';

            function onMove(e) {
                const delta = startX - e.clientX;
                const newW = Math.min(Math.max(startW + delta, 260), window.innerWidth * 0.8);
                sidebar.style.width = newW + 'px';
            }

            function onUp() {
                handle.classList.remove('active');
                sidebar.style.transition = '';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                if (window.cy) window.cy.resize();
            }

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    })();

    // Boot execution on DOM loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.boot);
    } else {
        window.boot();
    }

})();
