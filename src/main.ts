/**
 * GRID-BESS: Utility-Scale Solar PV, Battery Energy Storage (BESS) & 132kV Substation EMS
 * Industrial SCADA & Digital Twin System Engine
 * 
 * Lead Electrical & Automation Systems Engineer: أ. طارق ابوعشي | Tareq Abuashi
 */

import { scadaAudio } from './engine/audioAlarm';

// ============================================================================
// SYSTEM STATE INTERFACES
// ============================================================================

interface SystemState {
  gridFrequency: number;        // Hz, nominal 60.00
  targetFrequency: number;      // Hz
  busVoltage132: number;        // kV, nominal 132.4
  busVoltage33: number;         // kV, nominal 33.2
  oltcTap: number;              // 1 to 17, nominal 9
  irradiance: number;           // W/m², 0 to 1100
  trackerAngle: number;         // degrees, -60 to +60
  pvActivePower: number;        // MW, 0 to 150
  pvReactivePower: number;      // MVAR, -45 to +45
  bessSoC: number;              // %, 0 to 100
  bessPower: number;            // MW, + for discharge, - for charge
  bessMode: 'STANDBY' | 'DROOP' | 'CHARGE' | 'DISCHARGE' | 'ISOLATED';
  bessRacks: { id: number; temp: number; volts: number; isolated: boolean }[];
  cb101Closed: boolean;         // 132 kV breaker
  cb301Closed: boolean;         // 33 kV breaker
  trafoOti: number;             // °C oil temp
  trafoWti: number;             // °C winding temp
  buchholzTrip: boolean;
  dgaH2: number;                // ppm Hydrogen
  dgaC2H2: number;              // ppm Acetylene
  cellDeltaV: number;           // mV max cell spread
  relay87tTripped: boolean;
  relay81Tripped: boolean;
  relay21Tripped: boolean;
  relay25Locked: boolean;
  activeAlarm: boolean;
  alarmMessage: string;
}

// Initial Nominal State
const state: SystemState = {
  gridFrequency: 60.00,
  targetFrequency: 60.00,
  busVoltage132: 132.4,
  busVoltage33: 33.2,
  oltcTap: 9,
  irradiance: 945,
  trackerAngle: 22.4,
  pvActivePower: 138.2,
  pvReactivePower: 12.4,
  bessSoC: 78.5,
  bessPower: 0.0,
  bessMode: 'STANDBY',
  bessRacks: [
    { id: 1, temp: 25.1, volts: 3.28, isolated: false },
    { id: 2, temp: 25.3, volts: 3.29, isolated: false },
    { id: 3, temp: 25.0, volts: 3.28, isolated: false },
    { id: 4, temp: 25.4, volts: 3.27, isolated: false },
    { id: 5, temp: 25.2, volts: 3.28, isolated: false },
    { id: 6, temp: 25.5, volts: 3.28, isolated: false },
    { id: 7, temp: 25.2, volts: 3.28, isolated: false },
    { id: 8, temp: 25.3, volts: 3.29, isolated: false },
  ],
  cb101Closed: true,
  cb301Closed: true,
  trafoOti: 62.4,
  trafoWti: 74.1,
  buchholzTrip: false,
  dgaH2: 18.4,
  dgaC2H2: 0.2,
  cellDeltaV: 14,
  relay87tTripped: false,
  relay81Tripped: false,
  relay21Tripped: false,
  relay25Locked: false,
  activeAlarm: false,
  alarmMessage: 'GRID SYNCHRONIZED (60.00 Hz) • 150 MWp PV EXPORTING • BESS FLOATING • 132/33 kV SUBSTATION CLEAR'
};

// Canvas History Buffers (60fps rolling data)
const canvasHistory = {
  h2History: new Array(120).fill(18.4),
  c2h2History: new Array(120).fill(0.2),
  deltaVHistory: new Array(120).fill(14),
};

// ============================================================================
// SOE (SEQUENCE OF EVENTS) LOGGING
// ============================================================================

function addSoeEvent(tag: string, severity: 'NORMAL' | 'WARN' | 'TRIP' | 'CRITICAL' | 'DROOP' | 'INFO', desc: string) {
  const tbody = document.getElementById('soe-table-body');
  if (!tbody) return;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;

  const soeTs = document.getElementById('soe-timestamp');
  if (soeTs) soeTs.textContent = timeStr;

  let tagClass = 'tag-info';
  if (severity === 'NORMAL') tagClass = 'tag-success';
  if (severity === 'WARN') tagClass = 'tag-warning';
  if (severity === 'TRIP') tagClass = 'tag-critical';
  if (severity === 'CRITICAL') tagClass = 'tag-critical';
  if (severity === 'DROOP') tagClass = 'tag-droop';

  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${timeStr}</td>
    <td class="font-bold">${tag}</td>
    <td><span class="badge-tag ${tagClass}">${severity}</span></td>
    <td>${desc}</td>
  `;

  tbody.insertBefore(row, tbody.firstChild);

  // Keep max 50 entries
  while (tbody.children.length > 50) {
    tbody.removeChild(tbody.lastChild!);
  }
}

// ============================================================================
// REAL-TIME SCADA TELEMETRY & UI UPDATES
// ============================================================================

function updateUI() {
  // System Clock
  const now = new Date();
  const clockEl = document.getElementById('header-clock');
  if (clockEl) {
    clockEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }

  // Header Telemetry
  const freqEl = document.getElementById('header-grid-freq');
  if (freqEl) {
    freqEl.textContent = `${state.gridFrequency.toFixed(2)} Hz`;
    if (state.gridFrequency < 59.80 || state.gridFrequency > 60.20) {
      freqEl.className = 'header-stat-val text-red font-mono font-bold';
    } else {
      freqEl.className = 'header-stat-val text-cyan font-mono';
    }
  }

  const busVoltEl = document.getElementById('header-bus-volts');
  if (busVoltEl) {
    busVoltEl.textContent = state.cb101Closed ? `${state.busVoltage132.toFixed(1)} kV` : '0.0 kV (DEAD)';
  }

  const netExport = state.cb101Closed && state.cb301Closed ? (state.pvActivePower + state.bessPower) : 0;
  const netExportEl = document.getElementById('header-net-export');
  if (netExportEl) {
    netExportEl.textContent = `${netExport.toFixed(1)} MW`;
    netExportEl.className = netExport > 0 ? 'header-stat-val text-green font-mono' : 'header-stat-val text-amber font-mono';
  }

  // Module 1: Solar PV Readouts
  const pvPowerEl = document.getElementById('pv-power-val');
  if (pvPowerEl) pvPowerEl.innerHTML = `${state.pvActivePower.toFixed(1)} <span class="readout-unit">MW</span>`;

  const pvPowerBar = document.getElementById('pv-power-bar');
  if (pvPowerBar) pvPowerBar.style.width = `${Math.min(100, (state.pvActivePower / 150) * 100)}%`;

  const pvIrrEl = document.getElementById('pv-irradiance-val');
  if (pvIrrEl) pvIrrEl.innerHTML = `${Math.round(state.irradiance)} <span class="readout-unit">W/m²</span>`;

  const pvDcEl = document.getElementById('pv-dc-volts');
  if (pvDcEl) {
    const dcV = state.irradiance > 50 ? 1200 + (state.irradiance / 1100) * 180 : 0;
    pvDcEl.innerHTML = `${Math.round(dcV).toLocaleString()} <span class="readout-unit">VDC</span>`;
  }

  const pvQEl = document.getElementById('pv-q-val');
  if (pvQEl) pvQEl.innerHTML = `${state.pvReactivePower >= 0 ? '+' : ''}${state.pvReactivePower.toFixed(1)} <span class="readout-unit">MVAR</span>`;

  const pvSunAngle = document.getElementById('pv-sun-angle');
  if (pvSunAngle) pvSunAngle.textContent = `Tilt: ${state.trackerAngle >= 0 ? '+' : ''}${state.trackerAngle.toFixed(1)}°`;

  // Update SVG Solar Tracker
  const tiltDeg = state.trackerAngle;
  for (let i = 1; i <= 3; i++) {
    const panelEl = document.getElementById(`panel-tilt-${i}`);
    if (panelEl) {
      panelEl.setAttribute('transform', `rotate(${tiltDeg})`);
    }
  }

  // Sun Orb Position in SVG
  const sunGroup = document.getElementById('sun-orb-group');
  if (sunGroup) {
    // Map irradiance 0 -> 1100 to arc
    const ratio = Math.max(0, Math.min(1, state.irradiance / 1100));
    const sunX = 100 + ratio * 400;
    const sunY = 160 - Math.sin(ratio * Math.PI) * 115;
    sunGroup.setAttribute('transform', `translate(${sunX}, ${sunY})`);
  }

  // Module 2: BESS Readouts
  const bessSocEl = document.getElementById('bess-soc-val');
  if (bessSocEl) bessSocEl.innerHTML = `${state.bessSoC.toFixed(1)} <span class="readout-unit">%</span>`;

  const bessSocBar = document.getElementById('bess-soc-bar');
  if (bessSocBar) bessSocBar.style.width = `${state.bessSoC}%`;

  const bessPowerEl = document.getElementById('bess-power-val');
  if (bessPowerEl) {
    let modeText = '0.0 MW';
    if (state.bessPower > 0) modeText = `+${state.bessPower.toFixed(1)} MW (DISCHARGE)`;
    else if (state.bessPower < 0) modeText = `${state.bessPower.toFixed(1)} MW (CHARGE)`;
    bessPowerEl.innerHTML = `${modeText}`;
  }

  const crateEl = document.getElementById('bess-crate-val');
  if (crateEl) {
    const cRate = Math.abs(state.bessPower) / 200; // 200 MWh base
    crateEl.textContent = `Rate: ${cRate.toFixed(2)}C`;
  }

  const droopTextEl = document.getElementById('bess-droop-text');
  if (droopTextEl) {
    if (state.bessMode === 'DROOP') {
      droopTextEl.textContent = 'DROOP ACTIVE (+50 MW / 120ms)';
      droopTextEl.className = 'text-solar font-bold';
    } else if (state.bessMode === 'ISOLATED') {
      droopTextEl.textContent = 'FAULT INTERLOCK ENGAGED';
      droopTextEl.className = 'text-red font-bold';
    } else {
      droopTextEl.textContent = '4.0% Droop (Standby)';
      droopTextEl.className = 'text-cyan font-bold';
    }
  }

  // BESS PCS Flow Arrow & Label in SVG
  const pcsArrow = document.getElementById('pcs-flow-arrow');
  const pcsLabel = document.getElementById('pcs-flow-label');
  if (pcsArrow && pcsLabel) {
    if (state.bessPower > 1) {
      pcsArrow.className = 'flow-export';
      pcsArrow.setAttribute('stroke', '#f97316');
      pcsLabel.textContent = `DISCHARGING (+${state.bessPower.toFixed(0)} MW)`;
      pcsLabel.setAttribute('fill', '#f97316');
    } else if (state.bessPower < -1) {
      pcsArrow.className = 'flow-import';
      pcsArrow.setAttribute('stroke', '#10b981');
      pcsLabel.textContent = `CHARGING (${state.bessPower.toFixed(0)} MW)`;
      pcsLabel.setAttribute('fill', '#10b981');
    } else {
      pcsArrow.className = 'flow-stopped';
      pcsArrow.setAttribute('stroke', '#06b6d4');
      pcsLabel.textContent = 'FLOATING (0 MW)';
      pcsLabel.setAttribute('fill', '#10b981');
    }
  }

  // Racks Visual Status
  state.bessRacks.forEach((rack) => {
    const cardEl = document.getElementById(`card-rack-${rack.id}`);
    const tempEl = document.getElementById(`rack-${rack.id}-temp`);
    if (cardEl && tempEl) {
      if (rack.isolated) {
        cardEl.className = 'bess-rack-card rack-isolated';
        tempEl.textContent = `${rack.temp.toFixed(1)}°C • ISOLATED`;
        tempEl.style.color = '#ef4444';
      } else {
        cardEl.className = 'bess-rack-card';
        tempEl.textContent = `${rack.temp.toFixed(1)}°C • ${rack.volts.toFixed(2)}V`;
        tempEl.style.color = '#38bdf8';
      }
    }
  });

  const rack7Badge = document.getElementById('rack-7-status-badge');
  if (rack7Badge) {
    if (state.bessRacks[6].isolated) {
      rack7Badge.textContent = 'TRIPPED';
      rack7Badge.className = 'text-red font-bold';
    } else {
      rack7Badge.textContent = 'ONLINE';
      rack7Badge.className = 'text-green';
    }
  }

  // Module 3: Substation SLD Status
  const oltcDisplay = document.getElementById('oltc-tap-display');
  if (oltcDisplay) {
    oltcDisplay.textContent = `${String(state.oltcTap).padStart(2, '0')} (${state.busVoltage132.toFixed(1)} kV)`;
  }

  const trafoTemps = document.getElementById('trafo-temps');
  if (trafoTemps) {
    trafoTemps.textContent = `OTI: ${state.trafoOti.toFixed(1)}°C | WTI: ${state.trafoWti.toFixed(1)}°C`;
    if (state.trafoWti > 85) trafoTemps.setAttribute('fill', '#ef4444');
    else trafoTemps.setAttribute('fill', '#38bdf8');
  }

  const buchholzEl = document.getElementById('buchholz-status');
  if (buchholzEl) {
    if (state.buchholzTrip) {
      buchholzEl.textContent = 'Buchholz Relay: GAS TRIP !';
      buchholzEl.setAttribute('fill', '#ef4444');
    } else {
      buchholzEl.textContent = 'Buchholz Relay: NORMAL';
      buchholzEl.setAttribute('fill', '#10b981');
    }
  }

  // CB-101 Breaker
  const boxCb101 = document.getElementById('box-cb-101');
  const statusCb101 = document.getElementById('status-cb-101');
  const contactCb101 = document.getElementById('contact-cb-101');
  if (boxCb101 && statusCb101 && contactCb101) {
    if (state.cb101Closed) {
      boxCb101.setAttribute('stroke', '#10b981');
      contactCb101.setAttribute('stroke', '#10b981');
      contactCb101.setAttribute('x1', '-8');
      contactCb101.setAttribute('y1', '0');
      contactCb101.setAttribute('x2', '8');
      contactCb101.setAttribute('y2', '0');
      statusCb101.textContent = 'CLOSED';
      statusCb101.setAttribute('fill', '#10b981');
    } else {
      boxCb101.setAttribute('stroke', '#ef4444');
      contactCb101.setAttribute('stroke', '#ef4444');
      contactCb101.setAttribute('x1', '-8');
      contactCb101.setAttribute('y1', '5');
      contactCb101.setAttribute('x2', '8');
      contactCb101.setAttribute('y2', '-8'); // open diagonal
      statusCb101.textContent = 'TRIPPED';
      statusCb101.setAttribute('fill', '#ef4444');
    }
  }

  // CB-301 Breaker
  const boxCb301 = document.getElementById('box-cb-301');
  const statusCb301 = document.getElementById('status-cb-301');
  const contactCb301 = document.getElementById('contact-cb-301');
  if (boxCb301 && statusCb301 && contactCb301) {
    if (state.cb301Closed) {
      boxCb301.setAttribute('stroke', '#10b981');
      contactCb301.setAttribute('stroke', '#10b981');
      contactCb301.setAttribute('x1', '-8');
      contactCb301.setAttribute('y1', '0');
      contactCb301.setAttribute('x2', '8');
      contactCb301.setAttribute('y2', '0');
      statusCb301.textContent = 'CLOSED';
      statusCb301.setAttribute('fill', '#10b981');
    } else {
      boxCb301.setAttribute('stroke', '#ef4444');
      contactCb301.setAttribute('stroke', '#ef4444');
      contactCb301.setAttribute('x1', '-8');
      contactCb301.setAttribute('y1', '5');
      contactCb301.setAttribute('x2', '8');
      contactCb301.setAttribute('y2', '-8');
      statusCb301.textContent = 'TRIPPED';
      statusCb301.setAttribute('fill', '#ef4444');
    }
  }

  // Substation Flow Lines animation toggle
  const powerLines = [
    'line-bus132-cb101',
    'line-cb101-trafo',
    'line-trafo-cb301',
    'line-cb301-bus33',
    'pv-flow-line'
  ];
  const isFlowing = state.cb101Closed && state.cb301Closed && state.pvActivePower > 0;
  powerLines.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.className = isFlowing ? 'flow-export' : 'flow-stopped';
    }
  });

  // Relays LED and Status
  updateRelayElement('relay-card-87t', 'led-87t', 'val-87t', state.relay87tTripped, 'ANSI 87T TRIP (Idiff: 0.84 pu)', 'Idiff: 0.04 pu (Pk: 0.20)');
  updateRelayElement('relay-card-81', 'led-81', 'val-81', state.relay81Tripped, `ANSI 81U TRIP (f: ${state.gridFrequency.toFixed(2)} Hz)`, `f: ${state.gridFrequency.toFixed(2)} Hz (Trip: 59.40)`);
  updateRelayElement('relay-card-21', 'led-21', 'val-21', state.relay21Tripped, 'ANSI 21 FAULT DETECTED', 'Z1 Reach: Normal | I < In');
  updateRelayElement('relay-card-25', 'led-25', 'val-25', state.relay25Locked, 'ANSI 25 SYNCHRO CHECKING...', 'ΔV: 0.8% • Δθ: 1.2° • READY');

  // Master Alarm Banner
  const alarmBanner = document.getElementById('master-alarm-banner');
  const badgeStatus = document.getElementById('alarm-badge-status');
  const bannerMsg = document.getElementById('alarm-banner-message');
  if (alarmBanner && badgeStatus && bannerMsg) {
    if (state.activeAlarm) {
      alarmBanner.className = 'alarm-banner active-alarm';
      badgeStatus.className = 'alarm-badge fault';
      badgeStatus.textContent = 'CRITICAL ALARM';
      bannerMsg.textContent = state.alarmMessage;
    } else {
      alarmBanner.className = 'alarm-banner';
      badgeStatus.className = 'alarm-badge healthy';
      badgeStatus.textContent = 'NORMAL';
      bannerMsg.textContent = state.alarmMessage;
    }
  }

  // KPIs
  const kpiH2 = document.getElementById('kpi-h2');
  if (kpiH2) kpiH2.textContent = `${state.dgaH2.toFixed(1)} ppm`;

  const kpiC2H2 = document.getElementById('kpi-c2h2');
  if (kpiC2H2) kpiC2H2.textContent = `${state.dgaC2H2.toFixed(2)} ppm`;

  const kpiDeltaV = document.getElementById('kpi-deltav');
  if (kpiDeltaV) kpiDeltaV.textContent = `${Math.round(state.cellDeltaV)} mV`;
}

function updateRelayElement(cardId: string, ledId: string, valId: string, isTripped: boolean, trippedText: string, normalText: string) {
  const card = document.getElementById(cardId);
  const led = document.getElementById(ledId);
  const val = document.getElementById(valId);
  if (!card || !led || !val) return;

  if (isTripped) {
    card.className = 'relay-card relay-tripped';
    led.className = 'relay-led led-red';
    val.textContent = trippedText;
    val.style.color = '#ef4444';
  } else {
    card.className = 'relay-card';
    led.className = 'relay-led led-green';
    val.textContent = normalText;
    val.style.color = '#94a3b8';
  }
}

// ============================================================================
// 60 FPS HTML5 CANVAS ENGINE: ONLINE DGA & BESS SPREAD
// ============================================================================

function initCanvasEngine() {
  const canvas = document.getElementById('ai-telemetry-canvas') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  function render() {
    if (!canvas || !ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    // Shift data buffers
    canvasHistory.h2History.shift();
    canvasHistory.h2History.push(state.dgaH2 + (Math.random() * 0.4 - 0.2));

    canvasHistory.c2h2History.shift();
    canvasHistory.c2h2History.push(state.dgaC2H2 + (Math.random() * 0.05 - 0.025));

    canvasHistory.deltaVHistory.shift();
    canvasHistory.deltaVHistory.push(state.cellDeltaV + (Math.random() * 0.6 - 0.3));

    // Clear background
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);

    // Draw Grid lines
    ctx.strokeStyle = '#131d35';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Divider line between DGA (top 60%) and BESS Delta V (bottom 40%)
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.62);
    ctx.lineTo(w, h * 0.62);
    ctx.stroke();

    // Top Section: Online DGA (H2 in Cyan, C2H2 in Emerald)
    // H2 Curve
    ctx.beginPath();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    for (let i = 0; i < canvasHistory.h2History.length; i++) {
      const val = canvasHistory.h2History[i];
      const x = (i / (canvasHistory.h2History.length - 1)) * w;
      // Map 0 to 120 ppm -> y from h * 0.58 to 15
      const y = h * 0.58 - (Math.min(120, val) / 120) * (h * 0.52);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // C2H2 Curve (Yellow/Orange)
    ctx.beginPath();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < canvasHistory.c2h2History.length; i++) {
      const val = canvasHistory.c2h2History[i];
      const x = (i / (canvasHistory.c2h2History.length - 1)) * w;
      // Map 0 to 5 ppm -> y from h * 0.58 to 15
      const y = h * 0.58 - (Math.min(5, val) / 5) * (h * 0.52);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // DGA Alert Threshold line (H2 = 50 ppm)
    const alertY = h * 0.58 - (50 / 120) * (h * 0.52);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, alertY);
    ctx.lineTo(w, alertY);
    ctx.stroke();
    ctx.setLineDash([]);

    // DGA Text Labels
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('H2 (0-120 ppm)', 10, 14);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('C2H2 (0-5 ppm)', 110, 14);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.fillText('H2 ALERT LIMIT (50 ppm)', w - 145, alertY - 4);

    // Bottom Section: BESS Cell Delta V Bars
    const bottomBase = h - 6;
    const barWidth = w / canvasHistory.deltaVHistory.length;
    for (let i = 0; i < canvasHistory.deltaVHistory.length; i++) {
      const dv = canvasHistory.deltaVHistory[i];
      const barH = (Math.min(200, dv) / 200) * (h * 0.32);
      const x = i * barWidth;
      const y = bottomBase - barH;

      ctx.fillStyle = dv > 100 ? 'rgba(239, 68, 68, 0.85)' : (dv > 50 ? 'rgba(245, 158, 11, 0.75)' : 'rgba(16, 185, 129, 0.5)');
      ctx.fillRect(x, y, barWidth - 1, barH);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.fillText('BESS 3840-CELL VOLTAGE SPREAD ΔV (0-200 mV) • TRIP THRESHOLD: 150 mV', 10, h * 0.62 + 13);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

// ============================================================================
// SYSTEM SIMULATION & TELEMETRY PHYSICS LOOP
// ============================================================================

function startPhysicsLoop() {
  setInterval(() => {
    // Dynamic physics calculation based on Irradiance and Tracker
    const effectiveIrr = state.irradiance;
    state.pvActivePower = (effectiveIrr / 1000) * 150 * 0.989 * (state.cb301Closed && state.cb101Closed ? 1 : 0);

    // Realistic small frequency micro-flutter
    if (state.targetFrequency === 60.00) {
      state.gridFrequency = 60.00 + (Math.sin(Date.now() / 2000) * 0.015);
    } else {
      // Approach target frequency
      state.gridFrequency += (state.targetFrequency - state.gridFrequency) * 0.2;
    }

    // Droop Control Logic:
    // If f drops below 59.85 Hz and not isolated, BESS injects power rapidly!
    if (state.gridFrequency < 59.85 && state.bessMode !== 'ISOLATED') {
      state.bessMode = 'DROOP';
      state.bessPower = 50.0; // 50 MW primary droop injection
      // Frequency recovers back toward 60.00
      state.targetFrequency = 60.00;
    } else if (state.gridFrequency >= 59.95 && state.bessMode === 'DROOP') {
      // Smoothly return to floating
      state.bessPower = Math.max(0, state.bessPower - 5);
      if (state.bessPower <= 1) {
        state.bessPower = 0.0;
        state.bessMode = 'STANDBY';
      }
    }

    // Voltage calculation based on OLTC Tap (1 to 17, tap 9 = 132.0kV nominal)
    const tapOffset = (state.oltcTap - 9) * 0.8;
    state.busVoltage132 = state.cb101Closed ? 132.0 + tapOffset + (state.pvReactivePower * 0.04) : 0;
    state.busVoltage33 = state.cb301Closed ? 33.0 + (tapOffset * 0.25) : 0;

    // Transformer oil & winding temperature rise proportional to current
    const loadRatio = (state.pvActivePower + Math.abs(state.bessPower)) / 160;
    const targetOti = 45 + loadRatio * 25;
    const targetWti = 52 + loadRatio * 32;
    state.trafoOti += (targetOti - state.trafoOti) * 0.05;
    state.trafoWti += (targetWti - state.trafoWti) * 0.05;

    // BESS SoC gradual evolution
    if (state.bessPower > 0) {
      state.bessSoC = Math.max(5, state.bessSoC - 0.02);
    } else if (state.bessPower < 0) {
      state.bessSoC = Math.min(100, state.bessSoC + 0.02);
    }

    updateUI();
  }, 100);
}

// ============================================================================
// FAULT INJECTION SCENARIOS
// ============================================================================

function setupFaultHandlers() {
  // Fault 1: Simulate Grid Frequency Drop (59.4 Hz)
  const btnFreq = document.getElementById('btn-fault-freq');
  if (btnFreq) {
    btnFreq.addEventListener('click', () => {
      scadaAudio.playClick();
      scadaAudio.playDroopAlert();

      state.targetFrequency = 59.40;
      state.gridFrequency = 59.40;
      state.relay81Tripped = true;
      state.activeAlarm = true;
      state.alarmMessage = 'ANSI 81U TRIP: GRID FREQ DECAY TO 59.40 Hz — PRIMARY DROOP DISPATCHED (+50 MW)';

      addSoeEvent('GRID-FREQ', 'CRITICAL', 'Under-frequency excursion detected: f = 59.40 Hz (Threshold: 59.85 Hz).');
      addSoeEvent('ANSI-81U', 'TRIP', 'ANSI 81U Underfrequency relay pickup. Initiating synthetic inertia response.');
      addSoeEvent('BESS-DROOP', 'DROOP', 'Primary Frequency Droop: BESS dispatched 50.0 MW in 118 ms (Droop R = 4.0%).');

      setTimeout(() => {
        addSoeEvent('GRID-FREQ', 'NORMAL', 'Frequency decay arrested at 59.72 Hz. Frequency stabilizing back to 60.00 Hz.');
        state.relay81Tripped = false;
        if (!state.relay87tTripped) {
          state.activeAlarm = false;
          state.alarmMessage = 'GRID STABILIZED (60.00 Hz) • BESS PRIMARY INJECTION COMPLETE • SYSTEM HEALTHY';
        }
      }, 4500);
    });
  }

  // Fault 2: Simulate BESS Rack Thermal Runaway
  const btnThermal = document.getElementById('btn-fault-thermal');
  if (btnThermal) {
    btnThermal.addEventListener('click', () => {
      scadaAudio.playClick();
      scadaAudio.playWarningChime();
      scadaAudio.playBreakerOperation(false);

      // Spike rack 7
      state.bessRacks[6].temp = 86.4;
      state.bessRacks[6].volts = 2.45;
      state.bessRacks[6].isolated = true;
      state.cellDeltaV = 194; // Critical delta V
      state.activeAlarm = true;
      state.alarmMessage = 'BESS RACK #07 THERMAL RUNAWAY IMMINENT: ΔV = 194mV, T = 86.4°C — DC CONTACTOR TRIPPED';

      // Update AI banner
      const anomalyBox = document.getElementById('ai-anomaly-box');
      const anomalyTag = document.getElementById('ai-anomaly-tag');
      const anomalyDesc = document.getElementById('ai-anomaly-desc');
      if (anomalyBox && anomalyTag && anomalyDesc) {
        anomalyBox.style.borderColor = '#ef4444';
        anomalyBox.style.background = 'rgba(239, 68, 68, 0.15)';
        anomalyTag.textContent = 'CRITICAL ALARM';
        anomalyTag.className = 'text-red font-bold';
        anomalyDesc.textContent = 'BESS Rack #07 Cell Voltage Imbalance ΔV > 180mV & Thermal Runaway Detected. DC Contactor QF-07 tripped open. Aerosol fire suppression system armed.';
      }

      // Fire Suppression LED in SVG
      const fireLed = document.getElementById('fire-suppression-led');
      const fireStatus = document.getElementById('fire-suppression-status');
      if (fireLed && fireStatus) {
        fireLed.setAttribute('fill', '#ef4444');
        fireStatus.textContent = 'DISCHARGING AEROSOL (RACK 07 ISOLATED)';
        fireStatus.setAttribute('fill', '#ef4444');
      }

      addSoeEvent('BMS-RACK07', 'CRITICAL', 'Cell #142 internal impedance fault: V = 2.45V, T = 86.4°C (Delta V = 194 mV).');
      addSoeEvent('QF-07-DC', 'TRIP', 'BESS DC Contactor QF-07 opened mechanically. Rack #07 completely isolated from DC bus.');
      addSoeEvent('FIRE-SYS', 'WARN', 'Aerosol fire suppression zone 2 armed & interlocked (NFPA 855).');
    });
  }

  // Fault 3: Simulate Transformer Differential Fault (ANSI 87T)
  const btn87t = document.getElementById('btn-fault-87t');
  if (btn87t) {
    btn87t.addEventListener('click', () => {
      scadaAudio.playClick();
      scadaAudio.playBreakerOperation(false);
      scadaAudio.startTripAlarm();

      state.relay87tTripped = true;
      state.buchholzTrip = true;
      state.cb101Closed = false;
      state.cb301Closed = false;
      state.dgaH2 = 98.4;
      state.dgaC2H2 = 3.8;
      state.activeAlarm = true;
      state.alarmMessage = 'ANSI 87T TRANSFORMER DIFFERENTIAL TRIP: 132kV CB-101 & 33kV CB-301 LOCKED OUT • BUCHHOLZ GAS TRIP';

      addSoeEvent('ANSI-87T', 'CRITICAL', 'Restrained Differential Protection Trip: Idiff = 0.84 pu (Trip Pickup > 0.20 pu). Phase B Internal Winding Fault.');
      addSoeEvent('CB-101', 'TRIP', '132 kV SF6 Circuit Breaker CB-101 opened in 38 ms by 87T lockout relay.');
      addSoeEvent('CB-301', 'TRIP', '33 kV Incomer Breaker CB-301 opened in 42 ms.');
      addSoeEvent('BUCHHOLZ', 'TRIP', 'Buchholz Gas Accumulation Relay tripped. Rapid gas surge detected in conservator pipe.');
      addSoeEvent('DGA-MON', 'WARN', 'Online DGA detected steep hydrogen rise (H2: 98.4 ppm) and acetylene (C2H2: 3.8 ppm).');
    });
  }

  // Fault 4: Synchrocheck & Grid Reconnection (ANSI 25)
  const btnSynchro = document.getElementById('btn-fault-synchro');
  if (btnSynchro) {
    btnSynchro.addEventListener('click', () => {
      scadaAudio.playClick();
      scadaAudio.stopAlarm();

      state.relay25Locked = true;
      state.alarmMessage = 'ANSI 25 SYNCHROCHECK IN PROGRESS: EVALUATING VOLTAGE, FREQUENCY & PHASE ANGLE MATCH...';
      addSoeEvent('ANSI-25', 'WARN', 'Automatic Synchronizer sequence initiated: Sampling V_line vs V_bus and phase angle delta.');

      setTimeout(() => {
        // Successful Synchro Match
        state.relay25Locked = false;
        state.relay87tTripped = false;
        state.buchholzTrip = false;
        state.cb101Closed = true;
        state.cb301Closed = true;
        state.activeAlarm = false;
        state.alarmMessage = 'SYNCHRONIZATION SUCCESS: 132kV CB-101 & 33kV CB-301 CLOSED • SUBSTATION ENERGIZED';

        scadaAudio.playBreakerOperation(true);
        scadaAudio.playSynchroSuccess();

        addSoeEvent('ANSI-25', 'NORMAL', 'Synchrocheck permissive validated: ΔV = 1.2%, Δf = 0.02 Hz, Δθ = 2.4° (Holding 500 ms).');
        addSoeEvent('CB-101', 'NORMAL', '132 kV CB-101 closed automatically. Substation reconnected to grid.');
        addSoeEvent('CB-301', 'NORMAL', '33 kV CB-301 closed. Solar PV and BESS infeed restored to grid.');
      }, 2000);
    });
  }

  // Clear SOE Button
  const btnClearSoe = document.getElementById('btn-clear-soe');
  if (btnClearSoe) {
    btnClearSoe.addEventListener('click', () => {
      scadaAudio.playClick();
      const tbody = document.getElementById('soe-table-body');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td>${new Date().toLocaleTimeString()}.000</td>
            <td>SOE-CLEAR</td>
            <td><span class="badge-tag tag-info">INFO</span></td>
            <td>Sequence of Events log buffer cleared by operator.</td>
          </tr>
        `;
      }
    });
  }

  // System Quick Reset Button
  const btnQuickReset = document.getElementById('btn-quick-reset');
  if (btnQuickReset) {
    btnQuickReset.addEventListener('click', () => {
      scadaAudio.playClick();
      scadaAudio.stopAlarm();

      state.gridFrequency = 60.00;
      state.targetFrequency = 60.00;
      state.cb101Closed = true;
      state.cb301Closed = true;
      state.relay87tTripped = false;
      state.relay81Tripped = false;
      state.relay21Tripped = false;
      state.relay25Locked = false;
      state.buchholzTrip = false;
      state.dgaH2 = 18.4;
      state.dgaC2H2 = 0.2;
      state.cellDeltaV = 14;
      state.activeAlarm = false;
      state.bessMode = 'STANDBY';
      state.bessPower = 0.0;
      state.alarmMessage = 'GRID SYNCHRONIZED (60.00 Hz) • 150 MWp PV EXPORTING • BESS FLOATING • 132/33 kV SUBSTATION CLEAR';

      state.bessRacks.forEach((r) => {
        r.isolated = false;
        r.temp = 25.2;
        r.volts = 3.28;
      });

      // Reset AI anomaly banner
      const anomalyBox = document.getElementById('ai-anomaly-box');
      const anomalyTag = document.getElementById('ai-anomaly-tag');
      const anomalyDesc = document.getElementById('ai-anomaly-desc');
      if (anomalyBox && anomalyTag && anomalyDesc) {
        anomalyBox.style.borderColor = 'var(--border-subtle)';
        anomalyBox.style.background = '#0d1527';
        anomalyTag.textContent = 'OPTIMAL';
        anomalyTag.className = 'text-green';
        anomalyDesc.textContent = 'All DGA gas ratios within Duval Zone 1 (Thermal Fault < 150°C). BESS rack cell voltage spread ΔV = 14 mV (Well below 50 mV trip limit).';
      }

      // Reset Fire Suppression LED
      const fireLed = document.getElementById('fire-suppression-led');
      const fireStatus = document.getElementById('fire-suppression-status');
      if (fireLed && fireStatus) {
        fireLed.setAttribute('fill', '#10b981');
        fireStatus.textContent = 'ARMED & INTERLOCKED';
        fireStatus.setAttribute('fill', '#10b981');
      }

      addSoeEvent('SYS-RESET', 'NORMAL', 'Master SCADA Reset executed by Lead Engineer. All protection lockouts reset.');
      scadaAudio.playBreakerOperation(true);
    });
  }

  // Audio Toggle
  const btnAudio = document.getElementById('btn-audio-toggle');
  const audioIcon = document.getElementById('audio-icon');
  const audioText = document.getElementById('audio-text');
  if (btnAudio && audioIcon && audioText) {
    btnAudio.addEventListener('click', () => {
      const isMuted = scadaAudio.toggleMute();
      if (isMuted) {
        audioIcon.className = 'fa-solid fa-volume-xmark';
        audioText.textContent = 'Audio: Muted';
        btnAudio.className = 'btn btn-secondary';
      } else {
        audioIcon.className = 'fa-solid fa-volume-high';
        audioText.textContent = 'Audio: Active';
        btnAudio.className = 'btn btn-secondary';
      }
      scadaAudio.playClick();
    });
  }

  // Fullscreen Toggle
  const btnFullscreen = document.getElementById('btn-fullscreen');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      scadaAudio.playClick();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  // OLTC Tap Buttons
  const btnTapUp = document.getElementById('btn-tap-up');
  if (btnTapUp) {
    btnTapUp.addEventListener('click', () => {
      scadaAudio.playClick();
      if (state.oltcTap < 17) {
        state.oltcTap++;
        addSoeEvent('OLTC-MTR', 'INFO', `OLTC stepped up to Tap #${state.oltcTap}. Secondary voltage adjusted.`);
      }
    });
  }

  const btnTapDown = document.getElementById('btn-tap-down');
  if (btnTapDown) {
    btnTapDown.addEventListener('click', () => {
      scadaAudio.playClick();
      if (state.oltcTap > 1) {
        state.oltcTap--;
        addSoeEvent('OLTC-MTR', 'INFO', `OLTC stepped down to Tap #${state.oltcTap}. Secondary voltage adjusted.`);
      }
    });
  }

  // Interactive Sunlight / Irradiance Slider
  const sliderIrr = document.getElementById('slider-irradiance') as HTMLInputElement;
  if (sliderIrr) {
    sliderIrr.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      state.irradiance = val;
      // Calculate sun tracker angle from irradiance (mimicking solar elevation)
      // When at 945 W/m², angle is ~+22°
      const normalized = (val - 550) / 550; // -1 to +1
      state.trackerAngle = Math.round(normalized * 58 * 10) / 10;
    });
  }

  // Reactive Power Q-Control Slider
  const sliderQ = document.getElementById('slider-q-control') as HTMLInputElement;
  if (sliderQ) {
    sliderQ.addEventListener('input', (e) => {
      state.pvReactivePower = parseFloat((e.target as HTMLInputElement).value);
    });
  }

  // Dossier Modal Open / Close
  const modalBackdrop = document.getElementById('dossier-modal');
  const btnOpenDossier = document.getElementById('btn-open-dossier');
  const btnCloseDossier = document.getElementById('btn-close-dossier');
  const btnCloseDossierFooter = document.getElementById('btn-close-dossier-footer');

  if (btnOpenDossier && modalBackdrop) {
    btnOpenDossier.addEventListener('click', () => {
      scadaAudio.playClick();
      modalBackdrop.classList.remove('hidden');
    });
  }

  if (btnCloseDossier && modalBackdrop) {
    btnCloseDossier.addEventListener('click', () => {
      scadaAudio.playClick();
      modalBackdrop.classList.add('hidden');
    });
  }

  if (btnCloseDossierFooter && modalBackdrop) {
    btnCloseDossierFooter.addEventListener('click', () => {
      scadaAudio.playClick();
      modalBackdrop.classList.add('hidden');
    });
  }

  // Close modal on click outside dialog
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        modalBackdrop.classList.add('hidden');
      }
    });
  }

  // Clickable SLD Circuit Breakers for manual dispatch!
  const sldCb101 = document.getElementById('sld-cb-101');
  if (sldCb101) {
    sldCb101.addEventListener('click', () => {
      state.cb101Closed = !state.cb101Closed;
      scadaAudio.playBreakerOperation(state.cb101Closed);
      addSoeEvent('CB-101-MAN', state.cb101Closed ? 'NORMAL' : 'WARN', `132 kV CB-101 manually toggled: ${state.cb101Closed ? 'CLOSED' : 'OPENED'}.`);
    });
  }

  const sldCb301 = document.getElementById('sld-cb-301');
  if (sldCb301) {
    sldCb301.addEventListener('click', () => {
      state.cb301Closed = !state.cb301Closed;
      scadaAudio.playBreakerOperation(state.cb301Closed);
      addSoeEvent('CB-301-MAN', state.cb301Closed ? 'NORMAL' : 'WARN', `33 kV CB-301 manually toggled: ${state.cb301Closed ? 'CLOSED' : 'OPENED'}.`);
    });
  }
}

// ============================================================================
// SYSTEM ENTRYPOINT
// ============================================================================

window.addEventListener('DOMContentLoaded', () => {
  setupFaultHandlers();
  initCanvasEngine();
  startPhysicsLoop();
  updateUI();
  addSoeEvent('SYS-BOOT', 'NORMAL', 'GRID-BESS EMS SCADA v5.0 online. Lead Engineer: أ. طارق ابوعشي');
});
