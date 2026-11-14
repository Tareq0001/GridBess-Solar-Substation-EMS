# GRID-BESS: Utility-Scale Solar PV, Battery Energy Storage (BESS) & 132kV Substation EMS

> **Industrial SCADA & Energy Management System (EMS) Digital Twin**  
> **Author & Lead Systems Engineer:** أ. طارق ابوعشي | Tareq Abuashi — *Lead Electrical & Automation Systems Engineer*  
> **Architecture:** 150 MWp Solar PV Array • 200 MWh LFP BESS • 132/33 kV Step-Up Substation • Primary Frequency Droop Control (60.00 Hz) • ANSI Protection Suite • Online DGA & Predictive Analytics

---

## ⚡ Executive Summary & Engineering Architecture

**GRID-BESS** is an enterprise-grade Energy Management System (EMS) and Supervisory Control and Data Acquisition (SCADA) suite built for utility-scale renewable generation and high-voltage transmission interconnects. Designed in strict compliance with **IEEE 1547**, **IEEE 2800**, **IEC 61850**, **NFPA 855**, and **IEC 60870-5-104**, this platform delivers a real-time digital twin integrating 150 MWp of solar generation, a 200 MWh Lithium-Iron-Phosphate (LFP) BESS facility, and a 160 MVA 132/33 kV transmission substation.

The system features real-time synthetic inertia with sub-120ms primary frequency droop response, automated ANSI numerical protection relay modeling, online dissolved gas analysis (DGA), and 60 FPS predictive maintenance diagnostics.

---

## 🏛️ System Modules & Technical Specifications

```
                             [ 132 kV TRANSMISSION GRID (60.00 Hz) ]
                                                │
                                      [ 132 kV CB-101 (SF6) ]
                                                │
                                    [ 160 MVA 132/33 kV TRAFO ]
                                      (Dyn11 • OLTC Taps 1-17)
                                                │
                                      [ 33 kV CB-301 (VCB) ]
                                                │
                   ┌────────────────────────────┴────────────────────────────┐
                   ▼                                                         ▼
        [ 33 kV BUSBAR A: SOLAR PV ]                              [ 33 kV BUSBAR B: BESS ]
                   │                                                         │
       ┌───────────┴───────────┐                                 ┌───────────┴───────────┐
       ▼                       ▼                                 ▼                       ▼
  [ 150 MWp PV ]      [ Central Inverters ]                 [ 200 MWh LFP ]        [ 100 MW 4-Quadrant ]
 (Trackers -60°/+60°)  (1500 VDC / 33 kV)                 (16 Racks • Chiller)      (PCS Bidirectional)
```

### Module 1: 150 MWp Solar PV Array & Central Inverters
- **Nominal Peak Capacity:** 150 MWp bifacial monocrystalline silicon PV modules.
- **Tracker Topology:** Single-axis astronomical backtracking horizontal trackers (-60° to +60° tracking arc).
- **Inverter Architecture:** 1500 VDC central inverters stepping up to 33 kV MV collection bus.
- **Dynamic Voltage Support:** 4-Quadrant Volt-VAr regulation providing ±45 MVAR reactive power support at the 33 kV Point of Interconnection (POI).
- **Interactive Controls:** Plane of Array (POA) Irradiance modulation (0 to 1100 W/m²) and dynamic tracking tilt telemetry.

### Module 2: 200 MWh LFP BESS & Primary Frequency Droop Control
- **Storage Capacity:** 200 MWh / 100 MW (2-hour duration, 0.5C nominal rating) using Lithium Iron Phosphate (LiFePO4) chemistry.
- **Primary Frequency Response:** Automated $R = 4.0\%$ droop curve centered at 60.00 Hz (deadband: 59.98 - 60.02 Hz). Fast-frequency active power injection within **118 ms** upon grid under-frequency excursions ($f < 59.85\text{ Hz}$).
- **Auxiliary Systems:** Liquid chiller cooling loop maintained at 24.8°C and aerosol fire suppression interlocks (NFPA 855 / UL 9540A).
- **Rack Telemetry:** Real-time cell impedance, voltage, and temperature monitoring across 16 internal rack clusters.

### Module 3: 132/33 kV Substation Single Line Diagram (SLD) & ANSI Protection Suite
- **Main Power Transformer:** 160 MVA ONAN/ONAF, 132/33 kV, Dyn11 vector group, fitted with On-Load Tap Changer (OLTC) covering 17 physical steps (±10% voltage regulation).
- **Switchgear:** 132 kV SF6 circuit breakers (CB-101, CB-102) and 33 kV vacuum circuit breakers (CB-301, CB-PV, CB-BESS, Bus-Tie CB-300).
- **ANSI Numerical Protection Relays:**
  - **ANSI 87T:** Dual-slope percentage-restrained transformer differential protection ($I_{diff} > 0.20\text{ pu}$, operates in $< 18\text{ ms}$).
  - **ANSI 81U/81O:** Under/over frequency protection stages (59.40 Hz trip threshold).
  - **ANSI 21/67:** Phase distance and directional overcurrent protection.
  - **ANSI 25:** Automatic synchrocheck relay enforcing voltage magnitude ($\Delta V \le 5\%$), frequency difference ($\Delta f \le 0.1\text{ Hz}$), and phase angle match ($\Delta\theta \le 10^\circ$).

### Module 4: AI Predictive Maintenance & 60 FPS Telemetry Engine
- **Online Dissolved Gas Analysis (DGA):** Continuous tracking of Hydrogen ($H_2$) and Acetylene ($C_2H_2$) in transformer dielectric oil using Duval Triangle classification.
- **BESS Cell Spread Diagnostics:** Real-time analysis of 3,840 series-connected cells detecting micro-shorts and thermal runaway risk when $\Delta V > 150\text{ mV}$.
- **Hardware-Accelerated Canvas:** Custom 60 FPS HTML5 canvas engine rendering high-fidelity dual oscillograms.

### Module 5: Fault Injection & Sequence of Events (SOE) Chronology
- **Interactive Fault Scenarios:**
  1. `Simulate Grid Frequency Drop (59.4 Hz)`: Triggers droop response, dispatching +50 MW BESS injection in 118 ms.
  2. `Simulate BESS Rack Thermal Runaway`: Rises Rack #07 temperature to 86.4°C, opening DC Contactor QF-07 and arming aerosol fire systems.
  3. `Simulate Trafo Differential Fault (87T)`: Instantaneous trip of 132kV and 33kV breakers with wailing SCADA siren.
  4. `Synchrocheck & Grid Reconnection`: Evaluates ANSI 25 synchronizer permissives and recloses CB-101.
- **Sequence of Events (SOE) Recorder:** High-resolution millisecond timestamped event logging conforming to IEC 60870-5-104 standards.

---

## 🧮 Mathematical Foundations & Equations

### 1. Active Power Model (Solar PV)
$$P_{pv} = P_{stc} \cdot \left(\frac{G_{poa}}{1000}\right) \cdot \left[1 + \gamma (T_{cell} - 25)\right] \cdot \eta_{inv}$$
*Where:*
- $G_{poa}$: Plane-of-Array Irradiance ($W/m^2$)
- $\gamma = -0.34\% / ^\circ C$: Temperature derating coefficient
- $\eta_{inv} = 98.9\%$: Central inverter efficiency

### 2. Primary Frequency Droop Control
$$\Delta P = -\frac{1}{R} \cdot \left(\frac{f_{grid} - f_0}{f_0}\right) \cdot P_{rated}$$
*Where:*
- $R = 0.04$ (4.0% droop characteristic)
- $f_0 = 60.00\text{ Hz}$
- $t_{response} \le 120\text{ ms}$

### 3. Transformer Differential Protection (ANSI 87T)
$$I_{diff} = |\vec{I}_1 + \vec{I}_2| \quad,\quad I_{rest} = \frac{|\vec{I}_1| + |\vec{I}_2|}{2}$$
$$\text{Trip if: } I_{diff} > \begin{cases} K_1 \cdot I_{rest} + I_{pickup} & \text{for } I_{rest} \le I_{knee} \\ K_2 \cdot (I_{rest} - I_{knee}) + K_1 \cdot I_{knee} + I_{pickup} & \text{for } I_{rest} > I_{knee} \end{cases}$$

---

## 🛠️ Technology Stack

- **Core Framework:** Vite 6 + TypeScript 5.8
- **Audio Synthesizer:** Custom Web Audio API mechanical breaker simulation and dual-tone SCADA siren
- **Rendering:** SVG vector pipelines with dynamic CSS animation & HTML5 Canvas 60 FPS
- **Styling:** Industrial dark HMI theme (`#070b14` / `#0b1120`), typography with *JetBrains Mono* and *Inter*
- **Icons:** FontAwesome 6 Pro CDN

---

## 🚀 Building & Running Locally

```bash
# 1. Clone repository
git clone https://github.com/Tareq0001/GridBess-Solar-Substation-EMS.git

# 2. Navigate to project root
cd GridBess-Solar-Substation-EMS

# 3. Install dependencies
npm install

# 4. Start local development server
npm run dev

# 5. Build production bundle
npm run build
```

---

## 👨‍💻 Engineering Identity & Ownership

**Lead Electrical & Automation Systems Engineer:**  
**أ. طارق ابوعشي | Tareq Abuashi**  
*Specialist in High-Voltage Substation Automation, Utility-Scale Renewable Energy Integration & Industrial SCADA Digital Twins.*

*Copyright © 2026 Tareq Abuashi. All rights reserved.*
