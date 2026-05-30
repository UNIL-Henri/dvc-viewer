(function () {
    "use strict";

    window.STATE_COLORS = {
        valid: { bg: '#064e3b', border: '#10b981', text: '#ecfdf5', glow: 'rgba(16,185,129,0.5)' },
        needs_rerun: { bg: '#a16207', border: '#fde047', text: '#fefce8', glow: 'rgba(253,224,71,0.6)' },
        failed: { bg: '#450a0a', border: '#f43f5e', text: '#fff1f2', glow: 'rgba(244,63,94,0.6)' },
        never_run: { bg: '#1e293b', border: '#64748b', text: '#f1f5f9', glow: 'rgba(100,116,139,0.3)' },
        running: { bg: '#1e1b4b', border: '#818cf8', text: '#e0e7ff', glow: 'rgba(99,102,241,0.5)' },
    };

    window.cy = null;
    window.selectedStage = null;
    window._currentRunningStage = null;

    // ─── Build Cytoscape elements ───
    window.buildElements = function (data) {
        const elements = [];

        for (const node of data.nodes) {
            const sc = window.STATE_COLORS[node.state] || window.STATE_COLORS.never_run;
            elements.push({
                group: 'nodes',
                data: {
                    id: node.id,
                    label: node.id,
                    state: node.state,
                    cmd: node.cmd,
                    deps: node.deps,
                    outs: node.outs,
                    params: node.params || [],
                    metrics: node.metrics || [],
                    plots: node.plots || [],
                    hydra_config: node.hydra_config || null,
                    hydra_config_exists: node.hydra_config_exists || false,
                    frozen: node.frozen || false,
                    bgColor: sc.bg,
                    borderColor: sc.border,
                    textColor: sc.text,
                    glowColor: sc.glow,
                },
            });
        }

        for (const edge of data.edges) {
            elements.push({
                group: 'edges',
                data: {
                    id: `${edge.source}->${edge.target}`,
                    source: edge.source,
                    target: edge.target,
                    label: edge.label || '',
                },
            });
        }

        return elements;
    };

    // ─── Init Cytoscape ───
    window.initGraph = function (elements) {
        window.cy = cytoscape({
            container: document.getElementById('cy'),
            elements: elements,
            layout: {
                name: 'dagre',
                rankDir: 'TB',
                nodeSep: 60,
                rankSep: 80,
                edgeSep: 30,
                padding: 50,
                animate: true,
                animationDuration: 600,
                animationEasing: 'ease-out-cubic',
            },
            style: [
                {
                    selector: 'node',
                    style: {
                        'label': (ele) => ele.data('label'),
                        'width': 'label',
                        'height': 40,
                        'padding': '16px',
                        'shape': 'roundrectangle',
                        'background-color': 'data(bgColor)',
                        'border-width': 2,
                        'border-color': 'data(borderColor)',
                        'color': 'data(textColor)',
                        'font-family': "'Inter', sans-serif",
                        'font-size': 13,
                        'font-weight': 500,
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'text-wrap': 'none',
                        'transition-property': 'border-width, border-color, background-color',
                        'transition-duration': '0.15s',
                    },
                },
                {
                    selector: 'node[?frozen]',
                    style: {
                        'background-color': '#eff6ff',
                        'border-color': '#3b82f6',
                        'color': '#1d4ed8',
                        'label': (ele) => '❄️ ' + ele.data('label'),
                    }
                },
                {
                    selector: 'node:active, node:selected',
                    style: {
                        'border-width': 3,
                        'border-color': '#6366f1',
                        'overlay-opacity': 0,
                    },
                },
                {
                    selector: 'node.hover',
                    style: {
                        'border-width': 3,
                    },
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': 'rgba(99, 102, 241, 0.35)',
                        'target-arrow-color': 'rgba(99, 102, 241, 0.55)',
                        'target-arrow-shape': 'triangle',
                        'arrow-scale': 1.1,
                        'curve-style': 'bezier',
                        'transition-property': 'line-color, target-arrow-color, width',
                        'transition-duration': '0.15s',
                    },
                },
                {
                    selector: 'edge:selected',
                    style: {
                        'width': 3,
                        'line-color': 'rgba(99, 102, 241, 0.7)',
                        'target-arrow-color': 'rgba(99, 102, 241, 0.9)',
                    },
                },
                {
                    selector: 'node.dimmed',
                    style: {
                        'opacity': 0.25,
                    },
                },
                {
                    selector: 'edge.dimmed',
                    style: {
                        'opacity': 0.12,
                    },
                },
                {
                    selector: 'node.highlighted',
                    style: {
                        'opacity': 1,
                    },
                },
                {
                    selector: 'edge.highlighted',
                    style: {
                        'opacity': 1,
                        'width': 3,
                        'line-color': 'rgba(99, 102, 241, 0.7)',
                        'target-arrow-color': 'rgba(99, 102, 241, 0.9)',
                    },
                },
            ],
            minZoom: 0.2,
            maxZoom: 3,
            wheelSensitivity: 0.3,
        });

        // ─── Click on node → select & show detail ───
        window.cy.on('tap', 'node', function (evt) {
            const node = evt.target;
            window.selectedStage = node.data().id;
            window.showDetail(node.data());
            window.highlightNeighborhood(node);
            window.removeNodeBadge(node.data().id);
        });

        // Reposition floating badges on pan/zoom
        window.cy.on('render', window.repositionNodeBadges);

        // ─── Click on background → deselect ───
        window.cy.on('tap', function (evt) {
            if (evt.target === window.cy) {
                window.selectedStage = null;
                window.clearDetail();
                window.clearHighlight();
            }
        });

        // ─── Hover tooltip ───
        const tooltip = document.getElementById('tooltip');
        window.cy.on('mouseover', 'node', function (evt) {
            const node = evt.target;
            node.addClass('hover');
            const pos = node.renderedPosition();
            tooltip.textContent = `${node.data('label')} — ${window.STATE_LABELS[node.data('state')]}`;
            tooltip.style.left = (pos.x) + 'px';
            tooltip.style.top = (pos.y) + 'px';
            tooltip.classList.add('visible');
        });

        window.cy.on('mouseout', 'node', function (evt) {
            evt.target.removeClass('hover');
            tooltip.classList.remove('visible');
        });

        // ─── Controls ───
        document.getElementById('btn-fit').addEventListener('click', () => {
            window.cy.fit(undefined, 50);
        });
        document.getElementById('btn-zoom-in').addEventListener('click', () => {
            window.cy.zoom({ level: window.cy.zoom() * 1.3, renderedPosition: { x: window.cy.width() / 2, y: window.cy.height() / 2 } });
        });
        document.getElementById('btn-zoom-out').addEventListener('click', () => {
            window.cy.zoom({ level: window.cy.zoom() / 1.3, renderedPosition: { x: window.cy.width() / 2, y: window.cy.height() / 2 } });
        });

        return window.cy;
    };

    // ─── Highlight execution chain (all upstream ancestors + the node) ───
    window.highlightNeighborhood = function (node) {
        window.cy.elements().removeClass('dimmed highlighted');
        window.cy.elements().addClass('dimmed');
        const chain = window.cy.collection().merge(node);
        const queue = [node];
        const visited = new Set([node.id()]);
        while (queue.length > 0) {
            const current = queue.shift();
            const preds = current.predecessors('node');
            preds.forEach(pred => {
                if (!visited.has(pred.id())) {
                    visited.add(pred.id());
                    chain.merge(pred);
                    queue.push(pred);
                }
            });
        }
        const chainEdges = chain.edgesWith(chain);
        chain.merge(chainEdges);
        chain.removeClass('dimmed').addClass('highlighted');
    };

    window.clearHighlight = function () {
        if (window.cy) window.cy.elements().removeClass('dimmed highlighted');
    };

    // ─── Node badges (floating "NEW" pills on graph) ───
    window.addNodeBadge = function (stageId) {
        if (window._nodeBadgeEls[stageId]) return;
        if (!window.cy) return;
        const node = window.cy.getElementById(stageId);
        if (!node.length) return;

        const badge = document.createElement('div');
        badge.className = 'node-badge';
        badge.textContent = '🔍';
        document.getElementById('node-badges-layer').appendChild(badge);
        window._nodeBadgeEls[stageId] = badge;
        window.positionBadge(stageId);
    };

    window.removeNodeBadge = function (stageId) {
        const badge = window._nodeBadgeEls[stageId];
        if (badge) {
            badge.remove();
            delete window._nodeBadgeEls[stageId];
        }
    };

    window.clearAllNodeBadges = function () {
        for (const id of Object.keys(window._nodeBadgeEls)) {
            window.removeNodeBadge(id);
        }
    };

    window.positionBadge = function (stageId) {
        const badge = window._nodeBadgeEls[stageId];
        if (!badge || !window.cy) return;
        const node = window.cy.getElementById(stageId);
        if (!node.length) return;
        const pos = node.renderedPosition();
        const w = node.renderedWidth ? node.renderedWidth() / 2 : 60;
        const h = node.renderedHeight ? node.renderedHeight() / 2 : 20;
        badge.style.left = (pos.x + w) + 'px';
        badge.style.top = (pos.y + h) + 'px';
    };

    window.repositionNodeBadges = function () {
        for (const id of Object.keys(window._nodeBadgeEls)) {
            window.positionBadge(id);
        }
    };

    // Per-node animation
    window.startSingleNodeAnimation = function (stageId) {
        if (!window.cy) return;
        const node = window.cy.getElementById(stageId);
        if (!node.length) return;
        if (node.scratch('_animating')) return;
        
        console.log('[ANIM] START', stageId);
        node.scratch('_origBg', node.data('bgColor'));
        node.scratch('_origBorder', node.data('borderColor'));
        node.scratch('_origGlow', node.data('glowColor'));
        node.scratch('_animating', true);

        const startTime = performance.now();
        const PERIOD = 1800;

        const intervalId = setInterval(() => {
            if (!node.scratch('_animating') || node.removed()) {
                clearInterval(intervalId);
                return;
            }
            const t = ((performance.now() - startTime) % PERIOD) / PERIOD;
            const s = (Math.sin(t * Math.PI * 2 - Math.PI / 2) + 1) / 2;

            const bgR = Math.round(30 + s * 19);
            const bgG = Math.round(27 + s * 19);
            const bgB = Math.round(75 + s * 54);
            const brR = Math.round(99 + s * 66);
            const brG = Math.round(102 + s * 78);
            const brB = Math.round(241 + s * 11);

            node.data({
                bgColor: `rgb(${bgR}, ${bgG}, ${bgB})`,
                borderColor: `rgb(${brR}, ${brG}, ${brB})`,
            });
        }, 50);

        node.scratch('_animIntervalId', intervalId);
    };

    window.stopSingleNodeAnimation = function (stageId, success = true) {
        if (!window.cy) return;
        const node = window.cy.getElementById(stageId);
        if (!node.length) return;
        
        const intervalId = node.scratch('_animIntervalId');
        if (intervalId) clearInterval(intervalId);
        node.scratch('_animating', false);
        node.scratch('_animIntervalId', undefined);
        
        const origBg = node.scratch('_origBg');
        const origBorder = node.scratch('_origBorder');
        const origGlow = node.scratch('_origGlow');
        if (origBg) {
            node.data('bgColor', origBg);
            node.data('borderColor', origBorder);
            node.data('glowColor', origGlow);
        }
        
        node.removeStyle();
        node.scratch('_origBg', undefined);
        node.scratch('_origBorder', undefined);
        node.scratch('_origGlow', undefined);
        console.log('[ANIM] STOP', stageId);
    };

})();
