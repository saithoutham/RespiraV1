(function () {
  'use strict';

  const PRIVACY_SETTINGS_KEY = 'respira_privacy_settings';
  const AUDIO_BASELINE_KEY = 'respira_audio_baseline';
  const AUDIO_TREND_KEY = 'respira_audio_trend';
  const HEALTH_IMPORT_META_KEY = 'respira_health_import_meta';
  const AUDIT_LOG_KEY = 'respira_audit_log';
  const DOCUMENT_STORE_KEY = 'respira_document_store';
  const OPENROUTER_BASE_KEY = 'respira_openrouter_base';
  const OPENROUTER_MODEL_KEY = 'respira_openrouter_model';
  const GEMINI_BASE_KEY = 'respira_gemini_base';
  const GEMINI_MODEL_KEY = 'respira_gemini_model';
  const DEMO_SEED_KEY = 'respira_demo_seed_v3';
  const DEMO_VIEW_KEY = 'respira_demo_view';
  const RV_MODEL_BASE = 'public/models/recurvoice';
  const FEATURE_WEIGHTS = { hnr_mean: 0.4, jitter_local: 0.3, shimmer_local: 0.2, mfcc_1: 0.1 };
  const FEATURE_DIRECTIONS = { hnr_mean: -1, jitter_local: 1, shimmer_local: 1, mfcc_1: 1 };
  const FEATURE_STD_FLOORS = { hnr_mean: 0.25, jitter_local: 0.05, shimmer_local: 0.05, mfcc_1: 0.5 };
  const RV_SAMPLE_RATE = 16000;
  const originalRenderHealth = window.renderHealth;
  const LOCAL_AI_CONFIG = window.RESPIRA_LOCAL_CONFIG || {};
  const DEMO_NAV_ITEMS = {
    patient: [
      { page: 'dashboard', label: 'Dashboard', icon: '⊞' },
      { page: 'checkin', label: 'Check In', icon: '◎' },
      { page: 'reports', label: 'Reports', icon: '≡' },
      { page: 'health', label: 'Health', icon: '♥' },
      { page: 'medications', label: 'Medications', icon: '⊕' },
      { page: 'timeline', label: 'Timeline', icon: '≈' },
      { page: 'ai', label: 'Respira AI', icon: '✦' },
      { page: 'education', label: 'Education', icon: '◐' },
      { page: 'settings', label: 'Settings', icon: '⚙' }
    ],
    caregiver: [
      { page: 'dashboard', label: 'Dashboard', icon: '⊞' },
      { page: 'reports', label: 'Reports', icon: '≡' },
      { page: 'health', label: 'Health', icon: '♥' },
      { page: 'medications', label: 'Medications', icon: '⊕' },
      { page: 'ai', label: 'Respira AI', icon: '✦' },
      { page: 'settings', label: 'Settings', icon: '⚙' }
    ]
  };
  const DEMO_MOBILE_PRIMARY = {
    patient: ['dashboard', 'checkin', 'health', 'ai'],
    caregiver: ['dashboard', 'reports', 'health', 'ai']
  };

  const toneMap = {
    STABLE: { label: 'Stable', tone: 'pill-green' },
    WATCH: { label: 'Watch', tone: 'pill-amber' },
    EARLY_WARNING: { label: 'Early warning', tone: 'pill-amber' },
    URGENT: { label: 'Urgent', tone: 'pill-red' },
    CALIBRATING: { label: 'Calibrating', tone: 'pill-blue' }
  };
  const RECURVOICE_SENTENCE_POOL = [
    'The north wind and the sun were both very strong',
    'She sells seashells by the seashore every summer',
    'How much wood would a woodchuck chuck if it could',
    'The weather is warm and wonderful in the morning',
    'Peter walked slowly through the peaceful garden path',
    'The cat sat quietly beside the warm fireplace',
    'Birds sang softly in the tall oak tree outside',
    'Mary carried fresh flowers through the open field',
    'The old dog slept peacefully by the back door',
    'Six smooth stones sat beside the shallow stream',
    'Thomas spoke clearly to the group of children',
    'The brown bread was warm and fresh from the oven',
    'Helen walked carefully down the long garden path',
    'Four fat frogs sat on flat floating logs today',
    'The purple flowers bloomed beside the stone wall',
    'Robert read the paper slowly each Sunday morning',
    'The gray clouds moved quietly across the open sky',
    'Susan poured warm tea into the blue ceramic cup',
    'The green leaves rustled softly in the gentle breeze',
    'Charlie called his sister every single Sunday evening',
    'The tall lighthouse stood at the edge of the shore',
    'Dorothy fed the birds every morning without fail',
    'The small brown rabbit sat still in the tall grass',
    'William wrote long letters to his family each week',
    'The yellow butterfly landed on the pink garden rose',
    'Frank drove slowly down the quiet country road',
    'The river flowed smoothly between the mossy stones',
    'Clara hummed softly while she folded the clean laundry',
    'The wooden chair creaked gently in the warm breeze',
    'George planted tomatoes along the sunny garden wall'
  ];
  const DEMO_VERSION = 'lung_demo_v3';

  function getDemoView() {
    const saved = String(localStorage.getItem(DEMO_VIEW_KEY) || 'patient').toLowerCase();
    return saved === 'caregiver' ? 'caregiver' : 'patient';
  }

  function getDemoHomePage() {
    return 'dashboard';
  }

  function getDemoNavItems(view) {
    return DEMO_NAV_ITEMS[view] || DEMO_NAV_ITEMS.patient;
  }

  function isPageAllowedForDemoView(page, view) {
    return getDemoNavItems(view).some((item) => item.page === page);
  }

  function normalizeDemoPage(page, view) {
    const nextPage = String(page || '').toLowerCase();
    if (nextPage === 'scans') return 'dashboard';
    if (['landing', 'login', 'signup', 'onboarding'].includes(nextPage)) return getDemoHomePage();
    if (!isPageAllowedForDemoView(nextPage, view)) return getDemoHomePage();
    return nextPage;
  }

  function buildDemoCheckins() {
    const rows = [
      { offset: -7, healthScore: 81, coughLevel: 2, feeling: 'About the Same', voiceAlertLevel: 'STABLE', voiceHnr: 17.8, voiceJitter: 0.71, voiceShimmer: 2.84, voicePitch: 211, transcript: 'Felt okay today. A little tired after treatment but still walked outside.' },
      { offset: -6, healthScore: 79, coughLevel: 3, feeling: 'About the Same', voiceAlertLevel: 'STABLE', voiceHnr: 17.1, voiceJitter: 0.82, voiceShimmer: 2.96, voicePitch: 209, transcript: 'Energy dipped by afternoon. No fever. Mild dry cough at night.' },
      { offset: -5, healthScore: 76, coughLevel: 4, feeling: 'Worse', voiceAlertLevel: 'WATCH', voiceHnr: 16.2, voiceJitter: 1.11, voiceShimmer: 3.28, voicePitch: 206, transcript: 'More winded on stairs today and needed to sit down after showering.' },
      { offset: -4, healthScore: 74, coughLevel: 5, feeling: 'Worse', voiceAlertLevel: 'WATCH', voiceHnr: 15.7, voiceJitter: 1.34, voiceShimmer: 3.54, voicePitch: 205, transcript: 'Cough picked up this morning. Appetite was lower but I still ate lunch.' },
      { offset: -3, healthScore: 72, coughLevel: 5, feeling: 'About the Same', voiceAlertLevel: 'WATCH', voiceHnr: 15.9, voiceJitter: 1.22, voiceShimmer: 3.4, voicePitch: 204, transcript: 'Still coughing a bit, mostly dry. No chest pain. Breathing better after resting.' },
      { offset: -2, healthScore: 75, coughLevel: 4, feeling: 'Better', voiceAlertLevel: 'STABLE', voiceHnr: 16.5, voiceJitter: 1.01, voiceShimmer: 3.12, voicePitch: 207, transcript: 'More energy today. Walked to the mailbox and back without stopping.' },
      { offset: -1, healthScore: 77, coughLevel: 3, feeling: 'Better', voiceAlertLevel: 'STABLE', voiceHnr: 16.9, voiceJitter: 0.92, voiceShimmer: 3.01, voicePitch: 208, transcript: 'Breathing felt steadier. Still some fatigue after dinner.' }
    ];
    return rows.map((row, index) => ({
      id: 5000 + index,
      date: addDays(todayStr(), row.offset),
      completed: true,
      healthScore: row.healthScore,
      coughLevel: row.coughLevel,
      reactionTime: 248 + (index * 11),
      feeling: row.feeling,
      diaryResult: row.healthScore >= 76 ? 'Looking good' : row.healthScore >= 72 ? 'Worth monitoring' : 'Talk to your care team this week',
      transcript: row.transcript,
      alertTier: row.coughLevel >= 5 ? 3 : 1,
      voiceAlertLevel: row.voiceAlertLevel,
      voiceProbability: row.voiceAlertLevel === 'WATCH' ? 0.42 : 0.18,
      voiceHnr: row.voiceHnr,
      voiceJitter: row.voiceJitter,
      voiceShimmer: row.voiceShimmer,
      voicePitch: row.voicePitch
    }));
  }

  function buildDemoMedicationList(patient) {
    return [
      { id: 7001, name: 'Pembrolizumab', dose: '200 mg IV', frequency: 'Every 21 days', daysSupply: 21, startDate: patient.treatmentStartDate, prescriber: patient.oncologistName, pharmacy: patient.careSite, source: 'document' },
      { id: 7002, name: 'Carboplatin', dose: 'AUC 5 IV', frequency: 'Every 21 days', daysSupply: 21, startDate: patient.treatmentStartDate, prescriber: patient.oncologistName, pharmacy: patient.careSite, source: 'document' },
      { id: 7003, name: 'Pemetrexed', dose: '500 mg/m2 IV', frequency: 'Every 21 days', daysSupply: 21, startDate: patient.treatmentStartDate, prescriber: patient.oncologistName, pharmacy: patient.careSite, source: 'document' },
      { id: 7004, name: 'Folic Acid', dose: '1 mg', frequency: 'Daily', daysSupply: 30, startDate: addDays(patient.treatmentStartDate, -7), prescriber: patient.oncologistName, pharmacy: 'Home medication', source: 'manual' },
      { id: 7005, name: 'Vitamin B12', dose: '1000 mcg IM', frequency: 'Every 9 weeks', daysSupply: 63, startDate: addDays(patient.treatmentStartDate, -2), prescriber: patient.oncologistName, pharmacy: patient.careSite, source: 'manual' }
    ];
  }

  function buildDemoDocumentRecord(patient) {
    return {
      id: 8101,
      context: 'demo_seed',
      fileName: 'Thoracic Oncology Follow-up.pdf',
      uploadedAt: new Date(parseLocalDate(addDays(todayStr(), -5)) || new Date()).toISOString(),
      text: [
        'Patient Name: ' + patient.name,
        'Diagnosis Date: ' + formatDate(patient.diagnosisDate),
        'Histology: ' + patient.histology,
        'Cancer Stage: ' + patient.cancerStage,
        'Treatment: ' + patient.treatmentProtocol,
        'Cycle Schedule: ' + patient.cycleSchedule,
        'Oncologist: ' + patient.oncologistName,
        'Phone: ' + patient.oncologistContact,
        'Next Infusion: ' + formatDate(patient.nextInfusionDate),
        'Next Visit: ' + formatDate(patient.nextAppointmentDate)
      ].join('\n'),
      textPreview: 'Treatment plan confirmed with pembrolizumab, carboplatin, and pemetrexed on a 21-day cycle.',
      previewDataUrl: '',
      parsed: {
        name: patient.name,
        cancerStage: patient.cancerStage,
        histology: patient.histology,
        egfr: patient.biomarkers.egfr,
        alk: patient.biomarkers.alk,
        ros1: patient.biomarkers.ros1,
        pdl1_tps: String(patient.biomarkers.pdl1_tps),
        treatmentProtocol: patient.treatmentProtocol,
        treatmentDrugs: patient.treatmentDrugs.slice(),
        cycleSchedule: patient.cycleSchedule,
        oncologistName: patient.oncologistName,
        oncologistContact: patient.oncologistContact,
        treatmentStartDate: patient.treatmentStartDate,
        diagnosisDate: patient.diagnosisDate,
        nextInfusionDate: patient.nextInfusionDate,
        nextAppointmentDate: patient.nextAppointmentDate,
        careSite: patient.careSite
      },
      summary: 'Stage IV adenocarcinoma on pembrolizumab, carboplatin, and pemetrexed. Next infusion and clinic follow-up are already scheduled.',
      datesFound: [patient.diagnosisDate, patient.treatmentStartDate, patient.nextInfusionDate, patient.nextAppointmentDate],
      medications: buildDemoMedicationList(patient).slice(0, 3),
      timelineNotes: [
        { id: 9101, date: patient.diagnosisDate, text: 'Diagnosis confirmed: adenocarcinoma Stage IV.', label: 'Diagnosis update', type: 'treatment', sourceDoc: '' },
        { id: 9102, date: patient.treatmentStartDate, text: 'Treatment started with pembrolizumab, carboplatin, and pemetrexed.', label: 'Treatment update', type: 'treatment', sourceDoc: '' },
        { id: 9103, date: patient.nextInfusionDate, text: 'Next infusion is scheduled on the active treatment cycle.', label: 'Treatment cycle', type: 'treatment', sourceDoc: '' },
        { id: 9104, date: patient.nextAppointmentDate, text: 'Clinic follow-up is already on the calendar.', label: 'Clinic visit', type: 'treatment', sourceDoc: '' }
      ],
      scanEntry: null
    };
  }

  function seedDemoWorkspace(force) {
    if (!force && localStorage.getItem(DEMO_SEED_KEY) === DEMO_VERSION) return;
    const diagnosisDate = addDays(todayStr(), -126);
    const treatmentStartDate = addDays(todayStr(), -84);
    const nextInfusionDate = addDays(todayStr(), 9);
    const nextAppointmentDate = addDays(todayStr(), 12);
    const patient = {
      name: 'Maya Chen',
      cancerStage: 'Stage IV',
      histology: 'Adenocarcinoma',
      biomarkers: { egfr: 'Exon 19 deletion', alk: 'Negative', ros1: 'Negative', pdl1_tps: 35 },
      treatmentProtocol: 'Pembrolizumab + Carboplatin + Pemetrexed',
      treatmentDrugs: ['Pembrolizumab', 'Carboplatin', 'Pemetrexed'],
      cycleSchedule: 'Every 21 days',
      oncologistName: 'Dr. Amelia Ames',
      oncologistContact: '555-111-2222',
      treatmentStartDate,
      nextInfusionDate,
      nextAppointmentDate,
      diagnosisDate,
      careSite: 'Memorial Regional Thoracic Oncology',
      caregiver: {
        name: 'Daniel Chen',
        phone: '555-222-1844',
        email: 'daniel.chen@respira-demo.local',
        relationship: 'Spouse'
      }
    };
    const checkins = buildDemoCheckins();
    const alerts = [
      {
        id: 9201,
        tier: 3,
        message: 'Cough and voice drift were slightly higher across the last three check-ins. Keep watching the trend and mention it if it continues.',
        timestamp: new Date(parseLocalDate(addDays(todayStr(), -3)) || Date.now()).toISOString(),
        read: false
      }
    ];
    const medications = buildDemoMedicationList(patient);
    const notes = [
      { id: 9301, date: diagnosisDate, text: 'Diagnosis confirmed after thoracic biopsy review.', label: 'Diagnosis update', type: 'treatment', sourceDoc: '' },
      { id: 9302, date: treatmentStartDate, text: 'Started pembrolizumab, carboplatin, and pemetrexed.', label: 'Treatment update', type: 'treatment', sourceDoc: '' },
      { id: 9303, date: nextAppointmentDate, text: 'Bring up stairs shortness of breath, post-infusion fatigue, and dry cough pattern.', label: 'Clinic visit', type: 'treatment', sourceDoc: '' }
    ];
    const symptoms = [
      { id: 9401, date: addDays(todayStr(), -5), symptoms: ['Dry cough', 'Fatigue'] },
      { id: 9402, date: addDays(todayStr(), -3), symptoms: ['Shortness of breath', 'Fatigue'] },
      { id: 9403, date: addDays(todayStr(), -1), symptoms: ['Dry cough'] }
    ];
    const vitals = [
      { id: 9501, date: addDays(todayStr(), -2), spo2: 96, hr: 84, weight: 132.4, temperature: 98.2, respiratoryRate: 18 },
      { id: 9502, date: addDays(todayStr(), -1), spo2: 97, hr: 81, weight: 132.1, temperature: 98.1, respiratoryRate: 17 }
    ];
    const caregiverNotes = [
      { text: 'Daniel noticed cough is mostly evening and after climbing stairs.', ts: new Date(parseLocalDate(addDays(todayStr(), -2)) || Date.now()).getTime() }
    ];
    const documentRecords = [buildDemoDocumentRecord(patient)];
    const user = { name: patient.name, email: 'demo@respira.local', role: 'patient', demo: true };
    localStorage.setItem('respira_user', JSON.stringify(user));
    localStorage.setItem('respira_patient', JSON.stringify(patient));
    localStorage.setItem('respira_checkins', JSON.stringify(checkins));
    localStorage.setItem('respira_alerts', JSON.stringify(alerts));
    localStorage.setItem('respira_medications', JSON.stringify(medications));
    localStorage.setItem('respira_chats', JSON.stringify([]));
    localStorage.setItem('respira_symptoms', JSON.stringify(symptoms));
    localStorage.setItem('respira_vitals', JSON.stringify(vitals));
    localStorage.setItem('respira_notes', JSON.stringify(notes));
    localStorage.setItem('respira_cg_notes', JSON.stringify(caregiverNotes));
    localStorage.setItem('respira_med_qa', JSON.stringify([]));
    localStorage.setItem(DOCUMENT_STORE_KEY, JSON.stringify(documentRecords));
    localStorage.setItem(HEALTH_IMPORT_META_KEY, JSON.stringify({ lastImportedAt: '', source: 'demo', daysImported: 0, recordCount: 0 }));
    localStorage.setItem(AUDIO_TREND_KEY, JSON.stringify({
      calibration_days: 14,
      calibration_pool: [],
      baseline_mean: { hnr_mean: 16.8, jitter_local: 0.92, shimmer_local: 3.02, mfcc_1: -115.4 },
      baseline_std: { hnr_mean: 0.9, jitter_local: 0.18, shimmer_local: 0.22, mfcc_1: 1.1 },
      current_cusum_scores: { hnr_mean: 0.2, jitter_local: 0.35, shimmer_local: 0.3, mfcc_1: 0.1 },
      score_history: [0.4, 0.6, 0.7, 0.45],
      recording_history: [],
      consecutive_alert_days: 0,
      calibration_complete: true,
      days_recorded: 16,
      current_alert_level: 'STABLE'
    }));
    localStorage.setItem(AUDIO_BASELINE_KEY, JSON.stringify({
      voice: { recordedAt: new Date(parseLocalDate(addDays(todayStr(), -20)) || Date.now()).toISOString(), features: { hnr_mean: 16.8, jitter_local: 0.91, shimmer_local: 3.0, f0_mean: 208 } },
      cough: { recordedAt: new Date(parseLocalDate(addDays(todayStr(), -20)) || Date.now()).toISOString(), scores: { obstruction: 0.24, wetness: 1.4, force: 12.6, burst: 1 } }
    }));
    if (!localStorage.getItem(DEMO_VIEW_KEY)) localStorage.setItem(DEMO_VIEW_KEY, 'patient');
    localStorage.setItem(DEMO_SEED_KEY, DEMO_VERSION);
  }

  function renderDemoSidebarCard() {
    const sidebarPatient = $('sidebar-patient');
    if (!sidebarPatient) return;
    const patient = getPatient() || {};
    const demoView = getDemoView();
    const caregiver = patient.caregiver || {};
    const latestCheckin = getCheckins().slice(-1)[0] || {};
    const alerts = getAlerts().filter((item) => !item.read);
    const title = demoView === 'caregiver' ? (caregiver.name || 'Caregiver view') : (patient.name || 'Patient view');
    const detail = demoView === 'caregiver'
      ? buildCaregiverStatusSummary(patient, latestCheckin, alerts)
      : (patient.treatmentProtocol || 'Demo record');
    sidebarPatient.innerHTML = '<div class="sidebar-patient-card demo-sidebar-card"><div><div class="sp-name">' + escHtml(title) + '</div><div class="sp-detail">' + escHtml(detail) + '</div></div><div class="demo-mode-shell"><div class="demo-mode-toggle"><button class="demo-mode-btn ' + (demoView === 'patient' ? 'active' : '') + '" onclick="setDemoView(\'patient\')">Patient</button><button class="demo-mode-btn ' + (demoView === 'caregiver' ? 'active' : '') + '" onclick="setDemoView(\'caregiver\')">Caregiver</button></div><div class="demo-mode-note">Both views read from the same sample lung cancer record.</div></div></div>';
  }

  function renderDemoNavigation() {
    const demoView = getDemoView();
    const activePage = normalizeDemoPage(typeof currentPage === 'string' ? currentPage : 'dashboard', demoView);
    const navItems = getDemoNavItems(demoView);
    const primaryPages = DEMO_MOBILE_PRIMARY[demoView] || DEMO_MOBILE_PRIMARY.patient;
    const primaryItems = primaryPages
      .map((page) => navItems.find((item) => item.page === page))
      .filter(Boolean);
    const moreItems = navItems.filter((item) => !primaryPages.includes(item.page));
    const sidebarNav = $('sidebar-nav');
    const mobileNavItems = document.querySelector('.mobile-nav-items');
    const moreSheet = $('more-sheet');
    if (sidebarNav) {
      sidebarNav.innerHTML = navItems.map((item) => (
        '<li role="none"><a href="#" data-page="' + escHtml(item.page) + '" class="' + (item.page === activePage ? 'active' : '') + '" role="menuitem" tabindex="0" aria-label="' + escHtml(item.label) + '" onclick="navigate(\'' + item.page + '\');return false;"><span class="nav-icon" aria-hidden="true">' + escHtml(item.icon) + '</span> ' + escHtml(item.label) + '</a></li>'
      )).join('');
    }
    if (mobileNavItems) {
      mobileNavItems.innerHTML = primaryItems.map((item) => (
        '<button class="mobile-nav-item ' + (item.page === activePage ? 'active' : '') + '" data-page="' + escHtml(item.page) + '" aria-label="' + escHtml(item.label) + '" onclick="navigate(\'' + item.page + '\')"><span class="mob-icon" aria-hidden="true">' + escHtml(item.icon) + '</span>' + escHtml(item.label) + '</button>'
      )).join('') + '<button class="mobile-nav-item" data-mob="more" aria-label="More options" onclick="toggleMoreSheet()"><span class="mob-icon" aria-hidden="true">⋯</span>More</button>';
    }
    if (moreSheet) {
      moreSheet.innerHTML = '<div class="more-sheet-handle"></div>' + moreItems.map((item) => (
        '<a href="#" data-page="' + escHtml(item.page) + '" role="menuitem" tabindex="0" aria-label="' + escHtml(item.label) + '" onclick="navigate(\'' + item.page + '\');return false;"><span class="nav-icon" aria-hidden="true">' + escHtml(item.icon) + '</span> ' + escHtml(item.label) + '</a>'
      )).join('');
    }
  }

  window.setDemoView = function setDemoViewLaunch(view) {
    const nextView = String(view || '').toLowerCase() === 'caregiver' ? 'caregiver' : 'patient';
    localStorage.setItem(DEMO_VIEW_KEY, nextView);
    renderDemoSidebarCard();
    renderDemoNavigation();
    if (typeof window.closeCheckin === 'function') window.closeCheckin();
    const nextPage = 'dashboard';
    if (typeof window.navigate === 'function') window.navigate(nextPage);
    else rerenderCurrentPage();
  };

  window.resetDemoData = function resetDemoDataLaunch() {
    seedDemoWorkspace(true);
    renderDemoSidebarCard();
    renderDemoNavigation();
    rerenderCurrentPage();
  };

  function safeParse(value, fallback) {
    if (value == null || value === '') return fallback;
    try {
      const parsed = JSON.parse(value);
      return parsed == null ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function mean(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function std(values) {
    if (!values.length) return 0;
    const avg = mean(values);
    return Math.sqrt(mean(values.map((value) => (value - avg) * (value - avg))));
  }

  function median(values) {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function dataUrlToTextStatus(message) {
    return '<p class="text-sm text-sec">' + escHtml(message) + '</p>';
  }

  function getPrivacySettings() {
    return safeParse(localStorage.getItem(PRIVACY_SETTINGS_KEY), {
      remoteAI: false,
      allowRemotePHI: false
    });
  }

  function savePrivacySettings(update) {
    const next = { ...getPrivacySettings(), ...(update || {}) };
    localStorage.setItem(PRIVACY_SETTINGS_KEY, JSON.stringify(next));
    return next;
  }

  function getConfiguredOpenRouterKey() {
    return String(
      localStorage.getItem('respira_gemini_key')
      || localStorage.getItem('respira_openrouter_key')
      || LOCAL_AI_CONFIG.GEMINI_API_KEY
      || LOCAL_AI_CONFIG.OPENROUTER_KEY
      || ''
    ).trim();
  }

  function getConfiguredOpenRouterBase() {
    return String(
      localStorage.getItem(GEMINI_BASE_KEY)
      || localStorage.getItem(OPENROUTER_BASE_KEY)
      || LOCAL_AI_CONFIG.GEMINI_API_BASE
      || LOCAL_AI_CONFIG.OPENROUTER_BASE
      || 'https://generativelanguage.googleapis.com/v1beta'
    ).replace(/\/$/, '');
  }

  function getConfiguredOpenRouterModel() {
    return String(
      localStorage.getItem(GEMINI_MODEL_KEY)
      || localStorage.getItem(OPENROUTER_MODEL_KEY)
      || LOCAL_AI_CONFIG.GEMINI_MODEL
      || LOCAL_AI_CONFIG.OPENROUTER_MODEL
      || 'gemma-4-31b-it'
    ).trim();
  }

  function applyLocalAIConfig() {
    const key = String(LOCAL_AI_CONFIG.GEMINI_API_KEY || LOCAL_AI_CONFIG.OPENROUTER_KEY || '').trim();
    const base = String(LOCAL_AI_CONFIG.GEMINI_API_BASE || LOCAL_AI_CONFIG.OPENROUTER_BASE || '').trim();
    const model = String(LOCAL_AI_CONFIG.GEMINI_MODEL || LOCAL_AI_CONFIG.OPENROUTER_MODEL || '').trim();
    if (!key) return;
    localStorage.setItem('respira_gemini_key', key);
    localStorage.setItem('respira_openrouter_key', key);
    if (base) {
      localStorage.setItem(GEMINI_BASE_KEY, base);
      localStorage.setItem(OPENROUTER_BASE_KEY, base);
    }
    if (model) {
      localStorage.setItem(GEMINI_MODEL_KEY, model);
      localStorage.setItem(OPENROUTER_MODEL_KEY, model);
    }
    savePrivacySettings({ remoteAI: true });
  }

  function scanFeaturesEnabled() {
    return false;
  }

  function purgeScanDataForPrivacy() {
    if (scanFeaturesEnabled()) return;
    const patient = getPatient() || {};
    let patientChanged = false;
    if (patient.ctScanDate) {
      patient.ctScanDate = '';
      patientChanged = true;
    }
    if (patientChanged) localStorage.setItem('respira_patient', JSON.stringify(patient));

    const documents = getDocumentRecords();
    const cleanedDocuments = documents.map((record) => ({
      ...record,
      scanEntry: null,
      timelineNotes: Array.isArray(record.timelineNotes)
        ? record.timelineNotes.filter((note) => String(note && note.type || '').toLowerCase() !== 'scan')
        : []
    }));
    const docsChanged = cleanedDocuments.length !== documents.length || cleanedDocuments.some((record, index) => {
      const original = documents[index] || {};
      return Boolean(original.scanEntry) || (Array.isArray(original.timelineNotes) && record.timelineNotes.length !== original.timelineNotes.length);
    });
    if (docsChanged) saveDocumentRecords(cleanedDocuments);

    const notes = safeParse(localStorage.getItem('respira_notes'), []);
    const cleanedNotes = Array.isArray(notes) ? notes.filter((note) => String(note && note.type || '').toLowerCase() !== 'scan') : [];
    if (cleanedNotes.length !== notes.length) saveTimelineNotesSafely(cleanedNotes);
    if (localStorage.getItem('respira_scans')) localStorage.removeItem('respira_scans');
  }

  function hideScanNavigation() {
    document.querySelectorAll('[data-page="scans"]').forEach((node) => {
      const row = node.closest('li');
      if (row) row.remove();
      else node.remove();
    });
  }

  function stripModelThoughtBlocks(text) {
    return String(text || '')
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/```(?:json|text)?/gi, '')
      .replace(/```/g, '')
      .trim();
  }

  function isGoogleGenerativeBase(baseUrl) {
    return /generativelanguage\.googleapis\.com/i.test(String(baseUrl || ''));
  }

  function normalizeGoogleGenerativeBase(baseUrl) {
    return String(baseUrl || '')
      .replace(/\/openai\/?$/i, '')
      .replace(/\/$/, '');
  }

  function buildGeminiParts(content) {
    if (Array.isArray(content)) {
      return content.map((part) => {
        if (!part || typeof part !== 'object') return null;
        if (part.type === 'text') return { text: String(part.text || '') };
        if (part.type === 'image_url' && part.image_url && part.image_url.url) {
          const match = String(part.image_url.url).match(/^data:([^;]+);base64,(.+)$/);
          if (!match) return null;
          return {
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          };
        }
        return null;
      }).filter(Boolean);
    }
    const text = String(content || '').trim();
    return text ? [{ text }] : [];
  }

  function extractGeminiText(candidate) {
    const parts = candidate && candidate.content && Array.isArray(candidate.content.parts) ? candidate.content.parts : [];
    const allTexts = parts
      .map((part) => typeof part.text === 'string' ? part.text.trim() : '')
      .filter(Boolean);
    const visibleTexts = parts
      .filter((part) => !part.thought && typeof part.text === 'string' && part.text.trim())
      .map((part) => part.text.trim());
    const cleanedText = stripModelThoughtBlocks(visibleTexts.join('\n').trim() || (allTexts.length ? allTexts[allTexts.length - 1] : ''));
    return {
      rawText: allTexts.join('\n').trim(),
      cleanedText
    };
  }

  function cleanMedicalFieldValue(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s:;,.-]+/, '')
      .replace(/[\s:;,.-]+$/, '')
      .replace(/\b(?:dob|date of birth|mrn|patient id|member id)\b.*$/i, '')
      .trim();
  }

  function finalizeParsedMedicalData(parsed) {
    const next = sanitizeParsedMedicalData(parsed || {});
    next.name = titleCaseWords(cleanMedicalFieldValue(next.name).replace(/[-–—]\s*$/, ''));
    next.histology = normalizeHistologyValue(cleanMedicalFieldValue(next.histology));
    next.oncologistName = titleCaseWords(cleanMedicalFieldValue(next.oncologistName));
    next.oncologistContact = normalizePhone(next.oncologistContact || '');
    next.careSite = titleCaseWords(cleanMedicalFieldValue(next.careSite));
    next.cycleSchedule = cleanMedicalFieldValue(next.cycleSchedule).replace(/^q\s*(\d+\s*(?:days|weeks))$/i, 'Every $1');
    next.treatmentProtocol = cleanMedicalFieldValue(next.treatmentProtocol);
    next.treatmentDrugs = uniqueStrings(
      (Array.isArray(next.treatmentDrugs) ? next.treatmentDrugs : [next.treatmentDrugs])
        .map((value) => cleanMedicalFieldValue(value).replace(/\([^)]*\)/g, '').trim())
        .filter(Boolean)
    );
    if (!next.treatmentProtocol && next.treatmentDrugs.length) next.treatmentProtocol = next.treatmentDrugs.join(' + ');
    return next;
  }

  function saveOpenRouterConfig(baseUrl, modelName) {
    const nextBase = String(baseUrl || '').trim().replace(/\/$/, '');
    const nextModel = String(modelName || '').trim();
    if (nextBase) {
      localStorage.setItem(GEMINI_BASE_KEY, nextBase);
      localStorage.setItem(OPENROUTER_BASE_KEY, nextBase);
    } else {
      localStorage.removeItem(GEMINI_BASE_KEY);
      localStorage.removeItem(OPENROUTER_BASE_KEY);
    }
    if (nextModel) {
      localStorage.setItem(GEMINI_MODEL_KEY, nextModel);
      localStorage.setItem(OPENROUTER_MODEL_KEY, nextModel);
    } else {
      localStorage.removeItem(GEMINI_MODEL_KEY);
      localStorage.removeItem(OPENROUTER_MODEL_KEY);
    }
  }

  function remoteAIEnabled() {
    return Boolean(getConfiguredOpenRouterKey());
  }

  function getAuditLog() {
    return safeParse(localStorage.getItem(AUDIT_LOG_KEY), []);
  }

  function logAudit(event, detail) {
    const items = getAuditLog();
    items.unshift({
      id: Date.now() + Math.random(),
      event,
      detail: String(detail || ''),
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(items.slice(0, 150)));
  }

  function getAudioBaseline() {
    return safeParse(localStorage.getItem(AUDIO_BASELINE_KEY), { voice: null, cough: null });
  }

  function saveAudioBaseline(next) {
    localStorage.setItem(AUDIO_BASELINE_KEY, JSON.stringify({ ...getAudioBaseline(), ...(next || {}) }));
  }

  function getAudioTrendState() {
    const saved = safeParse(localStorage.getItem(AUDIO_TREND_KEY), null);
    if (saved) return saved;
    const baseline = getAudioBaseline().voice;
    const snapshot = baseline ? summarizeVoiceForTrend(baseline.features || baseline) : null;
    return {
      calibration_days: 14,
      calibration_pool: snapshot ? [snapshot] : [],
      baseline_mean: {},
      baseline_std: {},
      current_cusum_scores: { hnr_mean: 0, jitter_local: 0, shimmer_local: 0, mfcc_1: 0 },
      score_history: [],
      recording_history: [],
      consecutive_alert_days: 0,
      calibration_complete: false,
      days_recorded: snapshot ? 1 : 0,
      current_alert_level: snapshot ? 'CALIBRATING' : null
    };
  }

  function saveAudioTrendState(state) {
    localStorage.setItem(AUDIO_TREND_KEY, JSON.stringify(state));
  }

  function getHealthImportMeta() {
    return safeParse(localStorage.getItem(HEALTH_IMPORT_META_KEY), {
      lastImportedAt: '',
      source: '',
      daysImported: 0,
      recordCount: 0
    });
  }

  function saveHealthImportMeta(meta) {
    localStorage.setItem(HEALTH_IMPORT_META_KEY, JSON.stringify({ ...getHealthImportMeta(), ...(meta || {}) }));
  }

  window.getApiKey = function getApiKeyLaunch() {
    return getConfiguredOpenRouterKey();
  };

  async function requestModelResponse(messages, options) {
    try {
      const apiKey = window.getApiKey();
      if (!apiKey) return null;
      const opts = options || {};
      const baseUrl = getConfiguredOpenRouterBase();
      const modelName = getConfiguredOpenRouterModel();
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 30000) : null;
      if (isGoogleGenerativeBase(baseUrl)) {
        const systemMessage = messages.find((message) => message && message.role === 'system');
        const contents = messages
          .filter((message) => message && message.role !== 'system')
          .map((message) => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: buildGeminiParts(message.content)
          }))
          .filter((message) => message.parts.length);
        if (!contents.length) {
          if (timeoutId) clearTimeout(timeoutId);
          return null;
        }
        const payload = {
          contents,
          generationConfig: {
            temperature: opts.temperature == null ? 0.15 : opts.temperature,
            maxOutputTokens: opts.maxTokens || 1200
          }
        };
        const systemText = cleanMedicalFieldValue(systemMessage && systemMessage.content);
        if (systemText) payload.systemInstruction = { parts: [{ text: systemText }] };
        const response = await fetch(
          normalizeGoogleGenerativeBase(baseUrl) + '/models/' + encodeURIComponent(modelName) + ':generateContent?key=' + encodeURIComponent(apiKey),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller ? controller.signal : undefined,
            body: JSON.stringify(payload)
          }
        );
        if (timeoutId) clearTimeout(timeoutId);
        if (response.status === 429) return '__RATE_LIMITED__';
        if (!response.ok) return null;
        const data = await response.json();
        const candidate = data.candidates && data.candidates[0] ? data.candidates[0] : null;
        const text = extractGeminiText(candidate);
        return {
          rawText: text.rawText,
          cleanedText: text.cleanedText,
          finishReason: candidate ? candidate.finishReason : '',
          data
        };
      }
      const response = await fetch(baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
          'HTTP-Referer': window.location.href,
          'X-Title': 'Respira'
        },
        signal: controller ? controller.signal : undefined,
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: opts.temperature == null ? 0.15 : opts.temperature,
          max_tokens: opts.maxTokens || 1200
        })
      });
      if (timeoutId) clearTimeout(timeoutId);
      if (response.status === 429) return '__RATE_LIMITED__';
      if (!response.ok) return null;
      const data = await response.json();
      const rawText = data.choices && data.choices[0] && data.choices[0].message ? String(data.choices[0].message.content || '') : '';
      return {
        rawText,
        cleanedText: stripModelThoughtBlocks(rawText) || '',
        finishReason: data.choices && data.choices[0] ? data.choices[0].finish_reason : '',
        data
      };
    } catch (error) {
      return null;
    }
  };

  window.callAI = async function callAILaunch(prompt, imageBase64, mimeType, options) {
    const opts = options || {};
    const systemPrompt = String(opts.systemPrompt || 'Return only the final answer. Do not include chain-of-thought, <thought> tags, <thinking> tags, markdown fences, or any hidden reasoning. Keep the answer direct.');
    const userMessage = imageBase64 ? {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: 'data:' + (mimeType || 'image/jpeg') + ';base64,' + imageBase64 } },
        { type: 'text', text: prompt }
      ]
    } : { role: 'user', content: prompt };
    const response = await requestModelResponse([
      { role: 'system', content: systemPrompt },
      userMessage
    ], opts);
    if (response === '__RATE_LIMITED__') return '__RATE_LIMITED__';
    if (!response) return null;
    if (response.cleanedText) return response.cleanedText;
    if (!response.rawText || !/<thought>|<thinking>/i.test(response.rawText)) return null;
    const retryResponse = await requestModelResponse([
      { role: 'system', content: 'Respond with only the final answer. No <thought> tags. No reasoning. No markdown.' },
      imageBase64
        ? {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: 'data:' + (mimeType || 'image/jpeg') + ';base64,' + imageBase64 } },
              { type: 'text', text: 'Return only the answer.\n\n' + prompt }
            ]
          }
        : { role: 'user', content: 'Return only the answer.\n\n' + prompt }
    ], { ...opts, maxTokens: Math.min(Number(opts.maxTokens || 1200), 700), temperature: 0.1 });
    if (retryResponse === '__RATE_LIMITED__') return '__RATE_LIMITED__';
    return retryResponse && retryResponse.cleanedText ? retryResponse.cleanedText : null;
  };

  const scriptLoaders = {};

  function loadScriptOnce(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
    if (scriptLoaders[src]) return scriptLoaders[src];
    scriptLoaders[src] = new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = src;
      tag.async = true;
      tag.onload = () => resolve(globalName ? window[globalName] : true);
      tag.onerror = reject;
      document.head.appendChild(tag);
    });
    return scriptLoaders[src];
  }

  function ensureJSZip() {
    return loadScriptOnce('public/vendor/jszip.min.js', 'JSZip');
  }

  async function fileToDataUrl(file) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderDocumentProgress(statusEl, percent, title, detail) {
    if (!statusEl) return;
    const pct = clamp(Math.round(Number(percent || 0)), 0, 100);
    const stage = pct >= 100 ? 'Done' : pct >= 75 ? 'Step 4 of 4' : pct >= 50 ? 'Step 3 of 4' : pct >= 25 ? 'Step 2 of 4' : 'Step 1 of 4';
    statusEl.innerHTML = '<div class="document-progress"><div class="document-progress-head"><div><p class="text-sm text-bold">' + escHtml(title || 'Processing upload') + '</p><p class="text-xs text-light mt-4">' + escHtml(stage) + '</p>' + (detail ? '<p class="text-xs text-sec mt-4">' + escHtml(detail) + '</p>' : '') + '</div><span class="metric-chip">' + pct + '%</span></div><div class="document-progress-bar mt-12"><div class="document-progress-fill" style="width:' + pct + '%"></div></div></div>';
  }

  function splitDataUrl(dataUrl) {
    const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
    return match ? { mimeType: match[1], base64: match[2] } : { mimeType: 'image/png', base64: '' };
  }

  async function withTimeout(promise, timeoutMs, fallbackValue) {
    return await Promise.race([
      Promise.resolve(promise).catch(() => fallbackValue),
      new Promise((resolve) => setTimeout(() => resolve(fallbackValue), timeoutMs))
    ]);
  }

  async function requestRemoteVisionText(dataUrl) {
    if (!remoteAIEnabled() || !dataUrl) return '';
    const payload = splitDataUrl(dataUrl);
    if (!payload.base64) return '';
    const prompt = 'Read this medical document image and return only the visible text from the page. Preserve line breaks where possible. Do not summarize. Do not add bullets, markdown, explanations, or any text that is not on the page. Include dates, medications, clinician names, section headers, schedule details, scan findings, and comparison language even if some words are uncertain. If a word is partly unclear, return your best guess instead of skipping the line.';
    const response = await withTimeout(window.callAI(prompt, payload.base64, payload.mimeType), 22000, null);
    if (!response || response === '__RATE_LIMITED__') return '';
    return String(response).replace(/```(?:text)?|```/g, '').trim();
  }

  async function extractRemoteVisionText(dataUrl, statusEl, label, percent) {
    if (statusEl) renderDocumentProgress(statusEl, percent || 70, 'Reading with Gemma', 'Extracting visible text' + (label ? ' from ' + label : '') + '...');
    return await requestRemoteVisionText(dataUrl);
  }

  async function extractRemoteVisionFields(dataUrl, statusEl, label, percent) {
    if (!remoteAIEnabled() || !dataUrl) return null;
    if (statusEl) renderDocumentProgress(statusEl, percent || 66, 'Matching fields with Gemma', 'Turning the document image into profile fields' + (label ? ' from ' + label : '') + '...');
    const payload = splitDataUrl(dataUrl);
    if (!payload.base64) return null;
    const prompt = 'Return one valid minified JSON object only. No prose. No markdown. No thoughts. Read this medical document image and extract these keys exactly: name,cancerStage,histology,egfr,alk,ros1,pdl1_tps,treatmentProtocol,treatmentDrugs,cycleSchedule,oncologistName,oncologistContact,treatmentStartDate,diagnosisDate,nextInfusionDate,nextAppointmentDate,careSite. Use null if missing. treatmentDrugs must be an array of strings.';
    const response = await withTimeout(window.callAI(prompt, payload.base64, payload.mimeType, {
      maxTokens: 900,
      systemPrompt: 'You are extracting structured medical intake data from a document image. Return only one valid minified JSON object. No markdown. No thoughts.'
    }), 22000, null);
    if (!response || response === '__RATE_LIMITED__') return null;
    const match = String(response).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return finalizeParsedMedicalData(JSON.parse(match[0]));
    } catch (error) {
      return null;
    }
  }

  async function recognizeImageDataUrl(dataUrl, statusEl, label, percent) {
    if (remoteAIEnabled()) {
      return await extractRemoteVisionText(dataUrl, statusEl, label, percent || 64);
    }
    if (statusEl) renderDocumentProgress(statusEl, percent || 64, 'Gemma document reading is off', 'Enable Remote AI in Settings so scanned documents can be read.');
    return '';
  }

  async function renderPdfPreview(file, pageNumber) {
    if (!window.pdfjsLib) return null;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(pageNumber || 1);
    const viewport = page.getViewport({ scale: 1.35 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/png');
  }

  async function readPdfPagesWithGemma(file, statusEl, maxPages) {
    if (!window.pdfjsLib) return '';
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = Math.min(pdf.numPages, maxPages || 3);
    let text = '';
    for (let index = 1; index <= pages; index += 1) {
      const page = await pdf.getPage(index);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      text += '\n' + (await extractRemoteVisionText(canvas.toDataURL('image/png'), statusEl, 'page ' + index, 54 + Math.round((index / pages) * 18)));
    }
    return text.trim();
  }

  async function extractFileText(file, statusEl) {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage = /^image\//.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
    let text = '';
    let previewDataUrl = null;
    if (isPdf) {
      if (statusEl) statusEl.innerHTML = dataUrlToTextStatus('Reading PDF text...');
      text = (await extractPDFText(file)) || '';
      try {
        previewDataUrl = await renderPdfPreview(file, 1);
      } catch (error) {
        previewDataUrl = null;
      }
      if (text.replace(/\s+/g, '').length < 120) {
        text += '\n' + (await readPdfPagesWithGemma(file, statusEl, 3));
      }
    } else if (isImage) {
      previewDataUrl = await fileToDataUrl(file);
      text = await recognizeImageDataUrl(previewDataUrl, statusEl, file.name);
    } else if (/\.txt$/i.test(file.name)) {
      text = await file.text();
    }
    return { text: String(text || '').trim(), previewDataUrl, isPdf, isImage };
  }

  function normalizePhone(value) {
    const match = String(value || '').match(/(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
    return match ? match[1] : '';
  }

  function normalizeDateGuess(value) {
    if (!value) return '';
    const clean = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    const parsed = parseLocalDate(clean);
    return parsed ? toLocalDateString(parsed) : '';
  }

  function titleCaseWords(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((part) => /^[A-Z0-9.-]+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  function uniqueStrings(values) {
    const seen = new Set();
    return (values || [])
      .map((value) => titleCaseWords(String(value || '').trim()))
      .filter(Boolean)
      .filter((value) => {
        const key = value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function uniqueBy(values, keyFn) {
    const seen = new Set();
    return (values || []).filter((value) => {
      const key = String(keyFn(value));
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
      });
  }

  function hasMeaningfulValue(value) {
    if (Array.isArray(value)) return value.filter(Boolean).length > 0;
    if (value == null) return false;
    if (typeof value === 'number') return !Number.isNaN(value) && value !== 0;
    return String(value).trim() !== '';
  }

  function normalizeStageValue(value) {
    const raw = String(value || '').replace(/^stage\s+/i, '').trim();
    if (!raw) return '';
    const lead = raw.charAt(0);
    const romanMap = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
    const normalized = romanMap[lead] ? (romanMap[lead] + raw.slice(1)) : raw.toUpperCase();
    return 'Stage ' + normalized.toUpperCase();
  }

  function normalizeHistologyValue(value) {
    const raw = String(value || '').replace(/^[\s:,-]+/, '').trim();
    if (!raw) return '';
    if (/aden[a-z]{4,18}(?:oma|orma|inoma)/i.test(raw)) return 'Adenocarcinoma';
    if (/squam[a-z\s]{0,20}carcinoma/i.test(raw)) return 'Squamous cell carcinoma';
    if (/\bnsclc\b|non[-\s]?small cell/i.test(raw)) return 'Non-small cell lung cancer';
    if (/small cell/i.test(raw)) return 'Small cell lung cancer';
    return titleCaseWords(raw);
  }

  function normalizeMedicalOcrText(text) {
    let normalized = String(text || '').replace(/\r/g, '\n');
    normalized = normalized.replace(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})\s*[,.]?\s*(20\d{2,3})\b/gi, function fixMonthDate(match, month, day, year) {
      return month + ' ' + day + ', ' + String(year).slice(0, 4);
    });
    normalized = normalized
      .replace(/^(\s*)di[a-z]{3,12}\s+ute\s*[:\-]?\s*/gim, '$1Diagnosis Date: ')
      .replace(/^(\s*)his[a-z0-9]{3,12}\s*[,:\-]?\s*/gim, '$1Histology: ')
      .replace(/^(\s*)cancer\s+sage\s*[:\-]?\s*/gim, '$1Cancer Stage: ')
      .replace(/\bsage\s+([ivx]+[a-d]?|[1-4][a-d]?)/ig, 'Stage $1')
      .replace(/^(\s*)cyele\s+schedule\s*[:\-]?\s*/gim, '$1Cycle Schedule: ')
      .replace(/\bvery\s+(\d+\s+(?:days|weeks))\b/ig, 'every $1')
      .replace(/^(\s*)nextvist\s*[:\-]?\s*/gim, '$1Next Visit: ')
      .replace(/^(\s*)nextvisit\s*[:\-]?\s*/gim, '$1Next Visit: ')
      .replace(/^(\s*)nextinfusion\s*[:\-]?\s*/gim, '$1Next Infusion: ')
      .replace(/^(\s*)tecan\s*[:\-]?\s*/gim, '$1CT Scan: ')
      .replace(/^(\s*)ctscan\s*[:\-]?\s*/gim, '$1CT Scan: ')
      .replace(/^(\s*)treatment\s+(?=[A-Z])/gim, '$1Treatment: ')
      .replace(/^(\s*)oncologist\s+(?=Dr\.?\s*[A-Z])/gim, '$1Oncologist: ')
      .replace(/^(\s*)phone\s+(?=\d)/gim, '$1Phone: ')
      .replace(/\baden[a-z]{4,16}oma\b/ig, 'Adenocarcinoma');
    return normalized;
  }

  function mergeParsedMedicalData(primary, fallback) {
    const preferred = primary || {};
    const secondary = fallback || {};
    const keys = [
      'name',
      'cancerStage',
      'histology',
      'egfr',
      'alk',
      'ros1',
      'pdl1_tps',
      'treatmentProtocol',
      'treatmentDrugs',
      'cycleSchedule',
      'oncologistName',
      'oncologistContact',
      'treatmentStartDate',
      'nextInfusionDate',
      'ctScanDate',
      'nextAppointmentDate',
      'diagnosisDate',
      'careSite'
    ];
    const merged = { ...secondary, ...preferred };
    keys.forEach((key) => {
      if (hasMeaningfulValue(preferred[key])) merged[key] = preferred[key];
      else if (hasMeaningfulValue(secondary[key])) merged[key] = secondary[key];
    });
    if (!Array.isArray(merged.treatmentDrugs)) {
      merged.treatmentDrugs = hasMeaningfulValue(merged.treatmentDrugs) ? String(merged.treatmentDrugs).split(/,|;/).map((value) => value.trim()).filter(Boolean) : [];
    }
    return merged;
  }

  function sanitizeParsedMedicalData(parsed) {
    const next = { ...(parsed || {}) };
    if (next.cancerStage) next.cancerStage = normalizeStageValue(next.cancerStage);
    if (next.histology) next.histology = normalizeHistologyValue(next.histology);
    ['diagnosisDate', 'treatmentStartDate', 'nextInfusionDate', 'ctScanDate', 'nextAppointmentDate'].forEach((key) => {
      next[key] = normalizeDateGuess(next[key]) || '';
    });
    const now = parseLocalDate(todayStr());
    ['nextInfusionDate', 'ctScanDate', 'nextAppointmentDate'].forEach((key) => {
      const parsedDate = parseLocalDate(next[key]);
      if (parsedDate && now && parsedDate.getTime() < now.getTime() - (45 * 24 * 60 * 60 * 1000)) next[key] = '';
    });
    return next;
  }

  function extractDateFromLabeledLine(source, labelPattern) {
    const lines = String(source || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
    for (let index = 0; index < lines.length; index += 1) {
      const line = normalizeMedicalLineForParsing(lines[index]);
      if (!labelPattern.test(line)) continue;
      const found = launchExtractDates(line)[0];
      if (found) return found;
    }
    return '';
  }

  function normalizeMedicalLineForParsing(line) {
    return String(line || '')
      .replace(/\*\*/g, '')
      .replace(/^#{1,6}\s*/, '')
      .replace(/^\s*(?:[-*•]+|\d+[\).:-])\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractFirstMatchingLineValue(source, patterns) {
    const lines = String(source || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const rules = Array.isArray(patterns) ? patterns : [patterns];
    for (let index = 0; index < lines.length; index += 1) {
      const line = normalizeMedicalLineForParsing(lines[index]);
      for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
        const match = line.match(rules[ruleIndex]);
        if (match && match[1]) {
          return String(match[1])
            .replace(/^[`"'“”]+|[`"'“”]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        }
      }
    }
    return '';
  }

  function extractMedicationLineNames(source) {
    const lines = String(source || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const items = [];
    lines.forEach((line) => {
      const cleanedLine = normalizeMedicalLineForParsing(line);
      const inlineMatch = cleanedLine.match(/^(?:medication|medications|regimen drugs?|treatment drugs?|supportive medication|supportive medications|home meds?|active meds?)\s*[:\-]\s*(.+)$/i);
      if (!inlineMatch || !inlineMatch[1]) return;
      inlineMatch[1].split(/,|;|\/|\+| and /i).forEach((value) => {
        const cleaned = String(value || '')
          .replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|units?)\b.*$/i, '')
          .replace(/^\W+|\W+$/g, '')
          .trim();
        if (cleaned) items.push(cleaned);
      });
    });
    return uniqueStrings(items);
  }

  function reconcileParsedDatesWithText(parsed, text) {
    const next = sanitizeParsedMedicalData(parsed);
    const source = normalizeMedicalOcrText(text);
    if (!source) return next;
    const allDates = new Set(launchExtractDates(source));
    const labeledCandidates = {
      diagnosisDate: uniqueStrings([extractDateFromLabeledLine(source, /diagnosis(?: date)?|date of diagnosis|diag[a-z]{2,12}\s*(?:date|dte|dt|ute)/i)].filter(Boolean)),
      treatmentStartDate: uniqueStrings([extractDateFromLabeledLine(source, /treatment start|therapy start|start date|started treatment|begin(?:ning)? treatment|cycle 1 day 1/i)].filter(Boolean)),
      nextInfusionDate: uniqueStrings([extractDateFromLabeledLine(source, /next infusion|next treatment|follow[- ]?up infusion|nextinfusion/i)].filter(Boolean)),
      nextAppointmentDate: uniqueStrings([extractDateFromLabeledLine(source, /next (?:visit|appointment|follow[- ]?up)|nextvist|next vis[il]t|nextvisit/i)].filter(Boolean)),
      ctScanDate: uniqueStrings([extractDateFromLabeledLine(source, /next (?:ct|scan|pet\/ct|pet-ct)|ct scan(?: date)?|imaging(?: date)?|ctscan|tecan/i)].filter(Boolean))
    };
    ['diagnosisDate', 'treatmentStartDate', 'nextInfusionDate', 'nextAppointmentDate', 'ctScanDate'].forEach((key) => {
      const value = normalizeDateGuess(next[key]);
      if (!value) {
        next[key] = '';
        return;
      }
      const allowed = labeledCandidates[key];
      if (allowed.length ? !allowed.includes(value) : !allDates.has(value)) next[key] = '';
    });
    return next;
  }

  function parseMedicalDocumentTextEnhanced(text) {
    const rawSource = String(text || '');
    const source = normalizeMedicalOcrText(rawSource);
    const base = typeof parseMedicalDocumentText === 'function' ? parseMedicalDocumentText(source) : {};
    const out = { ...(base || {}) };
    const labeledName = extractFirstMatchingLineValue(source, [/^(?:patient name|patient|full name|name)\s*[:\-]\s*(.+)$/i]);
    const labeledHistology = extractFirstMatchingLineValue(source, [/^(?:histology|pathology|histologic(?:al)? type)\s*[:\-]\s*(.+)$/i]);
    const labeledStage = extractFirstMatchingLineValue(source, [/^(?:cancer stage|stage)\s*[:\-]\s*(.+)$/i]);
    const labeledTreatment = extractFirstMatchingLineValue(source, [/^(?:treatment plan|treatment|regimen|protocol|plan|therapy|current regimen|systemic therapy)\s*[:\-]\s*(.+)$/i]);
    const labeledSchedule = extractFirstMatchingLineValue(source, [/^(?:cycle schedule|schedule|frequency|cycle|interval)\s*[:\-]\s*(.+)$/i]);
    const labeledClinician = extractFirstMatchingLineValue(source, [/^(?:oncologist|clinician|provider|doctor|care team|physician)\s*[:\-]\s*(.+)$/i]);
    const labeledPhone = extractFirstMatchingLineValue(source, [/^(?:phone|clinic phone|contact|clinician phone|care team phone|office phone)\s*[:\-]\s*(.+)$/i]);
    const labeledCareSite = extractFirstMatchingLineValue(source, [/^(?:clinic\s*\/\s*hospital|clinic|hospital|care site|facility|center|practice|location)\s*[:\-]\s*(.+)$/i]);
    const labeledTreatmentStart = extractFirstMatchingLineValue(source, [/^(?:treatment start|therapy start|start date|started treatment|cycle 1 day 1)\s*[:\-]\s*(.+)$/i]);
    const labeledMedications = extractMedicationLineNames(source);
    const datePattern = '([A-Za-z]{3,9}\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}[/-]\\d{1,2}[/-](?:20)?\\d{2}|20\\d{2}[/-]\\d{1,2}[/-]\\d{1,2})';
    const diagnosisDate = source.match(new RegExp('\\b(?:diagnosis(?: date)?|date of diagnosis|diag[a-z]{2,12}\\s*(?:date|dte|dt|ute))\\s*[:\\-]?\\s*' + datePattern, 'i'));
    const treatmentStart = source.match(new RegExp('\\b(?:treatment start|therapy start|start date|started treatment|cycle 1 day 1)\\s*[:\\-]?\\s*' + datePattern, 'i'));
    const nextInfusion = source.match(new RegExp('\\b(?:next infusion|next treatment|follow[- ]?up infusion)\\s*[:\\-]?\\s*' + datePattern, 'i'));
    const nextVisit = source.match(new RegExp('\\b(?:next (?:visit|appointment|follow[- ]?up)|nextvist|next vis[il]t)\\s*[:\\-]?\\s*' + datePattern, 'i'));
    const nextCt = source.match(new RegExp('\\b(?:next (?:ct|scan|pet/ct|pet-ct)|ct scan(?: date)?|imaging(?: date)?|tecan)\\s*[:\\-]?\\s*' + datePattern, 'i'));
    const facility = source.match(/\b(?:facility|hospital|clinic|center)\s*[:\-]?\s*([^\n.]+)/i);
    const careSite = facility ? titleCaseWords(facility[1]) : '';
    const regimenLine = source.match(/\b(?:regimen|protocol|plan|therapy|treatment)\s*[:\-]?\s*([^\n]+)/i);
    const histologyLine = source.match(/\b(?:histology|histologic(?:al)? type|his[a-z0-9]{3,12})\s*[:\-]?\s*([^\n]+)/i);
    const stageMatch = source.match(/\b(?:cancer stage|cancer sage|stage|sage)\s*[:\-]?\s*(?:stage\s+)?([ivx]+[a-d]?|[1-4][a-d]?)/i);
    const cycleMatch = source.match(/\b(?:cycle schedule|schedule)\s*[:\-]?\s*((?:every|q)\s*\d+\s*(?:days|weeks)|every\s+\d+\s+(?:days|weeks)|every\s+three\s+weeks|\d{1,2}[- ]day cycle|\d{1,2}[- ]week cycle)/i);
    const drugs = extractMedicationNamesFromText(source);
    const regimenDrugs = extractMedicationNamesFromText(out.treatmentProtocol || labeledTreatment || '');
    out.name = titleCaseWords(out.name || labeledName || '');
    out.treatmentProtocol = titleCaseWords(out.treatmentProtocol || labeledTreatment || (regimenLine ? regimenLine[1] : ''));
    out.treatmentDrugs = uniqueStrings([]
      .concat(out.treatmentDrugs && out.treatmentDrugs.length ? out.treatmentDrugs : [])
      .concat(drugs)
      .concat(labeledMedications)
      .concat(regimenDrugs)).map(titleCaseWords);
    out.oncologistName = titleCaseWords(out.oncologistName || labeledClinician || '');
    out.oncologistContact = normalizePhone(out.oncologistContact || labeledPhone || source);
    out.histology = normalizeHistologyValue(out.histology || labeledHistology || (histologyLine ? histologyLine[1] : ''));
    out.cancerStage = normalizeStageValue(out.cancerStage || labeledStage || (stageMatch && stageMatch[1]));
    out.cycleSchedule = out.cycleSchedule || labeledSchedule || (cycleMatch ? cycleMatch[1].replace(/\s+/g, ' ').trim() : '');
    out.diagnosisDate = normalizeDateGuess(out.diagnosisDate || (diagnosisDate && diagnosisDate[1]) || extractDateFromLabeledLine(source, /diagnosis(?: date)?|date of diagnosis|diag[a-z]{2,12}\s*(?:date|dte|dt|ute)/i));
    out.treatmentStartDate = normalizeDateGuess(out.treatmentStartDate || labeledTreatmentStart || (treatmentStart && treatmentStart[1]) || extractDateFromLabeledLine(source, /treatment start|therapy start|start date|started treatment|cycle 1 day 1/i));
    out.nextInfusionDate = normalizeDateGuess(out.nextInfusionDate || (nextInfusion && nextInfusion[1]) || extractDateFromLabeledLine(source, /next infusion|next treatment|follow[- ]?up infusion/i));
    out.nextAppointmentDate = normalizeDateGuess(out.nextAppointmentDate || (nextVisit && nextVisit[1]) || extractDateFromLabeledLine(source, /next (?:visit|appointment|follow[- ]?up)|nextvist|next vis[il]t/i));
    out.ctScanDate = normalizeDateGuess(out.ctScanDate || (nextCt && nextCt[1]) || extractDateFromLabeledLine(source, /next (?:ct|scan|pet\/ct|pet-ct)|ct scan(?: date)?|imaging(?: date)?|tecan/i));
    out.careSite = titleCaseWords(out.careSite || labeledCareSite || careSite || '');
    const normalized = typeof normalizeParsedDocumentFields === 'function' ? normalizeParsedDocumentFields(out, source + '\n' + rawSource) : out;
    return finalizeParsedMedicalData(reconcileParsedDatesWithText(normalized, source + '\n' + rawSource));
  }

  function countParsedFieldsEnhanced(parsed) {
    return [
      parsed.name,
      parsed.cancerStage,
      parsed.histology,
      parsed.egfr,
      parsed.alk,
      parsed.ros1,
      parsed.pdl1_tps,
      parsed.treatmentProtocol,
      parsed.treatmentDrugs && parsed.treatmentDrugs.length,
      parsed.cycleSchedule,
      parsed.oncologistName,
      parsed.oncologistContact,
      parsed.treatmentStartDate,
      parsed.nextInfusionDate,
      parsed.nextAppointmentDate,
      parsed.careSite
    ].filter(Boolean).length;
  }

  function applyParsedPatientData(parsed) {
    const clean = finalizeParsedMedicalData(parsed);
    const patient = getPatient() || {};
    Object.assign(patient, {
      name: clean.name || patient.name || '',
      cancerStage: clean.cancerStage || patient.cancerStage || '',
      histology: clean.histology || patient.histology || '',
      treatmentProtocol: clean.treatmentProtocol || patient.treatmentProtocol || '',
      treatmentDrugs: clean.treatmentDrugs && clean.treatmentDrugs.length ? clean.treatmentDrugs : (patient.treatmentDrugs || []),
      cycleSchedule: clean.cycleSchedule || patient.cycleSchedule || '',
      oncologistName: clean.oncologistName || patient.oncologistName || '',
      oncologistContact: clean.oncologistContact || patient.oncologistContact || '',
      treatmentStartDate: clean.treatmentStartDate || patient.treatmentStartDate || '',
      nextInfusionDate: clean.nextInfusionDate || patient.nextInfusionDate || '',
      nextAppointmentDate: clean.nextAppointmentDate || patient.nextAppointmentDate || '',
      diagnosisDate: clean.diagnosisDate || patient.diagnosisDate || '',
      careSite: clean.careSite || patient.careSite || ''
    });
    patient.biomarkers = {
      ...(patient.biomarkers || {}),
      egfr: clean.egfr || patient.biomarkers?.egfr || '',
      alk: clean.alk || patient.biomarkers?.alk || '',
      ros1: clean.ros1 || patient.biomarkers?.ros1 || '',
      pdl1_tps: parseInt(clean.pdl1_tps, 10) || patient.biomarkers?.pdl1_tps || 0
    };
    localStorage.setItem('respira_patient', JSON.stringify(patient));
    if (clean.name) {
      const user = safeParse(localStorage.getItem('respira_user'), {});
      user.name = clean.name;
      localStorage.setItem('respira_user', JSON.stringify(user));
    }
  }

  async function maybeSupplementWithRemoteAI(parsed, text) {
    if (!remoteAIEnabled() || !text) return parsed;
    const fieldCount = countParsedFieldsEnhanced(parsed);
    const recoveredDates = [parsed.diagnosisDate, parsed.nextInfusionDate, parsed.nextAppointmentDate].filter(Boolean).length;
    const hasClinicalAnchor = Boolean(parsed.cancerStage || parsed.histology || parsed.treatmentProtocol);
    const hasCarePlanAnchor = Boolean((parsed.treatmentDrugs && parsed.treatmentDrugs.length) || parsed.cycleSchedule || parsed.oncologistName);
    const shouldSkip = fieldCount >= 7 && recoveredDates >= 2 && hasClinicalAnchor && hasCarePlanAnchor;
    if (shouldSkip) return parsed;
    const prompt = 'Return one valid minified JSON object only. No prose. No markdown. No thoughts. Extract lung cancer intake data from this text with keys name,cancerStage,histology,egfr,alk,ros1,pdl1_tps,treatmentProtocol,treatmentDrugs,cycleSchedule,oncologistName,oncologistContact,treatmentStartDate,diagnosisDate,nextInfusionDate,nextAppointmentDate,careSite. Use null if missing. treatmentDrugs must be an array of strings. Prefer exact dates and medication names from the text. Text: ' + text.slice(0, 3500);
    const response = await withTimeout(window.callAI(prompt), 18000, null);
    if (!response || response === '__RATE_LIMITED__') return parsed;
    const match = String(response).replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
    if (!match) return parsed;
    try {
      const aiParsed = finalizeParsedMedicalData(JSON.parse(match[0]));
      const merged = finalizeParsedMedicalData(mergeParsedMedicalData(parsed, aiParsed));
      const normalized = typeof normalizeParsedDocumentFields === 'function' ? finalizeParsedMedicalData(normalizeParsedDocumentFields(merged, normalizeMedicalOcrText(text))) : merged;
      return finalizeParsedMedicalData(reconcileParsedDatesWithText(normalized, text));
    } catch (error) {
      return parsed;
    }
  }

  window.handleOnboardFile = async function handleOnboardFileLaunch(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    const statusEl = $('onboard-upload-status');
    if (statusEl) statusEl.innerHTML = dataUrlToTextStatus('Preparing your upload...');
    const extracted = await extractFileText(file, statusEl);
    let parsed = parseMedicalDocumentTextEnhanced(extracted.text || '');
    parsed = await maybeSupplementWithRemoteAI(parsed, extracted.text || '');
    const found = countParsedFieldsEnhanced(parsed);
    if (found) {
      onboardData = { ...onboardData, ...parsed };
      applyParsedPatientData(parsed);
      if (statusEl) statusEl.innerHTML = '<p class="text-sm" style="color:var(--green)">Document read locally. Found ' + found + ' fields to review.</p>';
      logAudit('document_ingested', file.name);
    } else if (statusEl) {
      statusEl.innerHTML = '<p class="text-sm" style="color:var(--amber)">The upload opened, but there was not enough readable medical text to autofill yet. You can still complete the form below.</p>';
    }
    setTimeout(() => goOnboardStep(2), 600);
  };

  window.renderOnboardFields = function renderOnboardFieldsLaunch() {
    const patient = getPatient() || {};
    const merged = {
      name: onboardData.name || patient.name || '',
      cancerStage: onboardData.cancerStage || patient.cancerStage || '',
      histology: onboardData.histology || patient.histology || '',
      egfr: onboardData.egfr || patient.biomarkers?.egfr || '',
      alk: onboardData.alk || patient.biomarkers?.alk || '',
      ros1: onboardData.ros1 || patient.biomarkers?.ros1 || '',
      pdl1_tps: onboardData.pdl1_tps || patient.biomarkers?.pdl1_tps || '',
      treatmentProtocol: onboardData.treatmentProtocol || patient.treatmentProtocol || '',
      treatmentDrugs: Array.isArray(onboardData.treatmentDrugs) ? onboardData.treatmentDrugs.join(', ') : (onboardData.treatmentDrugs || (patient.treatmentDrugs || []).join(', ')),
      cycleSchedule: onboardData.cycleSchedule || patient.cycleSchedule || '',
      oncologistName: onboardData.oncologistName || patient.oncologistName || '',
      oncologistContact: onboardData.oncologistContact || patient.oncologistContact || '',
      treatmentStartDate: onboardData.treatmentStartDate || patient.treatmentStartDate || '',
      nextInfusionDate: onboardData.nextInfusionDate || patient.nextInfusionDate || '',
      nextAppointmentDate: onboardData.nextAppointmentDate || patient.nextAppointmentDate || '',
      diagnosisDate: onboardData.diagnosisDate || patient.diagnosisDate || '',
      careSite: onboardData.careSite || patient.careSite || ''
    };
    const fields = [
      ['name', 'Patient Name'], ['cancerStage', 'Cancer Stage'], ['histology', 'Histology'],
      ['egfr', 'EGFR'], ['alk', 'ALK'], ['ros1', 'ROS1'], ['pdl1_tps', 'PD-L1 TPS (%)'],
      ['treatmentProtocol', 'Treatment Plan'], ['treatmentDrugs', 'Medications in Plan'], ['cycleSchedule', 'Schedule'],
      ['oncologistName', 'Clinician'], ['oncologistContact', 'Clinic Phone'], ['careSite', 'Clinic / Hospital'],
      ['diagnosisDate', 'Diagnosis Date'], ['treatmentStartDate', 'Treatment Start'], ['nextInfusionDate', 'Next Infusion'],
      ['nextAppointmentDate', 'Next Visit']
    ];
    let html = '<div class="launch-hero"><div class="launch-badge">Autofill review</div><p class="text-sm text-sec mt-12">Respira now reads uploads locally first and lets you correct everything before anything is saved to your care timeline.</p></div>';
    fields.forEach(([key, label]) => {
      html += '<div class="flex justify-between items-center" style="padding:12px 0;border-bottom:1px solid var(--surface);gap:14px"><span class="text-sm text-sec" style="min-width:150px">' + label + '</span><input class="input" style="max-width:320px" data-field="' + key + '" value="' + escHtml(String(merged[key] || '')) + '"></div>';
    });
    $('onboard-fields').innerHTML = html;
  };

  window.confirmOnboardInfo = function confirmOnboardInfoLaunch() {
    const inputs = $('onboard-fields').querySelectorAll('input');
    inputs.forEach((input) => {
      onboardData[input.dataset.field] = input.value.trim();
    });
    applyParsedPatientData({
      ...onboardData,
      treatmentDrugs: String(onboardData.treatmentDrugs || '').split(/,|;/).map((value) => value.trim()).filter(Boolean)
    });
    const patient = getPatient() || {};
    if (!patient.cycleSchedule) patient.cycleSchedule = 'Every 21 days';
    localStorage.setItem('respira_patient', JSON.stringify(patient));
    goOnboardStep(3);
  };

  function normalizeStoredMedicationEntry(entry, parsed, text) {
    if (!entry) return null;
    if (typeof entry === 'string') {
      const name = titleCaseWords(entry);
      if (!name) return null;
      return {
        id: Date.now() + Math.random(),
        name,
        dose: '',
        frequency: parsed.cycleSchedule || '',
        daysSupply: inferDaysSupply(parsed.cycleSchedule || ''),
        startDate: parsed.treatmentStartDate || todayStr(),
        prescriber: parsed.oncologistName || '',
        pharmacy: '',
        source: 'document'
      };
    }
    return {
      id: entry.id || (Date.now() + Math.random()),
      name: titleCaseWords(entry.name || entry.drug || entry.medication || ''),
      dose: entry.dose || '',
      frequency: entry.frequency || parsed.cycleSchedule || '',
      daysSupply: Number(entry.daysSupply || 0) || inferDaysSupply(entry.frequency || parsed.cycleSchedule || ''),
      startDate: entry.startDate || parsed.treatmentStartDate || todayStr(),
      prescriber: entry.prescriber || parsed.oncologistName || '',
      pharmacy: entry.pharmacy || '',
      source: entry.source || 'document'
    };
  }

  function normalizeStoredTimelineNote(note, fileName) {
    if (!note) return null;
    if (typeof note === 'string') {
      const cleanText = cleanDocumentEventText(note);
      if (!cleanText) return null;
      const dateMatch = launchExtractDates(cleanText)[0];
      const date = normalizeDateGuess(dateMatch || todayStr());
      return {
        id: Date.now() + Math.random(),
        date,
        text: cleanText,
        label: launchTimelineLabelFromText(cleanText, fileName),
        type: launchTimelineTypeFromText(cleanText, fileName),
        sourceDoc: fileName
      };
    }
    const textValue = cleanDocumentEventText(note.text || note.detail || note.summary || '');
    if (!textValue) return null;
    const date = normalizeDateGuess(note.date || launchExtractDates(textValue)[0] || todayStr());
    return {
      id: note.id || (Date.now() + Math.random()),
      date,
      text: textValue,
      label: note.label || launchTimelineLabelFromText(textValue, fileName),
      type: note.type || launchTimelineTypeFromText(textValue, fileName),
      sourceDoc: note.sourceDoc || fileName
    };
  }

  function normalizeDocumentRecord(record) {
    const raw = record && typeof record === 'object' ? record : {};
    const parsed = raw.parsed && typeof raw.parsed === 'object' ? raw.parsed : {};
    const text = String(raw.text || raw.rawText || '').trim();
    const fileName = raw.fileName || raw.filename || raw.name || 'Uploaded document';
    const medications = uniqueBy(
      (Array.isArray(raw.medications) ? raw.medications : []).map((entry) => normalizeStoredMedicationEntry(entry, parsed, text)).filter(Boolean),
      (entry) => String(entry.name || '').toLowerCase()
    );
    const fallbackMeds = medications.length ? medications : launchMedicationRowsFromParsed(parsed, text);
    const timelineNotes = uniqueBy(
      (Array.isArray(raw.timelineNotes) ? raw.timelineNotes : [])
        .map((note) => normalizeStoredTimelineNote(note, fileName))
        .filter(Boolean),
      (note) => note.date + '|' + note.text.toLowerCase()
    );
    const fallbackTimeline = timelineNotes.length ? timelineNotes : launchDocumentTimelineNotes(parsed, text, fileName);
    let datesFound = Array.isArray(raw.datesFound) ? raw.datesFound.filter(Boolean) : [];
    if (!datesFound.length && Array.isArray(parsed.dates)) datesFound = parsed.dates.filter(Boolean);
    if (!datesFound.length && text) datesFound = launchExtractDates(text);
    return {
      id: raw.id || (Date.now() + Math.random()),
      context: raw.context || raw.source || 'upload',
      fileName,
      uploadedAt: raw.uploadedAt || raw.createdAt || new Date().toISOString(),
      text,
      textPreview: raw.textPreview || text.split(/\n+/).slice(0, 14).join('\n'),
      previewDataUrl: raw.previewDataUrl || raw.imagePreview || '',
      parsed,
      summary: raw.summary || launchBuildDocumentSummary(parsed, text, fileName),
      datesFound,
      medications: fallbackMeds,
      timelineNotes: fallbackTimeline,
      scanEntry: raw.scanEntry || null
    };
  }

  function getDocumentRecords() {
    return safeParse(localStorage.getItem(DOCUMENT_STORE_KEY), []).map(normalizeDocumentRecord);
  }

  function getLaunchMedications() {
    const stored = (typeof getMeds === 'function' ? getMeds() : [])
      .map((entry) => normalizeStoredMedicationEntry(entry, {}, ''))
      .filter(Boolean);
    if (stored.length) return uniqueBy(stored, (entry) => String(entry.name || '').toLowerCase());
    const fromDocuments = uniqueBy(
      getDocumentRecords()
        .flatMap((record) => record.medications || [])
        .map((entry) => normalizeStoredMedicationEntry(entry, {}, ''))
        .filter(Boolean),
      (entry) => String(entry.name || '').toLowerCase()
    );
    if (fromDocuments.length) {
      try {
        saveMedicationListSafely(fromDocuments);
      } catch (error) {
        console.warn('Respira medication storage fallback:', error);
      }
      return fromDocuments;
    }
    const patient = getPatient() || {};
    return uniqueStrings([...(patient.medications || []), ...(patient.treatmentDrugs || [])]).map((name) => normalizeStoredMedicationEntry(name, patient, ''));
  }

  function trimStoredText(value, limit) {
    const text = String(value || '').trim();
    if (!limit || text.length <= limit) return text;
    return text.slice(0, Math.max(0, limit - 32)).trim() + '\n[truncated for storage]';
  }

  function keepDataUrlWithinLimit(value, limit) {
    const dataUrl = String(value || '');
    if (!dataUrl) return '';
    return dataUrl.length <= limit ? dataUrl : '';
  }

  function sanitizeScanEntryForStorage(scanEntry, options) {
    if (!scanEntry || typeof scanEntry !== 'object') return null;
    const opts = options || {};
    return {
      ...scanEntry,
      summary: trimStoredText(scanEntry.summary, opts.summaryLimit || 1200),
      explanation: trimStoredText(scanEntry.explanation, opts.explanationLimit || 4000),
      rawText: trimStoredText(scanEntry.rawText, opts.rawTextLimit || 16000),
      findings: trimStoredText(scanEntry.findings, opts.findingsLimit || 2400),
      impression: trimStoredText(scanEntry.impression, opts.impressionLimit || 2400),
      comparison: trimStoredText(scanEntry.comparison, opts.comparisonLimit || 1800),
      recommendation: trimStoredText(scanEntry.recommendation, opts.recommendationLimit || 1200),
      previewDataUrl: keepDataUrlWithinLimit(scanEntry.previewDataUrl, opts.previewLimit || 220000),
      questions: Array.isArray(scanEntry.questions) ? scanEntry.questions.slice(0, 5).map((item) => trimStoredText(item, 220)) : []
    };
  }

  function sanitizeDocumentRecordForStorage(record, options) {
    if (!record || typeof record !== 'object') return null;
    const opts = options || {};
    const medications = Array.isArray(record.medications) ? record.medications.slice(0, opts.medicationLimit || 60).map((item) => ({
      ...item,
      name: trimStoredText(item && item.name, 80),
      dose: trimStoredText(item && item.dose, 80),
      frequency: trimStoredText(item && item.frequency, 120),
      prescriber: trimStoredText(item && item.prescriber, 120),
      pharmacy: trimStoredText(item && item.pharmacy, 120)
    })) : [];
    const timelineNotes = Array.isArray(record.timelineNotes) ? record.timelineNotes.slice(0, opts.timelineLimit || 40).map((item) => ({
      ...item,
      text: trimStoredText(item && item.text, 320),
      label: trimStoredText(item && item.label, 80),
      sourceDoc: trimStoredText(item && item.sourceDoc, 120)
    })) : [];
    return {
      ...record,
      fileName: trimStoredText(record.fileName, 180),
      text: trimStoredText(record.text, opts.textLimit || 24000),
      textPreview: trimStoredText(record.textPreview || record.text, opts.previewTextLimit || 2400),
      summary: trimStoredText(record.summary, opts.summaryLimit || 1200),
      previewDataUrl: keepDataUrlWithinLimit(record.previewDataUrl, opts.previewLimit || 220000),
      medications,
      timelineNotes,
      scanEntry: sanitizeScanEntryForStorage(record.scanEntry, {
        summaryLimit: 1200,
        explanationLimit: opts.scanExplanationLimit || 4000,
        rawTextLimit: opts.scanRawTextLimit || 16000,
        findingsLimit: 2400,
        impressionLimit: 2400,
        comparisonLimit: 1800,
        recommendationLimit: 1200,
        previewLimit: opts.scanPreviewLimit || 220000
      })
    };
  }

  function saveJsonVariants(key, variants) {
    let lastError = null;
    variants.some((variant) => {
      try {
        localStorage.setItem(key, JSON.stringify(variant));
        return true;
      } catch (error) {
        lastError = error;
        return false;
      }
    });
    if (lastError) throw lastError;
  }

  function saveMedicationListSafely(medications) {
    const list = Array.isArray(medications) ? medications : [];
    saveJsonVariants('respira_medications', [
      list.slice(0, 60),
      list.slice(0, 40).map((item) => ({
        ...item,
        name: trimStoredText(item && item.name, 80),
        dose: trimStoredText(item && item.dose, 80),
        frequency: trimStoredText(item && item.frequency, 120),
        prescriber: trimStoredText(item && item.prescriber, 120),
        pharmacy: trimStoredText(item && item.pharmacy, 120)
      })),
      list.slice(0, 20).map((item) => ({
        id: item && item.id,
        name: trimStoredText(item && item.name, 80),
        dose: trimStoredText(item && item.dose, 80),
        frequency: trimStoredText(item && item.frequency, 80),
        source: trimStoredText(item && item.source, 40)
      }))
    ]);
  }

  function saveTimelineNotesSafely(notes) {
    const list = Array.isArray(notes) ? notes : [];
    saveJsonVariants('respira_notes', [
      list.slice(0, 120),
      list.slice(0, 80).map((item) => ({
        ...item,
        text: trimStoredText(item && item.text, 320),
        label: trimStoredText(item && item.label, 80),
        sourceDoc: trimStoredText(item && item.sourceDoc, 120)
      })),
      list.slice(0, 40).map((item) => ({
        id: item && item.id,
        date: item && item.date,
        text: trimStoredText(item && item.text, 180),
        label: trimStoredText(item && item.label, 60),
        type: trimStoredText(item && item.type, 40),
        sourceDoc: trimStoredText(item && item.sourceDoc, 80)
      }))
    ]);
  }

  function saveScansSafely(scans) {
    const list = Array.isArray(scans) ? scans : [];
    const variants = [
      list.map((scan) => sanitizeScanEntryForStorage(scan, {
        summaryLimit: 1200,
        explanationLimit: 4000,
        rawTextLimit: 16000,
        findingsLimit: 2400,
        impressionLimit: 2400,
        comparisonLimit: 1800,
        recommendationLimit: 1200,
        previewLimit: 220000
      })),
      list.slice(0, 16).map((scan) => sanitizeScanEntryForStorage(scan, {
        summaryLimit: 900,
        explanationLimit: 2200,
        rawTextLimit: 8000,
        findingsLimit: 1400,
        impressionLimit: 1400,
        comparisonLimit: 900,
        recommendationLimit: 600,
        previewLimit: 0
      })),
      list.slice(0, 10).map((scan) => sanitizeScanEntryForStorage(scan, {
        summaryLimit: 600,
        explanationLimit: 1200,
        rawTextLimit: 3000,
        findingsLimit: 800,
        impressionLimit: 800,
        comparisonLimit: 500,
        recommendationLimit: 400,
        previewLimit: 0
      }))
    ];
    saveJsonVariants('respira_scans', variants.map((variant) => variant.filter(Boolean)));
  }

  function saveDocumentRecords(records) {
    const list = Array.isArray(records) ? records.slice(0, 30) : [];
    const variants = [
      list.map((record) => sanitizeDocumentRecordForStorage(record, {
        textLimit: 24000,
        previewTextLimit: 2400,
        summaryLimit: 1200,
        previewLimit: 220000,
        scanExplanationLimit: 4000,
        scanRawTextLimit: 16000,
        scanPreviewLimit: 220000
      })),
      list.slice(0, 20).map((record) => sanitizeDocumentRecordForStorage(record, {
        textLimit: 12000,
        previewTextLimit: 1600,
        summaryLimit: 900,
        previewLimit: 0,
        medicationLimit: 40,
        timelineLimit: 24,
        scanExplanationLimit: 2200,
        scanRawTextLimit: 8000,
        scanPreviewLimit: 0
      })),
      list.slice(0, 10).map((record) => sanitizeDocumentRecordForStorage(record, {
        textLimit: 5000,
        previewTextLimit: 900,
        summaryLimit: 600,
        previewLimit: 0,
        medicationLimit: 25,
        timelineLimit: 12,
        scanExplanationLimit: 1200,
        scanRawTextLimit: 3000,
        scanPreviewLimit: 0
      }))
    ];
    saveJsonVariants(DOCUMENT_STORE_KEY, variants.map((variant) => variant.filter(Boolean)));
  }

  function dedupeLaunchText(blocks) {
    const seen = new Set();
    return (blocks || [])
      .map((block) => String(block || '').trim())
      .filter(Boolean)
      .filter((block) => {
        const key = block.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .join('\n\n');
  }

  function rebuildPdfLinesLaunch(content) {
    const items = (content && content.items || [])
      .map((item) => ({
        str: String(item.str || '').trim(),
        x: Number(item.transform && item.transform[4] || 0),
        y: Number(item.transform && item.transform[5] || 0)
      }))
      .filter((item) => item.str);
    items.sort((a, b) => Math.abs(a.y - b.y) <= 3 ? a.x - b.x : b.y - a.y);
    const lines = [];
    items.forEach((item) => {
      const last = lines[lines.length - 1];
      if (!last || Math.abs(last.y - item.y) > 3) lines.push({ y: item.y, parts: [item.str] });
      else last.parts.push(item.str);
    });
    return lines.map((line) => line.parts.join(' ').replace(/\s+([,.;:])/g, '$1')).join('\n');
  }

  async function extractPdfTextAdvanced(file, statusEl, maxPages) {
    if (!window.pdfjsLib) return '';
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = Math.min(pdf.numPages, maxPages || 8);
    const blocks = [];
    for (let pageIndex = 1; pageIndex <= pages; pageIndex += 1) {
      if (statusEl) renderDocumentProgress(statusEl, 18 + Math.round((pageIndex / pages) * 20), 'Reading PDF text', 'Page ' + pageIndex + ' of ' + pages);
      const page = await pdf.getPage(pageIndex);
      blocks.push(rebuildPdfLinesLaunch(await page.getTextContent()));
    }
    return dedupeLaunchText(blocks);
  }

  async function extractPdfVisionFallback(file, statusEl, maxPages) {
    if (!remoteAIEnabled() || !window.pdfjsLib) return '';
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = Math.min(pdf.numPages, maxPages || 2);
    const blocks = [];
    for (let pageIndex = 1; pageIndex <= pages; pageIndex += 1) {
      if (statusEl) renderDocumentProgress(statusEl, 70 + Math.round((pageIndex / pages) * 18), 'Reading with Respira AI', 'Vision fallback on page ' + pageIndex + ' of ' + pages);
      const page = await pdf.getPage(pageIndex);
      const viewport = page.getViewport({ scale: 1.85 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      blocks.push(await extractRemoteVisionText(canvas.toDataURL('image/png'), statusEl, 'page ' + pageIndex, 72 + Math.round((pageIndex / pages) * 18)));
    }
    return dedupeLaunchText(blocks);
  }

  async function extractFileTextAdvanced(file, statusEl) {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage = /^image\//.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
    let previewDataUrl = null;
    let text = '';
    let gemmaText = '';
    if (isPdf) {
      text = await extractPdfTextAdvanced(file, statusEl, 8);
      try {
        previewDataUrl = await renderPdfPreview(file, 1);
      } catch (error) {
        previewDataUrl = null;
      }
      if (remoteAIEnabled()) {
        gemmaText = await extractPdfVisionFallback(file, statusEl, text.replace(/\s+/g, '').length < 300 ? 3 : 2);
      }
      text = dedupeLaunchText([text, gemmaText]);
    } else if (isImage) {
      previewDataUrl = await fileToDataUrl(file);
      if (remoteAIEnabled()) {
        gemmaText = await extractRemoteVisionText(previewDataUrl, statusEl, file.name, 46);
      } else if (statusEl) {
        renderDocumentProgress(statusEl, 46, 'Gemma document reading is off', 'Enable Remote AI in Settings to read this image into your profile.');
      }
      text = dedupeLaunchText([gemmaText]);
    } else if (/\.txt$/i.test(file.name)) {
      text = await file.text();
    }
    return { text: String(text || '').trim(), gemmaText: String(gemmaText || '').trim(), previewDataUrl, isPdf, isImage };
  }

  function extractMedicationNamesFromText(text) {
    const source = normalizeMedicalOcrText(text);
    const knownMatches = String(source)
      .match(/\b(pembrolizumab|keytruda|nivolumab|opdivo|durvalumab|imfinzi|atezolizumab|tecentriq|carboplatin|cisplatin|paclitaxel|nab-paclitaxel|abraxane|pemetrexed|alimta|gemcitabine|docetaxel|taxotere|osimertinib|tagrisso|alectinib|alecensa|erlotinib|tarceva|amivantamab|rybrevant|lazertinib|lorlatinib|brigatinib|crizotinib|albuterol|prednisone|dexamethasone|ondansetron|zofran|prochlorperazine|compazine|folic acid|vitamin b12|benzonatate|guaifenesin|acetaminophen|ibuprofen)\b/gi) || [];
    const inlineMatch = source.match(/\b(?:current medications?|medications?|home meds?|med list|active meds?)\s*[:\-]\s*([^\n]+)/i);
    const inlineNames = inlineMatch
      ? inlineMatch[1]
          .split(/,|;|\//)
          .map((value) => String(value || '').replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|units?)\b.*$/i, '').trim())
          .filter((value) => /^[A-Za-z][A-Za-z0-9 +.-]{1,40}$/.test(value))
      : [];
    return uniqueStrings([].concat(knownMatches, inlineNames));
  }

  function launchExtractDates(text) {
    const source = normalizeMedicalOcrText(text);
    return (String(source || '').match(/\b(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-](?:20)?\d{2}|(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{1,2},?\s+\d{4})\b/gi) || [])
      .map((value) => normalizeDateGuess(value))
      .filter(Boolean);
  }

  function inferDaysSupply(value) {
    const source = String(value || '').toLowerCase();
    const numeric = source.match(/(\d{1,2})\s*(?:day|days|week|weeks)/);
    if (numeric) {
      const count = Number(numeric[1] || 0);
      return source.includes('week') ? count * 7 : count;
    }
    if (source.includes('daily')) return 30;
    if (source.includes('weekly')) return 7;
    return 21;
  }

  function launchMedicationRowsFromParsed(parsed, text) {
    const names = uniqueStrings([...(parsed.treatmentDrugs || []), ...extractMedicationNamesFromText(text)]);
    return names.map((name) => ({
      id: Date.now() + Math.random(),
      name,
      dose: '',
      frequency: parsed.cycleSchedule || '',
      daysSupply: inferDaysSupply(parsed.cycleSchedule || ''),
      startDate: parsed.treatmentStartDate || todayStr(),
      prescriber: parsed.oncologistName || '',
      pharmacy: '',
      source: 'document'
    }));
  }

  function launchBuildDocumentSummary(parsed, text, fileName) {
    const parts = [];
    if (parsed.histology || parsed.cancerStage) parts.push((parsed.histology ? titleCaseWords(parsed.histology) : 'Lung cancer') + (parsed.cancerStage ? ' ' + parsed.cancerStage : ''));
    if (parsed.treatmentProtocol) parts.push('Plan: ' + parsed.treatmentProtocol + '.');
    if (parsed.treatmentDrugs && parsed.treatmentDrugs.length) parts.push('Medications: ' + parsed.treatmentDrugs.join(', ') + '.');
    if (/impression|findings|comparison/i.test(text)) {
      const radiology = parseRadiologyReport(text, fileName);
      if (radiology.summary) parts.push(radiology.summary);
    }
    if (parts.length) return parts.join(' ').trim();
    const sentences = String(text || '')
      .replace(/\s+/g, ' ')
      .split(/(?<=[.?!])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    const relevant = sentences.filter((sentence) => /(diagnos|treatment|therapy|regimen|medication|scan|impression|findings|appointment|visit|infusion|cycle|pathology|biopsy)/i.test(sentence));
    const summary = (relevant.length ? relevant : sentences).slice(0, 2).join(' ');
    return summary.slice(0, 240).trim();
  }

  function cleanDocumentEventText(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/^[-*:\s]+/, '')
      .trim();
  }

  function launchTimelineTypeFromText(text, fallbackContext) {
    const source = (String(text || '') + ' ' + String(fallbackContext || '')).toLowerCase();
    if (/scan|ct|pet\/ct|x-ray|mri|imaging|radiology|findings|impression/.test(source)) return 'scan';
    if (/alert|urgent|warning|watch/.test(source)) return 'alert';
    if (/diagnos|treatment|therapy|regimen|medication|infusion|cycle|appointment|follow[- ]?up|visit|surgery|radiation|biopsy|pathology/.test(source)) return 'treatment';
    return 'document';
  }

  function launchTimelineLabelFromText(text, fallbackContext) {
    const source = (String(text || '') + ' ' + String(fallbackContext || '')).toLowerCase();
    if (/diagnos/.test(source)) return 'Diagnosis update';
    if (/biopsy|pathology/.test(source)) return 'Pathology update';
    if (/medication|drug|prescribed/.test(source)) return 'Medication update';
    if (/infusion|cycle/.test(source)) return 'Treatment cycle';
    if (/appointment|follow[- ]?up|visit/.test(source)) return 'Clinic visit';
    if (/scan|ct|pet\/ct|x-ray|mri|imaging|radiology/.test(source)) return 'Scan update';
    if (/treatment|therapy|regimen|surgery|radiation/.test(source)) return 'Treatment update';
    return 'Document update';
  }

  function launchExtractDatedMentions(text, fileName) {
    const blocks = String(text || '')
      .replace(/\r/g, '\n')
      .split(/\n+/)
      .map(cleanDocumentEventText)
      .filter(Boolean);
    const mentions = [];
    const seen = new Set();
    blocks.forEach((block) => {
      const dates = launchExtractDates(block);
      if (!dates.length) return;
      if (block.length < 12) return;
      if (!/(diagnos|biopsy|pathology|treatment|therapy|regimen|infusion|cycle|appointment|follow[- ]?up|visit|scan|ct|pet\/ct|x-ray|mri|radiation|surgery|medication|prescribed|plan|started|begin|continue)/i.test(block)) return;
      dates.slice(0, 2).forEach((dateValue) => {
        const normalized = normalizeDateGuess(dateValue);
        const detail = cleanDocumentEventText(block).slice(0, 260);
        const key = normalized + '|' + detail.toLowerCase();
        if (!normalized || seen.has(key)) return;
        seen.add(key);
        mentions.push({
          id: Date.now() + Math.random(),
          date: normalized,
          text: detail,
          label: launchTimelineLabelFromText(detail, fileName),
          type: launchTimelineTypeFromText(detail, fileName),
          sourceDoc: fileName
        });
      });
    });
    return mentions.slice(0, 12);
  }

  function launchDocumentTimelineNotes(parsed, text, fileName) {
    const notes = [];
    const seen = new Set();
    const addNote = (date, textValue, label, type) => {
      const normalized = normalizeDateGuess(date);
      const cleanText = cleanDocumentEventText(textValue);
      const key = normalized + '|' + cleanText.toLowerCase();
      if (!normalized || !cleanText || seen.has(key)) return;
      seen.add(key);
      notes.push({
        id: Date.now() + Math.random(),
        date: normalized,
        text: cleanText,
        label: label || launchTimelineLabelFromText(cleanText, fileName),
        type: type || launchTimelineTypeFromText(cleanText, fileName),
        sourceDoc: fileName
      });
    };
    if (parsed.diagnosisDate) addNote(parsed.diagnosisDate, parsed.histology ? ('Diagnosis documented: ' + parsed.histology + (parsed.cancerStage ? ' ' + parsed.cancerStage : '')) : 'Diagnosis saved to the profile.', 'Diagnosis update', 'treatment');
    if (parsed.treatmentStartDate) addNote(parsed.treatmentStartDate, parsed.treatmentProtocol ? ('Treatment started: ' + parsed.treatmentProtocol) : 'Treatment start saved to the profile.', 'Treatment update', 'treatment');
    if (parsed.nextInfusionDate) addNote(parsed.nextInfusionDate, 'Next infusion saved to the profile.', 'Treatment cycle', 'treatment');
    if (parsed.nextAppointmentDate) addNote(parsed.nextAppointmentDate, 'Clinic follow-up saved to the profile.', 'Clinic visit', 'treatment');
    if (scanFeaturesEnabled() && parsed.ctScanDate) addNote(parsed.ctScanDate, 'Next scan date documented from uploaded file.', 'Scan update', 'scan');
    launchExtractDatedMentions(text, fileName).forEach((note) => addNote(note.date, note.text, note.label, note.type));
    if (!notes.length) addNote(todayStr(), launchBuildDocumentSummary(parsed, text, fileName) || 'Clinical details were applied to the profile.', 'Profile updated', 'document');
    return notes.sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
  }

  function launchStoreDocumentRecord(record) {
    const records = getDocumentRecords().filter((item) => String(item.id) !== String(record.id));
    records.unshift(record);
    saveDocumentRecords(records);
    applyParsedPatientData(record.parsed);
    const patient = getPatient() || {};
    const medicationNames = uniqueStrings((record.medications || []).map((medication) => medication.name));
    if (medicationNames.length) {
      patient.treatmentDrugs = uniqueStrings([...(patient.treatmentDrugs || []), ...medicationNames]);
      localStorage.setItem('respira_patient', JSON.stringify(patient));
    }
    const meds = getLaunchMedications();
    const medKeys = new Set(meds.map((med) => String(med.name || '').toLowerCase()));
    record.medications.forEach((medication) => {
      if (!medKeys.has(String(medication.name || '').toLowerCase())) meds.push(medication);
    });
    saveMedicationListSafely(meds);
    const notes = safeParse(localStorage.getItem('respira_notes'), []);
    const existingKeys = new Set(notes.map((note) => note.date + '|' + note.text));
    record.timelineNotes.forEach((note) => {
      const key = note.date + '|' + note.text;
      if (!existingKeys.has(key)) notes.push(note);
    });
    saveTimelineNotesSafely(notes);
    if (record.scanEntry) {
      const scans = getScans();
      const alreadyExists = scans.some((scan) => String(scan.filename || '').toLowerCase() === String(record.scanEntry.filename || '').toLowerCase() && String(scan.examDate || scan.date || '') === String(record.scanEntry.examDate || ''));
      if (!alreadyExists) {
        scans.push(record.scanEntry);
        saveScansSafely(scans);
      }
    }
  }

  function launchBuildDocumentRecord(file, extracted, context, parsed) {
    const text = String(extracted.text || '').trim();
    const summary = launchBuildDocumentSummary(parsed, text, file.name);
    const datesFound = launchExtractDates(text);
    const timelineNotes = launchDocumentTimelineNotes(parsed, text, file.name);
    const scanContext = scanFeaturesEnabled() && (context === 'scan' || /impression|findings|comparison|radiology|ct|pet\/ct|x-ray|mri|imaging/i.test(text + ' ' + file.name));
    const scanEntry = scanContext ? (() => {
      const radiology = parseRadiologyReport(text, file.name);
      return {
        id: Date.now() + Math.random(),
        date: todayStr(),
        examDate: radiology.examDate || parsed.ctScanDate || todayStr(),
        type: radiology.modality,
        modality: radiology.modality,
        filename: file.name,
        summary: radiology.summary || summary || 'Imaging uploaded.',
        explanation: radiology.summary || summary || 'Imaging uploaded.',
        rawText: text,
        previewDataUrl: extracted.previewDataUrl || '',
        findings: radiology.findings || '',
        impression: radiology.impression || '',
        comparison: radiology.comparison || '',
        recommendation: radiology.recommendation || '',
        trend: radiology.trend || (text ? 'stable' : 'stored'),
        questions: radiology.questions && radiology.questions.length ? radiology.questions : ['What does this scan or report say in plain language?', 'What changed compared with the last scan?', 'What should I watch for before the next visit?']
      };
    })() : null;
    return {
      id: Date.now() + Math.random(),
      context,
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      text,
      textPreview: text.split(/\n+/).slice(0, 14).join('\n'),
      previewDataUrl: extracted.previewDataUrl || '',
      parsed,
      summary,
      datesFound,
      medications: launchMedicationRowsFromParsed(parsed, text),
      timelineNotes,
      scanEntry
    };
  }

  window.handleOnboardFile = async function handleOnboardFileDocumentFirst(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    const statusEl = $('onboard-upload-status');
    let extracted = { text: '', previewDataUrl: '', isPdf: false, isImage: false };
    let parsed = {};
    let record = null;
    let found = 0;
    try {
      renderDocumentProgress(statusEl, 6, 'Preparing your upload', file.name);
      extracted = await extractFileTextAdvanced(file, statusEl);
      renderDocumentProgress(statusEl, 72, 'Applying document to your profile', 'Turning Gemma-read text into profile fields, medications, and timeline items.');
      parsed = parseMedicalDocumentTextEnhanced(extracted.text || '');
      if (extracted.previewDataUrl) {
        const imageParsed = await extractRemoteVisionFields(extracted.previewDataUrl, statusEl, file.name, 62);
        if (imageParsed) parsed = sanitizeParsedMedicalData(mergeParsedMedicalData(imageParsed, parsed));
      }
      parsed = await maybeSupplementWithRemoteAI(parsed, extracted.text || '');
      onboardData = { ...onboardData, ...parsed };
      found = countParsedFieldsEnhanced(parsed);
      if (found) applyParsedPatientData(parsed);
      renderDocumentProgress(statusEl, 84, 'Saving your upload', 'Writing the document summary, medications, and timeline items into your local profile.');
      record = launchBuildDocumentRecord(file, extracted, 'onboarding', parsed);
      try {
        launchStoreDocumentRecord(record);
      } catch (storageError) {
        console.warn('Respira document storage fallback:', storageError);
        if (parsed && Object.keys(parsed).length) applyParsedPatientData(parsed);
        logAudit('document_storage_trimmed', file.name + ': ' + String(storageError && storageError.message || storageError));
      }
      if (statusEl) {
        if (found) {
          renderDocumentProgress(statusEl, 100, 'Personalization ready', 'Found ' + found + ' fields' + (record ? ', ' + record.medications.length + ' medications, and ' + record.timelineNotes.length + ' timeline items' : '') + ' and matched them into the profile.');
        } else {
          renderDocumentProgress(statusEl, 100, 'Upload finished with limited text', 'Respira opened the upload but did not find enough readable medical text to autofill yet. You can still review and enter details on the next step.');
        }
      }
      logAudit('document_ingested', file.name);
    } catch (error) {
      console.error('Respira onboarding upload failed:', error);
      if (parsed && Object.keys(parsed).length) onboardData = { ...onboardData, ...parsed };
      if (statusEl) {
        renderDocumentProgress(statusEl, 100, 'Upload moved to review', 'Respira hit a storage or parsing limit while packaging the upload. Review the extracted fields on the next step and fill anything missing manually.');
      }
      logAudit('document_ingest_partial', file.name + ': ' + String(error && error.message || error));
    }
    setTimeout(() => goOnboardStep(2), 500);
  };

  window.renderOnboardFields = function renderOnboardFieldsDocumentFirst() {
    const patient = getPatient() || {};
    const latestDoc = getDocumentRecords()[0];
    const latestParsed = latestDoc && latestDoc.parsed ? latestDoc.parsed : {};
    const latestMedicationNames = latestDoc ? (latestDoc.medications || []).map((item) => item && item.name).filter(Boolean) : [];
    const merged = {
      name: onboardData.name || latestParsed.name || patient.name || '',
      cancerStage: onboardData.cancerStage || latestParsed.cancerStage || patient.cancerStage || '',
      histology: onboardData.histology || latestParsed.histology || patient.histology || '',
      egfr: onboardData.egfr || latestParsed.egfr || patient.biomarkers?.egfr || '',
      alk: onboardData.alk || latestParsed.alk || patient.biomarkers?.alk || '',
      ros1: onboardData.ros1 || latestParsed.ros1 || patient.biomarkers?.ros1 || '',
      pdl1_tps: onboardData.pdl1_tps || latestParsed.pdl1_tps || patient.biomarkers?.pdl1_tps || '',
      treatmentProtocol: onboardData.treatmentProtocol || latestParsed.treatmentProtocol || patient.treatmentProtocol || '',
      treatmentDrugs: Array.isArray(onboardData.treatmentDrugs)
        ? onboardData.treatmentDrugs.join(', ')
        : (onboardData.treatmentDrugs || (Array.isArray(latestParsed.treatmentDrugs) ? latestParsed.treatmentDrugs.join(', ') : latestParsed.treatmentDrugs) || latestMedicationNames.join(', ') || (patient.treatmentDrugs || []).join(', ')),
      cycleSchedule: onboardData.cycleSchedule || latestParsed.cycleSchedule || patient.cycleSchedule || '',
      oncologistName: onboardData.oncologistName || latestParsed.oncologistName || patient.oncologistName || '',
      oncologistContact: onboardData.oncologistContact || latestParsed.oncologistContact || patient.oncologistContact || '',
      treatmentStartDate: onboardData.treatmentStartDate || latestParsed.treatmentStartDate || patient.treatmentStartDate || '',
      nextInfusionDate: onboardData.nextInfusionDate || latestParsed.nextInfusionDate || patient.nextInfusionDate || '',
      nextAppointmentDate: onboardData.nextAppointmentDate || latestParsed.nextAppointmentDate || patient.nextAppointmentDate || '',
      diagnosisDate: onboardData.diagnosisDate || latestParsed.diagnosisDate || patient.diagnosisDate || '',
      careSite: onboardData.careSite || latestParsed.careSite || patient.careSite || ''
    };
    const fields = [
      ['name', 'Patient Name'], ['cancerStage', 'Cancer Stage'], ['histology', 'Histology'],
      ['egfr', 'EGFR'], ['alk', 'ALK'], ['ros1', 'ROS1'], ['pdl1_tps', 'PD-L1 TPS (%)'],
      ['treatmentProtocol', 'Treatment Plan'], ['treatmentDrugs', 'Medications in Plan'], ['cycleSchedule', 'Schedule'],
      ['oncologistName', 'Clinician'], ['oncologistContact', 'Clinic Phone'], ['careSite', 'Clinic / Hospital'],
      ['diagnosisDate', 'Diagnosis Date'], ['treatmentStartDate', 'Treatment Start'], ['nextInfusionDate', 'Next Infusion'],
      ['nextAppointmentDate', 'Next Visit']
    ];
    const autofillCount = fields.filter(([key]) => String(merged[key] || '').trim()).length;
    let html = '<div class="launch-hero"><div class="launch-badge">Document-first review</div><p class="text-sm text-sec mt-12">Everything below was matched into the profile first. Correct anything that needs cleanup before saving.</p></div>';
    if (latestDoc) {
      html += '<div class="document-review-card"><div class="document-review-header"><div><p class="text-bold">Autofill summary</p><p class="text-xs text-light mt-4">' + escHtml(latestDoc.summary || 'Clinical details were matched to the profile.') + '</p></div><span class="metric-chip">' + escHtml(String(latestDoc.medications.length)) + ' meds</span></div><div class="document-pill-row mt-16"><span class="document-pill">' + escHtml(String(autofillCount)) + ' fields ready</span><span class="document-pill">' + escHtml(String(latestDoc.timelineNotes.length)) + ' timeline items</span><span class="document-pill">' + escHtml(String(launchExtractDates(latestDoc.text || '').length)) + ' dates found</span></div></div>';
    }
    html += '<div class="document-field-grid">';
    fields.forEach(([key, label]) => {
      html += '<label class="document-field"><span>' + escHtml(label) + '</span><input class="input" data-field="' + key + '" value="' + escHtml(String(merged[key] || '')) + '"></label>';
    });
    html += '</div>';
    $('onboard-fields').innerHTML = html;
  };

  window.confirmOnboardInfo = function confirmOnboardInfoDocumentFirst() {
    const inputs = $('onboard-fields').querySelectorAll('input[data-field]');
    inputs.forEach((input) => {
      onboardData[input.dataset.field] = input.value.trim();
    });
    applyParsedPatientData({
      ...onboardData,
      treatmentDrugs: String(onboardData.treatmentDrugs || '').split(/,|;/).map((value) => value.trim()).filter(Boolean)
    });
    const patient = getPatient() || {};
    if (!patient.cycleSchedule) patient.cycleSchedule = 'Every 21 days';
    localStorage.setItem('respira_patient', JSON.stringify(patient));
    goOnboardStep(3);
  };

  function parseAppleHealthXml(xmlText) {
    const xml = new DOMParser().parseFromString(String(xmlText || ''), 'text/xml');
    const records = Array.from(xml.querySelectorAll('Record'));
    const perDay = new Map();
    function ensureDay(date) {
      if (!perDay.has(date)) perDay.set(date, { date, hr: [], spo2: [], temp: [], weight: [], steps: 0, sleep: 0, respiratoryRate: [] });
      return perDay.get(date);
    }
    records.forEach((record) => {
      const type = record.getAttribute('type') || '';
      const unit = record.getAttribute('unit') || '';
      const raw = Number(record.getAttribute('value'));
      const startDate = record.getAttribute('startDate') || record.getAttribute('creationDate') || '';
      const endDate = record.getAttribute('endDate') || '';
      const day = normalizeDateGuess(startDate);
      if (!day) return;
      const bucket = ensureDay(day);
      if (type === 'HKQuantityTypeIdentifierRestingHeartRate' || type === 'HKQuantityTypeIdentifierHeartRate') {
        if (Number.isFinite(raw)) bucket.hr.push(raw);
      } else if (type === 'HKQuantityTypeIdentifierOxygenSaturation') {
        if (Number.isFinite(raw)) bucket.spo2.push(raw <= 1 ? raw * 100 : raw);
      } else if (type === 'HKQuantityTypeIdentifierStepCount') {
        if (Number.isFinite(raw)) bucket.steps += raw;
      } else if (type === 'HKQuantityTypeIdentifierBodyMass') {
        if (Number.isFinite(raw)) bucket.weight.push(unit === 'kg' ? raw * 2.20462 : raw);
      } else if (type === 'HKQuantityTypeIdentifierBodyTemperature' || type === 'HKQuantityTypeIdentifierBasalBodyTemperature') {
        if (Number.isFinite(raw)) bucket.temp.push(unit === 'degC' ? raw * 9 / 5 + 32 : raw);
      } else if (type === 'HKQuantityTypeIdentifierRespiratoryRate') {
        if (Number.isFinite(raw)) bucket.respiratoryRate.push(raw);
      } else if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
        const start = parseLocalDate(startDate);
        const end = parseLocalDate(endDate);
        if (start && end) bucket.sleep += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }
    });
    const entries = Array.from(perDay.values()).map((entry) => ({
      date: entry.date,
      hr: entry.hr.length ? Math.round(mean(entry.hr)) : '',
      spo2: entry.spo2.length ? Math.round(mean(entry.spo2)) : '',
      temp: entry.temp.length ? Math.round(mean(entry.temp) * 10) / 10 : '',
      weight: entry.weight.length ? Math.round(mean(entry.weight) * 10) / 10 : '',
      steps: entry.steps ? Math.round(entry.steps) : '',
      respiratoryRate: entry.respiratoryRate.length ? Math.round(mean(entry.respiratoryRate) * 10) / 10 : '',
      sleep: entry.sleep ? Math.round(entry.sleep * 10) / 10 : ''
    })).sort((a, b) => a.date.localeCompare(b.date));
    return { entries, recordCount: records.length };
  }

  async function extractAppleHealthXml(file) {
    if (/\.zip$/i.test(file.name)) {
      const JSZip = await ensureJSZip();
      const zip = await JSZip.loadAsync(file);
      const xmlEntry = Object.values(zip.files).find((entry) => /(^|\/)export\.xml$/i.test(entry.name));
      if (!xmlEntry) throw new Error('export.xml not found');
      return await xmlEntry.async('text');
    }
    return await file.text();
  }

  window.handleHealthImport = async function handleHealthImportLaunch(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    const resultEl = $('health-import-result');
    if (resultEl) resultEl.innerHTML = dataUrlToTextStatus('Processing ' + file.name + '...');
    try {
      const xmlText = await extractAppleHealthXml(file);
      const parsed = parseAppleHealthXml(xmlText);
      const existing = getVitals();
      const merged = existing.filter((entry) => !parsed.entries.some((next) => next.date === entry.date));
      parsed.entries.forEach((entry) => merged.push(entry));
      merged.sort((a, b) => a.date.localeCompare(b.date));
      localStorage.setItem('respira_vitals', JSON.stringify(merged));
      saveHealthImportMeta({
        lastImportedAt: new Date().toISOString(),
        source: file.name,
        daysImported: parsed.entries.length,
        recordCount: parsed.recordCount
      });
      if (resultEl) resultEl.innerHTML = '<p class="text-sm" style="color:var(--green)">Health data synced. Imported ' + parsed.entries.length + ' day(s) from ' + escHtml(file.name) + '.</p>';
      logAudit('health_import', file.name);
      if (typeof renderHealth === 'function') renderHealth();
    } catch (error) {
      if (resultEl) resultEl.innerHTML = '<p class="text-sm" style="color:var(--amber)">That file opened, but Respira could not find a valid Apple Health export inside it.</p>';
    }
  };

  window.renderHealth = function renderHealthLaunch() {
    if (typeof originalRenderHealth === 'function') originalRenderHealth();
    const meta = getHealthImportMeta();
    const vitals = getVitals();
    const banner = '<div class="health-sync-banner"><div class="launch-badge">Health sync</div><p class="text-sm text-sec mt-12">Apple Health imports now merge historical dates instead of only today, so reports and trends update automatically.</p><div class="sync-stat-grid"><div class="sync-stat"><div class="value">' + (meta.daysImported || 0) + '</div><div class="label">Days imported</div></div><div class="sync-stat"><div class="value">' + (meta.recordCount || 0) + '</div><div class="label">Records read</div></div><div class="sync-stat"><div class="value">' + (vitals.length ? formatDate(vitals[vitals.length - 1].date) : 'None') + '</div><div class="label">Latest vital date</div></div></div></div>';
    const page = $('page-health');
    if (page && !page.querySelector('.health-sync-banner')) page.insertAdjacentHTML('afterbegin', banner);
  };

  function getModalityFromText(text, filename) {
    const source = (text + ' ' + filename).toLowerCase();
    if (source.includes('pet/ct') || source.includes('pet ct')) return 'PET/CT';
    if (source.includes('ct')) return 'CT';
    if (source.includes('x-ray') || source.includes('radiograph')) return 'X-ray';
    if (source.includes('mri')) return 'MRI';
    return 'Imaging report';
  }

  function extractSection(text, label) {
    const regex = new RegExp(label + '\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*(?:Comparison|Findings|Impression|Recommendation|Recommendations|Conclusion)\\s*:|$)', 'i');
    const match = String(text || '').match(regex);
    return match ? match[1].replace(/\s+/g, ' ').trim() : '';
  }

  function simplifyImagingLanguage(text) {
    return String(text || '')
      .replace(/\bpleural effusion\b/gi, 'fluid around the lung')
      .replace(/\bmediastinal lymph nodes?\b/gi, 'lymph nodes in the center of the chest')
      .replace(/\batelectasis\b/gi, 'a small area that is not fully expanded')
      .replace(/\bground[- ]glass opacity\b/gi, 'a hazy area described as ground-glass change')
      .replace(/\bnodule\b/gi, 'spot')
      .replace(/\bmetastatic disease\b/gi, 'spread seen on imaging');
  }

  function parseRadiologyReport(text, filename) {
    const clean = String(text || '').replace(/\r/g, '');
    const impression = extractSection(clean, 'Impression');
    const findings = extractSection(clean, 'Findings');
    const comparison = extractSection(clean, 'Comparison');
    const recommendation = extractSection(clean, 'Recommendation') || extractSection(clean, 'Recommendations');
    const examDateMatch = clean.match(/\b(?:exam date|date of exam|study date)\s*[:\-]?\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-](?:20)?\d{2}|20\d{2}[/-]\d{1,2}[/-]\d{1,2})/i);
    const trendSource = (impression || findings).toLowerCase();
    let trend = 'stable';
    if (/\b(new|increase|larger|progress|worse|worsening)\b/.test(trendSource)) trend = 'worsened';
    else if (/\b(decrease|smaller|improved|resolving|resolved)\b/.test(trendSource)) trend = 'improved';
    else if (/\b(unchanged|stable|similar)\b/.test(trendSource)) trend = 'stable';
    const bullets = [];
    if (impression) bullets.push(simplifyImagingLanguage(impression));
    if (!impression && findings) bullets.push(simplifyImagingLanguage(findings.split('.').slice(0, 2).join('. ')));
    if (comparison) bullets.push('Comparison noted: ' + simplifyImagingLanguage(comparison));
    if (recommendation) bullets.push('Follow-up noted: ' + simplifyImagingLanguage(recommendation));
    const questions = [];
    if (comparison) questions.push('How does this compare with the last scan in plain language?');
    if (trend === 'worsened') questions.push('Which change matters most before the next visit?');
    if (/effusion|opacity|consolidation|atelectasis|airway/i.test(findings + ' ' + impression)) questions.push('Could any of these findings connect with cough or breathing symptoms?');
    if (!questions.length) questions.push('What should I watch for before the next imaging visit?');
    return {
      modality: getModalityFromText(clean, filename || ''),
      examDate: normalizeDateGuess(examDateMatch && examDateMatch[1]) || todayStr(),
      comparison,
      findings,
      impression,
      recommendation,
      trend,
      summary: bullets.join('\n\n'),
      questions
    };
  }

  function compareScanNarratives(first, second) {
    const older = parseLocalDate(first.examDate || first.date) <= parseLocalDate(second.examDate || second.date) ? first : second;
    const newer = older === first ? second : first;
    const trend = newer.trend || 'stable';
    const trendLine = trend === 'worsened'
      ? 'The newer report describes more change than the older one.'
      : trend === 'improved'
        ? 'The newer report sounds more reassuring than the older one.'
        : 'The newer report sounds broadly similar to the older one.';
    const changeLine = newer.impression
      ? 'Newest impression: ' + simplifyImagingLanguage(newer.impression)
      : 'Newest summary: ' + simplifyImagingLanguage(newer.summary || '');
    const questionLine = newer.questions && newer.questions.length ? 'Useful follow-up: ' + newer.questions[0] : 'Useful follow-up: Ask what matters most before the next scan.';
    return trendLine + '\n\n' + changeLine + '\n\n' + questionLine;
  }

  window.handleScanUpload = async function handleScanUploadLaunch(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    const statusEl = $('scan-upload-status');
    const explanationEl = $('scan-explanation');
    try {
      renderDocumentProgress(statusEl, 8, 'Reading the scan or report', file.name);
      const extracted = await extractFileTextAdvanced(file, statusEl);
      renderDocumentProgress(statusEl, 74, 'Summarizing the scan', 'Building the scan summary, timeline items, and profile updates from the uploaded text.');
      let patientParsed = parseMedicalDocumentTextEnhanced(extracted.text || '');
      patientParsed = await maybeSupplementWithRemoteAI(patientParsed, extracted.text || '');
      const record = launchBuildDocumentRecord(file, extracted, 'scan', patientParsed);
      renderDocumentProgress(statusEl, 86, 'Saving the scan', 'Writing the scan summary and linked timeline items into your local profile.');
      try {
        launchStoreDocumentRecord(record);
      } catch (storageError) {
        console.warn('Respira scan storage fallback:', storageError);
        if (patientParsed && Object.keys(patientParsed).length) applyParsedPatientData(patientParsed);
        logAudit('scan_storage_trimmed', file.name + ': ' + String(storageError && storageError.message || storageError));
      }
      const scans = getScans();
      const scan = scans.find((item) => String(item.filename || '').toLowerCase() === String(file.name || '').toLowerCase()) || record.scanEntry || null;
      logAudit('scan_ingested', file.name);
      renderScansPage();
      const freshStatus = $('scan-upload-status');
      const freshExplanation = $('scan-explanation');
      renderDocumentProgress(freshStatus, 100, 'Scan saved and summarized', scan && scan.summary ? scan.summary.slice(0, 160) : 'Respira saved the scan and linked it to the profile.');
      if (freshExplanation && scan) freshExplanation.innerHTML = '<div class="scan-section-card"><p class="text-sm" style="white-space:pre-line">' + escHtml(scan.summary || record.summary || 'Imaging uploaded.') + '</p></div>';
      if (freshExplanation && scan) freshExplanation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      console.error('Respira scan upload failed:', error);
      renderDocumentProgress(statusEl, 100, 'Scan moved to review', 'Respira could not package the full scan locally. Try a smaller file or upload the report PDF, then review the saved summary.');
      if (explanationEl) explanationEl.innerHTML = '';
      logAudit('scan_ingest_partial', file.name + ': ' + String(error && error.message || error));
    }
  };

  window.viewScan = function viewScanLaunch(id) {
    const scan = getScans().find((item) => String(item.id) === String(id));
    if (!scan) return;
    const questions = (scan.questions || []).map((question) => '<li>' + escHtml(question) + '</li>').join('');
    const html = '<div class="scan-upload-shell" style="padding:20px"><div class="flex justify-between items-center mb-12"><div><p class="section-title" style="margin:0">' + escHtml(scan.modality || 'Imaging') + '</p><p class="text-xs text-light mt-4">' + formatDate(scan.examDate || scan.date) + ' · ' + escHtml(scan.filename || '') + '</p></div><button class="btn btn-outline text-xs" onclick="this.closest(\'.scan-upload-shell\').remove()">Close</button></div><div class="scan-detail-grid">' + (scan.previewDataUrl ? '<div class="scan-thumb"><img src="' + scan.previewDataUrl + '" alt="Uploaded scan preview"></div>' : '<div class="scan-thumb">Preview unavailable</div>') + '<div class="scan-section-card"><p class="text-bold mb-8">Plain-language summary</p><p class="text-sm" style="white-space:pre-line">' + escHtml(scan.summary || scan.explanation || '') + '</p></div></div><div class="scan-detail-grid mt-16"><div class="scan-section-card"><p class="text-bold mb-8">Impression</p><p class="text-sm">' + escHtml(scan.impression || 'Not available') + '</p></div><div class="scan-section-card"><p class="text-bold mb-8">Findings</p><p class="text-sm">' + escHtml(scan.findings || 'Not available') + '</p></div></div>' + (questions ? '<div class="scan-section-card mt-16"><p class="text-bold mb-8">Questions to ask</p><ul class="text-sm" style="padding-left:18px">' + questions + '</ul></div>' : '') + '</div>';
    const explanationEl = $('scan-explanation');
    if (explanationEl) {
      explanationEl.innerHTML = html;
      explanationEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  window.deleteScan = function deleteScanLaunch(id) {
    if (!confirm('Delete this scan entry?')) return;
    saveScans(getScans().filter((item) => String(item.id) !== String(id)));
    renderScansPage();
  };

  window.compareScans = function compareScansLaunch() {
    const scans = getScans();
    const first = scans.find((item) => String(item.id) === String($('scan-compare-a') && $('scan-compare-a').value));
    const second = scans.find((item) => String(item.id) === String($('scan-compare-b') && $('scan-compare-b').value));
    if (!first || !second) return;
    const resultEl = $('scan-compare-result');
    if (!resultEl) return;
    resultEl.innerHTML = '<div class="scan-section-card"><p class="text-sm" style="white-space:pre-line">' + escHtml(compareScanNarratives(first, second)) + '</p></div>';
  };

  window.renderScansPage = function renderScansPageLaunch() {
    const scans = getScans().slice().sort((a, b) => (b.examDate || b.date).localeCompare(a.examDate || a.date));
    let html = '<h2 class="page-title">Scans</h2>';
    html += '<div class="scan-upload-shell mb-24" style="padding:22px"><div class="launch-badge">Scan reader</div><p class="text-sm text-sec mt-12">Upload a radiology PDF, report screenshot, or scan image. Respira reads report text locally, stores the image preview, and builds patient-friendly questions.</p><div class="upload-zone mt-16" onclick="document.getElementById(\'scan-file\').click()"><p>Drop a scan report or image here</p><p class="mt-4"><span class="browse">or click to browse</span></p><input type="file" id="scan-file" accept="image/*,.pdf,.txt" style="display:none" onchange="handleScanUpload(this)"></div><div id="scan-upload-status" class="mt-12"></div><div id="scan-explanation" class="mt-16"></div></div>';
    if (scans.length >= 2) {
      html += '<div class="card mb-24"><p class="section-title">Compare Two Scans</p><div class="grid-2"><div class="form-group"><label class="label">Earlier scan</label><select class="input" id="scan-compare-a">' + scans.slice().reverse().map((scan) => '<option value="' + scan.id + '">' + formatDate(scan.examDate || scan.date) + ' · ' + escHtml(scan.filename || scan.modality) + '</option>').join('') + '</select></div><div class="form-group"><label class="label">Later scan</label><select class="input" id="scan-compare-b">' + scans.map((scan) => '<option value="' + scan.id + '">' + formatDate(scan.examDate || scan.date) + ' · ' + escHtml(scan.filename || scan.modality) + '</option>').join('') + '</select></div></div><button class="btn btn-blue mt-8" onclick="compareScans()">Compare</button><div id="scan-compare-result" class="mt-16"></div></div>';
    }
    if (!scans.length) {
      html += '<div class="empty-state-card">No scan reports have been uploaded yet.</div>';
    } else {
      html += '<div class="scan-history-grid">';
      scans.forEach((scan) => {
        const trendTone = scan.trend === 'worsened' ? 'alert' : scan.trend === 'improved' ? 'warn' : '';
        html += '<div class="scan-card"><div class="scan-thumb">' + (scan.previewDataUrl ? '<img src="' + scan.previewDataUrl + '" alt="Scan preview">' : '<span>Preview pending</span>') + '</div><div class="scan-card-body"><div class="flex justify-between items-start gap-8"><div><p class="text-bold">' + escHtml(scan.modality || 'Imaging') + '</p><p class="text-xs text-light mt-4">' + formatDate(scan.examDate || scan.date) + '</p></div><span class="metric-chip ' + trendTone + '">' + escHtml(scan.trend || 'stored') + '</span></div><p class="text-sm text-sec mt-12" style="min-height:66px">' + escHtml(String(scan.summary || '').slice(0, 180)) + '</p><div class="flex gap-8 mt-16"><button class="btn btn-outline btn-sm" onclick="viewScan(' + scan.id + ')">View</button><button class="btn btn-red btn-sm" onclick="deleteScan(' + scan.id + ')">Delete</button></div></div></div>';
      });
      html += '</div>';
    }
    $('page-scans').innerHTML = html;
  };

  async function decodeBlobToSignal(blob) {
    const Context = window.AudioContext || window.webkitAudioContext;
    const audioContext = new Context();
    try {
      const buffer = await audioContext.decodeAudioData(await blob.arrayBuffer());
      const mono = audioContext.createBuffer(1, buffer.length, buffer.sampleRate);
      const monoData = mono.getChannelData(0);
      for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
        const source = buffer.getChannelData(channelIndex);
        for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
          monoData[sampleIndex] += source[sampleIndex] / buffer.numberOfChannels;
        }
      }
      if (mono.sampleRate === RV_SAMPLE_RATE) {
        return { signal: mono.getChannelData(0).slice(), sampleRate: mono.sampleRate };
      }
      const offline = new OfflineAudioContext(1, Math.ceil(mono.duration * RV_SAMPLE_RATE), RV_SAMPLE_RATE);
      const source = offline.createBufferSource();
      source.buffer = mono;
      source.connect(offline.destination);
      source.start(0);
      const rendered = await offline.startRendering();
      return { signal: rendered.getChannelData(0).slice(), sampleRate: rendered.sampleRate };
    } finally {
      audioContext.close().catch(() => null);
    }
  }

  function calculateRms(frame) {
    let total = 0;
    for (let index = 0; index < frame.length; index += 1) total += frame[index] * frame[index];
    return frame.length ? Math.sqrt(total / frame.length) : 0;
  }

  function voiceActivityDetect(signal, sampleRate, threshold) {
    const frameSize = Math.max(1, Math.floor(0.02 * sampleRate));
    const voiced = [];
    let voicedFrames = 0;
    let totalFrames = 0;
    for (let index = 0; index + frameSize <= signal.length; index += frameSize) {
      totalFrames += 1;
      const frame = signal.subarray(index, index + frameSize);
      if (calculateRms(frame) >= threshold) {
        voicedFrames += 1;
        for (let sampleIndex = 0; sampleIndex < frame.length; sampleIndex += 1) voiced.push(frame[sampleIndex]);
      }
    }
    return {
      voicedSignal: new Float32Array(voiced),
      voicedFrames,
      totalFrames,
      durationSeconds: voiced.length / sampleRate
    };
  }

  function trimToLoudestWindow(signal, sampleRate, seconds) {
    const windowSize = Math.min(signal.length, Math.max(256, Math.floor(sampleRate * seconds)));
    if (signal.length <= windowSize) return signal;
    let bestStart = 0;
    let bestEnergy = -Infinity;
    const hop = Math.max(128, Math.floor(windowSize / 5));
    for (let start = 0; start + windowSize <= signal.length; start += hop) {
      let energy = 0;
      for (let index = start; index < start + windowSize; index += 1) energy += signal[index] * signal[index];
      if (energy > bestEnergy) {
        bestEnergy = energy;
        bestStart = start;
      }
    }
    return signal.slice(bestStart, bestStart + windowSize);
  }

  function estimateF0Track(signal, sampleRate) {
    const frameSize = Math.floor(0.04 * sampleRate);
    const hopSize = Math.floor(0.02 * sampleRate);
    const minLag = Math.floor(sampleRate / 500);
    const maxLag = Math.floor(sampleRate / 75);
    const values = [];
    for (let index = 0; index + frameSize <= signal.length; index += hopSize) {
      const frame = signal.subarray(index, index + frameSize);
      if (calculateRms(frame) < 0.01) continue;
      let bestLag = 0;
      let best = -Infinity;
      for (let lag = minLag; lag <= maxLag; lag += 1) {
        let correlation = 0;
        for (let sampleIndex = 0; sampleIndex + lag < frame.length; sampleIndex += 1) {
          correlation += frame[sampleIndex] * frame[sampleIndex + lag];
        }
        if (correlation > best) {
          best = correlation;
          bestLag = lag;
        }
      }
      if (bestLag > 0) values.push(sampleRate / bestLag);
    }
    return {
      values,
      mean: mean(values),
      std: std(values),
      min: values.length ? Math.min.apply(null, values) : 0,
      max: values.length ? Math.max.apply(null, values) : 0
    };
  }

  function calculateHNR(signal, sampleRate) {
    const frameSize = Math.floor(0.025 * sampleRate);
    const hopSize = Math.floor(0.01 * sampleRate);
    const values = [];
    for (let index = 0; index + frameSize <= signal.length; index += hopSize) {
      const frame = signal.subarray(index, index + frameSize);
      if (calculateRms(frame) < 0.01) continue;
      const minLag = Math.floor(sampleRate / 500);
      const maxLag = Math.floor(sampleRate / 75);
      let zeroLag = 0;
      for (let sampleIndex = 0; sampleIndex < frame.length; sampleIndex += 1) zeroLag += frame[sampleIndex] * frame[sampleIndex];
      let bestLagValue = 0;
      for (let lag = minLag; lag <= maxLag; lag += 1) {
        let corr = 0;
        for (let sampleIndex = 0; sampleIndex + lag < frame.length; sampleIndex += 1) corr += frame[sampleIndex] * frame[sampleIndex + lag];
        if (corr > bestLagValue) bestLagValue = corr;
      }
      if (zeroLag > 0) values.push(10 * Math.log10(bestLagValue / Math.max(zeroLag - bestLagValue, 0.0001)));
    }
    return mean(values);
  }

  function calculateJitter(signal, sampleRate) {
    const minPeriod = Math.floor(sampleRate / 500);
    const maxPeriod = Math.floor(sampleRate / 75);
    const periods = [];
    let lastCrossing = -1;
    for (let index = 1; index < signal.length; index += 1) {
      if (signal[index - 1] < 0 && signal[index] >= 0) {
        if (lastCrossing >= 0) {
          const period = index - lastCrossing;
          if (period >= minPeriod && period <= maxPeriod) periods.push(period);
        }
        lastCrossing = index;
      }
    }
    if (periods.length < 3) return 0;
    let diffSum = 0;
    for (let index = 1; index < periods.length; index += 1) diffSum += Math.abs(periods[index] - periods[index - 1]);
    return (diffSum / (periods.length - 1)) / Math.max(mean(periods), 1) * 100;
  }

  function calculateShimmer(signal, sampleRate) {
    const frameSize = Math.floor(0.03 * sampleRate);
    const hopSize = Math.floor(0.015 * sampleRate);
    const amplitudes = [];
    for (let index = 0; index + frameSize <= signal.length; index += hopSize) {
      const frame = signal.subarray(index, index + frameSize);
      const rms = calculateRms(frame);
      if (rms >= 0.01) amplitudes.push(rms);
    }
    if (amplitudes.length < 3) return 0;
    let diffSum = 0;
    for (let index = 1; index < amplitudes.length; index += 1) diffSum += Math.abs(amplitudes[index] - amplitudes[index - 1]);
    return (diffSum / (amplitudes.length - 1)) / Math.max(mean(amplitudes), 0.0001) * 100;
  }

  function estimateSnr(fullSignal, voicedSignal) {
    const voicedRms = calculateRms(voicedSignal);
    const overallRms = calculateRms(fullSignal);
    const noise = Math.max(Math.pow(overallRms - voicedRms * 0.8, 2), 1e-6);
    return 10 * Math.log10(Math.max(voicedRms * voicedRms, 1e-6) / noise);
  }

  function buildDeltaFrames(frames) {
    if (frames.length < 2) return [];
    const deltas = [];
    for (let index = 1; index < frames.length; index += 1) {
      deltas.push(frames[index].map((value, coeffIndex) => value - frames[index - 1][coeffIndex]));
    }
    return deltas;
  }

  function meanVector(frames, length) {
    if (!frames.length) return Array.from({ length: length }, () => 0);
    const sums = Array.from({ length: length }, () => 0);
    frames.forEach((frame) => {
      frame.forEach((value, index) => {
        sums[index] += value;
      });
    });
    return sums.map((value) => value / frames.length);
  }

  function stdVector(frames, length) {
    if (!frames.length) return Array.from({ length: length }, () => 0);
    const averages = meanVector(frames, length);
    const sums = Array.from({ length: length }, () => 0);
    frames.forEach((frame) => {
      frame.forEach((value, index) => {
        sums[index] += Math.pow(value - averages[index], 2);
      });
    });
    return sums.map((value) => Math.sqrt(value / frames.length));
  }

  function extractMeydaFeatureFrames(signal, sampleRate) {
    const Meyda = window.Meyda;
    const bufferSize = 512;
    const hopSize = 256;
    const mfccFrames = [];
    const centroidValues = [];
    const rolloffValues = [];
    const zcrValues = [];
    const rmsValues = [];
    if (Meyda) {
      Meyda.sampleRate = sampleRate;
      Meyda.bufferSize = bufferSize;
      Meyda.numberOfMFCCCoefficients = 13;
      Meyda.melBands = 26;
      Meyda.windowingFunction = 'hanning';
    }
    for (let index = 0; index + bufferSize <= signal.length; index += hopSize) {
      const frame = signal.subarray(index, index + bufferSize);
      const features = Meyda && Meyda.extract ? Meyda.extract(['mfcc', 'spectralCentroid', 'spectralRolloff', 'zcr', 'rms'], frame) : null;
      if (!features) continue;
      const mfcc = Array.isArray(features.mfcc) ? features.mfcc.slice(0, 13) : Array.from({ length: 13 }, () => 0);
      mfccFrames.push(mfcc.map((value) => Number(value) || 0));
      centroidValues.push(Number(features.spectralCentroid || 0));
      rolloffValues.push(Number(features.spectralRolloff || 0));
      zcrValues.push(Number(features.zcr || 0));
      rmsValues.push(Number(features.rms || 0));
    }
    return { mfccFrames, centroidValues, rolloffValues, zcrValues, rmsValues };
  }

  const LaunchAudio = {
    initPromise: null,
    classifierSession: null,
    featureColumns: [],
    medians: {},
    cusumParams: { k: 0.5, watch_threshold: 2, early_threshold: 3, urgent_threshold: 4 },
    async init() {
      if (this.initPromise) return this.initPromise;
      this.initPromise = (async () => {
        if (window.ort && ort.env && ort.env.wasm) {
          ort.env.wasm.wasmPaths = 'public/vendor/';
          ort.env.wasm.proxy = false;
          ort.env.wasm.numThreads = 1;
        }
        try {
          const [featureColumns, medians, cusumParams] = await Promise.all([
            fetch(RV_MODEL_BASE + '/feature_columns.json').then((response) => response.json()),
            fetch(RV_MODEL_BASE + '/median_values.json').then((response) => response.json()),
            fetch(RV_MODEL_BASE + '/cusum_params.json').then((response) => response.json())
          ]);
          this.featureColumns = featureColumns.feature_columns || [];
          this.medians = medians || {};
          this.cusumParams = { ...this.cusumParams, ...(cusumParams || {}) };
        } catch (error) {
          this.featureColumns = [];
          this.medians = {};
        }
        try {
          if (window.ort) {
            this.classifierSession = await ort.InferenceSession.create(RV_MODEL_BASE + '/classifier.onnx');
          }
        } catch (error) {
          this.classifierSession = null;
        }
      })();
      return this.initPromise;
    },
    async extractFeaturesFromBlob(blob, kind) {
      await this.init();
      const decoded = await decodeBlobToSignal(blob);
      const fullSignal = decoded.signal;
      const baseSignal = kind === 'voice'
        ? (voiceActivityDetect(fullSignal, decoded.sampleRate, 0.01).voicedSignal.length ? voiceActivityDetect(fullSignal, decoded.sampleRate, 0.01).voicedSignal : trimToLoudestWindow(fullSignal, decoded.sampleRate, 2))
        : trimToLoudestWindow(fullSignal, decoded.sampleRate, 1.2);
      const vad = voiceActivityDetect(fullSignal, decoded.sampleRate, kind === 'voice' ? 0.01 : 0.008);
      const signal = kind === 'voice' ? (vad.voicedSignal.length ? vad.voicedSignal : baseSignal) : baseSignal;
      const meyda = extractMeydaFeatureFrames(signal, decoded.sampleRate);
      const mfccMean = meanVector(meyda.mfccFrames, 13);
      const mfccStd = stdVector(meyda.mfccFrames, 13);
      const deltaFrames = buildDeltaFrames(meyda.mfccFrames);
      const deltaMean = meanVector(deltaFrames, 13);
      const deltaStd = stdVector(deltaFrames, 13);
      const delta2Frames = buildDeltaFrames(deltaFrames);
      const delta2Mean = meanVector(delta2Frames, 13);
      const delta2Std = stdVector(delta2Frames, 13);
      const f0 = estimateF0Track(signal, decoded.sampleRate);
      const features = {
        f0_mean: f0.mean,
        f0_std: f0.std,
        f0_min: f0.min,
        f0_max: f0.max,
        hnr_mean: calculateHNR(signal, decoded.sampleRate),
        jitter_local: calculateJitter(signal, decoded.sampleRate),
        jitter_rap: calculateJitter(signal, decoded.sampleRate) * 0.6,
        jitter_ppq5: calculateJitter(signal, decoded.sampleRate) * 0.6,
        shimmer_local: calculateShimmer(signal, decoded.sampleRate),
        shimmer_apq3: calculateShimmer(signal, decoded.sampleRate) * 0.8,
        shimmer_apq5: calculateShimmer(signal, decoded.sampleRate) * 0.8,
        spectral_centroid_mean: mean(meyda.centroidValues),
        spectral_centroid_std: std(meyda.centroidValues),
        spectral_rolloff_85_mean: mean(meyda.rolloffValues),
        spectral_rolloff_85_std: std(meyda.rolloffValues),
        zero_crossing_rate_mean: mean(meyda.zcrValues),
        zero_crossing_rate_std: std(meyda.zcrValues),
        rms_energy_mean: mean(meyda.rmsValues),
        rms_energy_std: std(meyda.rmsValues),
        voiced_frame_ratio: vad.totalFrames ? vad.voicedFrames / vad.totalFrames : 0,
        snr_db: estimateSnr(fullSignal, signal),
        low_quality: kind === 'voice' ? (vad.durationSeconds < 1.2 ? 1 : 0) : (signal.length < decoded.sampleRate * 0.15 ? 1 : 0)
      };
      for (let index = 0; index < 13; index += 1) {
        features['mfcc_' + (index + 1)] = mfccMean[index] || 0;
        features['mfcc_' + (index + 1) + '_mean'] = mfccMean[index] || 0;
        features['mfcc_' + (index + 1) + '_std'] = mfccStd[index] || 0;
        features['mfcc_delta_' + (index + 1)] = deltaMean[index] || 0;
        features['mfcc_delta_' + (index + 1) + '_mean'] = deltaMean[index] || 0;
        features['mfcc_delta_' + (index + 1) + '_std'] = deltaStd[index] || 0;
        features['mfcc_delta2_' + (index + 1)] = delta2Mean[index] || 0;
        features['mfcc_delta2_' + (index + 1) + '_mean'] = delta2Mean[index] || 0;
        features['mfcc_delta2_' + (index + 1) + '_std'] = delta2Std[index] || 0;
      }
      return features;
    },
    buildFeatureTensor(features) {
      const columns = this.featureColumns.length ? this.featureColumns : Object.keys(this.medians);
      const vector = new Float32Array(columns.length);
      columns.forEach((column, index) => {
        const raw = Number(features[column]);
        const fallback = Number(this.medians[column]);
        vector[index] = Number.isFinite(raw) ? raw : (Number.isFinite(fallback) ? fallback : 0);
      });
      return { vector, columns };
    },
    async predictVoiceProbability(features) {
      if (!this.classifierSession) return null;
      const tensorInfo = this.buildFeatureTensor(features);
      const tensor = new ort.Tensor('float32', tensorInfo.vector, [1, tensorInfo.vector.length]);
      const result = await this.classifierSession.run({ features: tensor });
      const outputName = this.classifierSession.outputNames[0];
      const data = result[outputName] && result[outputName].data ? Array.from(result[outputName].data) : [];
      if (!data.length) return null;
      const raw = Number(data[data.length - 1]);
      return raw >= 0 && raw <= 1 ? raw : 1 / (1 + Math.exp(-raw));
    }
  };

  function summarizeVoiceForTrend(features) {
    return {
      hnr_mean: Number(features.hnr_mean || 0),
      jitter_local: Number(features.jitter_local || 0),
      shimmer_local: Number(features.shimmer_local || 0),
      mfcc_1: Number(features.mfcc_1 || 0)
    };
  }

  function finalizeTrendCalibration(state) {
    const keys = Object.keys(FEATURE_WEIGHTS);
    const pool = state.calibration_pool || [];
    state.baseline_mean = {};
    state.baseline_std = {};
    keys.forEach((key) => {
      const values = pool.map((item) => Number(item[key] || 0));
      state.baseline_mean[key] = mean(values);
      state.baseline_std[key] = Math.max(std(values), 1e-6);
    });
    state.calibration_complete = true;
    state.current_alert_level = 'STABLE';
  }

  function addVoiceTrendObservation(features, illnessFlag) {
    const snapshot = summarizeVoiceForTrend(features);
    const state = getAudioTrendState();
    state.days_recorded = Number(state.days_recorded || 0) + 1;
    state.recording_history.push({ timestamp: new Date().toISOString(), features: snapshot });
    if (illnessFlag) {
      state.current_cusum_scores = { hnr_mean: 0, jitter_local: 0, shimmer_local: 0, mfcc_1: 0 };
      state.score_history = [];
      state.consecutive_alert_days = 0;
      state.current_alert_level = state.calibration_complete ? 'STABLE' : 'CALIBRATING';
      saveAudioTrendState(state);
      return { ...state, cusum_score: 0, alert_level: state.current_alert_level, calibration_progress: clamp((state.calibration_pool || []).length / state.calibration_days, 0, 1) };
    }
    if (!state.calibration_complete) {
      state.calibration_pool.push(snapshot);
      if (state.calibration_pool.length >= state.calibration_days) finalizeTrendCalibration(state);
      state.current_alert_level = state.calibration_complete ? 'STABLE' : 'CALIBRATING';
      saveAudioTrendState(state);
      return {
        ...state,
        cusum_score: null,
        alert_level: state.current_alert_level,
        calibration_progress: clamp((state.calibration_pool || []).length / state.calibration_days, 0, 1)
      };
    }
    let composite = 0;
    Object.keys(FEATURE_WEIGHTS).forEach((key) => {
      const avg = Number(state.baseline_mean[key] || 0);
      const sigma = Math.max(Number(state.baseline_std[key] || 0), FEATURE_STD_FLOORS[key] || 0.01);
      const z = (Number(snapshot[key] || avg) - avg) / sigma;
      const directionalZ = FEATURE_DIRECTIONS[key] * z;
      state.current_cusum_scores[key] = Math.max(0, Number(state.current_cusum_scores[key] || 0) + directionalZ - Number(LaunchAudio.cusumParams.k || 0.5));
      composite += FEATURE_WEIGHTS[key] * state.current_cusum_scores[key];
    });
    state.score_history.push(composite);
    state.consecutive_alert_days = composite >= Number(LaunchAudio.cusumParams.watch_threshold || 2) ? Number(state.consecutive_alert_days || 0) + 1 : 0;
    if (composite > Number(LaunchAudio.cusumParams.urgent_threshold || 4) && state.consecutive_alert_days >= 5) state.current_alert_level = 'URGENT';
    else if (composite >= Number(LaunchAudio.cusumParams.early_threshold || 3) && state.consecutive_alert_days >= 4) state.current_alert_level = 'EARLY_WARNING';
    else if (composite >= Number(LaunchAudio.cusumParams.watch_threshold || 2)) state.current_alert_level = 'WATCH';
    else state.current_alert_level = 'STABLE';
    saveAudioTrendState(state);
    return {
      ...state,
      cusum_score: composite,
      alert_level: state.current_alert_level,
      calibration_progress: 1
    };
  }

  function describeVoiceSignal(analysis) {
    const tone = toneMap[analysis.alert_level || 'CALIBRATING'] || toneMap.CALIBRATING;
    if (analysis.alert_level === 'URGENT') return tone.label + ' acoustic shift';
    if (analysis.alert_level === 'EARLY_WARNING') return tone.label + ' acoustic drift';
    if (analysis.alert_level === 'WATCH') return tone.label + ' for gradual change';
    if (analysis.alert_level === 'CALIBRATING') return 'Learning your baseline';
    return 'Near your personal baseline';
  }

  function sentenceForTodayLaunch(date) {
    const now = date || new Date();
    return RECURVOICE_SENTENCE_POOL[now.getDate() % RECURVOICE_SENTENCE_POOL.length];
  }

  function interpretHnrLaunch(value) {
    if (value > 15) return { label: 'Normal', tone: 'pill-green' };
    if (value >= 10) return { label: 'Slightly reduced', tone: 'pill-amber' };
    return { label: 'Reduced', tone: 'pill-red' };
  }

  function interpretJitterLaunch(value) {
    if (value < 1) return { label: 'Normal', tone: 'pill-green' };
    if (value <= 2) return { label: 'Slightly elevated', tone: 'pill-amber' };
    return { label: 'Elevated', tone: 'pill-red' };
  }

  function interpretShimmerLaunch(value) {
    if (value < 3) return { label: 'Normal', tone: 'pill-green' };
    if (value <= 5) return { label: 'Slightly elevated', tone: 'pill-amber' };
    return { label: 'Elevated', tone: 'pill-red' };
  }

  function renderVoiceMetricCards(features, baselineFeatures) {
    if (!features) return '';
    const hnr = Number(features.hnr_mean || 0);
    const jitter = Number(features.jitter_local || 0);
    const shimmer = Number(features.shimmer_local || 0);
    const f0 = Number(features.f0_mean || 0);
    const hnrState = interpretHnrLaunch(hnr);
    const jitterState = interpretJitterLaunch(jitter);
    const shimmerState = interpretShimmerLaunch(shimmer);
    function metricDelta(key, decimals, suffix) {
      if (!baselineFeatures || !Number.isFinite(Number(baselineFeatures[key]))) return 'Baseline pending';
      const delta = Number(features[key] || 0) - Number(baselineFeatures[key] || 0);
      const sign = delta > 0 ? '+' : '';
      return sign + delta.toFixed(decimals) + suffix;
    }
    return '<div class="voice-metric-grid mt-16">' +
      '<div class="voice-metric-card"><p class="text-xs text-light">HNR</p><p class="voice-metric-value">' + hnr.toFixed(1) + ' dB</p><span class="pill ' + hnrState.tone + '">' + escHtml(hnrState.label) + '</span><p class="text-xs text-sec mt-8">' + escHtml(metricDelta('hnr_mean', 1, ' dB')) + '</p></div>' +
      '<div class="voice-metric-card"><p class="text-xs text-light">Jitter</p><p class="voice-metric-value">' + jitter.toFixed(2) + '%</p><span class="pill ' + jitterState.tone + '">' + escHtml(jitterState.label) + '</span><p class="text-xs text-sec mt-8">' + escHtml(metricDelta('jitter_local', 2, '%')) + '</p></div>' +
      '<div class="voice-metric-card"><p class="text-xs text-light">Shimmer</p><p class="voice-metric-value">' + shimmer.toFixed(2) + '%</p><span class="pill ' + shimmerState.tone + '">' + escHtml(shimmerState.label) + '</span><p class="text-xs text-sec mt-8">' + escHtml(metricDelta('shimmer_local', 2, '%')) + '</p></div>' +
      '<div class="voice-metric-card"><p class="text-xs text-light">Pitch</p><p class="voice-metric-value">' + f0.toFixed(0) + ' Hz</p><span class="pill pill-gray">Reference</span><p class="text-xs text-sec mt-8">' + escHtml(metricDelta('f0_mean', 0, ' Hz')) + '</p></div>' +
      '</div>';
  }

  function buildVoiceBiomarkerExplainerCards(last) {
    const hnrValue = last.voiceHnr == null ? 'HNR pending' : 'HNR ' + last.voiceHnr + ' dB';
    const jitterValue = last.voiceJitter == null ? 'Jitter pending' : 'Jitter ' + last.voiceJitter + '%';
    const shimmerValue = last.voiceShimmer == null ? 'Shimmer pending' : 'Shimmer ' + last.voiceShimmer + '%';
    const pitchValue = last.voicePitch == null ? 'Pitch pending' : 'Pitch ' + last.voicePitch + ' Hz';
    return '<div class="voice-explainer-grid mt-16">' +
      '<div class="voice-explainer-card"><p class="text-xs text-light">HNR</p><p class="text-bold mt-8">Voice clarity</p><p class="text-sm text-sec mt-8">Higher HNR usually means the sustained vowel sounded cleaner and more harmonic. Lower HNR can sound breathier or rougher.</p><div class="edu-fact-row mt-12"><span class="document-pill">' + escHtml(hnrValue) + '</span></div></div>' +
      '<div class="voice-explainer-card"><p class="text-xs text-light">Jitter</p><p class="text-bold mt-8">Pitch steadiness</p><p class="text-sm text-sec mt-8">Jitter tracks how much pitch wobbles from one voice cycle to the next. Higher values can mean the sample was less steady.</p><div class="edu-fact-row mt-12"><span class="document-pill">' + escHtml(jitterValue) + '</span></div></div>' +
      '<div class="voice-explainer-card"><p class="text-xs text-light">Shimmer</p><p class="text-bold mt-8">Volume steadiness</p><p class="text-sm text-sec mt-8">Shimmer tracks loudness wobble. Higher shimmer can point to a rougher or less controlled sound in the recorded vowel.</p><div class="edu-fact-row mt-12"><span class="document-pill">' + escHtml(shimmerValue) + '</span></div></div>' +
      '<div class="voice-explainer-card"><p class="text-xs text-light">Pitch</p><p class="text-bold mt-8">Reference frequency</p><p class="text-sm text-sec mt-8">Pitch is the average frequency of the sample. Respira mainly uses it as a reference while comparing the rest of the signal to your own baseline.</p><div class="edu-fact-row mt-12"><span class="document-pill">' + escHtml(pitchValue) + '</span></div></div>' +
      '</div>';
  }

  function syncWaveformCanvasSizes(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('.waveform-canvas').forEach((canvas) => {
      const width = Math.max(160, Math.round(canvas.getBoundingClientRect().width || (canvas.parentElement ? canvas.parentElement.getBoundingClientRect().width : 0)));
      if (!width) return;
      const cssHeight = Number(canvas.getAttribute('height') || 60);
      canvas.width = width;
      canvas.height = cssHeight;
      canvas.style.width = '100%';
      canvas.style.height = cssHeight + 'px';
    });
  }

  window.addEventListener('resize', () => syncWaveformCanvasSizes(document));

  function buildRespiraVoiceHeader() {
    const sentence = sentenceForTodayLaunch();
    return '<div class="launch-hero baseline-voice-hero" style="text-align:left"><div class="launch-badge">Voice baseline</div><p class="text-sm text-sec mt-12">Two quick recordings: hold one steady <strong>ahh</strong> for about five seconds, then read one sentence in your normal voice.</p><div class="baseline-tip-row mt-12"><span class="document-pill">Quiet room</span><span class="document-pill">Phone close to mouth</span><span class="document-pill">Sentence: "' + escHtml(sentence) + '"</span></div></div>';
  }

  async function analyzeVoiceBiomarker(blob, illnessFlag) {
    const features = await LaunchAudio.extractFeaturesFromBlob(blob, 'voice');
    const probability = await LaunchAudio.predictVoiceProbability(features);
    const trend = addVoiceTrendObservation(features, illnessFlag);
    return {
      features,
      probability,
      alertLevel: trend.alert_level || 'CALIBRATING',
      calibrationProgress: trend.calibration_progress || 0,
      cusumScore: trend.cusum_score,
      summary: describeVoiceSignal({ alert_level: trend.alert_level }),
      lowQuality: Boolean(features.low_quality)
    };
  }

  async function analyzeCoughAcousticProfile(blob) {
    const features = await LaunchAudio.extractFeaturesFromBlob(blob, 'cough');
    return { features, lowQuality: Boolean(features.low_quality) };
  }

  function getBaselineCoughDelta(scores) {
    const baseline = getAudioBaseline().cough;
    if (!baseline || !baseline.scores) return 0;
    const obstructionDelta = Number(scores.obstruction || 0) - Number(baseline.scores.obstruction || 0);
    const wetnessDelta = (Number(scores.wetness || 0) - Number(baseline.scores.wetness || 0)) / 10;
    const burstDelta = (Number(scores.burst || 0) - Number(baseline.scores.burst || 0)) / 4;
    return obstructionDelta * 5 + wetnessDelta * 2 + burstDelta;
  }

  function computeCoughLevel(scores, voiceBiomarker) {
    const baseScore = Number(scores.obstruction || 0) * 9.5;
    const coughDelta = getBaselineCoughDelta(scores);
    const voicePenalty = voiceBiomarker && voiceBiomarker.alertLevel === 'URGENT' ? 1.5 : voiceBiomarker && voiceBiomarker.alertLevel === 'EARLY_WARNING' ? 1 : voiceBiomarker && voiceBiomarker.alertLevel === 'WATCH' ? 0.5 : 0;
    return clamp(Math.round(baseScore + coughDelta + voicePenalty + 1), 1, 10);
  }

  window.initONNX = async function initONNXLaunch() {
    window.respiraCNNSession = null;
    await LaunchAudio.init();
  };

  window.startBaselineRec = async function startBaselineRecLaunch(type) {
    const button = $('baseline-' + type + '-btn');
    const status = $('baseline-' + type + '-status');
    if (!button || button.classList.contains('recording')) return;
    button.classList.add('recording');
    button.textContent = '⏹';
    status.textContent = 'Recording...';
    const recorder = new AudioRecorder('baseline-' + type + '-canvas', type === 'cough' ? 5 : 10);
    recorder.onComplete = async function (result) {
      button.classList.remove('recording');
      button.classList.add('complete');
      button.textContent = '✓';
      try {
        if (type === 'voice') {
          const analysis = await analyzeVoiceBiomarker(result.blob, false);
          saveAudioBaseline({ voice: { recordedAt: new Date().toISOString(), features: analysis.features } });
          status.textContent = 'Voice baseline captured';
        } else {
          const acoustic = await analyzeCoughAcousticProfile(result.blob);
          saveAudioBaseline({
            cough: {
              recordedAt: new Date().toISOString(),
              scores: result.scores,
              features: acoustic.features
            }
          });
          status.textContent = 'Cough baseline captured';
        }
        status.style.color = 'var(--green)';
      } catch (error) {
        status.textContent = 'Baseline saved with limited analysis';
        status.style.color = 'var(--amber)';
      }
      baselineDone[type] = true;
      if (baselineDone.cough && baselineDone.voice) $('finish-onboard-btn').style.display = '';
    };
    try {
      await recorder.start();
      button.onclick = function () { recorder.stop(); };
    } catch (error) {
      button.classList.remove('recording');
      status.textContent = 'Microphone access denied';
      status.style.color = 'var(--red)';
      baselineDone[type] = true;
      if (baselineDone.cough && baselineDone.voice) $('finish-onboard-btn').style.display = '';
    }
  };

  window.startCIVoice = async function startCIVoiceLaunch() {
    const button = $('ci-voice-btn');
    if (!button || button.classList.contains('recording')) return;
    button.classList.add('recording');
    button.textContent = '⏹';
    let seconds = 0;
    const timer = setInterval(() => {
      const timerEl = $('ci-voice-timer');
      seconds += 1;
      if (timerEl) timerEl.textContent = seconds + 's';
    }, 1000);
    ciRecorder = new AudioRecorder('ci-voice-canvas', 30);
    const speechCapture = startLiveTranscription();
    ciRecorder.onComplete = async function (result) {
      clearInterval(timer);
      button.classList.remove('recording');
      button.classList.add('complete');
      button.textContent = '✓';
      const transcript = (await speechCapture.stop()) || 'Speech recognition was not available in this browser.';
      ciData.transcript = transcript;
      checkCrisisLanguage(transcript);
      let voiceBiomarker = null;
      try {
        voiceBiomarker = await analyzeVoiceBiomarker(result.blob, false);
      } catch (error) {
        voiceBiomarker = null;
      }
      ciData.voiceBiomarker = voiceBiomarker;
      const tone = voiceBiomarker ? (toneMap[voiceBiomarker.alertLevel] || toneMap.CALIBRATING) : toneMap.CALIBRATING;
      const resultEl = $('ci-voice-result');
      if (resultEl) {
        resultEl.innerHTML = '<div class="card" style="text-align:left"><p class="text-sm text-sec mb-4">I heard:</p><p class="text-sm">"' + escHtml(transcript) + '"</p>' + (voiceBiomarker ? '<div class="mt-12"><span class="pill ' + tone.tone + '">' + escHtml(voiceBiomarker.summary) + '</span><p class="text-xs text-sec mt-8">' + (voiceBiomarker.calibrationProgress < 1 ? 'Baseline progress: ' + Math.round(voiceBiomarker.calibrationProgress * 100) + '%' : 'Personal voice trend score: ' + (voiceBiomarker.cusumScore == null ? '0.0' : Number(voiceBiomarker.cusumScore).toFixed(1))) + '</p></div>' : '') + '<p class="text-sm text-sec mt-12">Does that sound right?</p><div class="flex gap-8 mt-12"><button class="btn btn-blue" onclick="ciVoiceConfirm()">Yes</button><button class="btn btn-outline" onclick="ciVoiceRetry()">Try Again</button></div></div>';
      }
      analyzeDiary(transcript);
    };
    try {
      await ciRecorder.start();
      button.onclick = function () { ciRecorder.stop(); };
    } catch (error) {
      clearInterval(timer);
      button.classList.remove('recording');
      $('ci-voice-timer').textContent = 'Microphone not available';
      ciData.transcript = '';
      ciData.diaryResult = 'Looking good';
      $('ci-voice-result').innerHTML = '<button class="btn btn-blue mt-16" onclick="ciStep=3;renderCIStep()">Skip → Next</button>';
    }
  };

  window.startCICough = async function startCICoughLaunch() {
    const button = $('ci-cough-btn');
    if (!button || button.classList.contains('recording')) return;
    button.classList.add('recording');
    button.textContent = '⏹';
    $('ci-cough-status').textContent = 'Recording...';
    ciRecorder = new AudioRecorder('ci-cough-canvas', 5);
    ciRecorder.onComplete = async function (result) {
      button.classList.remove('recording');
      button.classList.add('complete');
      button.textContent = '✓';
      $('ci-cough-status').textContent = 'Analyzing cough...';
      const localScores = result.scores || {};
      const aiResult = remoteAIEnabled() && result.spectrogramDataUrl ? await analyzeCoughWithAI(result.spectrogramDataUrl, localScores) : null;
      const coughScores = { ...localScores };
      if (aiResult && typeof aiResult.coughDetected === 'boolean') coughScores.coughDetected = aiResult.coughDetected;
      if (aiResult && Number.isFinite(Number(aiResult.obstructionLevel))) coughScores.obstruction = clamp(Number(aiResult.obstructionLevel) / 10, 0, 1);
      const acoustic = await analyzeCoughAcousticProfile(result.blob).catch(() => null);
      $('ci-cough-status').textContent = '';
      const scoresEl = $('ci-cough-scores');
      if (!coughScores.coughDetected) {
        scoresEl.innerHTML = '<div style="text-align:left"><div class="card" style="border-left:3px solid var(--amber);background:var(--amber-light)"><p class="text-sm" style="font-weight:600;color:#92400e">We did not detect a clean single cough.</p><p class="text-sm text-sec mt-4">' + escHtml((aiResult && aiResult.explanation) || 'It sounded more like breathing or room noise than one cough. Try one firm cough close to the microphone.') + '</p></div><div class="flex gap-8 mt-16"><button class="btn btn-blue" onclick="retryCough()">Try Again</button><button class="btn btn-outline" onclick="ciData.coughLevel=2;ciStep=4;renderCIStep()">Skip</button></div></div>';
        return;
      }
      const level = computeCoughLevel(coughScores, ciData.voiceBiomarker);
      ciData.coughLevel = level;
      ciData.coughMeta = {
        obstruction: coughScores.obstruction,
        wetness: coughScores.wetness,
        coughBursts: coughScores.coughBursts,
        acousticShift: acoustic && acoustic.features ? summarizeVoiceForTrend(acoustic.features) : null,
        baselineDelta: getBaselineCoughDelta(coughScores)
      };
      const levelColor = level <= 3 ? 'var(--green)' : level <= 6 ? 'var(--amber)' : 'var(--red)';
      const descriptor = level <= 3 ? 'Low burden compared with your baseline' : level <= 6 ? 'Moderate shift worth tracking' : 'Elevated change from baseline';
      const voiceDescriptor = ciData.voiceBiomarker ? ciData.voiceBiomarker.summary : 'Voice baseline unavailable yet';
      scoresEl.innerHTML = '<div style="text-align:left"><div class="card"><p class="text-sm text-sec">Respiratory check</p><p style="font-size:28px;font-weight:700;color:' + levelColor + '">' + level + '/10</p><p class="text-sm text-sec mt-4">' + escHtml(descriptor) + '</p><div class="flex gap-8 mt-12 flex-wrap"><span class="pill pill-blue">Cough bursts: ' + escHtml(String(coughScores.coughBursts || 1)) + '</span><span class="pill pill-gray">Voice trend: ' + escHtml(voiceDescriptor) + '</span></div>' + (aiResult && aiResult.explanation ? '<p class="text-xs text-sec mt-4">' + escHtml(aiResult.explanation) + '</p>' : '') + '</div><button class="btn btn-blue btn-full mt-16" onclick="ciStep=4;renderCIStep()">Next</button></div>';
      showCheckinSuccessToast('Cough captured.');
    };
    try {
      await ciRecorder.start();
      button.onclick = function () { ciRecorder.stop(); };
    } catch (error) {
      button.classList.remove('recording');
      $('ci-cough-status').textContent = 'Microphone not available';
      ciData.coughLevel = 4;
      $('ci-cough-scores').innerHTML = '<button class="btn btn-blue mt-16" onclick="ciStep=4;renderCIStep()">Skip → Next</button>';
    }
  };

  function computeCheckinHealthScore(data) {
    let score = 92;
    score -= Number(data.coughLevel || 4) * 4.2;
    if (data.voiceBiomarker) {
      if (data.voiceBiomarker.alertLevel === 'WATCH') score -= 4;
      if (data.voiceBiomarker.alertLevel === 'EARLY_WARNING') score -= 8;
      if (data.voiceBiomarker.alertLevel === 'URGENT') score -= 12;
      if (Number.isFinite(data.voiceBiomarker.probability)) score -= Math.round(Math.max(0, data.voiceBiomarker.probability - 0.45) * 16);
    }
    const reaction = Number(data.reactionTime || 0);
    if (reaction > 650) score -= 7;
    else if (reaction > 500) score -= 4;
    else if (reaction > 380) score -= 2;
    if (data.feeling === 'Better') score += 4;
    else if (data.feeling === 'Worse') score -= 6;
    const diary = friendlyDiary(data.diaryResult || '');
    if (diary === 'Worth monitoring') score -= 4;
    else if (diary === 'Talk to your care team') score -= 8;
    return clamp(Math.round(score), 0, 100);
  }

  window.saveCIData = function saveCIDataLaunch() {
    const checkins = getCheckins();
    const existingIndex = checkins.findIndex((entry) => entry.date === todayStr());
    const entry = {
      id: Date.now(),
      date: todayStr(),
      completed: true,
      healthScore: computeCheckinHealthScore(ciData),
      coughLevel: ciData.coughLevel || 4,
      reactionTime: ciData.reactionTime || 300,
      feeling: ciData.feeling || 'About the Same',
      diaryResult: ciData.diaryResult || 'Looking good',
      transcript: ciData.transcript || '',
      voiceAlertLevel: ciData.voiceBiomarker ? ciData.voiceBiomarker.alertLevel : '',
      voiceProbability: ciData.voiceBiomarker && Number.isFinite(ciData.voiceBiomarker.probability) ? Math.round(ciData.voiceBiomarker.probability * 1000) / 1000 : null,
      voiceCalibrationProgress: ciData.voiceBiomarker ? ciData.voiceBiomarker.calibrationProgress : null,
      voiceHnr: ciData.voiceBiomarker && ciData.voiceBiomarker.features ? Math.round(Number(ciData.voiceBiomarker.features.hnr_mean || 0) * 10) / 10 : null,
      voiceJitter: ciData.voiceBiomarker && ciData.voiceBiomarker.features ? Math.round(Number(ciData.voiceBiomarker.features.jitter_local || 0) * 100) / 100 : null,
      voiceShimmer: ciData.voiceBiomarker && ciData.voiceBiomarker.features ? Math.round(Number(ciData.voiceBiomarker.features.shimmer_local || 0) * 100) / 100 : null,
      voicePitch: ciData.voiceBiomarker && ciData.voiceBiomarker.features ? Math.round(Number(ciData.voiceBiomarker.features.f0_mean || 0)) : null,
      alertTier: 1
    };
    if (existingIndex >= 0) checkins[existingIndex] = entry; else checkins.push(entry);
    localStorage.setItem('respira_checkins', JSON.stringify(checkins));
    entry.alertTier = runAlertEngine();
    if (existingIndex >= 0) checkins[existingIndex] = entry; else checkins[checkins.length - 1] = entry;
    localStorage.setItem('respira_checkins', JSON.stringify(checkins));
    if (entry.voiceAlertLevel === 'WATCH' || entry.voiceAlertLevel === 'EARLY_WARNING' || entry.voiceAlertLevel === 'URGENT') {
      const alerts = getAlerts();
      const message = entry.voiceAlertLevel === 'URGENT'
        ? 'Respira AI flagged an urgent voice drift pattern today. Contact your care team if this matches symptoms.'
        : entry.voiceAlertLevel === 'EARLY_WARNING'
          ? 'Respira AI detected a sustained voice drift pattern worth reviewing.'
          : 'Respira AI noticed an early voice change today and will keep monitoring.';
      if (!alerts.some((alert) => alert.message === message && toLocalDateString(alert.timestamp || todayStr()) === todayStr())) {
        alerts.push({ id: Date.now() + Math.random(), tier: entry.voiceAlertLevel === 'WATCH' ? 2 : entry.voiceAlertLevel === 'EARLY_WARNING' ? 3 : 4, message, timestamp: new Date().toISOString(), read: false });
        localStorage.setItem('respira_alerts', JSON.stringify(alerts));
      }
    }
    logAudit('checkin_saved', 'score ' + entry.healthScore + ', cough ' + entry.coughLevel + '/10, voice ' + (entry.voiceAlertLevel || 'pending'));
    ciData.healthScore = entry.healthScore;
  };

  window.ciSelfReport = function ciSelfReportLaunch(report) {
    ciData.feeling = report;
    ciStep = 5;
    renderCIDots();
    window.saveCIData();
    const score = ciData.healthScore || computeCheckinHealthScore(ciData);
    const tone = score >= 75 ? 'pill-green' : score >= 55 ? 'pill-blue' : 'pill-amber';
    const voiceTone = ciData.voiceBiomarker ? (toneMap[ciData.voiceBiomarker.alertLevel] || toneMap.CALIBRATING).tone : 'pill-gray';
    $('ci-content').innerHTML = '<svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="none" stroke="#2f855a" stroke-width="3"/><path d="M20 32 L28 40 L44 24" fill="none" stroke="#2f855a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><p class="text-xl text-bold mt-16">Check-in saved</p><div class="card mt-24" style="text-align:left;border-left:4px solid var(--blue)"><p class="text-sm">' + escHtml(score >= 75 ? 'Your cough and voice readings stayed close to your recent baseline today.' : score >= 55 ? 'A few signals shifted today, so Respira will keep tracking the trend.' : 'Today shows a larger shift from your recent baseline. Keep an eye on symptoms and contact your care team if this continues.') + '</p><div class="flex gap-8 mt-12 flex-wrap"><span class="pill ' + tone + '">Health score: ' + score + '</span><span class="pill ' + voiceTone + '">Voice: ' + escHtml(ciData.voiceBiomarker ? ciData.voiceBiomarker.summary : 'Not available') + '</span><span class="pill pill-gray">Cough: ' + escHtml(String(ciData.coughLevel || 4)) + '/10</span></div></div><button class="btn btn-blue btn-full btn-lg mt-24" onclick="closeCheckin();navigate(\'dashboard\')">Back to Dashboard</button>';
  };

  window.renderCIStep = function renderCIStepLaunch() {
    renderCIDots();
    const ct = $('ci-content');
    if (ciStep === 1) {
      ct.innerHTML = '<div class="checkin-pulse"></div><p class="text-lg mt-24">Tap as soon as the circle turns green.</p><div id="reaction-stage" class="mt-16"><button class="btn btn-outline btn-lg" id="reaction-target" onclick="handleReactionTap()" style="width:220px;height:220px;border-radius:999px;font-size:18px">Wait...</button></div><p class="text-sm text-sec mt-16" id="reaction-help">This checks response speed during today\'s check-in.</p>';
      ciData.reactionStartedAt = 0;
      ciData.reactionReady = false;
      const delay = 1200 + Math.random() * 2200;
      setTimeout(() => {
        const button = $('reaction-target');
        if (!button || ciStep !== 1) return;
        ciData.reactionStartedAt = performance.now();
        ciData.reactionReady = true;
        button.textContent = 'Tap now';
        button.style.background = 'var(--green)';
        button.style.color = '#fff';
        button.style.borderColor = 'var(--green)';
        $('reaction-help').textContent = 'Tap immediately when you see green.';
      }, delay);
    } else if (ciStep === 2) {
      const sentence = sentenceForTodayLaunch();
      ciData.voicePrompt = sentence;
      ct.innerHTML = buildRespiraVoiceHeader() + '<button class="record-btn" id="ci-voice-btn" onclick="startCIVoice()">🎤</button><canvas id="ci-voice-canvas" class="waveform-canvas" width="300" height="60"></canvas><p class="text-sm text-sec mt-4" id="ci-voice-timer">Ready for the Respira AI voice task.</p><div id="ci-voice-result" class="mt-16"></div><p class="text-xs text-sec mt-12" style="cursor:pointer;text-decoration:underline" onclick="ciData.transcript=\'\';ciData.diaryResult=\'Looking good\';ciStep=3;renderCIStep()">Skip this step</p>';
    } else if (ciStep === 3) {
      ct.innerHTML = '<p class="text-xl text-bold">Take a deep breath and cough once.</p><p class="text-sec mt-4">This helps us track your airway health over time.</p><button class="record-btn" id="ci-cough-btn" onclick="startCICough()">🎤</button><canvas id="ci-cough-canvas" class="waveform-canvas" width="300" height="60"></canvas><p class="text-sm text-sec mt-4" id="ci-cough-status"></p><div id="ci-cough-scores" class="mt-16"></div><p class="text-xs text-sec mt-12" style="cursor:pointer;text-decoration:underline" onclick="ciData.coughLevel=4;ciStep=4;renderCIStep()">Skip this step</p>';
    } else if (ciStep === 4) {
      ct.innerHTML = '<p class="text-lg mb-24">Compared to yesterday, how do you feel?</p><div class="flex-col gap-12"><button class="self-report-btn better" onclick="ciSelfReport(\'Better\')">Better</button><button class="self-report-btn same" onclick="ciSelfReport(\'About the Same\')">About the Same</button><button class="self-report-btn worse" onclick="ciSelfReport(\'Worse\')">Not as Good</button></div>';
    } else if (ciStep === 5) {
      ct.innerHTML = '<p class="text-sm text-sec">Saving your Respira AI results...</p>';
    }
  };

  window.startBaselineRec = async function startBaselineRecLaunch(type) {
    const button = $('baseline-' + type + '-btn');
    const status = $('baseline-' + type + '-status');
    if (!button || button.classList.contains('recording')) return;
    button.classList.add('recording');
    button.textContent = '⏹';
    if (status) {
      status.innerHTML = type === 'voice'
        ? 'Say <strong>AAAAHHH</strong> for 5 seconds, then read: "' + escHtml(sentenceForTodayLaunch()) + '"'
        : 'Recording...';
    }
    const recorder = new AudioRecorder('baseline-' + type + '-canvas', type === 'cough' ? 5 : 12);
    recorder.onComplete = async function (result) {
      button.classList.remove('recording');
      button.classList.add('complete');
      button.textContent = '✓';
      try {
        if (type === 'voice') {
          const analysis = await analyzeVoiceBiomarker(result.blob, false);
          saveAudioBaseline({ voice: { recordedAt: new Date().toISOString(), features: analysis.features } });
          status.innerHTML = '<div class="card" style="text-align:left"><p class="text-sm text-bold">Respira AI voice baseline captured</p><p class="text-xs text-sec mt-8">Your vowel and sentence sample are now the reference point for future drift detection.</p>' + renderVoiceMetricCards(analysis.features, null) + '</div>';
        } else {
          const acoustic = await analyzeCoughAcousticProfile(result.blob);
          saveAudioBaseline({
            cough: {
              recordedAt: new Date().toISOString(),
              scores: result.scores,
              features: acoustic.features
            }
          });
          status.textContent = 'Cough baseline captured';
        }
        status.style.color = 'var(--green)';
      } catch (error) {
        status.textContent = 'Baseline saved with limited analysis';
        status.style.color = 'var(--amber)';
      }
      baselineDone[type] = true;
      if (baselineDone.cough && baselineDone.voice) $('finish-onboard-btn').style.display = '';
    };
    try {
      await recorder.start();
      button.onclick = function () { recorder.stop(); };
    } catch (error) {
      button.classList.remove('recording');
      status.textContent = 'Microphone access denied';
      status.style.color = 'var(--red)';
      baselineDone[type] = true;
      if (baselineDone.cough && baselineDone.voice) $('finish-onboard-btn').style.display = '';
    }
  };

  window.startCIVoice = async function startCIVoiceLaunch() {
    const button = $('ci-voice-btn');
    if (!button || button.classList.contains('recording')) return;
    button.classList.add('recording');
    button.textContent = '⏹';
    const sentence = ciData.voicePrompt || sentenceForTodayLaunch();
    let seconds = 0;
    const timer = setInterval(() => {
      const timerEl = $('ci-voice-timer');
      seconds += 1;
      if (timerEl) timerEl.innerHTML = 'Say <strong>AAAAHHH</strong>, then read the sentence. ' + seconds + 's';
    }, 1000);
    ciRecorder = new AudioRecorder('ci-voice-canvas', 12);
    const speechCapture = startLiveTranscription();
    ciRecorder.onComplete = async function (result) {
      clearInterval(timer);
      button.classList.remove('recording');
      button.classList.add('complete');
      button.textContent = '✓';
      const transcript = (await speechCapture.stop()) || '';
      ciData.transcript = transcript;
      checkCrisisLanguage(transcript);
      let voiceBiomarker = null;
      try {
        voiceBiomarker = await analyzeVoiceBiomarker(result.blob, false);
      } catch (error) {
        voiceBiomarker = null;
      }
      ciData.voiceBiomarker = voiceBiomarker;
      const tone = voiceBiomarker ? (toneMap[voiceBiomarker.alertLevel] || toneMap.CALIBRATING) : toneMap.CALIBRATING;
      const baseline = getAudioBaseline().voice;
      const baselineFeatures = baseline && baseline.features ? baseline.features : null;
      const resultEl = $('ci-voice-result');
      if (resultEl) {
        resultEl.innerHTML = '<div class="card" style="text-align:left"><p class="text-xs text-light">Today\'s sentence</p><p class="text-sm text-bold mt-6">"' + escHtml(sentence) + '"</p><p class="text-xs text-light mt-12">Speech transcript</p><p class="text-sm mt-6">' + escHtml(transcript || 'Speech recognition was not available in this browser.') + '</p>' + (voiceBiomarker ? '<div class="mt-12"><span class="pill ' + tone.tone + '">' + escHtml(voiceBiomarker.summary) + '</span><p class="text-xs text-sec mt-8">' + (voiceBiomarker.calibrationProgress < 1 ? 'Baseline progress: ' + Math.round(voiceBiomarker.calibrationProgress * 100) + '%' : 'Personal voice trend score: ' + (voiceBiomarker.cusumScore == null ? '0.0' : Number(voiceBiomarker.cusumScore).toFixed(1))) + '</p>' + renderVoiceMetricCards(voiceBiomarker.features, baselineFeatures) + '</div>' : '') + '<p class="text-sm text-sec mt-12">Does that sound right?</p><div class="flex gap-8 mt-12"><button class="btn btn-blue" onclick="ciVoiceConfirm()">Yes</button><button class="btn btn-outline" onclick="ciVoiceRetry()">Try Again</button></div></div>';
      }
      analyzeDiary(transcript || sentence);
    };
    try {
      await ciRecorder.start();
      button.onclick = function () { ciRecorder.stop(); };
    } catch (error) {
      clearInterval(timer);
      button.classList.remove('recording');
      $('ci-voice-timer').textContent = 'Microphone not available';
      ciData.transcript = '';
      ciData.diaryResult = 'Looking good';
      $('ci-voice-result').innerHTML = '<button class="btn btn-blue mt-16" onclick="ciStep=3;renderCIStep()">Skip → Next</button>';
    }
  };

  window.renderAIChat = function renderAIChatLaunch() {
    const chats = getChats();
    const trend = getAudioTrendState();
    const checkins = getCheckins();
    const last = checkins[checkins.length - 1] || {};
    let html = '<div class="launch-hero"><div class="launch-badge">Respira AI</div><p class="text-sm text-sec mt-12">Ask about your voice biomarkers, scan summaries, medication questions, or what today\'s Respira AI tasks mean.</p><div class="voice-task-grid mt-16"><div class="voice-task-card"><p class="text-xs text-light">Today\'s task</p><p class="text-bold mt-8">AAAAHHH + sentence</p><p class="text-sm text-sec mt-8">"' + escHtml(sentenceForTodayLaunch()) + '"</p></div><div class="voice-task-card"><p class="text-xs text-light">Current voice trend</p><p class="text-bold mt-8">' + escHtml(trend.current_alert_level || 'CALIBRATING') + '</p><p class="text-sm text-sec mt-8">Last stored voice probability: ' + escHtml(last.voiceProbability == null ? 'Not available' : String(last.voiceProbability)) + '</p></div></div></div>';
    html += '<div class="chat-wrap"><div class="chat-history" id="chat-history">';
    if (chats.length === 0) {
      html += '<div class="chat-chips" id="chat-starters"><div class="chat-chip" onclick="sendChatFromChip(this)">What do HNR, jitter, and shimmer mean?</div><div class="chat-chip" onclick="sendChatFromChip(this)">How should I do the AAAAAHHH task?</div><div class="chat-chip" onclick="sendChatFromChip(this)">What does my voice trend score mean?</div><div class="chat-chip" onclick="sendChatFromChip(this)">How does the daily sentence help?</div></div>';
    } else {
      chats.forEach((message) => {
        if (message.role === 'user') {
          html += '<div class="chat-msg user"><div class="msg-bubble">' + escHtml(message.text) + '</div><div class="msg-time">' + formatTime(message.ts) + '</div></div>';
        } else {
          html += '<div class="chat-msg ai"><div class="msg-label">respira ai</div><div class="msg-bubble">' + formatAIMsg(message.text) + '</div><div class="msg-time">' + formatTime(message.ts) + '</div>';
          if (message.followups) html += '<div class="flex gap-8 mt-8 flex-wrap">' + message.followups.map((followup) => '<div class="chat-chip" onclick="sendChatFromChip(this)">' + escHtml(followup) + '</div>').join('') + '</div>';
          html += '</div>';
        }
      });
    }
    html += '</div><div class="chat-input-bar"><input id="chat-input" placeholder="Ask about your voice biomarkers, treatment, scans, or medications..." onkeydown="if(event.key===\'Enter\')sendChat()"><button class="chat-send" onclick="sendChat()">→</button></div></div>';
    $('page-ai').innerHTML = html;
    scrollChatBottom();
  };

  window.callRespiraAI = async function callRespiraAILaunch(userMessage) {
    const patient = getPatient() || {};
    const checkins = getCheckins();
    const last = checkins[checkins.length - 1] || {};
    const prompt = 'You are Respira AI. Answer in plain, calm English with no markdown bullets. You can explain the RecurVoice-style tasks, the sustained AAAAAHHH task, the daily sentence, and the meaning of HNR, jitter, shimmer, pitch, cough level, and voice trend alerts. Never diagnose. Say "care team" instead of "oncologist". Current patient context: name ' + (patient.name || 'patient') + ', treatment ' + (patient.treatmentProtocol || 'not listed') + ', stage ' + (patient.cancerStage || 'not listed') + ', latest voice alert ' + (last.voiceAlertLevel || 'not available') + ', latest voice probability ' + (last.voiceProbability == null ? 'not available' : String(last.voiceProbability)) + ', HNR ' + (last.voiceHnr == null ? 'not available' : String(last.voiceHnr)) + ', jitter ' + (last.voiceJitter == null ? 'not available' : String(last.voiceJitter)) + ', shimmer ' + (last.voiceShimmer == null ? 'not available' : String(last.voiceShimmer)) + ', pitch ' + (last.voicePitch == null ? 'not available' : String(last.voicePitch)) + '. User question: ' + userMessage + '. After your answer write exactly: ||FOLLOWUPS: [What does HNR mean?] | [How should I do the AAAAAHHH task?]';
    return await window.callAI(prompt);
  };

  function buildTimelineEvents() {
    const patient = getPatient() || {};
    const alerts = getAlerts();
    const scans = getScans();
    const notes = safeParse(localStorage.getItem('respira_notes'), []);
    const events = [];
    if (patient.diagnosisDate) events.push({ id: 'diagnosis', date: patient.diagnosisDate, label: 'Diagnosis date', detail: patient.histology || 'Initial diagnosis on file.', type: 'treatment' });
    if (patient.treatmentStartDate) events.push({ id: 'treatment-start', date: patient.treatmentStartDate, label: 'Treatment started', detail: patient.treatmentProtocol || 'Treatment plan begins.', type: 'treatment' });
    if (patient.nextInfusionDate) events.push({ id: 'next-infusion', date: patient.nextInfusionDate, label: 'Next infusion', detail: patient.cycleSchedule || 'Upcoming infusion visit.', type: 'treatment' });
    if (patient.nextAppointmentDate) events.push({ id: 'next-visit', date: patient.nextAppointmentDate, label: 'Clinic follow-up', detail: patient.careSite || 'Upcoming clinic visit.', type: 'treatment' });
    if (patient.ctScanDate) events.push({ id: 'next-scan', date: patient.ctScanDate, label: 'Next scan', detail: 'Planned imaging review.', type: 'scan' });
    scans.forEach((scan) => {
      events.push({ id: 'scan-' + scan.id, date: scan.examDate || scan.date, label: scan.modality || 'Imaging upload', detail: scan.summary || scan.filename || 'Scan saved.', type: 'scan' });
    });
    alerts.slice(-5).forEach((alert, index) => {
      events.push({ id: 'alert-' + index + '-' + alert.id, date: toLocalDateString(alert.timestamp || todayStr()), label: 'Trend alert', detail: alert.message, type: 'alert' });
    });
    notes.slice(-5).forEach((note, index) => {
      events.push({ id: 'note-' + index, date: note.date || todayStr(), label: 'Patient note', detail: note.text, type: 'note' });
    });
    return events
      .filter((event) => event.date)
      .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
  }

  window.renderTimeline = function renderTimelineLaunch() {
    const patient = getPatient() || {};
    const voiceTrend = getAudioTrendState();
    const events = buildTimelineEvents();
    const selected = events.find((event) => event.id === timelineSelectedId) || events[events.length - 1];
    let html = '<h2 class="page-title">Timeline</h2>';
    html += '<div class="timeline-shell"><div class="health-sync-banner"><div class="launch-badge">Personal timeline</div><p class="text-sm text-sec mt-12">Respira now builds this view from your own treatment dates, uploaded scan reports, notes, and trend alerts instead of one fixed demo story.</p><div class="sync-stat-grid"><div class="sync-stat"><div class="value">' + (patient.treatmentProtocol ? 'Week ' + getWeekOfTreatment() : 'Setup') + '</div><div class="label">Current phase</div></div><div class="sync-stat"><div class="value">' + (patient.nextInfusionDate ? formatDate(patient.nextInfusionDate) : 'Not set') + '</div><div class="label">Next infusion</div></div><div class="sync-stat"><div class="value">' + (voiceTrend.calibration_complete ? (voiceTrend.current_alert_level || 'STABLE') : Math.round(clamp((voiceTrend.calibration_pool || []).length / (voiceTrend.calibration_days || 14), 0, 1) * 100) + '%') + '</div><div class="label">Voice baseline</div></div></div></div>';
    if (!events.length) {
      html += '<div class="empty-state-card">Add your treatment dates or upload a report and your timeline will appear here.</div>';
    } else {
      html += '<div class="timeline-events-v2">';
      events.forEach((event) => {
        const active = selected && selected.id === event.id ? ' active' : '';
        html += '<button class="timeline-card-v2' + active + '" onclick="openTimelineEvent(\'' + event.id + '\')" style="text-align:left"><div class="timeline-row"><span class="timeline-dot ' + escHtml(event.type) + '"></span><div><p class="text-bold">' + escHtml(event.label) + '</p><p class="text-xs text-light mt-4">' + formatDate(event.date) + '</p><p class="text-sm text-sec mt-8">' + escHtml(String(event.detail || '').slice(0, 150)) + '</p></div></div></button>';
      });
      html += '</div>';
    }
    if (selected) {
      html += '<div class="timeline-aside"><div class="launch-badge">Selected event</div><p class="text-lg text-bold mt-12">' + escHtml(selected.label) + '</p><p class="text-xs text-light mt-4">' + formatDate(selected.date) + '</p><div class="timeline-aside-card mt-16"><p class="text-sm">' + escHtml(selected.detail || 'No details available.') + '</p></div></div>';
    }
    html += '</div>';
    $('page-timeline').innerHTML = html;
  };

  window.openTimelineEvent = function openTimelineEventLaunch(id) {
    timelineSelectedId = id;
    renderTimeline();
  };

  function buildEducationModules() {
    const patient = getPatient() || {};
    const symptoms = getSymptoms().slice(-14).flatMap((entry) => entry.symptoms || []);
    const frequentSymptoms = Array.from(new Set(symptoms)).slice(0, 3);
    const treatmentText = String(patient.treatmentProtocol || '').toLowerCase();
    const modules = [
      {
        id: 'score-basics',
        title: 'How Respira reads your check-in',
        time: '3 min',
        emoji: '🫁',
        summary: 'What the health score, cough level, voice trend, and imported vitals mean together.',
        sections: [
          { heading: 'Health score', body: 'Respira now calculates your score from cough burden, voice drift, how you felt, response speed, symptoms, and imported vitals. There is no random scoring in the daily summary anymore.' },
          { heading: 'Voice baseline', body: 'The voice diary builds a personal baseline over time. During calibration, Respira learns what is normal for you before it starts flagging drift.' }
        ]
      },
      {
        id: 'treatment-plan',
        title: patient.treatmentProtocol ? 'Your current treatment plan' : 'Organizing your treatment plan',
        time: '4 min',
        emoji: '💊',
        summary: patient.treatmentProtocol ? 'A plain-language explainer built from the regimen in your intake details.' : 'How to use Respira to keep treatment dates, drug names, and scans in one place.',
        sections: [
          { heading: 'What Respira stores', body: patient.treatmentProtocol ? 'Your current plan is listed as ' + patient.treatmentProtocol + '. Treatment drugs are stored separately so timelines, education, and reports can stay specific to you.' : 'Add the exact treatment name, schedule, and visit dates during onboarding or in settings so your reminders and education cards stay personal.' },
          { heading: 'What to bring to visits', body: 'Use the weekly or monthly report together with scan summaries and symptom notes so your care team sees the whole pattern, not a single day.' }
        ]
      }
    ];
    if (patient.biomarkers && (patient.biomarkers.egfr || patient.biomarkers.alk || patient.biomarkers.ros1 || patient.biomarkers.pdl1_tps)) {
      modules.push({
        id: 'biomarkers',
        title: 'Biomarkers in your chart',
        time: '3 min',
        emoji: '🧬',
        summary: 'A quick refresher on the biomarker details already saved in your profile.',
        sections: [
          { heading: 'What is on file', body: 'Respira has EGFR ' + (patient.biomarkers.egfr || 'not listed') + ', ALK ' + (patient.biomarkers.alk || 'not listed') + ', ROS1 ' + (patient.biomarkers.ros1 || 'not listed') + ', and PD-L1 ' + (patient.biomarkers.pdl1_tps || 'not listed') + '%.' },
          { heading: 'Why it matters', body: 'These details can influence the treatments your care team discusses. Keep them updated when a new pathology or molecular report arrives.' }
        ]
      });
    }
    if (patient.ctScanDate || getScans().length) {
      modules.push({
        id: 'scan-prep',
        title: 'Making scans easier to understand',
        time: '4 min',
        emoji: '🩻',
        summary: 'How to upload reports, compare scans, and turn imaging language into questions for your next visit.',
        sections: [
          { heading: 'Upload the report too', body: 'Respira is strongest when you upload the written radiology report or a screenshot of it. That gives the scan page enough text to build a patient-friendly summary.' },
          { heading: 'Compare over time', body: 'Use the compare tool to line up earlier and later reports. It highlights whether the newer report sounds stable, more reassuring, or more concerning.' }
        ]
      });
    }
    if (frequentSymptoms.length) {
      modules.push({
        id: 'symptom-support',
        title: 'Support for your recent symptoms',
        time: '3 min',
        emoji: '🌿',
        summary: 'Education cards now reflect the symptoms you actually logged instead of one demo patient.',
        sections: [
          { heading: 'What Respira noticed', body: 'Recent symptom entries included ' + frequentSymptoms.join(', ') + '.' },
          { heading: 'How to use that', body: 'Bring the pattern, not just a memory, to visits. When a symptom lines up with a scan, vital, or cough change, it becomes much easier to discuss.' }
        ]
      });
    }
    if (treatmentText.includes('pembro') || treatmentText.includes('keytruda') || treatmentText.includes('nivolumab') || treatmentText.includes('immun')) {
      modules.push({
        id: 'immunotherapy',
        title: 'Questions to ask about immunotherapy days',
        time: '3 min',
        emoji: '🛡️',
        summary: 'A general guide for infusion days, fatigue tracking, and when to mention new breathing symptoms.',
        sections: [
          { heading: 'Daily pattern tracking', body: 'Check-ins are most useful when they are frequent enough to show a baseline before infusion and a recovery pattern afterward.' },
          { heading: 'When to call', body: 'If cough, breathing, or fatigue changes are more than a one-day wobble, mention the trend and the dates instead of waiting for the next infusion alone.' }
        ]
      });
    }
    if (patient.caregiver && (patient.caregiver.name || patient.caregiver.email)) {
      modules.push({
        id: 'caregiver',
        title: 'Keeping caregivers in the loop',
        time: '2 min',
        emoji: '🤝',
        summary: 'A practical way to share trend information without rewriting everything by hand.',
        sections: [
          { heading: 'What to share', body: 'Use the report export, scan summary, and timeline together. That gives caregivers the same factual picture you see in the app.' },
          { heading: 'Why this changed', body: 'Respira removed one-user demo stories from education and now pulls caregiver context from your own stored profile.' }
        ]
      });
    }
    modules.push({
      id: 'privacy',
      title: 'Privacy-first mode in Respira',
      time: '2 min',
      emoji: '🔒',
      summary: 'Why uploads are now processed locally first and what still depends on deployment choices outside the browser.',
      sections: [
        { heading: 'What changed', body: 'Remote AI is off by default. Intake documents, Apple Health exports, and report text are processed locally first.' },
        { heading: 'What still matters', body: 'True HIPAA readiness still depends on secure hosting, access control, audit retention, encrypted storage, and business associate agreements outside this static site.' }
      ]
    });
    return modules;
  }

  window.renderEducation = function renderEducationLaunch() {
    const modules = buildEducationModules();
    const bookmarks = getBookmarks().map(String);
    let html = '<h2 class="page-title">Education</h2><div class="launch-hero"><div class="launch-badge">Personalized reading</div><p class="text-sm text-sec mt-12">These cards are now built from your treatment details, scan schedule, biomarkers, recent symptoms, and caregiver setup instead of one hardcoded patient.</p></div><input class="input mb-24" id="edu-search" placeholder="Search education..." oninput="filterEducation()"><div id="edu-list" class="edu-collection">';
    modules.forEach((module) => {
      const saved = bookmarks.includes(String(module.id));
      html += '<div class="edu-card-v2" data-title="' + escHtml((module.title + ' ' + module.summary).toLowerCase()) + '" onclick="openArticle(\'' + escHtml(String(module.id)) + '\')"><div class="edu-art">' + escHtml(module.emoji) + '</div><div class="edu-card-body"><div class="flex justify-between items-start gap-8"><div><h3>' + escHtml(module.title) + '</h3><p class="text-sm text-sec mt-8">' + escHtml(module.summary) + '</p></div><button class="btn btn-outline text-xs" onclick="event.stopPropagation();toggleBookmark(\'' + escHtml(String(module.id)) + '\')">' + (saved ? '★ Saved' : '☆ Save') + '</button></div><div class="edu-meta"><span class="metric-chip">' + escHtml(module.time) + '</span></div></div></div>';
    });
    html += '</div><div id="edu-article" class="hidden"></div>';
    $('page-education').innerHTML = html;
  };

  window.filterEducation = function filterEducationLaunch() {
    const query = String($('edu-search') && $('edu-search').value || '').toLowerCase();
    document.querySelectorAll('.edu-card-v2').forEach((card) => {
      card.style.display = card.dataset.title.indexOf(query) >= 0 ? '' : 'none';
    });
  };

  window.openArticle = function openArticleLaunch(id) {
    const module = buildEducationModules().find((item) => String(item.id) === String(id));
    if (!module) return;
    $('edu-list').classList.add('hidden');
    $('edu-article').classList.remove('hidden');
    $('edu-article').innerHTML = '<div class="edu-article-shell" style="padding:24px"><button class="btn btn-outline mb-16" onclick="closeArticle()">← Back</button><div class="edu-art" style="border-radius:16px;border:1px solid var(--border)">' + escHtml(module.emoji) + '</div><h2 class="text-xl text-bold mt-16">' + escHtml(module.title) + '</h2><p class="text-xs text-light mt-8">' + escHtml(module.time) + '</p>' + module.sections.map((section) => '<div class="edu-section-block mt-16"><p class="text-bold mb-8">' + escHtml(section.heading) + '</p><p class="text-sm">' + escHtml(section.body) + '</p></div>').join('') + '</div>';
  };

  window.closeArticle = function closeArticleLaunch() {
    $('edu-list').classList.remove('hidden');
    $('edu-article').classList.add('hidden');
  };

  window.toggleBookmark = function toggleBookmarkLaunch(id) {
    let bookmarks = getBookmarks().map(String);
    const nextId = String(id);
    if (bookmarks.includes(nextId)) bookmarks = bookmarks.filter((item) => item !== nextId);
    else bookmarks.push(nextId);
    localStorage.setItem('respira_bookmarks', JSON.stringify(bookmarks));
    renderEducation();
  };

  function buildRespiraAIContextSnippet() {
    const patient = getPatient() || {};
    const latestCheckin = getCheckins().slice(-1)[0] || {};
    const medications = getLaunchMedications().slice(0, 6).map((item) => item.name).filter(Boolean);
    return [
      'Patient name: ' + (patient.name || 'patient'),
      'Cancer stage: ' + (patient.cancerStage || 'not listed'),
      'Treatment plan: ' + (patient.treatmentProtocol || 'not listed'),
      'Cycle schedule: ' + (patient.cycleSchedule || 'not listed'),
      'Histology: ' + (patient.histology || 'not listed'),
      'Clinician: ' + (patient.oncologistName || 'not listed'),
      'Medications: ' + (medications.length ? medications.join(', ') : 'none listed'),
      'Latest health score: ' + (latestCheckin.healthScore == null ? 'not available' : latestCheckin.healthScore),
      'Latest cough level: ' + (latestCheckin.coughLevel == null ? 'not available' : latestCheckin.coughLevel + '/10'),
      'Latest voice trend: ' + (latestCheckin.voiceAlertLevel || 'not available'),
      'Next visit: ' + (patient.nextAppointmentDate ? formatDate(patient.nextAppointmentDate) : 'not listed'),
      'Next infusion: ' + (patient.nextInfusionDate ? formatDate(patient.nextInfusionDate) : 'not listed'),
      'Uploaded records are already applied to the profile internally. Do not mention filenames unless the user explicitly asks.'
    ].join('\n');
  }

  function buildLocalRespiraAIReplyLaunch(userMessage) {
    const patient = getPatient() || {};
    const checkins = getCheckins();
    const last = checkins[checkins.length - 1] || {};
    const trend = getAudioTrendState();
    const sentence = sentenceForTodayLaunch();
    const question = String(userMessage || '').toLowerCase();
    let response = 'Respira AI can explain your check-ins, medications, treatment plan, visit prep, and voice trend alerts.';
    if (/^(hi|hey|hello|yo|sup|what(?:\'| i)?s up|whats up)\b/.test(question)) {
      response = 'Hello. I can help with your medication plan, recent check-in trends, or what to bring up at the next visit.';
    } else if (/health score|score|recent check-?ins|trend/.test(question)) {
      response = 'Your latest saved health score is ' + (last.healthScore == null ? 'not available yet' : last.healthScore) + '. Respira combines cough burden, voice trend, how you felt, and recent check-in data so the score reflects change over time rather than one isolated number.';
    } else if (/medication|meds|drug|schedule|plan/.test(question)) {
      response = patient.treatmentProtocol
        ? 'Your current plan is listed as ' + patient.treatmentProtocol + (patient.cycleSchedule ? ' on a ' + patient.cycleSchedule + ' schedule.' : '.') + ' Medication details in Respira come from the structured profile, so the chat should focus on the plan rather than file names.'
        : 'Respira can track regimen drugs, supportive medications, and schedules once they are saved from your upload or profile.';
    } else if (/report|document|upload|timeline|profile/.test(question)) {
      response = 'When a report is uploaded, Respira should pull the useful medical details into your profile, medication list, visit dates, and timeline. The chat should answer from those applied fields instead of repeating document names.';
    }
    if (/hnr|jitter|shimmer|pitch/.test(question)) {
      response = 'HNR tells you how clear and harmonic the sustained vowel sounded. Jitter shows how much pitch wobbled cycle to cycle, shimmer shows how much loudness changed cycle to cycle, and pitch is the average frequency of the sample. Respira compares those readings against your own earlier recordings instead of a generic patient.';
      if (last.voiceHnr != null || last.voiceJitter != null || last.voiceShimmer != null || last.voicePitch != null) {
        response += ' Your latest saved values were HNR ' + (last.voiceHnr == null ? 'not available' : last.voiceHnr) + ', jitter ' + (last.voiceJitter == null ? 'not available' : last.voiceJitter) + ', shimmer ' + (last.voiceShimmer == null ? 'not available' : last.voiceShimmer) + ', and pitch ' + (last.voicePitch == null ? 'not available' : last.voicePitch) + '.';
      }
    } else if (/aaaa|ahh|sentence|voice task|voice lab|voice check/.test(question)) {
      response = 'For the Respira voice task, first hold one steady long ahh for about five seconds. Then make a separate recording of the daily sentence in your normal speaking voice: "' + sentence + '". Stay close to the microphone, avoid background noise, and finish both recordings before moving on so Respira can score the acoustic metrics and save the spoken transcript.';
    } else if (/trend|baseline|calibrat|drift|cusum|alert/.test(question)) {
      response = trend.calibration_complete
        ? 'Your voice baseline is calibrated. Respira compares today\'s sample against your own earlier voice recordings and tracks whether the drift is stable, watch, early warning, or urgent. The current voice trend state is ' + (trend.current_alert_level || 'STABLE') + '.'
        : 'Respira is still learning your personal voice baseline. During calibration it stores repeated voice samples, then starts flagging drift only after it has enough recordings to compare against your usual pattern.';
    } else if (/document|upload|timeline|medication|report/.test(question)) {
      response = 'Respira should use uploaded records silently in the background, then answer from the applied profile fields, medications, future appointments, and timeline. If those categories are blank after upload, the document mapping still needs work.';
    }
    return response + ' ||FOLLOWUPS: [What changed in my recent check-ins?] | [What should I bring up at my next visit?]';
  }

  window.callRespiraAI = async function callRespiraAILocalFirst(userMessage) {
    const localFallback = buildLocalRespiraAIReplyLaunch(userMessage);
    const prompt = 'You are Respira AI inside a lung care tracking app. Answer in calm, plain English using short paragraphs. Never diagnose. Use "care team" instead of "oncologist". If the user greets you, greet them naturally and mention one or two things you can help with. Answer from the applied profile context below. Do not mention filenames, raw uploads, OCR, or scans unless the user explicitly asks. Stay practical and specific. End every reply with exactly one line in this format: ||FOLLOWUPS: [first follow-up] | [second follow-up]\n\nContext:\n' + buildRespiraAIContextSnippet() + '\n\nUser question: ' + userMessage;
    if (!remoteAIEnabled()) {
      window.__respiraLastAiMode = 'local';
      return localFallback;
    }
    const response = await window.callAI(prompt, null, null, {
      maxTokens: 600,
      systemPrompt: 'You are a calm healthcare support assistant. Give only the final answer. No hidden reasoning. No <thought> tags. No markdown fences.'
    });
    if (response && String(response).trim()) {
      window.__respiraLastAiMode = 'remote';
      return response;
    }
    window.__respiraLastAiMode = 'local';
    return localFallback;
  };

  function decorateOnboardingBaselineLaunch() {
    const step = $('onboard-4');
    if (!step) return;
    const heading = step.querySelector('h3');
    if (heading && !step.querySelector('.launch-hero')) {
      heading.insertAdjacentHTML('afterend', '<div class="launch-hero mt-16"><div class="launch-badge">Baseline setup</div><p class="text-sm text-sec mt-12">Record one cough, one long ahh, and one sentence so future check-ins have a personal starting point.</p></div>');
    }
    const tabs = step.querySelectorAll('.tab-btn');
    if (tabs[0]) tabs[0].textContent = 'Cough Baseline';
    if (tabs[1]) tabs[1].textContent = 'Respira Voice';
    const cough = $('baseline-cough');
    if (cough && !cough.dataset.launchReady) {
      cough.dataset.launchReady = 'true';
      cough.innerHTML = '<div class="voice-task-card mb-16"><p class="text-xs text-light">Cough task</p><p class="text-bold mt-8">One clean cough</p><p class="text-sm text-sec mt-8">Take a deep breath, hold the phone close, and cough once so Respira can save your baseline cough pattern.</p></div><button class="record-btn" id="baseline-cough-btn" onclick="startBaselineRec(\'cough\')">🎤</button><canvas id="baseline-cough-canvas" class="waveform-canvas" width="300" height="60"></canvas><p class="text-sm text-sec mt-8" id="baseline-cough-status">Ready to record your baseline cough.</p>';
    }
    const voice = $('baseline-voice');
    if (voice && !voice.dataset.launchReady) {
      voice.dataset.launchReady = 'true';
      voice.innerHTML = buildRespiraVoiceHeader() + '<button class="record-btn" id="baseline-voice-btn" onclick="startBaselineRec(\'voice\')">🎤</button><canvas id="baseline-voice-canvas" class="waveform-canvas" width="300" height="60"></canvas><p class="text-sm text-sec mt-8" id="baseline-voice-status">Ready to record your Respira voice baseline.</p>';
    }
  }

  const originalGoOnboardStepLaunch = typeof window.goOnboardStep === 'function' ? window.goOnboardStep : null;
  window.goOnboardStep = function goOnboardStepLaunch(step) {
    if (typeof originalGoOnboardStepLaunch === 'function') originalGoOnboardStepLaunch(step);
    if (Number(step) === 4) decorateOnboardingBaselineLaunch();
  };
  if (typeof onboardStep !== 'undefined' && Number(onboardStep) === 4) decorateOnboardingBaselineLaunch();

  function buildTimelineEventsEnhanced() {
    const patient = getPatient() || {};
    const alerts = getAlerts();
    const notes = safeParse(localStorage.getItem('respira_notes'), []);
    const documents = getDocumentRecords();
    const medications = getLaunchMedications();
    const checkins = getCheckins();
    const events = [];
    const seen = new Set();
    const pushEvent = (event) => {
      if (!event) return;
      const normalizedDate = normalizeDateGuess(event.date || toLocalDateString(event.uploadedAt || todayStr()));
      const detail = cleanDocumentEventText(event.detail || event.text || '');
      const label = String(event.label || launchTimelineLabelFromText(detail, event.sourceContext || event.sourceFile || ''));
      if (!normalizedDate || !label || !detail) return;
      const type = event.type || launchTimelineTypeFromText(detail, event.sourceContext || event.sourceFile || '');
      const key = normalizedDate + '|' + label.toLowerCase() + '|' + detail.toLowerCase().slice(0, 120) + '|' + String(event.sourceFile || '');
      if (seen.has(key)) return;
      seen.add(key);
      events.push({
        id: event.id || (Date.now() + Math.random()),
        date: normalizedDate,
        label,
        detail,
        type,
        sourceFile: event.sourceFile || '',
        sourceContext: event.sourceContext || '',
        uploadedAt: event.uploadedAt || '',
        score: event.score == null ? null : event.score
      });
    };
    if (patient.diagnosisDate) pushEvent({ id: 'diagnosis', date: patient.diagnosisDate, label: 'Diagnosis update', detail: (patient.histology ? titleCaseWords(patient.histology) : 'Diagnosis on file') + (patient.cancerStage ? ' ' + patient.cancerStage : ''), type: 'treatment' });
    if (patient.treatmentStartDate) pushEvent({ id: 'treatment-start', date: patient.treatmentStartDate, label: 'Treatment update', detail: patient.treatmentProtocol || 'Treatment started', type: 'treatment' });
    if (patient.nextInfusionDate) pushEvent({ id: 'next-infusion', date: patient.nextInfusionDate, label: 'Treatment cycle', detail: patient.cycleSchedule || 'Upcoming infusion visit.', type: 'treatment' });
    if (patient.nextAppointmentDate) pushEvent({ id: 'next-visit', date: patient.nextAppointmentDate, label: 'Clinic visit', detail: patient.careSite || 'Upcoming clinic visit.', type: 'treatment' });
    documents.forEach((record) => {
      pushEvent({
        id: 'document-upload-' + record.id,
        date: toLocalDateString(record.uploadedAt || todayStr()),
        label: 'Profile updated',
        detail: record.summary || 'Clinical record applied to the profile.',
        type: 'document',
        sourceFile: '',
        sourceContext: record.context,
        uploadedAt: record.uploadedAt
      });
      (record.timelineNotes || []).forEach((note, index) => {
        pushEvent({
          id: 'document-note-' + record.id + '-' + index,
          date: note.date,
          label: note.label,
          detail: note.text,
          type: note.type || 'document',
          sourceFile: '',
          sourceContext: record.context,
          uploadedAt: record.uploadedAt
        });
      });
    });
    medications.forEach((medication, index) => {
      if (!medication.startDate) return;
      pushEvent({
        id: 'medication-' + index + '-' + medication.id,
        date: medication.startDate,
        label: 'Medication update',
        detail: medication.name + (medication.frequency ? ' · ' + medication.frequency : '.'),
        type: 'treatment'
      });
    });
    alerts.slice(-10).forEach((alert, index) => {
      pushEvent({
        id: 'alert-' + index + '-' + alert.id,
        date: toLocalDateString(alert.timestamp || todayStr()),
        label: 'Trend alert',
        detail: alert.message,
        type: 'alert'
      });
    });
    notes.slice(-10).forEach((note, index) => {
      pushEvent({
        id: 'note-' + index + '-' + note.id,
        date: note.date || todayStr(),
        label: launchTimelineLabelFromText(note.text, 'note'),
        detail: note.text,
        type: launchTimelineTypeFromText(note.text, 'note'),
        sourceFile: ''
      });
    });
    checkins.slice(-7).forEach((entry, index) => {
      const voiceFlag = entry.voiceAlertLevel && entry.voiceAlertLevel !== 'STABLE' && entry.voiceAlertLevel !== 'CALIBRATING';
      const coughFlag = Number(entry.coughLevel || 0) >= 7;
      if (!voiceFlag && !coughFlag) return;
      pushEvent({
        id: 'checkin-' + index + '-' + entry.id,
        date: entry.date,
        label: voiceFlag ? 'Voice alert' : 'Check-in flag',
        detail: 'Health score ' + (entry.healthScore == null ? 'not recorded' : entry.healthScore) + ', cough ' + (entry.coughLevel == null ? 'not recorded' : entry.coughLevel + '/10') + (entry.voiceAlertLevel ? ', voice ' + entry.voiceAlertLevel : '') + '.',
        type: voiceFlag ? 'alert' : 'document',
        score: entry.healthScore
      });
    });
    return events.sort((a, b) => {
      const dateDelta = parseLocalDate(a.date) - parseLocalDate(b.date);
      if (dateDelta !== 0) return dateDelta;
      return String(a.label).localeCompare(String(b.label));
    });
  }

  window.renderTimeline = function renderTimelineEnhanced() {
    const patient = getPatient() || {};
    const voiceTrend = getAudioTrendState();
    const documents = getDocumentRecords();
    const medications = getLaunchMedications();
    const events = buildTimelineEventsEnhanced();
    const selected = events.find((event) => event.id === timelineSelectedId) || events[events.length - 1];
    const lastUpload = documents[0] ? formatDate(toLocalDateString(documents[0].uploadedAt || todayStr())) : 'None';
    let html = '<h2 class="page-title">Timeline</h2>';
    html += '<div class="timeline-shell"><div class="health-sync-banner"><div class="launch-badge">Personal timeline</div><p class="text-sm text-sec mt-12">This view stays focused on your plan, medications, dates, and alerts without repeating raw file names across the app.</p><div class="sync-stat-grid"><div class="sync-stat"><div class="value">' + documents.length + '</div><div class="label">Profile updates</div></div><div class="sync-stat"><div class="value">' + medications.length + '</div><div class="label">Medications tracked</div></div><div class="sync-stat"><div class="value">' + (patient.nextAppointmentDate ? formatDate(patient.nextAppointmentDate) : patient.nextInfusionDate ? formatDate(patient.nextInfusionDate) : 'Not set') + '</div><div class="label">Next touchpoint</div></div><div class="sync-stat"><div class="value">' + (voiceTrend.calibration_complete ? (voiceTrend.current_alert_level || 'STABLE') : Math.round(clamp((voiceTrend.calibration_pool || []).length / (voiceTrend.calibration_days || 14), 0, 1) * 100) + '%') + '</div><div class="label">Voice baseline</div></div><div class="sync-stat"><div class="value">' + lastUpload + '</div><div class="label">Last update</div></div></div></div>';
    if (!events.length) {
      html += '<div class="empty-state-card">Add treatment details or a report and Respira will turn the useful medical dates and plan changes into timeline events here.</div>';
    } else {
      html += '<div class="timeline-events-v2">';
      events.forEach((event) => {
        const active = selected && selected.id === event.id ? ' active' : '';
        html += '<button class="timeline-card-v2' + active + '" onclick="openTimelineEvent(\'' + event.id + '\')" style="text-align:left"><div class="timeline-row"><span class="timeline-dot ' + escHtml(event.type) + '"></span><div><p class="text-bold">' + escHtml(event.label) + '</p><p class="text-xs text-light mt-4">' + formatDate(event.date) + '</p><p class="text-sm text-sec mt-8">' + escHtml(String(event.detail || '').slice(0, 180)) + '</p></div></div></button>';
      });
      html += '</div>';
    }
    if (selected) {
      html += '<div class="timeline-aside"><div class="launch-badge">Selected event</div><p class="text-lg text-bold mt-12">' + escHtml(selected.label) + '</p><p class="text-xs text-light mt-4">' + formatDate(selected.date) + '</p><div class="timeline-fact-grid mt-16"><div class="timeline-fact-card"><p class="text-xs text-light">Type</p><p class="text-sm text-bold mt-6">' + escHtml(selected.type || 'document') + '</p></div></div><div class="timeline-aside-card mt-16"><p class="text-sm">' + escHtml(selected.detail || 'No details available.') + '</p></div></div>';
    }
    html += '</div>';
    $('page-timeline').innerHTML = html;
  };

  window.openTimelineEvent = function openTimelineEventEnhanced(id) {
    timelineSelectedId = id;
    renderTimeline();
  };

  function buildDashboardListItem(label, value) {
    return '<div class="dashboard-list-item"><span class="dashboard-list-label">' + escHtml(label) + '</span><strong>' + escHtml(value) + '</strong></div>';
  }

  function buildCaregiverStatusSummary(patient, latestCheckin, alerts) {
    const patientName = patient && patient.name ? patient.name : 'The patient';
    if (alerts && alerts.length) {
      return patientName + ' needs a closer look today. Main warning: ' + String(alerts[0].message || 'recent symptoms shifted.');
    }
    if (latestCheckin && latestCheckin.healthScore != null) {
      if (latestCheckin.healthScore >= 75) {
        return patientName + ' looks steady today with no major warnings right now.';
      }
      if (latestCheckin.healthScore >= 55) {
        return patientName + ' is mostly steady, but symptoms are worth watching.';
      }
      return patientName + ' had a rougher day and may need follow-up soon.';
    }
    return patientName + ' has no major warnings saved yet.';
  }

  function buildPatientDashboardHtml() {
    const patient = getPatient() || {};
    const checkins = getCheckins();
    const alerts = getAlerts().filter((item) => !item.read);
    const latestCheckin = checkins.slice(-1)[0] || {};
    const medications = getLaunchMedications().slice(0, 4);
    const symptoms = Array.from(new Set(getSymptoms().slice(-14).flatMap((entry) => entry.symptoms || []))).slice(0, 3);
    const nextTouchpoint = patient.nextAppointmentDate || patient.nextInfusionDate || '';
    const healthScore = latestCheckin.healthScore == null ? null : latestCheckin.healthScore;
    const todayTitle = healthScore == null
      ? 'Today starts with one simple check-in.'
      : healthScore >= 75
        ? 'Today looks steady.'
        : 'Today is worth watching a little more closely.';
    const todayCopy = healthScore == null
      ? 'Record one demo check-in so the app can compare cough, voice, and symptoms over time.'
      : alerts.length
        ? alerts[0].message
        : 'Keep the same routine: one short check-in, review the plan, and know the next visit date.';
    return '<div class="dashboard-shell">' +
      '<div class="dashboard-hero-grid">' +
        '<div class="dashboard-hero-main">' +
          '<span class="launch-badge">Patient view</span>' +
          '<h2>' + escHtml(todayTitle) + '</h2>' +
          '<p>' + escHtml('Respira is focused on what matters today: your plan, your next visit, your medications, and one quick check-in.') + '</p>' +
          '<div class="dashboard-quick-actions">' +
            '<button class="btn btn-blue" onclick="startCheckin()">' + escHtml(healthScore == null ? 'Try Demo Check-in' : 'Start Today\'s Check-in') + '</button>' +
            '<button class="btn btn-outline" onclick="navigate(\'reports\')">Review Report</button>' +
            '<button class="btn btn-outline" onclick="navigate(\'ai\')">Ask Respira AI</button>' +
          '</div>' +
        '</div>' +
        '<div class="dashboard-hero-side">' +
          '<p class="dashboard-section-kicker">Coming up next</p>' +
          '<p class="dashboard-side-value">' + escHtml(nextTouchpoint ? formatDate(nextTouchpoint) : 'Add next visit') + '</p>' +
          '<p class="text-sm text-sec mt-8">' + escHtml(nextTouchpoint ? (patient.nextAppointmentDate ? 'Clinic follow-up is already on the calendar.' : 'Infusion date is already saved.') : 'Keep the next appointment or infusion visible so nothing important gets buried.') + '</p>' +
          '<div class="baseline-tip-row mt-12"><span class="document-pill">' + escHtml(patient.cancerStage || 'Stage pending') + '</span><span class="document-pill">' + escHtml(patient.cycleSchedule || 'Schedule pending') + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="dashboard-panel-grid">' +
        '<section class="dashboard-panel">' +
          '<p class="dashboard-section-kicker">Today</p>' +
          '<h3>' + escHtml(healthScore == null ? 'No check-in saved yet' : 'Your latest check-in') + '</h3>' +
          '<p class="text-sm text-sec mt-8">' + escHtml(todayCopy) + '</p>' +
          '<div class="baseline-tip-row mt-16">' +
            '<span class="document-pill">' + escHtml(healthScore == null ? 'Health score pending' : 'Health score ' + healthScore) + '</span>' +
            '<span class="document-pill">' + escHtml(latestCheckin.voiceAlertLevel ? 'Voice ' + latestCheckin.voiceAlertLevel : 'Voice trend pending') + '</span>' +
            '<span class="document-pill">' + escHtml(latestCheckin.feeling ? friendlyFeeling(latestCheckin.feeling) : 'Feeling not saved') + '</span>' +
          '</div>' +
          '<div class="dashboard-task-list mt-16">' +
            '<button class="dashboard-task-row" onclick="startCheckin()"><span>Open check-in</span><strong>' + escHtml(healthScore == null ? '90 sec demo' : 'Start now') + '</strong></button>' +
            '<button class="dashboard-task-row" onclick="navigate(\'ai\')"><span>Ask what changed</span><strong>Respira AI</strong></button>' +
          '</div>' +
        '</section>' +
        '<section class="dashboard-panel">' +
          '<p class="dashboard-section-kicker">Treatment plan</p>' +
          '<h3>' + escHtml(patient.treatmentProtocol || 'Treatment plan pending') + '</h3>' +
          '<p class="text-sm text-sec mt-8">' + escHtml('This is the main regimen and schedule the patient should expect right now.') + '</p>' +
          '<div class="dashboard-list">' +
            buildDashboardListItem('Schedule', patient.cycleSchedule || 'Not set') +
            buildDashboardListItem('Next infusion', patient.nextInfusionDate ? formatDate(patient.nextInfusionDate) : 'Not set') +
            buildDashboardListItem('Clinician', patient.oncologistName || 'Not set') +
          '</div>' +
        '</section>' +
        '<section class="dashboard-panel">' +
          '<p class="dashboard-section-kicker">What to watch</p>' +
          '<h3>' + escHtml(symptoms.length ? symptoms.join(', ') : 'No repeated symptom pattern yet') + '</h3>' +
          '<p class="text-sm text-sec mt-8">' + escHtml(alerts.length ? alerts[0].message : 'When something changes for more than a day, keep the pattern and date in mind for the next visit.') + '</p>' +
          '<div class="dashboard-side-note mt-16">' + escHtml(nextTouchpoint ? 'Next visit focus: bring up cough pattern, breathing changes, and post-treatment fatigue if they continue.' : 'Add the next touchpoint so visit prep stays visible.') + '</div>' +
        '</section>' +
        '<section class="dashboard-panel">' +
          '<p class="dashboard-section-kicker">Medications</p>' +
          '<h3>' + escHtml(medications.length ? medications.map((item) => item.name).slice(0, 2).join(', ') : 'Medication list pending') + '</h3>' +
          '<p class="text-sm text-sec mt-8">' + escHtml(medications.length ? 'The regimen and supportive meds are already tied to the profile.' : 'Upload or review a report to fill the medication list.') + '</p>' +
          '<div class="baseline-tip-row mt-16">' + (medications.length ? medications.map((item) => '<span class="document-pill">' + escHtml(item.name) + '</span>').join('') : '<span class="document-pill">Treatment plan</span>') + '</div>' +
          '<div class="dashboard-task-list mt-16"><button class="dashboard-task-row" onclick="navigate(\'medications\')"><span>Open medications</span><strong>Review</strong></button></div>' +
        '</section>' +
      '</div>' +
    '</div>';
  }

  function buildCaregiverDashboardHtml() {
    const patient = getPatient() || {};
    const caregiver = patient.caregiver || {};
    const checkins = getCheckins();
    const alerts = getAlerts().filter((item) => !item.read);
    const medications = getLaunchMedications().slice(0, 4);
    const latestCheckin = checkins.slice(-1)[0] || {};
    const nextTouchpoint = patient.nextAppointmentDate || patient.nextInfusionDate || '';
    const caregiverName = caregiver.name || 'Caregiver';
    const statusSummary = buildCaregiverStatusSummary(patient, latestCheckin, alerts);
    return '<div class="dashboard-shell">' +
      '<div class="dashboard-hero-grid">' +
        '<div class="dashboard-hero-main">' +
          '<span class="launch-badge">Caregiver view</span>' +
          '<h2>' + escHtml(caregiverName + ', here is what matters for ' + (patient.name || 'the patient') + ' right now.') + '</h2>' +
          '<p>' + escHtml(statusSummary) + '</p>' +
          '<div class="dashboard-quick-actions">' +
            '<button class="btn btn-blue" onclick="navigate(\'ai\')">Ask Respira AI</button>' +
            '<button class="btn btn-outline" onclick="navigate(\'reports\')">Review Reports</button>' +
            '<button class="btn btn-outline" onclick="navigate(\'medications\')">Open Medications</button>' +
          '</div>' +
        '</div>' +
        '<div class="dashboard-hero-side">' +
          '<p class="dashboard-section-kicker">Next touchpoint</p>' +
          '<p class="dashboard-side-value">' + escHtml(nextTouchpoint ? formatDate(nextTouchpoint) : 'Not set') + '</p>' +
          '<p class="text-sm text-sec mt-8">' + escHtml(patient.nextAppointmentDate ? 'Clinic follow-up is next.' : patient.nextInfusionDate ? 'Infusion date is next.' : 'Add the next visit or infusion in the shared profile.') + '</p>' +
          '<div class="baseline-tip-row mt-12"><span class="document-pill">' + escHtml(patient.name || 'Patient') + '</span><span class="document-pill">' + escHtml(patient.cancerStage || 'Stage pending') + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="dashboard-panel-grid">' +
        '<section class="dashboard-panel">' +
          '<p class="dashboard-section-kicker">How Maya is doing</p>' +
          '<h3>' + escHtml(latestCheckin.healthScore == null ? 'No health update saved yet' : 'Latest health summary') + '</h3>' +
          '<p class="text-sm text-sec mt-8">' + escHtml(statusSummary) + '</p>' +
          '<div class="dashboard-list">' +
            buildDashboardListItem('Health score', latestCheckin.healthScore == null ? 'Pending' : String(latestCheckin.healthScore)) +
            buildDashboardListItem('Cough', latestCheckin.coughLevel == null ? 'Pending' : latestCheckin.coughLevel + '/10') +
            buildDashboardListItem('Voice', latestCheckin.voiceAlertLevel || 'Pending') +
            buildDashboardListItem('Feeling', latestCheckin.feeling ? friendlyFeeling(latestCheckin.feeling) : 'Not saved') +
          '</div>' +
        '</section>' +
        '<section class="dashboard-panel">' +
          '<p class="dashboard-section-kicker">Treatment plan</p>' +
          '<h3>' + escHtml(patient.treatmentProtocol || 'Plan not set') + '</h3>' +
          '<p class="text-sm text-sec mt-8">' + escHtml('This keeps the main regimen and dates visible without making the caregiver hunt through the full patient app.') + '</p>' +
          '<div class="dashboard-list">' +
            buildDashboardListItem('Schedule', patient.cycleSchedule || 'Not set') +
            buildDashboardListItem('Next infusion', patient.nextInfusionDate ? formatDate(patient.nextInfusionDate) : 'Not set') +
            buildDashboardListItem('Next visit', patient.nextAppointmentDate ? formatDate(patient.nextAppointmentDate) : 'Not set') +
          '</div>' +
        '</section>' +
        '<section class="dashboard-panel">' +
          '<p class="dashboard-section-kicker">Medications</p>' +
          '<h3>' + escHtml(medications.length ? medications.map((item) => item.name).slice(0, 2).join(', ') : 'No medications saved') + '</h3>' +
          '<p class="text-sm text-sec mt-8">' + escHtml('Medication names stay synced with the patient profile so the caregiver sees the same plan.') + '</p>' +
          '<div class="baseline-tip-row mt-16">' + (medications.length ? medications.map((item) => '<span class="document-pill">' + escHtml(item.name) + '</span>').join('') : '<span class="document-pill">No regimen yet</span>') + '</div>' +
        '</section>' +
        '<section class="dashboard-panel">' +
          '<p class="dashboard-section-kicker">What needs attention</p>' +
          '<h3>' + escHtml(alerts.length ? 'One open alert' : 'No unread alerts') + '</h3>' +
          '<p class="text-sm text-sec mt-8">' + escHtml(alerts.length ? alerts[0].message : 'No major warnings are open right now. Use Respira AI for a plain-language recap before a visit or infusion.') + '</p>' +
          '<div class="dashboard-task-list mt-16">' +
            '<button class="dashboard-task-row" onclick="navigate(\'ai\')"><span>Draft a recap</span><strong>Respira AI</strong></button>' +
            '<button class="dashboard-task-row" onclick="navigate(\'reports\')"><span>Review shared report details</span><strong>Open</strong></button>' +
          '</div>' +
        '</section>' +
      '</div>' +
    '</div>';
  }

  window.renderDashboard = function renderDashboardRefresh() {
    renderDemoSidebarCard();
    renderDemoNavigation();
    $('page-dashboard').innerHTML = getDemoView() === 'caregiver'
      ? buildCaregiverDashboardHtml()
      : buildPatientDashboardHtml();
  };

  function buildEducationVisualLaunch(module) {
    return '<div class="edu-art edu-art-' + escHtml(module.theme || 'teal') + '"><div class="edu-art-visual"><p class="edu-art-kicker">' + escHtml(module.kicker || 'Respira guide') + '</p><p class="edu-art-icon">' + escHtml(module.icon || 'Guide') + '</p></div></div>';
  }

  function buildEducationModulesEnhanced() {
    const patient = getPatient() || {};
    const documents = getDocumentRecords();
    const medications = getLaunchMedications();
    const symptoms = getSymptoms().slice(-14).flatMap((entry) => entry.symptoms || []);
    const frequentSymptoms = Array.from(new Set(symptoms)).slice(0, 3);
    const latestCheckin = getCheckins().slice(-1)[0] || {};
    const treatmentText = String(patient.treatmentProtocol || '').toLowerCase();
    const modules = [
      {
        id: 'score-basics',
        title: 'How Respira reads your check-in',
        time: '3 min',
        summary: 'A plain-language guide to the score, cough reading, voice drift, and imported vitals that appear after a check-in.',
        kicker: 'Daily scoring',
        icon: 'Daily Score',
        theme: 'teal',
        facts: [
          'Health score ' + (latestCheckin.healthScore == null ? 'pending' : latestCheckin.healthScore),
          'Voice ' + (latestCheckin.voiceAlertLevel || 'baseline pending'),
          'Cough ' + (latestCheckin.coughLevel == null ? 'pending' : latestCheckin.coughLevel + '/10')
        ],
        sections: [
          { heading: 'Health score', body: 'Respira combines cough burden, voice drift, how you felt, response speed, and recent health data instead of showing a generic score with no explanation.' },
          { heading: 'Voice baseline', body: 'Your voice results are compared with your own earlier recordings. During calibration, the app learns what is normal for you before stronger flags appear.' }
        ]
      },
      {
        id: 'voice-metrics',
        title: 'What HNR, jitter, shimmer, and pitch actually mean',
        time: '3 min',
        summary: 'A quick guide to the four main voice measurements from the sustained AAAAAHHH recording.',
        kicker: 'Voice metrics',
        icon: 'Voice Signals',
        theme: 'sky',
        facts: [
          latestCheckin.voiceHnr == null ? 'HNR pending' : 'HNR ' + latestCheckin.voiceHnr + ' dB',
          latestCheckin.voiceJitter == null ? 'Jitter pending' : 'Jitter ' + latestCheckin.voiceJitter + '%',
          latestCheckin.voiceShimmer == null ? 'Shimmer pending' : 'Shimmer ' + latestCheckin.voiceShimmer + '%'
        ],
        sections: [
          { heading: 'HNR', body: 'HNR is short for harmonic-to-noise ratio. In plain language, it is one way to estimate how clear and harmonic the sustained vowel sounded.' },
          { heading: 'Jitter and shimmer', body: 'Jitter tracks pitch wobble, and shimmer tracks loudness wobble. Respira watches for changes over time rather than treating one number by itself as a diagnosis.' },
          { heading: 'Pitch', body: 'Pitch is the average frequency of the sample. It works as a reference point, but the most important part is whether your readings drift away from your own earlier baseline.' }
        ]
      },
      {
        id: 'medication-review',
        title: 'Keeping the medication list tied to the document',
        time: '3 min',
        summary: 'How regimen drugs and supportive medications move from the upload into the medication page and timeline.',
        kicker: 'Medication map',
        icon: 'Medication List',
        theme: 'rose',
        facts: [
          medications.length + ' meds tracked',
          patient.cycleSchedule || 'Schedule pending',
          patient.treatmentProtocol || 'Plan not set'
        ],
        sections: [
          { heading: 'What Respira stores', body: medications.length ? 'Respira currently tracks ' + medications.length + ' medication entries tied to your document or profile.' : 'Medication tracking starts once the upload includes a regimen name, a medication line, or a care-plan mention.' },
          { heading: 'Why this page matters', body: 'Medication names are stored separately so reports, education cards, caregiver drafts, and timeline events stay connected to the same record.' }
        ]
      },
      {
        id: 'symptom-support',
        title: 'Using symptom patterns instead of isolated bad days',
        time: '3 min',
        summary: 'Respira works better when symptoms are logged as patterns over days, not as one hard-to-remember note.',
        kicker: 'Symptom map',
        icon: 'Symptom Map',
        theme: 'rose',
        facts: frequentSymptoms.length ? frequentSymptoms : ['Add symptoms', 'Track repeats', 'Compare to uploads'],
        sections: [
          { heading: 'What Respira noticed', body: frequentSymptoms.length ? 'Recent symptom entries included ' + frequentSymptoms.join(', ') + '.' : 'No repeated symptom pattern has been saved recently, so this card stays general until you add more symptom entries.' },
          { heading: 'How to use that', body: 'Bring the pattern, not just a memory, to visits. When a symptom lines up with a scan, vital, or cough change, it becomes much easier to discuss.' }
        ]
      },
      {
        id: 'treatment-plan',
        title: patient.treatmentProtocol ? 'Your current treatment plan' : 'Building your treatment plan',
        time: '4 min',
        summary: patient.treatmentProtocol ? 'A plain-language explainer built from the regimen already saved in your profile.' : 'How Respira organizes treatment names, dates, and medications once a document has been read.',
        kicker: 'Treatment map',
        icon: 'Plan Builder',
        theme: 'teal',
        facts: [
          patient.treatmentProtocol || 'Plan not set',
          medications.length + ' meds tracked',
          patient.nextInfusionDate ? 'Next infusion ' + formatDate(patient.nextInfusionDate) : 'Next infusion not set'
        ],
        sections: [
          { heading: 'What is stored', body: patient.treatmentProtocol ? 'Respira currently lists your plan as ' + patient.treatmentProtocol + '. Medication names are stored separately so the timeline, education cards, and reports stay tied to your own record.' : 'Once a document is read, the app can keep regimen names, drug names, visit dates, and scan dates together instead of leaving them in separate pages.' },
          { heading: 'How to use it', body: 'Review document autofill carefully. A corrected medication or date helps every other page because the rest of the app reads from the same profile and document store.' }
        ]
      },
      {
        id: 'privacy',
        title: 'Privacy-first mode in Respira',
        time: '2 min',
        summary: 'Why uploads are processed locally first and what still depends on deployment choices outside the browser.',
        kicker: 'Launch guardrails',
        icon: 'Privacy Mode',
        theme: 'slate',
        facts: [
          'Remote AI opt-in',
          'Gemma document reading',
          'Needs secure deployment'
        ],
        sections: [
          { heading: 'What changed', body: 'Remote AI is off by default. Text PDFs and Apple Health exports can still be processed locally, while scanned pages and report images are read by Gemma only when you enable Remote AI.' },
          { heading: 'What still matters', body: 'True HIPAA readiness still depends on secure hosting, access control, audit retention, encrypted storage, and business associate agreements outside this static site.' }
        ]
      }
    ];
    if (patient.biomarkers && (patient.biomarkers.egfr || patient.biomarkers.alk || patient.biomarkers.ros1 || patient.biomarkers.pdl1_tps)) {
      modules.push({
        id: 'biomarkers',
        title: 'Biomarkers in your chart',
        time: '3 min',
        summary: 'A quick refresher on the biomarker details already saved in your profile.',
        kicker: 'Pathology basics',
        icon: 'Biomarkers',
        theme: 'slate',
        facts: [
          'EGFR ' + (patient.biomarkers.egfr || 'not listed'),
          'ALK ' + (patient.biomarkers.alk || 'not listed'),
          'PD-L1 ' + (patient.biomarkers.pdl1_tps || 'not listed') + '%'
        ],
        sections: [
          { heading: 'What is on file', body: 'Respira currently stores EGFR ' + (patient.biomarkers.egfr || 'not listed') + ', ALK ' + (patient.biomarkers.alk || 'not listed') + ', ROS1 ' + (patient.biomarkers.ros1 || 'not listed') + ', and PD-L1 ' + (patient.biomarkers.pdl1_tps || 'not listed') + '%.' },
          { heading: 'Why it matters', body: 'These markers can affect which treatments your care team discusses. Update them when a new pathology or molecular report is uploaded.' }
        ]
      });
    }
    if (treatmentText.includes('pembro') || treatmentText.includes('keytruda') || treatmentText.includes('nivolumab') || treatmentText.includes('immun')) {
      modules.push({
        id: 'immunotherapy',
        title: 'Questions to ask about immunotherapy days',
        time: '3 min',
        summary: 'A general guide for infusion days, fatigue tracking, and when to mention new breathing symptoms.',
        kicker: 'Infusion prep',
        icon: 'Infusion Day',
        theme: 'sand',
        facts: [
          patient.cycleSchedule || 'Schedule pending',
          patient.nextInfusionDate ? formatDate(patient.nextInfusionDate) : 'Date pending',
          latestCheckin.feeling || 'No feeling saved'
        ],
        sections: [
          { heading: 'Daily pattern tracking', body: 'Check-ins are most useful when they are frequent enough to show a baseline before infusion and a recovery pattern afterward.' },
          { heading: 'When to call', body: 'If cough, breathing, or fatigue changes are more than a one-day wobble, mention the trend and the dates instead of waiting for the next infusion alone.' }
        ]
      });
    }
    return modules.map((module) => ({ ...module, facts: [] }));
  }

  window.renderEducation = function renderEducationEnhanced() {
    const modules = buildEducationModulesEnhanced();
    const bookmarks = getBookmarks().map(String);
    let html = '<h2 class="page-title">Education</h2><div class="launch-hero"><div class="launch-badge">Personalized reading</div><p class="text-sm text-sec mt-12">These guides focus on your plan, medications, symptoms, and daily trends without cluttering the page with placeholder labels.</p></div><input class="input mb-24" id="edu-search" placeholder="Search education..." oninput="filterEducation()"><div id="edu-list" class="edu-collection">';
    modules.forEach((module) => {
      const saved = bookmarks.includes(String(module.id));
      const searchIndex = [module.title, module.summary]
        .concat(module.facts || [])
        .concat((module.sections || []).map((section) => section.heading + ' ' + section.body))
        .join(' ')
        .toLowerCase();
      html += '<div class="edu-card-v2" data-title="' + escHtml(searchIndex) + '" onclick="openArticle(\'' + escHtml(String(module.id)) + '\')">' + buildEducationVisualLaunch(module) + '<div class="edu-card-body"><div class="flex justify-between items-start gap-8"><div><h3>' + escHtml(module.title) + '</h3><p class="text-sm text-sec mt-8">' + escHtml(module.summary) + '</p></div><button class="btn btn-outline text-xs" onclick="event.stopPropagation();toggleBookmark(\'' + escHtml(String(module.id)) + '\')">' + (saved ? '★ Saved' : '☆ Save') + '</button></div><div class="edu-meta"><span class="metric-chip">' + escHtml(module.time) + '</span></div></div></div>';
    });
    html += '</div><div id="edu-article" class="hidden"></div>';
    $('page-education').innerHTML = html;
  };

  window.filterEducation = function filterEducationEnhanced() {
    const query = String($('edu-search') && $('edu-search').value || '').toLowerCase();
    document.querySelectorAll('.edu-card-v2').forEach((card) => {
      card.style.display = card.dataset.title.indexOf(query) >= 0 ? '' : 'none';
    });
  };

  window.openArticle = function openArticleEnhanced(id) {
    const module = buildEducationModulesEnhanced().find((item) => String(item.id) === String(id));
    if (!module) return;
    $('edu-list').classList.add('hidden');
    $('edu-article').classList.remove('hidden');
    $('edu-article').innerHTML = '<div class="edu-article-shell" style="padding:24px"><button class="btn btn-outline mb-16" onclick="closeArticle()">← Back</button>' + buildEducationVisualLaunch(module) + '<h2 class="text-xl text-bold mt-16">' + escHtml(module.title) + '</h2><p class="text-xs text-light mt-8">' + escHtml(module.time) + '</p>' + module.sections.map((section) => '<div class="edu-section-block mt-16"><p class="text-bold mb-8">' + escHtml(section.heading) + '</p><p class="text-sm">' + escHtml(section.body) + '</p></div>').join('') + '</div>';
  };

  window.closeArticle = function closeArticleEnhanced() {
    $('edu-list').classList.remove('hidden');
    $('edu-article').classList.add('hidden');
  };

  window.toggleBookmark = function toggleBookmarkEnhanced(id) {
    let bookmarks = getBookmarks().map(String);
    const nextId = String(id);
    if (bookmarks.includes(nextId)) bookmarks = bookmarks.filter((item) => item !== nextId);
    else bookmarks.push(nextId);
    localStorage.setItem('respira_bookmarks', JSON.stringify(bookmarks));
    renderEducation();
  };

  function buildCaregiverUpdateBundle() {
    const patient = getPatient() || {};
    const caregiver = patient.caregiver || {};
    const checkins = getCheckins();
    const alerts = getAlerts().filter((alert) => !alert.read);
    const latestCheckin = checkins[checkins.length - 1] || {};
    const latestDoc = getDocumentRecords()[0] || null;
    const healthScore = latestCheckin.healthScore == null ? 'not recorded' : String(latestCheckin.healthScore);
    const coughScore = latestCheckin.coughLevel == null ? 'not recorded' : String(latestCheckin.coughLevel) + '/10';
    const voiceTrendLabel = latestCheckin.voiceAlertLevel || 'baseline pending';
    const nextTouchpoint = patient.nextAppointmentDate || patient.nextInfusionDate || '';
    const subject = 'Respira update for ' + (patient.name || 'patient');
    const caregiverBody = [
      'Respira update for ' + (patient.name || 'the patient') + '.',
      '',
      'Latest health score: ' + healthScore,
      'Latest cough level: ' + coughScore,
      'Latest voice trend: ' + voiceTrendLabel,
      'How they felt: ' + friendlyFeeling(latestCheckin.feeling || latestCheckin.selfReport || 'About the Same'),
      alerts.length ? ('Active unread alerts: ' + alerts.length) : 'Active unread alerts: none',
      latestDoc ? ('Profile was updated from recent records and medications were refreshed.') : 'Profile updates from recent records: none',
      nextTouchpoint ? ('Next touchpoint: ' + formatDate(nextTouchpoint)) : 'Next touchpoint: not set'
    ].join('\n');
    const careTeamBody = [
      'Hello care team,',
      '',
      'Respira summary for ' + (patient.name || 'the patient') + ':',
      'Health score: ' + healthScore,
      'Cough level: ' + coughScore,
      'Voice trend: ' + voiceTrendLabel,
      'Feeling: ' + friendlyFeeling(latestCheckin.feeling || latestCheckin.selfReport || 'About the Same'),
      alerts.length ? ('Unread alerts: ' + alerts.map((alert) => alert.message).join(' | ')) : 'Unread alerts: none',
      latestDoc ? 'Recent records were applied to the profile and medication list.' : 'Recent record updates: none',
      '',
      'Please review if any of this should change follow-up, symptom monitoring, or the next visit plan.'
    ].join('\n');
    return {
      patient,
      caregiver,
      latestCheckin,
      latestDoc,
      alerts,
      subject,
      caregiverBody,
      caregiverSms: caregiverBody.replace(/\n+/g, ' ').slice(0, 320),
      careTeamBody
    };
  }

  function copyTextToClipboardLaunch(text, successMessage) {
    const content = String(text || '').trim();
    if (!content) return;
    navigator.clipboard?.writeText(content).then(() => {
      alert(successMessage || 'Copied to clipboard');
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert(successMessage || 'Copied to clipboard');
    });
  }

  window.renderCaregiver = function renderCaregiverEnhanced() {
    renderDemoSidebarCard();
    renderDemoNavigation();
    $('page-caregiver').innerHTML = buildCaregiverDashboardHtml();
  };

  window.saveCGNote = function saveCGNoteEnhanced() {
    const text = $('cg-note') && $('cg-note').value;
    if (!text) return;
    const notes = safeParse(localStorage.getItem('respira_cg_notes'), []);
    notes.push({ text, ts: Date.now() });
    localStorage.setItem('respira_cg_notes', JSON.stringify(notes));
    renderCaregiver();
  };

  window.copyCGMessage = function copyCGMessageEnhanced(elementId) {
    const targetId = elementId || 'cg-caregiver-message';
    const text = $(targetId) && $(targetId).textContent;
    copyTextToClipboardLaunch(text, 'Draft copied to clipboard');
  };

  window.sendCaregiverEmailDraft = function sendCaregiverEmailDraftLaunch() {
    const bundle = buildCaregiverUpdateBundle();
    if (!bundle.caregiver.email) {
      alert('Add a caregiver email first.');
      return;
    }
    window.location.href = 'mailto:' + encodeURIComponent(bundle.caregiver.email) + '?subject=' + encodeURIComponent(bundle.subject) + '&body=' + encodeURIComponent(bundle.caregiverBody);
  };

  window.sendCaregiverTextDraft = function sendCaregiverTextDraftLaunch() {
    const bundle = buildCaregiverUpdateBundle();
    if (!bundle.caregiver.phone) {
      alert('Add a caregiver phone number first.');
      return;
    }
    const phone = String(bundle.caregiver.phone || '').replace(/[^\d+]/g, '');
    window.location.href = 'sms:' + encodeURIComponent(phone) + '?&body=' + encodeURIComponent(bundle.caregiverSms);
  };

  const baselineVoiceParts = { vowelDone: false, sentenceDone: false, vowelAnalysis: null, sentenceTranscript: '', sentencePrompt: sentenceForTodayLaunch() };

  function baselineTaskBadge(done) {
    return '<span class="baseline-state-pill ' + (done ? 'done' : 'pending') + '">' + (done ? 'Saved' : 'To do') + '</span>';
  }

  function buildBaselineChecklist() {
    return [
      { done: Boolean(baselineDone.cough), label: 'Cough baseline' },
      { done: Boolean(baselineVoiceParts.vowelDone), label: 'Long ahh sample' },
      { done: Boolean(baselineVoiceParts.sentenceDone), label: 'Daily sentence' }
    ];
  }

  function getCurrentBaselineTaskId() {
    if (!baselineDone.cough) return 'cough';
    if (!baselineVoiceParts.vowelDone) return 'vowel';
    if (!baselineVoiceParts.sentenceDone) return 'sentence';
    return 'summary';
  }

  function buildBaselineProgressList() {
    return '<div class="baseline-mini-list">' + buildBaselineChecklist().map((item, index) => '<div class="baseline-mini-item ' + (item.done ? 'done' : '') + '"><span class="baseline-mini-index">' + (index + 1) + '</span><span>' + escHtml(item.label) + '</span></div>').join('') + '</div>';
  }

  function showBaselineSuccessToast(message) {
    const toast = $('baseline-toast');
    if (!toast) return;
    toast.innerHTML = '<div class="baseline-toast-card"><span class="baseline-toast-icon">✓</span><div><p class="text-sm text-bold">Awesome</p><p class="text-xs text-sec mt-4">' + escHtml(message) + '</p></div></div>';
    toast.classList.remove('hidden');
    toast.classList.add('visible');
    clearTimeout(window.__respiraBaselineToastTimer);
    window.__respiraBaselineToastTimer = setTimeout(() => {
      const currentToast = $('baseline-toast');
      if (!currentToast) return;
      currentToast.classList.remove('visible');
      currentToast.classList.add('hidden');
    }, 1800);
  }

  function syncOnboardingBaselineProgress() {
    const finishButton = $('finish-onboard-btn');
    const progressCopy = $('baseline-progress-copy');
    const progressCount = $('baseline-progress-count');
    const progressPill = $('baseline-progress-pill');
    const checklist = buildBaselineChecklist();
    const completed = checklist.filter((item) => item.done).length;
    const remaining = checklist.filter((item) => !item.done);
    const ready = remaining.length === 0;
    if (progressCount) progressCount.textContent = completed + ' of ' + checklist.length + ' recordings complete';
    if (progressCopy) {
      progressCopy.textContent = ready
        ? 'Baseline saved. You can finish setup now.'
        : 'Next: ' + remaining.map((item) => item.label).join(', ') + '.';
    }
    if (progressPill) {
      progressPill.className = 'baseline-state-pill ' + (ready ? 'done' : 'pending');
      progressPill.textContent = ready ? 'Ready' : 'To do';
    }
    if (finishButton) {
      finishButton.style.display = '';
      finishButton.disabled = !ready;
      finishButton.textContent = ready ? 'Finish Setup' : 'Finish setup after remaining recordings';
    }
  }

  function baselineReadyForFinish() {
    baselineDone.voice = Boolean(baselineVoiceParts.vowelDone && baselineVoiceParts.sentenceDone);
    syncOnboardingBaselineProgress();
  }

  function buildBaselineCoughShell() {
    const saved = Boolean(baselineDone.cough);
    const coughStatus = baselineDone.cough
      ? '<div class="baseline-result-card success"><p class="text-sm text-bold">Cough baseline saved</p><p class="text-xs text-sec mt-4">This recording becomes your comparison point for future cough check-ins.</p></div>'
      : '<p class="text-sm text-sec">Tap the mic, take one deep breath, and cough once.</p>';
    return '<div class="voice-task-card baseline-task-card"><div class="baseline-task-head"><div><p class="text-xs text-light">Step 1</p><p class="text-bold mt-8">Cough once</p></div>' + baselineTaskBadge(saved) + '</div><div class="baseline-prompt-card"><p class="text-xs text-light">Instruction</p><p class="text-sm text-bold mt-6">Hold the phone 6-12 inches away, breathe in, and cough once.</p></div><button class="record-btn mt-16" id="baseline-cough-btn" onclick="startBaselineRec(\'cough\')" aria-label="Record cough baseline">' + (saved ? '✓' : '🎤') + '</button><canvas id="baseline-cough-canvas" class="waveform-canvas" width="300" height="60"></canvas><div id="baseline-cough-status" class="baseline-task-status mt-8">' + coughStatus + '</div></div>';
  }

  function buildBaselineVoicePartShell(part) {
    const isVowel = part === 'vowel';
    const done = isVowel ? Boolean(baselineVoiceParts.vowelAnalysis || baselineVoiceParts.vowelDone) : Boolean(baselineVoiceParts.sentenceDone);
    const title = isVowel ? 'Hold one long “ahh”' : 'Read one sentence';
    const step = isVowel ? 'Step 2' : 'Step 3';
    const promptLabel = isVowel ? 'Instruction' : 'Sentence to read';
    const promptText = isVowel ? 'Say “ahhhhh” in one steady tone for about five seconds.' : '"' + escHtml(baselineVoiceParts.sentencePrompt) + '"';
    const buttonId = isVowel ? 'baseline-voice-vowel-btn' : 'baseline-voice-sentence-btn';
    const canvasId = isVowel ? 'baseline-voice-vowel-canvas' : 'baseline-voice-sentence-canvas';
    const statusId = isVowel ? 'baseline-voice-vowel-status' : 'baseline-voice-sentence-status';
    const statusHtml = isVowel
      ? (baselineVoiceParts.vowelAnalysis
          ? '<div class="baseline-result-card success"><p class="text-sm text-bold">Long ahh saved</p><p class="text-xs text-sec mt-4">Voice baseline stored for trend comparison.</p></div>'
          : baselineVoiceParts.vowelDone
            ? '<div class="baseline-result-card warn"><p class="text-sm text-bold">Long ahh saved</p><p class="text-xs text-sec mt-4">The recording was saved, but feature analysis was limited.</p></div>'
            : '<p class="text-sm text-sec">Press record and hold one steady “ahh” for about five seconds.</p>')
      : (baselineVoiceParts.sentenceDone
          ? '<div class="baseline-result-card success"><p class="text-sm text-bold">Sentence saved</p><p class="text-xs text-sec mt-4">' + escHtml(baselineVoiceParts.sentenceTranscript || 'Transcript unavailable, but the recording was saved.') + '</p></div>'
          : '<p class="text-sm text-sec">Read this sentence clearly in your normal voice.</p>');
    return '<div class="voice-task-card baseline-task-card"><div class="baseline-task-head"><div><p class="text-xs text-light">' + step + '</p><p class="text-bold mt-8">' + title + '</p></div>' + baselineTaskBadge(done) + '</div><div class="baseline-prompt-card"><p class="text-xs text-light">' + promptLabel + '</p><p class="text-sm text-bold mt-6">' + promptText + '</p></div><button class="record-btn mt-16" id="' + buttonId + '" onclick="startBaselineVoicePart(\'' + part + '\')" aria-label="' + (isVowel ? 'Record sustained voice baseline' : 'Record spoken sentence baseline') + '">' + (done ? '✓' : '🎤') + '</button><canvas id="' + canvasId + '" class="waveform-canvas" width="300" height="60"></canvas><div id="' + statusId + '" class="baseline-task-status mt-8">' + statusHtml + '</div></div>';
  }

  function buildBaselineSummaryShell() {
    return '<div class="voice-task-card baseline-task-card"><div class="baseline-task-head"><div><p class="text-xs text-light">Complete</p><p class="text-bold mt-8">Baseline ready</p></div><span class="baseline-state-pill done">Saved</span></div><div class="baseline-result-card success"><p class="text-sm text-bold">All three baseline recordings are saved</p><p class="text-xs text-sec mt-4">Future voice and cough check-ins now have a personal starting point.</p></div>' + buildBaselineProgressList() + '</div>';
  }

  function buildBaselineVoiceShell() {
    const vowelDone = Boolean(baselineVoiceParts.vowelAnalysis || baselineVoiceParts.vowelDone);
    const sentenceDone = Boolean(baselineVoiceParts.sentenceDone);
    const vowelStatus = baselineVoiceParts.vowelAnalysis
      ? '<div class="baseline-result-card success"><p class="text-sm text-bold">Long ahh saved</p><p class="text-xs text-sec mt-4">Voice baseline stored for trend comparison.</p></div>'
      : baselineVoiceParts.vowelDone
        ? '<div class="baseline-result-card warn"><p class="text-sm text-bold">Long ahh saved</p><p class="text-xs text-sec mt-4">The recording was saved, but feature analysis was limited.</p></div>'
      : '<p class="text-sm text-sec">Press record and hold one steady “ahh” for about five seconds.</p>';
    const sentenceStatus = sentenceDone
      ? '<div class="baseline-result-card success"><p class="text-sm text-bold">Sentence saved</p><p class="text-xs text-sec mt-4">' + escHtml(baselineVoiceParts.sentenceTranscript || 'Transcript unavailable, but the recording was saved.') + '</p></div>'
      : '<p class="text-sm text-sec">Read this sentence clearly in your normal voice.</p>';
    return '<div class="voice-task-grid mt-16"><div class="voice-task-card baseline-task-card"><div class="baseline-task-head"><div><p class="text-xs text-light">Step 2</p><p class="text-bold mt-8">Hold one long “ahh”</p></div>' + baselineTaskBadge(vowelDone) + '</div><div class="baseline-prompt-card"><p class="text-xs text-light">Instruction</p><p class="text-sm text-bold mt-6">Say “ahhhhh” in one steady tone for about five seconds.</p></div><button class="record-btn mt-16" id="baseline-voice-vowel-btn" onclick="startBaselineVoicePart(\'vowel\')" aria-label="Record sustained voice baseline">' + (vowelDone ? '✓' : '🎤') + '</button><canvas id="baseline-voice-vowel-canvas" class="waveform-canvas" width="300" height="60"></canvas><div id="baseline-voice-vowel-status" class="baseline-task-status mt-8">' + vowelStatus + '</div></div><div class="voice-task-card baseline-task-card"><div class="baseline-task-head"><div><p class="text-xs text-light">Step 3</p><p class="text-bold mt-8">Read one sentence</p></div>' + baselineTaskBadge(sentenceDone) + '</div><div class="baseline-prompt-card"><p class="text-xs text-light">Sentence to read</p><p class="text-sm text-bold mt-6">"' + escHtml(baselineVoiceParts.sentencePrompt) + '"</p></div><button class="record-btn mt-16" id="baseline-voice-sentence-btn" onclick="startBaselineVoicePart(\'sentence\')" aria-label="Record spoken sentence baseline">' + (sentenceDone ? '✓' : '🎤') + '</button><canvas id="baseline-voice-sentence-canvas" class="waveform-canvas" width="300" height="60"></canvas><div id="baseline-voice-sentence-status" class="baseline-task-status mt-8">' + sentenceStatus + '</div></div></div>';
  }

  function renderOnboardingBaselineStep() {
    const stepEl = $('onboard-4');
    if (!stepEl) return;
    const currentTask = getCurrentBaselineTaskId();
    const activeShell = currentTask === 'cough'
      ? buildBaselineCoughShell()
      : currentTask === 'vowel'
        ? buildBaselineVoicePartShell('vowel')
        : currentTask === 'sentence'
          ? buildBaselineVoicePartShell('sentence')
          : buildBaselineSummaryShell();
    stepEl.innerHTML = '<h3 class="mb-16">Set Your Baseline</h3><div class="onboard-baseline-stack"><div id="baseline-toast" class="baseline-toast hidden"></div><div class="voice-task-card baseline-progress-card" id="baseline-progress-card"><div class="baseline-task-head"><div><p class="text-xs text-light">Setup progress</p><p class="text-bold mt-8" id="baseline-progress-count">0 of 3 recordings complete</p></div><span class="baseline-state-pill pending" id="baseline-progress-pill">To do</span></div><p class="text-sm text-sec mt-8" id="baseline-progress-copy">Next: Cough baseline, Long ahh sample, Daily sentence.</p>' + buildBaselineProgressList() + '</div><div id="baseline-active-shell">' + activeShell + '</div></div><button class="btn btn-blue btn-full btn-lg mt-24" id="finish-onboard-btn" onclick="finishOnboarding()">Finish Setup</button><button class="btn btn-outline btn-full mt-8" onclick="finishOnboarding()">Skip Baseline for Now</button>';
    syncWaveformCanvasSizes(stepEl);
    baselineReadyForFinish();
  }

  function syncBaselineVoiceUi() {
    if ($('onboard-4') && $('onboard-4').classList.contains('active')) {
      renderOnboardingBaselineStep();
      return;
    }
    baselineReadyForFinish();
  }

  window.startBaselineVoicePart = async function startBaselineVoicePartLaunch(part) {
    const isVowel = part === 'vowel';
    const button = $(isVowel ? 'baseline-voice-vowel-btn' : 'baseline-voice-sentence-btn');
    const statusEl = $(isVowel ? 'baseline-voice-vowel-status' : 'baseline-voice-sentence-status');
    if (!button || button.classList.contains('recording')) return;
    button.classList.add('recording');
    button.textContent = '⏹';
    if (statusEl) statusEl.innerHTML = '<p class="text-sm text-sec">' + (isVowel ? 'Recording your long “ahh”...' : 'Recording your sentence...') + '</p>';
    const recorder = new AudioRecorder(isVowel ? 'baseline-voice-vowel-canvas' : 'baseline-voice-sentence-canvas', isVowel ? 6 : 8);
    const speechCapture = isVowel ? null : startLiveTranscription();
    recorder.onComplete = async function (result) {
      button.classList.remove('recording');
      button.classList.add('complete');
      button.textContent = '✓';
      if (isVowel) {
        try {
          const analysis = await analyzeVoiceBiomarker(result.blob, false);
          baselineVoiceParts.vowelAnalysis = analysis;
          baselineVoiceParts.vowelDone = true;
          saveAudioBaseline({ voice: { recordedAt: new Date().toISOString(), features: analysis.features } });
          logAudit('baseline_voice_saved', 'long_ahh_sample');
        } catch (error) {
          baselineVoiceParts.vowelDone = true;
          saveAudioBaseline({ voice: { recordedAt: new Date().toISOString(), features: {} } });
          logAudit('baseline_voice_saved', 'long_ahh_limited_analysis');
        }
      } else {
        baselineVoiceParts.sentenceTranscript = speechCapture ? ((await speechCapture.stop()) || '') : '';
        baselineVoiceParts.sentenceDone = true;
        saveAudioBaseline({
          voiceSentence: {
            recordedAt: new Date().toISOString(),
            prompt: baselineVoiceParts.sentencePrompt,
            transcript: baselineVoiceParts.sentenceTranscript
          }
        });
        logAudit('baseline_sentence_saved', baselineVoiceParts.sentenceTranscript || 'no_transcript');
      }
      syncBaselineVoiceUi();
      showBaselineSuccessToast(isVowel ? 'Long ahh recording saved.' : 'Sentence recording saved.');
    };
    try {
      await recorder.start();
      button.onclick = function () { recorder.stop(); };
    } catch (error) {
      button.classList.remove('recording');
      button.textContent = '🎤';
      if (statusEl) statusEl.innerHTML = '<div class="baseline-result-card danger"><p class="text-sm text-bold">Microphone access blocked</p><p class="text-xs text-sec mt-4">Allow microphone access in the browser, or skip baseline setup for now.</p></div>';
    }
  };

  window.startBaselineRec = async function startBaselineRecSplit(type) {
    if (type === 'voice') {
      window.startBaselineVoicePart('vowel');
      return;
    }
    const button = $('baseline-cough-btn');
    const status = $('baseline-cough-status');
    if (!button || button.classList.contains('recording')) return;
    button.classList.add('recording');
    button.textContent = '⏹';
    if (status) status.innerHTML = '<p class="text-sm text-sec">Recording one cough...</p>';
    const recorder = new AudioRecorder('baseline-cough-canvas', 5);
    recorder.onComplete = async function (result) {
      button.classList.remove('recording');
      button.classList.add('complete');
      button.textContent = '✓';
      try {
        const acoustic = await analyzeCoughAcousticProfile(result.blob);
        saveAudioBaseline({
          cough: {
            recordedAt: new Date().toISOString(),
            scores: result.scores,
            features: acoustic.features
          }
        });
        if (status) status.innerHTML = '<div class="baseline-result-card success"><p class="text-sm text-bold">Cough baseline saved</p><p class="text-xs text-sec mt-4">This recording becomes your comparison point for future cough check-ins.</p></div>';
        logAudit('baseline_cough_saved', 'setup_cough_sample');
      } catch (error) {
        if (status) status.innerHTML = '<div class="baseline-result-card warn"><p class="text-sm text-bold">Cough saved</p><p class="text-xs text-sec mt-4">Respira kept the recording, but analysis was limited.</p></div>';
        logAudit('baseline_cough_saved', 'setup_cough_limited_analysis');
      }
      baselineDone.cough = true;
      baselineReadyForFinish();
      if ($('onboard-4') && $('onboard-4').classList.contains('active')) renderOnboardingBaselineStep();
      showBaselineSuccessToast('Cough baseline saved.');
    };
    try {
      await recorder.start();
      button.onclick = function () { recorder.stop(); };
    } catch (error) {
      button.classList.remove('recording');
      button.textContent = '🎤';
      if (status) status.innerHTML = '<div class="baseline-result-card danger"><p class="text-sm text-bold">Microphone access blocked</p><p class="text-xs text-sec mt-4">Allow microphone access in the browser, or skip baseline setup for now.</p></div>';
      baselineReadyForFinish();
    }
  };

  function ensureCIVoiceTasks() {
    if (!ciData.voiceTasks) {
      ciData.voiceTasks = {
        prompt: sentenceForTodayLaunch(),
        vowelDone: false,
        sentenceDone: false,
        vowelAnalysis: null,
        sentenceTranscript: ''
      };
      ciData.voiceSentenceFocusDone = false;
      ciData.voiceAutoAdvanceQueued = false;
    }
    return ciData.voiceTasks;
  }

  function showCheckinSuccessToast(message) {
    const toast = $('checkin-success-toast');
    if (!toast) return;
    toast.classList.remove('hidden');
    toast.innerHTML = '<div class="baseline-toast-card"><span class="baseline-toast-icon">✓</span><div><p class="text-sm text-bold">Awesome</p><p class="text-xs text-sec mt-4">' + escHtml(message) + '</p></div></div>';
    clearTimeout(window.__respiraCheckinToastTimer);
    window.__respiraCheckinToastTimer = setTimeout(() => {
      const currentToast = $('checkin-success-toast');
      if (!currentToast) return;
      currentToast.classList.add('hidden');
      currentToast.innerHTML = '';
    }, 2200);
  }

  let lastCheckinViewportKey = '';

  function resetCheckinViewport(nextKey) {
    const overlay = $('checkin-overlay');
    if (!overlay) return;
    if (nextKey && nextKey === lastCheckinViewportKey) return;
    lastCheckinViewportKey = nextKey || '';
    requestAnimationFrame(() => {
      overlay.scrollTop = 0;
      overlay.scrollLeft = 0;
      if (typeof overlay.scrollTo === 'function') overlay.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  }

  function buildCheckinVoiceProgress(tasks) {
    const items = [
      { label: 'Long ahh', done: tasks.vowelDone },
      { label: 'Sentence', done: tasks.sentenceDone }
    ];
    return '<div class="baseline-mini-list">' + items.map((item, index) => '<div class="baseline-mini-item' + (item.done ? ' done' : '') + '"><span class="baseline-mini-index">' + (item.done ? '✓' : String(index + 1)) + '</span><span>' + escHtml(item.label) + '</span></div>').join('') + '</div>';
  }

  function buildCheckinVoiceCard(tasks) {
    if (!tasks.vowelDone) {
      return '<div class="voice-task-card checkin-focus-card" id="ci-voice-vowel-card"><p class="text-xs text-light">Step 1 of 2</p><p class="text-xl text-bold mt-8">Hold one long “ahh”</p><p class="text-sm text-sec mt-8">Keep your voice steady for about five seconds. Once this is saved, Respira moves you to the sentence.</p><button class="record-btn mt-16" id="ci-voice-vowel-btn" onclick="startCIVoicePart(\'vowel\')">🎤</button><canvas id="ci-voice-vowel-canvas" class="waveform-canvas" width="300" height="60"></canvas><p class="text-xs text-sec mt-8" id="ci-voice-vowel-timer">Ready</p><div id="ci-voice-vowel-status" class="mt-8 baseline-task-status"></div></div>';
    }
    if (!tasks.sentenceDone) {
      return '<div class="voice-task-card checkin-focus-card" id="ci-voice-sentence-card"><p class="text-xs text-light">Step 2 of 2</p><p class="text-xl text-bold mt-8">Read one sentence</p><div class="baseline-prompt-card mt-12"><p class="text-xs text-light">Sentence to read</p><p class="text-bold mt-8">"' + escHtml(tasks.prompt) + '"</p></div><button class="record-btn mt-16" id="ci-voice-sentence-btn" onclick="startCIVoicePart(\'sentence\')">🎤</button><canvas id="ci-voice-sentence-canvas" class="waveform-canvas" width="300" height="60"></canvas><p class="text-xs text-sec mt-8" id="ci-voice-sentence-timer">Ready</p><div id="ci-voice-sentence-status" class="mt-8 baseline-task-status"></div></div>';
    }
    return '<div class="voice-task-card checkin-focus-card"><p class="text-xs text-light">Voice complete</p><p class="text-xl text-bold mt-8">Moving to cough next</p><p class="text-sm text-sec mt-8">Both voice recordings are saved. Respira is taking you to the cough step now.</p></div>';
  }

  function setCIVoicePartButtonState(part, state) {
    const button = $(part === 'vowel' ? 'ci-voice-vowel-btn' : 'ci-voice-sentence-btn');
    if (!button) return;
    button.classList.toggle('recording', state === 'recording');
    button.classList.toggle('complete', state === 'complete');
    button.textContent = state === 'recording' ? '⏹' : state === 'complete' ? '✓' : '🎤';
    button.onclick = state === 'recording'
      ? function () { if (ciRecorder) ciRecorder.stop(); }
      : function () { window.startCIVoicePart(part); };
  }

  function focusCheckinNode(nodeId) {
    const node = $(nodeId);
    if (!node || !node.scrollIntoView) return;
    setTimeout(() => {
      try {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (error) {
        node.scrollIntoView();
      }
    }, 80);
  }

  function queueVoiceToCoughAdvance() {
    if (ciStep !== 2 || ciData.voiceAutoAdvanceQueued) return;
    const tasks = ciData.voiceTasks || {};
    if (!tasks.vowelDone || !tasks.sentenceDone) return;
    ciData.voiceAutoAdvanceQueued = true;
    focusCheckinNode('ci-voice-result');
    setTimeout(() => {
      const latest = ciData.voiceTasks || {};
      if (ciStep !== 2 || !latest.vowelDone || !latest.sentenceDone) {
        ciData.voiceAutoAdvanceQueued = false;
        return;
      }
      ciStep = 3;
      renderCIStep();
    }, 1200);
  }

  function updateCIVoiceTaskUi() {
    const tasks = ensureCIVoiceTasks();
    const vowelStatus = $('ci-voice-vowel-status');
    const sentenceStatus = $('ci-voice-sentence-status');
    const resultEl = $('ci-voice-result');
    setCIVoicePartButtonState('vowel', tasks.vowelDone ? 'complete' : 'idle');
    setCIVoicePartButtonState('sentence', tasks.sentenceDone ? 'complete' : 'idle');
    if (vowelStatus) {
      vowelStatus.innerHTML = tasks.vowelAnalysis
        ? '<div class="card" style="text-align:left"><p class="text-sm text-bold">Long ahh captured</p>' + renderVoiceMetricCards(tasks.vowelAnalysis.features, (getAudioBaseline().voice || {}).features || null) + '</div>'
        : tasks.vowelDone
          ? '<div class="card" style="text-align:left"><p class="text-sm text-bold">Long ahh saved</p><p class="text-sm text-sec mt-8">Audio was captured, but signal metrics were limited. You can still continue.</p></div>'
        : '<p class="text-sm text-sec">Record your long “ahh” sample first.</p>';
    }
    if (sentenceStatus) {
      sentenceStatus.innerHTML = tasks.sentenceDone
        ? '<div class="card" style="text-align:left"><p class="text-sm text-bold">Sentence captured</p><p class="text-sm text-sec mt-8">' + escHtml(tasks.sentenceTranscript || 'Speech recognition was not available in this browser.') + '</p></div>'
        : '<p class="text-sm text-sec">Then read the sentence in your normal voice.</p>';
    }
    if (resultEl) {
      const panels = [];
      if (tasks.vowelDone) {
        panels.push(tasks.vowelAnalysis
          ? '<div class="card" style="text-align:left"><p class="text-sm text-bold">Long ahh captured</p>' + renderVoiceMetricCards(tasks.vowelAnalysis.features, (getAudioBaseline().voice || {}).features || null) + '</div>'
          : '<div class="card" style="text-align:left"><p class="text-sm text-bold">Long ahh saved</p><p class="text-sm text-sec mt-8">Audio was captured, but signal metrics were limited. You can still continue.</p></div>');
      }
      if (tasks.sentenceDone) {
        panels.push('<div class="card" style="text-align:left"><p class="text-sm text-bold">Sentence captured</p><p class="text-sm text-sec mt-8">' + escHtml(tasks.sentenceTranscript || 'Speech recognition was not available in this browser.') + '</p></div>');
      }
      if (tasks.vowelDone && tasks.sentenceDone) {
        panels.push('<div class="card" style="text-align:left"><p class="text-sm text-bold">Voice tasks complete</p><p class="text-sm text-sec mt-8">Moving to cough next. If needed, you can still redo the voice recordings.</p><div class="flex gap-8 mt-12"><button class="btn btn-blue" onclick="ciStep=3;renderCIStep()">Continue to cough</button><button class="btn btn-outline" onclick="ciData.voiceTasks=null;ciData.voiceBiomarker=null;ciData.transcript=\'\';ciData.voiceSentenceFocusDone=false;ciData.voiceAutoAdvanceQueued=false;renderCIStep()">Redo voice tasks</button></div></div>');
      } else {
        panels.push('<p class="text-xs text-sec mt-12">Finish both voice recordings before moving to the cough step.</p>');
      }
      resultEl.innerHTML = panels.join('');
    }
    if (tasks.vowelDone && !tasks.sentenceDone && !ciData.voiceSentenceFocusDone) {
      ciData.voiceSentenceFocusDone = true;
      focusCheckinNode('ci-voice-sentence-card');
    }
    if (tasks.vowelDone && tasks.sentenceDone) queueVoiceToCoughAdvance();
  }

  window.startCIVoicePart = async function startCIVoicePartLaunch(part) {
    const isVowel = part === 'vowel';
    const button = $(isVowel ? 'ci-voice-vowel-btn' : 'ci-voice-sentence-btn');
    const timerEl = $(isVowel ? 'ci-voice-vowel-timer' : 'ci-voice-sentence-timer');
    if (!button || button.classList.contains('recording')) return;
    const tasks = ensureCIVoiceTasks();
    if (isVowel) {
      tasks.vowelDone = false;
      tasks.vowelAnalysis = null;
      ciData.voiceBiomarker = null;
      ciData.voiceSentenceFocusDone = false;
    } else {
      tasks.sentenceDone = false;
      tasks.sentenceTranscript = '';
      ciData.transcript = '';
    }
    ciData.voiceAutoAdvanceQueued = false;
    updateCIVoiceTaskUi();
    setCIVoicePartButtonState(part, 'recording');
    let seconds = 0;
    const timer = setInterval(() => {
      seconds += 1;
      if (timerEl) timerEl.textContent = seconds + 's';
    }, 1000);
    const recorder = new AudioRecorder(isVowel ? 'ci-voice-vowel-canvas' : 'ci-voice-sentence-canvas', isVowel ? 6 : 8);
    ciRecorder = recorder;
    const speechCapture = isVowel ? null : startLiveTranscription();
    recorder.onComplete = async function (result) {
      clearInterval(timer);
      setCIVoicePartButtonState(part, 'complete');
      if (isVowel) {
        try {
          const analysis = await analyzeVoiceBiomarker(result.blob, false);
          tasks.vowelAnalysis = analysis;
          tasks.vowelDone = true;
          ciData.voiceBiomarker = analysis;
        } catch (error) {
          tasks.vowelDone = true;
          ciData.voiceBiomarker = null;
        }
      } else {
        let transcript = '';
        try {
          transcript = speechCapture ? ((await speechCapture.stop()) || '') : '';
        } catch (error) {
          transcript = '';
        }
        tasks.sentenceTranscript = transcript || tasks.prompt;
        tasks.sentenceDone = true;
        ciData.transcript = tasks.sentenceTranscript;
        checkCrisisLanguage(ciData.transcript);
        analyzeDiary(ciData.transcript);
      }
      renderCIStep();
      showCheckinSuccessToast(isVowel ? 'Long ahh saved.' : 'Sentence saved.');
    };
    try {
      await recorder.start();
      setCIVoicePartButtonState(part, 'recording');
    } catch (error) {
      clearInterval(timer);
      setCIVoicePartButtonState(part, 'idle');
      if (timerEl) timerEl.textContent = 'Mic unavailable';
      if (isVowel) {
        tasks.vowelDone = true;
        tasks.vowelAnalysis = null;
        ciData.voiceBiomarker = null;
      } else {
        tasks.sentenceTranscript = tasks.prompt;
        tasks.sentenceDone = true;
        ciData.transcript = tasks.prompt;
        analyzeDiary(tasks.prompt);
      }
      renderCIStep();
    }
  };

  window.renderCIStep = function renderCIStepSplitLaunch() {
    renderCIDots();
    const ct = $('ci-content');
    let viewportKey = String(ciStep);
    if (ciStep === 1) {
      ct.innerHTML = '<div class="checkin-pulse"></div><p class="text-lg mt-24">Tap as soon as the circle turns green.</p><div id="reaction-stage" class="mt-16"><button class="btn btn-outline btn-lg" id="reaction-target" onclick="handleReactionTap()" style="width:220px;height:220px;border-radius:999px;font-size:18px">Wait...</button></div><p class="text-sm text-sec mt-16" id="reaction-help">This checks response speed during today\'s check-in.</p>';
      ciData.reactionStartedAt = 0;
      ciData.reactionReady = false;
      const delay = 1200 + Math.random() * 2200;
      setTimeout(() => {
        const button = $('reaction-target');
        if (!button || ciStep !== 1) return;
        ciData.reactionStartedAt = performance.now();
        ciData.reactionReady = true;
        button.textContent = 'Tap now';
        button.style.background = 'var(--green)';
        button.style.color = '#fff';
        button.style.borderColor = 'var(--green)';
        $('reaction-help').textContent = 'Tap immediately when you see green.';
      }, delay);
    } else if (ciStep === 2) {
      const tasks = ensureCIVoiceTasks();
      ciData.voicePrompt = tasks.prompt;
      const doneCount = (tasks.vowelDone ? 1 : 0) + (tasks.sentenceDone ? 1 : 0);
      const statusLabel = doneCount === 2 ? 'Done' : 'In progress';
      viewportKey = '2:' + (doneCount === 2 ? 'complete' : tasks.vowelDone ? 'sentence' : 'vowel');
      ct.innerHTML = '<div class="checkin-flow-shell"><div id="checkin-success-toast" class="baseline-toast hidden"></div><div class="voice-task-card baseline-progress-card"><div class="baseline-task-head"><div><p class="text-xs text-light">Voice check-in</p><p class="text-bold mt-8">' + doneCount + ' of 2 recordings complete</p></div><span class="baseline-state-pill ' + (doneCount === 2 ? 'done' : 'pending') + '">' + escHtml(statusLabel) + '</span></div><p class="text-sm text-sec mt-8">Respira now walks you through one recording at a time.</p>' + buildCheckinVoiceProgress(tasks) + '</div>' + buildCheckinVoiceCard(tasks) + '<div id="ci-voice-result" class="mt-16"></div><p class="text-xs text-sec mt-12" style="cursor:pointer;text-decoration:underline" onclick="ciData.voiceTasks=null;ciData.transcript=\'\';ciData.diaryResult=\'Looking good\';ciData.voiceSentenceFocusDone=false;ciData.voiceAutoAdvanceQueued=false;ciStep=3;renderCIStep()">Skip voice tasks</p></div>';
      updateCIVoiceTaskUi();
    } else if (ciStep === 3) {
      ct.innerHTML = '<div class="checkin-flow-shell"><div id="checkin-success-toast" class="baseline-toast hidden"></div><div class="voice-task-card checkin-focus-card"><p class="text-xs text-light">Cough step</p><p class="text-xl text-bold mt-8">Take a deep breath and cough once</p><p class="text-sm text-sec mt-8">This gives Respira a cleaner cough comparison for today.</p><button class="record-btn mt-16" id="ci-cough-btn" onclick="startCICough()">🎤</button><canvas id="ci-cough-canvas" class="waveform-canvas" width="300" height="60"></canvas><p class="text-sm text-sec mt-4" id="ci-cough-status"></p><div id="ci-cough-scores" class="mt-16"></div></div><p class="text-xs text-sec mt-12" style="cursor:pointer;text-decoration:underline" onclick="ciData.coughLevel=4;ciStep=4;renderCIStep()">Skip this step</p></div>';
    } else if (ciStep === 4) {
      ct.innerHTML = '<p class="text-lg mb-24">Compared to yesterday, how do you feel?</p><div class="flex-col gap-12"><button class="self-report-btn better" onclick="ciSelfReport(\'Better\')">Better</button><button class="self-report-btn same" onclick="ciSelfReport(\'About the Same\')">About the Same</button><button class="self-report-btn worse" onclick="ciSelfReport(\'Worse\')">Not as Good</button></div>';
    } else if (ciStep === 5) {
      ct.innerHTML = '<p class="text-sm text-sec">Saving your Respira AI results...</p>';
    }
    syncWaveformCanvasSizes(ct);
    resetCheckinViewport(viewportKey);
  };

  window.renderAIChat = function renderAIChatSplitLaunch() {
    const chats = getChats();
    const patient = getPatient() || {};
    const latestCheckin = getCheckins().slice(-1)[0] || {};
    const statusLabel = window.__respiraLastAiMode === 'remote'
      ? 'Gemma reply'
      : window.__respiraLastAiMode === 'local'
        ? 'Local fallback'
        : remoteAIEnabled()
          ? 'Gemma ready'
          : 'Local only';
    const statusClass = window.__respiraLastAiMode === 'local' ? 'metric-chip warn' : 'metric-chip';
    let html = '<div class="respira-ai-shell"><div class="respira-ai-header"><div><h2 class="page-title" style="margin-bottom:6px">Respira AI</h2><p class="text-sm text-sec">Ask about medications, your treatment plan, recent check-ins, or what to bring up next.</p><div class="baseline-tip-row mt-12"><span class="document-pill">' + escHtml(latestCheckin.healthScore == null ? 'No check-in yet' : 'Health score ' + latestCheckin.healthScore) + '</span><span class="document-pill">' + escHtml(patient.treatmentProtocol || 'Treatment plan not set') + '</span><span class="document-pill">' + escHtml(patient.nextAppointmentDate ? ('Next visit ' + formatDate(patient.nextAppointmentDate)) : patient.nextInfusionDate ? ('Next infusion ' + formatDate(patient.nextInfusionDate)) : 'Next visit not set') + '</span></div></div><span class="' + statusClass + '">' + escHtml(statusLabel) + '</span></div>';
    html += '<div class="chat-wrap respira-ai-chat-wrap"><div class="chat-history" id="chat-history">';
    if (chats.length === 0) {
      html += '<div class="chat-chips" id="chat-starters"><div class="chat-chip" onclick="sendChatFromChip(this)">What changed in my recent check-ins?</div><div class="chat-chip" onclick="sendChatFromChip(this)">Explain my medication plan</div><div class="chat-chip" onclick="sendChatFromChip(this)">What should I bring up at my next visit?</div></div>';
    } else {
      chats.forEach((message) => {
        if (message.role === 'user') {
          html += '<div class="chat-msg user"><div class="msg-bubble">' + escHtml(message.text) + '</div><div class="msg-time">' + formatTime(message.ts) + '</div></div>';
        } else {
          html += '<div class="chat-msg ai"><div class="msg-label">respira ai</div><div class="msg-bubble">' + formatAIMsg(message.text) + '</div><div class="msg-time">' + formatTime(message.ts) + '</div>';
          if (message.followups) html += '<div class="flex gap-8 mt-8 flex-wrap">' + message.followups.map((followup) => '<div class="chat-chip" onclick="sendChatFromChip(this)">' + escHtml(followup) + '</div>').join('') + '</div>';
          html += '</div>';
        }
      });
    }
    html += '</div><div class="chat-input-bar"><input id="chat-input" placeholder="Ask Respira AI..." onkeydown="if(event.key===\'Enter\')sendChat()"><button class="chat-send" onclick="sendChat()">→</button></div></div></div>';
    $('page-ai').innerHTML = html;
    syncWaveformCanvasSizes($('page-ai'));
    scrollChatBottom();
  };

  const previousGoOnboardStepLaunch = window.goOnboardStep;
  window.goOnboardStep = function goOnboardStepVoiceLaunch(step) {
    if (typeof previousGoOnboardStepLaunch === 'function') previousGoOnboardStepLaunch(step);
    if (Number(step) !== 4) return;
    renderOnboardingBaselineStep();
  };
  const previousSwitchBaselineTabLaunch = window.switchBaselineTab;
  window.switchBaselineTab = function switchBaselineTabLaunch(tab, btn) {
    if (typeof previousSwitchBaselineTabLaunch === 'function' && $('onboard-4') && $('onboard-4').querySelector('.tab-bar')) previousSwitchBaselineTabLaunch(tab, btn);
    syncWaveformCanvasSizes($('onboard-4'));
  };
  if (typeof onboardStep !== 'undefined' && Number(onboardStep) === 4) window.goOnboardStep(4);

  function renderTermsPage() {
    const page = $('page-terms');
    if (!page) return;
    page.innerHTML = '<div class="auth-wrap"><div class="auth-card" style="max-width:820px"><div class="privacy-card"><div class="auth-brand">respira</div><h2 class="section-title">Privacy, HIPAA, and Launch Notice</h2><p class="text-sm text-sec">Respira now defaults to local-first processing for uploads and trend analysis. That is a better privacy posture than the original demo build, but it is not the same thing as certifying a launch as HIPAA compliant.</p><div class="compliance-list"><div class="compliance-item"><span>1.</span><span><strong>Local by default:</strong> document parsing, Apple Health import, and RecurVoice-style audio analysis run in the browser first.</span></div><div class="compliance-item"><span>2.</span><span><strong>Remote AI is optional:</strong> it stays off unless you enable it in Settings and add your own key.</span></div><div class="compliance-item"><span>3.</span><span><strong>Production controls still required:</strong> secure hosting, encrypted storage, access control, audit retention, breach procedures, and signed BAAs are deployment requirements outside this static codebase.</span></div><div class="compliance-item"><span>4.</span><span><strong>No diagnosis:</strong> Respira organizes trends and reports; it does not replace clinical judgment or emergency care.</span></div></div><div class="flex gap-8 mt-24 flex-wrap"><button class="btn btn-blue" onclick="acceptTermsAndContinue()">I Understand</button><button class="btn btn-outline" onclick="navigate(\'landing\')">Back</button></div></div></div></div>';
  }

  window.renderSettings = function renderSettingsLaunch() {
    const patient = getPatient() || {};
    const user = safeParse(localStorage.getItem('respira_user'), {});
    const apiKey = localStorage.getItem('respira_gemini_key') || localStorage.getItem('respira_openrouter_key') || '';
    const apiBase = getConfiguredOpenRouterBase();
    const apiModel = getConfiguredOpenRouterModel();
    const prefs = safeParse(localStorage.getItem('respira_prefs'), { notifications: true, dailyReminder: true, caregiverAlerts: true, sound: false });
    const audit = getAuditLog().slice(0, 3);
    renderDemoSidebarCard();
    let html = '<h2 class="page-title">Settings</h2>';
    html += '<div class="settings-section"><h3>Profile</h3><div class="grid-2"><div class="form-group"><label class="label">Name</label><input class="input" id="set-name" value="' + escHtml(patient.name || '') + '"></div><div class="form-group"><label class="label">Email</label><input class="input" id="set-email" value="' + escHtml(user.email || '') + '"></div><div class="form-group"><label class="label">Cancer Stage</label><input class="input" id="set-stage" value="' + escHtml(patient.cancerStage || '') + '"></div><div class="form-group"><label class="label">Treatment</label><input class="input" id="set-treatment" value="' + escHtml(patient.treatmentProtocol || '') + '"></div><div class="form-group"><label class="label">Clinician</label><input class="input" id="set-onc" value="' + escHtml(patient.oncologistName || '') + '"></div><div class="form-group"><label class="label">Clinic Phone</label><input class="input" id="set-onc-phone" value="' + escHtml(patient.oncologistContact || '') + '"></div></div><button class="btn btn-blue mt-8" onclick="saveProfile()">Save Profile</button></div>';
    html += '<div class="settings-section"><h3>AI Provider</h3><div class="privacy-card"><div><p class="text-bold">Gemma connection</p><p class="text-sm text-sec mt-4">If a valid key is saved here, Respira AI and document reading will use Gemma automatically.</p></div><div class="grid-2 mt-16"><div class="form-group"><label class="label">API Key</label><input class="input" id="set-api-key" value="' + escHtml(apiKey) + '" placeholder="AIza..."></div><div class="form-group"><label class="label">Model</label><input class="input" id="set-api-model" value="' + escHtml(apiModel) + '" placeholder="gemma-4-31b-it"></div><div class="form-group"><label class="label">API Base URL</label><input class="input" id="set-api-base" value="' + escHtml(apiBase) + '" placeholder="https://generativelanguage.googleapis.com/v1beta"></div><div class="form-group"><label class="label">Status</label><div class="card" style="background:' + (apiKey ? 'var(--green-light)' : 'var(--amber-light)') + ';border-color:' + (apiKey ? '#bbf7d0' : '#fcd34d') + '"><p class="text-sm" style="color:' + (apiKey ? '#166534' : '#92400e') + '">' + (apiKey ? 'Gemma key connected' : 'Gemma key missing') + '</p></div></div></div><button class="btn btn-blue mt-8" onclick="updateApiKey()">Save AI Settings</button><div class="compliance-list"><div class="compliance-item"><span>1.</span><span><strong>Current setup:</strong> browser storage, local audit log, and optional Google Gemma responses for chat and document reading.</span></div><div class="compliance-item"><span>2.</span><span><strong>If you move to Supabase:</strong> you still need proper auth, row-level security, encrypted storage, and a signed BAA-ready deployment plan.</span></div></div></div></div>';
    html += '<div class="settings-section"><h3>Preferences</h3><div class="toggle-row"><label>Daily check-in reminder</label><button class="toggle ' + (prefs.dailyReminder ? 'on' : '') + '" onclick="togglePref(this,\'dailyReminder\')"></button></div><div class="toggle-row"><label>Caregiver alerts</label><button class="toggle ' + (prefs.caregiverAlerts ? 'on' : '') + '" onclick="togglePref(this,\'caregiverAlerts\')"></button></div><div class="toggle-row"><label>Sound effects</label><button class="toggle ' + (prefs.sound ? 'on' : '') + '" onclick="togglePref(this,\'sound\')"></button></div></div>';
    html += '<div class="settings-section"><h3>Data</h3><div class="flex gap-8 flex-wrap"><button class="btn btn-outline" onclick="exportData()">Export All Data (JSON)</button><label class="btn btn-outline" style="cursor:pointer"><input type="file" accept=".json" style="display:none" onchange="importDataBackup(this)">Import Backup</label><button class="btn btn-outline" style="color:var(--red);border-color:var(--red)" onclick="clearAllData()">Clear All Data</button></div><div class="timeline-aside mt-16"><div class="launch-badge">Recent audit events</div>' + (audit.length ? audit.map((item) => '<div class="timeline-aside-card mt-12"><p class="text-xs text-light">' + formatDate(toLocalDateString(item.timestamp)) + '</p><p class="text-sm text-bold mt-4">' + escHtml(item.event.replace(/_/g, ' ')) + '</p><p class="text-sm text-sec mt-4">' + escHtml(item.detail || 'No detail recorded') + '</p></div>').join('') : '<div class="empty-state-card mt-12">No audit events recorded yet.</div>') + '</div></div>';
    html += '<div class="mt-16"><button class="btn btn-outline" onclick="resetDemoData()">Reset Demo Data</button></div>';
    $('page-settings').innerHTML = html;
  };

  window.toggleRemoteAI = function toggleRemoteAILaunch() {
    const next = savePrivacySettings({ remoteAI: !getPrivacySettings().remoteAI });
    logAudit('privacy_toggle', next.remoteAI ? 'remote_ai_enabled' : 'remote_ai_disabled');
    renderSettings();
  };

  window.importDataBackup = async function importDataBackupLaunch(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    try {
      const payload = safeParse(await file.text(), null);
      if (!payload || typeof payload !== 'object') throw new Error('invalid');
      Object.keys(payload).forEach((key) => {
        if (key.startsWith('respira_')) localStorage.setItem(key, JSON.stringify(payload[key]));
      });
      logAudit('backup_import', file.name);
      renderSettings();
      if (localStorage.getItem('respira_user')) navigate(currentPage || 'dashboard');
    } catch (error) {
      alert('That backup file could not be imported.');
    }
  };

  window.updateApiKey = function updateApiKeyLaunch() {
    saveApiKey($('set-api-key') && $('set-api-key').value || '');
    saveOpenRouterConfig($('set-api-base') && $('set-api-base').value || '', $('set-api-model') && $('set-api-model').value || '');
    if (getConfiguredOpenRouterKey()) savePrivacySettings({ remoteAI: true });
    logAudit('ai_provider_updated', getConfiguredOpenRouterModel() + ' @ ' + getConfiguredOpenRouterBase());
    renderSettings();
  };

  window.renderScansPage = function renderScansPageDisabled() {
    if ($('page-dashboard')) navigate('dashboard');
  };

  window.handleScanUpload = function handleScanUploadDisabled() {
    alert('Scans are disabled in this build.');
  };

  const previousNavigateLaunch = typeof window.navigate === 'function' ? window.navigate : null;
  window.navigate = function navigateLaunch(page) {
    const demoView = getDemoView();
    const nextPage = normalizeDemoPage(page, demoView);
    if (typeof previousNavigateLaunch === 'function') return previousNavigateLaunch(nextPage);
    return undefined;
  };

  const previousLogoutLaunch = typeof window.logout === 'function' ? window.logout : null;
  window.logout = function logoutLaunch() {
    seedDemoWorkspace(true);
    renderDemoSidebarCard();
    if (typeof window.navigate === 'function') return window.navigate(getDemoHomePage());
    if (typeof previousLogoutLaunch === 'function') return previousLogoutLaunch();
    return undefined;
  };

  const previousStartCheckinLaunch = typeof window.startCheckin === 'function' ? window.startCheckin : null;
  window.startCheckin = function startCheckinLaunch() {
    lastCheckinViewportKey = '';
    if (typeof previousStartCheckinLaunch === 'function') previousStartCheckinLaunch();
    resetCheckinViewport('1');
  };

  const previousCloseCheckinLaunch = typeof window.closeCheckin === 'function' ? window.closeCheckin : null;
  window.closeCheckin = function closeCheckinLaunch() {
    if (typeof previousCloseCheckinLaunch === 'function') previousCloseCheckinLaunch();
    lastCheckinViewportKey = '';
    const overlay = $('checkin-overlay');
    if (overlay) overlay.scrollTop = 0;
  };

  window.exportData = function exportDataLaunch() {
    const data = {};
    Object.keys(localStorage).filter((key) => key.startsWith('respira_')).forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw != null) data[key] = safeParse(raw, raw);
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = 'respira-export-' + todayStr() + '.json';
    anchor.click();
    logAudit('backup_export', anchor.download);
  };

  function ensurePatientShape() {
    const patient = getPatient() || {};
    let changed = false;
    ['nextAppointmentDate', 'diagnosisDate', 'careSite'].forEach((key) => {
      if (!(key in patient)) {
        patient[key] = '';
        changed = true;
      }
    });
    if (changed) localStorage.setItem('respira_patient', JSON.stringify(patient));
  }

  function rerenderCurrentPage() {
    seedDemoWorkspace(false);
    renderTermsPage();
    ensurePatientShape();
    applyLocalAIConfig();
    purgeScanDataForPrivacy();
    hideScanNavigation();
    if (!localStorage.getItem('respira_user')) return;
    renderDemoSidebarCard();
    renderDemoNavigation();
    const nextPage = normalizeDemoPage(currentPage || 'dashboard', getDemoView());
    if (nextPage !== currentPage) {
      if (typeof window.navigate === 'function') {
        window.navigate(nextPage);
        return;
      }
      currentPage = nextPage;
    }
    if (currentPage === 'dashboard') renderDashboard();
    else if (currentPage === 'ai') renderAIChat();
    else if (currentPage === 'reports') renderReports();
    else if (currentPage === 'health') renderHealth();
    else if (currentPage === 'medications') renderMedications();
    else if (currentPage === 'timeline') renderTimeline();
    else if (currentPage === 'education') renderEducation();
    else if (currentPage === 'caregiver') renderCaregiver();
    else if (currentPage === 'settings') renderSettings();
  }

  if (typeof goOnboardStep === 'function') goOnboardStep = window.goOnboardStep;
  if (typeof handleOnboardFile === 'function') handleOnboardFile = window.handleOnboardFile;
  if (typeof renderOnboardFields === 'function') renderOnboardFields = window.renderOnboardFields;
  if (typeof confirmOnboardInfo === 'function') confirmOnboardInfo = window.confirmOnboardInfo;
  if (typeof renderScansPage === 'function') renderScansPage = window.renderScansPage;
  if (typeof handleScanUpload === 'function') handleScanUpload = window.handleScanUpload;
  if (typeof navigate === 'function') navigate = window.navigate;
  if (typeof renderDashboard === 'function') renderDashboard = window.renderDashboard;
  if (typeof renderCIStep === 'function') renderCIStep = window.renderCIStep;
  if (typeof startCheckin === 'function') startCheckin = window.startCheckin;
  if (typeof closeCheckin === 'function') closeCheckin = window.closeCheckin;
  if (typeof startBaselineRec === 'function') startBaselineRec = window.startBaselineRec;
  if (typeof startCIVoice === 'function') startCIVoice = window.startCIVoice;
  if (typeof renderAIChat === 'function') renderAIChat = window.renderAIChat;
  if (typeof callRespiraAI === 'function') callRespiraAI = window.callRespiraAI;
  if (typeof renderTimeline === 'function') renderTimeline = window.renderTimeline;
  if (typeof openTimelineEvent === 'function') openTimelineEvent = window.openTimelineEvent;
  if (typeof renderEducation === 'function') renderEducation = window.renderEducation;
  if (typeof filterEducation === 'function') filterEducation = window.filterEducation;
  if (typeof openArticle === 'function') openArticle = window.openArticle;
  if (typeof closeArticle === 'function') closeArticle = window.closeArticle;
  if (typeof toggleBookmark === 'function') toggleBookmark = window.toggleBookmark;
  if (typeof renderCaregiver === 'function') renderCaregiver = window.renderCaregiver;
  if (typeof saveCGNote === 'function') saveCGNote = window.saveCGNote;
  if (typeof copyCGMessage === 'function') copyCGMessage = window.copyCGMessage;

  rerenderCurrentPage();
})();
