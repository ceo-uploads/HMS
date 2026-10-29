const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { autoUpdater } = require('electron-updater');
const { loadDatabase, saveDatabase } = require('./js/db-management');
const { createFirebaseSync, loadProjectConfigs } = require('./firebase/firebase');

let mainWindow;
let databaseDirectory;
let legacyDatabaseFile;
let assetsDirectory;
let firebaseSync;
let firebaseSyncInitializationError = null;
let firebaseSyncLastError = null;
let firebaseRetryTimer;
let firebaseRetryInProgress = false;
const updateState = {
  appVersion: app.getVersion(),
  supported: false,
  status: 'starting',
  currentVersion: app.getVersion(),
  availableVersion: null,
  percent: 0,
  transferred: 0,
  total: 0,
  error: null,
  logs: []
};

function publishUpdateState(message, status, details = {}) {
  Object.assign(updateState, details);
  if (status) updateState.status = status;
  if (message) {
    updateState.logs.push({ time: new Date().toISOString(), message, level: updateState.status === 'error' ? 'error' : 'info' });
    updateState.logs = updateState.logs.slice(-80);
  }
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updates:state', { ...updateState, logs: [...updateState.logs] });
}

function readableUpdaterError(error) {
  const message = String(error?.message || error || 'Unknown update error');
  if (/Cannot find latest\.yml/i.test(message)) {
    return 'The latest GitHub release is missing latest.yml. Publish the update again with npm run publish.';
  }
  return message.split(/\r?\n/)[0].slice(0, 500);
}

function configureAutoUpdater() {
  updateState.supported = app.isPackaged;
  updateState.status = app.isPackaged ? 'idle' : 'unsupported';
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  publishUpdateState(app.isPackaged ? `Updater ready for version ${app.getVersion()}.` : 'Updater is available in the installed release.', updateState.status);

  autoUpdater.on('checking-for-update', () => publishUpdateState('Checking GitHub Releases for a newer version.', 'checking', { error: null, availableVersion: null, percent: 0 }));
  autoUpdater.on('update-available', info => publishUpdateState(`Version ${info.version} is available to download.`, 'available', { availableVersion: info.version, releaseName: info.releaseName || '', releaseDate: info.releaseDate || null, releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '', error: null }));
  autoUpdater.on('update-not-available', info => publishUpdateState(`You are up to date. Latest version is ${info.version}.`, 'not-available', { availableVersion: null, latestVersion: info.version, error: null }));
  autoUpdater.on('download-progress', progress => publishUpdateState(`Downloading update: ${Math.round(progress.percent)}% (${progress.transferred} of ${progress.total} bytes).`, 'downloading', { percent: progress.percent, transferred: progress.transferred, total: progress.total }));
  autoUpdater.on('update-downloaded', info => publishUpdateState(`Version ${info.version} is ready to install. Restart to apply it.`, 'downloaded', { availableVersion: info.version, percent: 100, error: null }));
  autoUpdater.on('error', error => {
    const message = readableUpdaterError(error);
    publishUpdateState(message, 'error', { error: message });
  });
}

function initialData() {
  return {
    users: [{ username: 'kph2026', password: 'kph@2026', name: 'Counter' }],
    tests: [
      // Hematology Test
      { id: 'T-001', code: 'CBC', name: 'Complete Blood Count', price: 700 },
      { id: 'T-002', code: 'ESR', name: 'Erythrocyte Sedimentation Rate', price: 200 },
      { id: 'T-003', code: 'Hb%', name: 'Hemoglobin Percentage', price: 200 },
      { id: 'T-004', code: 'MP', name: 'Malarial Parasite', price: 200 },
      { id: 'T-005', code: 'AEC', name: 'Eosinophil Count', price: 200 },
      { id: 'T-006', code: 'BT CT', name: 'Bleeding Time & Clotting Time', price: 600 },
      { id: 'T-007', code: 'PT/APTT', name: 'Prothrombin Time / APTT', price: 1000 },
      { id: 'T-008', code: 'MT', name: 'Mantoux Test', price: 600 },
      { id: 'T-009', code: 'PBF', name: 'Peripheral Blood Film', price: 1000 },
      { id: 'T-010', code: 'Hb Elect', name: 'Hb Electrophoresis', price: 2000 },

      // Biochemical Test
      { id: 'T-011', code: 'FBS', name: 'Fasting Blood Sugar', price: 200 },
      { id: 'T-012', code: 'RBS', name: 'Random Blood Sugar', price: 200 },
      { id: 'T-013', code: 'OGTT', name: 'Oral Glucose Tolerance Test (3 Sample)', price: 600 },
      { id: 'T-014', code: 'FBS 2h 75g', name: 'FBS 2hrs After 75gm Glucose', price: 200 },
      { id: 'T-015', code: 'FBS 2h AB', name: 'FBS 2hrs After Breakfast', price: 200 },
      { id: 'T-016', code: 'CBG', name: 'Capillary Blood Glucose', price: 200 },
      { id: 'T-017', code: 'S. Bili', name: 'Serum Bilirubin', price: 400 },
      { id: 'T-018', code: 'S. Bili T/D/I', name: 'Serum Bilirubin Total/Direct/Indirect', price: 1000 },
      { id: 'T-019', code: 'ALT (SGPT)', name: 'Serum Alanine Aminotransferase', price: 600 },
      { id: 'T-020', code: 'AST (SGOT)', name: 'Serum Aspartate Aminotransferase', price: 600 },
      { id: 'T-021', code: 'ALP', name: 'Alkaline Phosphatase', price: 500 },
      { id: 'T-022', code: 'Urea', name: 'Serum Urea', price: 800 },
      { id: 'T-023', code: 'S. Creatinine', name: 'Serum Creatinine', price: 600 },
      { id: 'T-024', code: 'KFT', name: 'Kidney Function Test', price: 1500 },
      { id: 'T-025', code: 'LFT', name: 'Liver Function Test', price: 2000 },
      { id: 'T-026', code: 'S. BUN', name: 'Serum Blood Urea Nitrogen', price: 500 },
      { id: 'T-027', code: 'S. Uric Acid', name: 'Serum Uric Acid', price: 800 },
      { id: 'T-028', code: 'S. Amylase', name: 'Serum Amylase', price: 1200 },
      { id: 'T-029', code: 'S. Lipase', name: 'Serum Lipase', price: 1200 },
      { id: 'T-030', code: 'TP', name: 'Total Protein', price: 800 },
      { id: 'T-031', code: 'S. Albumin', name: 'Serum Albumin', price: 600 },
      { id: 'T-032', code: 'S. Globulin', name: 'Serum Globulin', price: 800 },
      { id: 'T-033', code: 'S. A/G Ratio', name: 'Serum Albumin/Globulin Ratio', price: 1500 },
      { id: 'T-034', code: 'S. Calcium', name: 'Serum Calcium', price: 800 },
      { id: 'T-035', code: 'LIPID', name: 'Lipid Profile', price: 1200 },
      { id: 'T-036', code: 'HbA1c', name: 'Glycated Hemoglobin', price: 1200 },
      { id: 'T-037', code: 'Trop-I', name: 'Troponin-1', price: 1200 },
      { id: 'T-038', code: 'Iron Profile', name: 'Serum Iron Profile', price: 3500 },
      { id: 'T-039', code: 'Electrolytes', name: 'Serum Electrolytes', price: 1200 },
      { id: 'T-040', code: 'Vit-D', name: 'Vitamin D', price: 4000 },

      // Serological Test
      { id: 'T-041', code: 'Widal', name: 'Widal Test', price: 600 },
      { id: 'T-042', code: 'ASO', name: 'ASO Titre', price: 800 },
      { id: 'T-043', code: 'RA', name: 'RA Test', price: 800 },
      { id: 'T-044', code: 'CRP', name: 'C-Reactive Protein', price: 800 },
      { id: 'T-045', code: 'BG', name: 'Blood Grouping & Rh Factor', price: 200 },
      { id: 'T-046', code: 'VDRL', name: 'VDRL Test', price: 400 },
      { id: 'T-047', code: 'TPHA', name: 'Treponema Pallidum Hemagglutination Assay', price: 800 },
      { id: 'T-048', code: 'TPHA Q&Q', name: 'TPHA Qualitative & Quantitative', price: 1200 },
      { id: 'T-049', code: 'ICT Kalazar', name: 'ICT For Kalazar', price: 1200 },
      { id: 'T-050', code: 'VDRL Q&Q', name: 'VDRL Qualitative & Quantitative', price: 1200 },
      { id: 'T-051', code: 'Febrile Ag', name: 'Febrile Antigen / Triple Antigen', price: 1200 },
      { id: 'T-052', code: 'HIV', name: 'HIV (ICT)', price: 1200 },
      { id: 'T-053', code: 'H. Pylori', name: 'Anti H. Pylori', price: 1200 },
      { id: 'T-054', code: 'ICT TB', name: 'ICT For Tbi/Anti TB IgG+IgM', price: 1200 },
      { id: 'T-055', code: 'Dengue NS1', name: 'Dengue NS1 Antigen', price: 700 },
      { id: 'T-056', code: 'Dengue Ab', name: 'Dengue IgG, IgM', price: 1200 },
      { id: 'T-057', code: 'ICT Filaria', name: 'ICT For Filaria', price: 1200 },
      { id: 'T-058', code: 'ICT Malaria', name: 'ICT For Malarial', price: 1200 },
      { id: 'T-059', code: 'CT TB', name: 'CT For TB', price: 1200 },

      // Hormone Test
      { id: 'T-060', code: 'T3', name: 'Triiodothyronine', price: 500 },
      { id: 'T-061', code: 'T4', name: 'Thyroxine', price: 500 },
      { id: 'T-062', code: 'TSH', name: 'Thyroid Stimulating Hormone', price: 1200 },
      { id: 'T-063', code: 'FT3', name: 'Free Triiodothyronine', price: 1000 },
      { id: 'T-064', code: 'FT4', name: 'Free Thyroxine', price: 1000 },
      { id: 'T-065', code: 'Testosterone', name: 'Serum Testosterone', price: 1500 },
      { id: 'T-066', code: 'Prolactin', name: 'Serum Prolactin', price: 1200 },
      { id: 'T-067', code: 'FSH', name: 'Follicle Stimulating Hormone', price: 1500 },
      { id: 'T-068', code: 'LH', name: 'Luteinizing Hormone', price: 1500 },
      { id: 'T-069', code: 'Progesterone', name: 'Serum Progesterone', price: 1500 },
      { id: 'T-070', code: 'Estrogen', name: 'Oestrogen / Estradiol (Per)', price: 1500 },
      { id: 'T-071', code: 'ANA', name: 'Antinuclear Antibody', price: 1500 },
      { id: 'T-072', code: 'Ferritin', name: 'Serum Ferritin', price: 1200 },
      { id: 'T-073', code: 'IgE', name: 'Serum IgE', price: 1200 },
      { id: 'T-074', code: 'PSA Total', name: 'Prostate Specific Antigen Total', price: 1500 },
      { id: 'T-075', code: 'GH', name: 'Growth Hormone', price: 1500 },
      { id: 'T-076', code: 'PTH', name: 'Para Thyroid Titre', price: 1500 },
      { id: 'T-077', code: 'Cortisol', name: 'Cortisol (Mon/Rva) (Per)', price: 1500 },
      { id: 'T-078', code: 'HLAB 27', name: 'HLA-B27 Antigen', price: 6000 },
      { id: 'T-079', code: 'Anti CCP AB', name: 'Anti-Cyclic Citrullinated Peptide Antibody', price: 2500 },
      { id: 'T-080', code: 'D-Dimer', name: 'D-Dimer Test', price: 2000 },

      // Hepatitis Profile Test
      { id: 'T-081', code: 'HBsAg (Scr)', name: 'HBsAg (Screening)', price: 600 },
      { id: 'T-082', code: 'HCV (Scr)', name: 'HCV (Screening)', price: 1200 },
      { id: 'T-083', code: 'HBsAg (ELISA)', name: 'HBsAg (ELISA)', price: 1200 },
      { id: 'T-084', code: 'HBeAg (ELISA)', name: 'HBeAg (ELISA)', price: 1500 },
      { id: 'T-085', code: 'Anti HBe', name: 'Anti HBe (ELISA)', price: 1500 },
      { id: 'T-086', code: 'Anti HCV', name: 'Anti HCV (ICT/ELISA)', price: 1500 },
      { id: 'T-087', code: 'Anti HBc Total', name: 'Anti HBc IgG/IgM (Per)', price: 1500 },
      { id: 'T-088', code: 'Anti HAV', name: 'Anti HAV IgG/IgM (Per)', price: 1500 },
      { id: 'T-089', code: 'Anti HEV', name: 'Anti HEV IgG/IgM (Per)', price: 1500 },
      { id: 'T-090', code: 'Anti HBV DNA', name: 'Anti HBV DNA Quantitative', price: 8800 },
      { id: 'T-091', code: 'Anti HBc', name: 'Anti HBc Total', price: 1500 },

      // Tumour Marker Test
      { id: 'T-092', code: 'Beta-hcG', name: 'Beta Human Chorionic Gonadotropin', price: 1500 },
      { id: 'T-093', code: 'CA 125', name: 'Cancer Antigen 125', price: 1500 },
      { id: 'T-094', code: 'CA 15.3/19.9', name: 'Cancer Antigen 15.3 / 19.9', price: 1500 },
      { id: 'T-095', code: 'AFP', name: 'ALPHA Feto Protein', price: 1500 },
      { id: 'T-096', code: 'PSA', name: 'Prostate Specific Antigen', price: 1500 },

      // Urine Test
      { id: 'T-097', code: 'Urine R/E (Macro)', name: 'Urine Routine Examination (Macroscopic)', price: 200 },
      { id: 'T-098', code: 'Urine R/E (Auto)', name: 'Urine Routine Examination (Automatic Analyzer)', price: 400 },
      { id: 'T-099', code: 'Urine PT', name: 'Urine Pregnancy Test', price: 200 },
      { id: 'T-100', code: 'Urine Albumin', name: 'Urine Micro Albumin Screening', price: 200 },
      { id: 'T-101', code: '24h Urine Prot', name: '24 Hours Total Urine Protein', price: 1200 },
      { id: 'T-102', code: 'Urine Ketone', name: 'Urine Ketonbody', price: 800 },
      { id: 'T-103', code: 'Urine Micro Alb', name: 'Urine Micro Albumin Quantitative', price: 1200 },

      // Stool Test
      { id: 'T-104', code: 'Stool R/E', name: 'Stool Routine Examination', price: 400 },
      { id: 'T-105', code: 'Stool C/S', name: 'Stool Culture & Sensitivity', price: 1200 },
      { id: 'T-106', code: 'Stool OBT', name: 'Stool Occult Blood Test', price: 800 },

      // Microbiology Test
      { id: 'T-107', code: 'Sputum Gram', name: 'Sputum For Gram Stain', price: 500 },
      { id: 'T-108', code: 'Sputum AFB', name: 'Sputum For AFB Stain', price: 500 },
      { id: 'T-109', code: 'PUS AFB', name: 'PUS For AFB Stain', price: 700 },
      { id: 'T-110', code: 'Skin Fungus', name: 'Skin Scrapings For Fungus', price: 1000 },
      { id: 'T-111', code: 'Blood C/S', name: 'Blood Culture & Sensitivity', price: 2000 },
      { id: 'T-112', code: 'PUS C/S', name: 'PUS Culture & Sensitivity', price: 1500 },
      { id: 'T-113', code: 'Fungus C/S', name: 'Fungus Culture & Sensitivity', price: 1500 },
      { id: 'T-114', code: 'Urine C/S', name: 'Urine Culture & Sensitivity', price: 1200 },
      { id: 'T-115', code: 'Stool C/S Micro', name: 'Stool Culture & Sensitivity', price: 1000 },

      // Others Test
      { id: 'T-116', code: 'ECG', name: 'Electrocardiogram', price: 600 },
      { id: 'T-117', code: 'Echo', name: 'Echocardiogram', price: 2500 },
      { id: 'T-118', code: 'Echo Color Child', name: 'Echocardiogram (Colour Doppler) Child', price: 3000 },
      { id: 'T-119', code: 'EEG', name: 'Electroencephalogram', price: 3000 },
      { id: 'T-120', code: 'Video Endoscopy', name: 'Video Endoscopy', price: 2500 },
      { id: 'T-121', code: 'Video Colonoscopy', name: 'Video Colonoscopy', price: 5000 },
      { id: 'T-122', code: 'Semen Analysis', name: 'Semen Analysis Routine', price: 1200 },
      { id: 'T-123', code: 'Uroflowmetry', name: 'Uroflowmetry Examination', price: 2000 },
      { id: 'T-124', code: 'Spirometry', name: 'Spirometry Lung Function Test', price: 2000 },
      { id: 'T-125', code: 'Pap Smear', name: 'Pap Smear For Cytology', price: 2500 },
      { id: 'T-126', code: 'CT Brain', name: 'CT SCAN of BRAIN', price: 3500 },
      { id: 'T-127', code: 'CT Whole Abdomen', name: 'CT SCAN of Whole Abdomen', price: 12000 },
      { id: 'T-128', code: 'HRCT Chest', name: 'HRCT SCAN of Chest', price: 7000 },
      { id: 'T-129', code: 'CT Chest', name: 'CT SCAN of Chest', price: 7000 },

      // USG Test
      { id: 'T-130', code: 'USG W/A', name: 'USG of Whole Abdomen', price: 1800 },
      { id: 'T-131', code: 'USG L/U/KUB', name: 'USG of Lower/Upper Abdomen/KUB', price: 1400 },
      { id: 'T-132', code: 'USG Pregnancy', name: 'USG of Pregnancy Profile/HDS', price: 1400 },
      { id: 'T-133', code: 'USG Scrotum', name: 'USG of Scrotum/Testises', price: 2500 },
      { id: 'T-134', code: 'USG Breast SGL', name: 'USG of Breast Single', price: 1500 },
      { id: 'T-135', code: 'USG Breast Both', name: 'USG of Breast Both', price: 2500 },
      { id: 'T-136', code: 'USG Anomaly Scan', name: 'USG of Anomaly Scan', price: 3000 },
      { id: 'T-137', code: 'USG ALL Swelling', name: 'USG of ALL Swelling', price: 2500 },
      { id: 'T-138', code: 'USG Thyroid', name: 'USG of Thyroid Gland', price: 2500 },
      { id: 'T-139', code: 'USG Brain', name: 'USG of BRAIN', price: 2500 },
      { id: 'T-140', code: 'Bio-Physical', name: 'Bio-Physical Profile', price: 3500 },
      { id: 'T-141', code: 'Doppler Mass', name: 'Doppler Study of Mass, Tumour & Swelling', price: 3500 },
      { id: 'T-142', code: 'Doppler Preg', name: 'Doppler Study of Pregnancy Profile', price: 3500 },
      { id: 'T-143', code: 'Doppler Thyroid', name: 'Doppler Study of Thyroid Gland', price: 3500 },
      { id: 'T-144', code: 'Doppler USG Penis', name: 'Doppler USG of Penile & Penis', price: 3500 },
      { id: 'T-145', code: 'Duplex Neck', name: 'Duplex Study of Neck Vessels', price: 3500 },
      { id: 'T-146', code: 'Duplex Scrotum', name: 'Duplex Study of Scrotum/Testises', price: 3500 },
      { id: 'T-147', code: 'Duplex R/L Lower', name: 'Duplex USG of Right/Left Lower Limb', price: 3500 },
      { id: 'T-148', code: 'Duplex R/L Upper', name: 'Duplex USG of Right/Left Upper Limb', price: 3500 },

      // X-Ray Test
      { id: 'T-149', code: 'X-Ray Abdomen', name: 'X-Ray Abdomen A/P', price: 700 },
      { id: 'T-150', code: 'X-Ray Lumbar', name: 'X-Ray Lumbar Spine Both View (ALL Big)', price: 700 },
      { id: 'T-151', code: 'X-Ray Ankle/PNS', name: 'X-Ray Both Ankle Joint / PNS (ALL Small)', price: 500 },
      { id: 'T-152', code: 'X-Ray Chest', name: 'X-Ray Chest P/A View', price: 600 },
      { id: 'T-153', code: 'X-Ray Hip', name: 'X-Ray Hip Joint B/V', price: 1200 },
      { id: 'T-154', code: 'X-Ray IVU', name: 'X-Ray IVU (Without Medicine)', price: 2500 },
      { id: 'T-155', code: 'X-Ray RGU MCU', name: 'X-Ray RGU, MCU (Without Medicine)', price: 2300 }
    ],

    doctors: [
      { id: 'D-001', name: 'Dr. Amina Rahman', title: 'MBBS, FCPS', specialty: 'Internal Medicine', contact: '01700000001', visits: '09:00 - 13:00', newPrice: 800, oldPrice: 500, photo: '' },
      { id: 'D-002', name: 'Dr. Farhan Ahmed', title: 'MBBS, MS', specialty: 'Cardiology', contact: '01700000002', visits: '16:00 - 20:00', newPrice: 1000, oldPrice: 700, photo: '' },
      { id: 'D-003', name: 'Dr. Umme Salma (Priya)', title: 'MBBS (COMC), BCS (Health), DOC (Dermatology)', specialty: 'Dermatology & Allergy', contact: '01868-551839', visits: '16:00 - 20:00', newPrice: 600, oldPrice: 400, photo: '' },
      { id: 'D-004', name: 'Dr. Madhabilata (Nishi)', title: 'MBBS (DU), DMU (Ultra), PGT (Gyne & Obs)', specialty: 'Gynecology, Obstetrics & Infertility', contact: '01762-913773', visits: '24/7 (On Request)', newPrice: 800, oldPrice: 500, photo: '' },
      { id: 'D-005', name: 'Dr. Md. Saif Ullah Sujan', title: 'MBBS, FCPS, MS (Urology), Associate Professor', specialty: 'Urology & General Surgery', contact: '01762-913773', visits: 'Fri 08:30 - 10:30', newPrice: 1000, oldPrice: 700, photo: '' },
      { id: 'D-006', name: 'Dr. Fatema Farhana', title: 'MBBS, D-LO, MSS (UK), Assistant Professor', specialty: 'ENT & Head-Neck Surgery', contact: '01762-913773', visits: 'Sun 09:00 - 14:00', newPrice: 800, oldPrice: 500, photo: '' },
      { id: 'D-007', name: 'Dr. Md. Fazlul Haque Baker', title: 'MBBS, BCS (Health), DMU, DCCD', specialty: 'Medicine, Rheumatology & Diabetes', contact: '01762-913773', visits: 'Off-hours', newPrice: 600, oldPrice: 400, photo: '' },
      { id: 'D-008', name: 'Dr. Afsarul Amin', title: 'MBBS, BCS, FCPS, PGT, CCD, CMU', specialty: 'Medicine, Nephrology & Diabetes', contact: '01762-913773', visits: 'Sat - Thu (Off-hours)', newPrice: 700, oldPrice: 400, photo: '' },
      { id: 'D-009', name: 'Dr. Yasin Arafat Bipul', title: 'MBBS, BCS, PGT, CCD, FCPS (Cardiology)', specialty: 'Cardiology & Medicine', contact: '01762-913773', visits: 'Thu - Fri', newPrice: 800, oldPrice: 500, photo: '' },
      { id: 'D-010', name: 'Dr. Md. Hasibul Haque', title: 'MBBS, BCS, Medical Officer (Paediatrics)', specialty: 'Paediatrics & Neonatology', contact: '01762-913773', visits: 'Sat - Thu (Off-hours)', newPrice: 600, oldPrice: 400, photo: '' },
      { id: 'D-011', name: 'Dr. Ashraf Ahmed', title: 'MBBS, PGT, MD Course', specialty: 'Paediatrics & Neonatology', contact: '01762-913773', visits: 'Fri 09:00 - 14:00', newPrice: 700, oldPrice: 400, photo: '' },
      { id: 'D-012', name: 'Al Mehedi Hasib', title: 'D.M.F (Dhaka), F.T- 250 Bed General Hospital, Feni', specialty: 'Sub-Assistant Medical Officer', contact: '01733-443339', visits: 'On Request', newPrice: 400, oldPrice: 250, photo: '' }
    ],

    agents: [{ id: 'A-001', name: 'Community Health Desk', contact: '01700000003' }],
    referrers: [{ id: 'R-001', agentId: 'A-001', name: 'Nusrat Jahan', contact: '01700000004' }],
    cabins: [
      { id: 'C-01', name: 'Cabin 01', price: 2500 }, { id: 'C-02', name: 'Cabin 02', price: 2500 },
      { id: 'C-03', name: 'Cabin 03', price: 3000 }, { id: 'C-04', name: 'Cabin 04', price: 3000 },
      { id: 'C-05', name: 'Cabin 05', price: 3500 }, { id: 'C-06', name: 'Cabin 06', price: 3500 }
    ],
    indoorServices: [], labOrders: [], appointments: [], bookings: [],
    floors: [], rooms: [], roomBills: [], roomClaims: []
  };
}

async function loadData() {
  return loadDatabase({ directory: databaseDirectory, legacyFile: legacyDatabaseFile, defaults: initialData });
}

async function saveData(data) {
  return saveDatabase({ directory: databaseDirectory, data });
}

async function getFirebaseSyncState() {
  const state = firebaseSync
    ? await firebaseSync.status()
    : { pending: 0, byProject: {}, lastSuccessAt: null, lastError: null, ready: false };
  return {
    available: Boolean(firebaseSync),
    ...state,
    lastError: firebaseSyncLastError || state.lastError || firebaseSyncInitializationError
  };
}

async function retryFirebaseQueue() {
  if (!firebaseSync || firebaseRetryInProgress) return;
  firebaseRetryInProgress = true;
  try {
    await firebaseSync.retry();
    firebaseSyncLastError = null;
  } catch (error) {
    firebaseSyncLastError = error.message;
  } finally {
    firebaseRetryInProgress = false;
  }
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('firebase-sync:state', await getFirebaseSyncState());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 760,
    minHeight: 620,
    frame: false,
    icon: path.join(__dirname, 'site_assets', 'Hospital_Logo.ico'),
    backgroundColor: '#f5f7f6',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'UI', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.on('context-menu', event => event.preventDefault());
}

app.whenReady().then(async () => {
  app.setPath('userData', path.join(app.getPath('appData'), 'hmss-desktop'));
  databaseDirectory = app.isPackaged
    ? path.join(app.getPath('userData'), 'Database')
    : path.join(__dirname, 'Database');
  legacyDatabaseFile = path.join(app.getPath('userData'), 'hospital-data.json');
  assetsDirectory = app.isPackaged
    ? path.join(app.getPath('userData'), 'assets')
    : path.join(__dirname, 'assets');
  await fs.mkdir(assetsDirectory, { recursive: true });

  try {
    firebaseSync = createFirebaseSync({
      file: path.join(app.getPath('userData'), 'firebase-sync-queue.json'),
      configs: await loadProjectConfigs(path.join(__dirname, 'Firebase_sdks'))
    });
    firebaseRetryTimer = setInterval(retryFirebaseQueue, 60000);
    await retryFirebaseQueue();
  } catch (error) {
    firebaseSyncInitializationError = `Firebase sync could not start: ${error.message}`;
  }

  ipcMain.handle('data:load', loadData);
  ipcMain.handle('data:save', (_event, data) => saveData(data));
  ipcMain.handle('firebase-sync:queue', async (_event, kind, record) => {
    if (!firebaseSync) throw new Error(firebaseSyncInitializationError || 'Firebase sync is unavailable.');
    const result = await firebaseSync.enqueue(kind, record);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('firebase-sync:state', await getFirebaseSyncState());
    setImmediate(retryFirebaseQueue);
    return result;
  });
  ipcMain.handle('firebase-sync:status', getFirebaseSyncState);
  ipcMain.handle('firebase-sync:retry', async () => {
    await retryFirebaseQueue();
    return getFirebaseSyncState();
  });
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:toggle-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('document:save-pdf', async (_event, pageSize) => {
    if (!['A4', 'A5'].includes(pageSize)) throw new Error('Unsupported document page size.');
    const destination = path.join(app.getPath('downloads'), `${pageSize === 'A5' ? 'Test-Cash-Memo' : 'Hospital-Bill'}-${Date.now()}.pdf`);
    const pdf = await mainWindow.webContents.printToPDF({
      pageSize,
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    await fs.writeFile(destination, pdf);
    return destination;
  });
  ipcMain.handle('updates:get-state', () => ({ ...updateState, appVersion: app.getVersion(), supported: app.isPackaged, logs: [...updateState.logs] }));
  ipcMain.handle('updates:check', async () => {
    if (!app.isPackaged) {
      publishUpdateState('Update checks are available in the installed release, not development mode.', 'unsupported');
      return { ...updateState, logs: [...updateState.logs] };
    }
    if (['checking', 'downloading'].includes(updateState.status)) return { ...updateState, logs: [...updateState.logs] };
    publishUpdateState('Starting update check.', 'checking', { error: null });
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      const message = readableUpdaterError(error);
      publishUpdateState(`Update check failed: ${message}`, 'error', { error: message });
    }
    return { ...updateState, logs: [...updateState.logs] };
  });
  ipcMain.handle('updates:download', async () => {
    if (!app.isPackaged || updateState.status !== 'available') throw new Error('No downloadable update is available.');
    publishUpdateState(`Starting download for version ${updateState.availableVersion}.`, 'downloading', { percent: 0, transferred: 0, total: 0 });
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      const message = readableUpdaterError(error);
      publishUpdateState(`Update download failed: ${message}`, 'error', { error: message });
      throw error;
    }
    return true;
  });
  ipcMain.handle('updates:install', () => {
    if (!app.isPackaged || updateState.status !== 'downloaded') throw new Error('The update has not finished downloading.');
    publishUpdateState('Restarting to install the update.', 'installing');
    autoUpdater.quitAndInstall(false, true);
  });
  const imageCategoryDirectory = category => {
    const directory = {
      doctors: 'doctors',
      agents: 'marketing_agent',
      referrers: 'Special_Referrer'
    }[category];
    if (!directory) throw new Error('Choose a supported profile category.');
    return path.join(assetsDirectory, directory);
  };
  const saveProfileImage = async (sourcePath, category) => {
    if (typeof sourcePath !== 'string' || !sourcePath) throw new Error('Choose an image file.');
    const extension = path.extname(sourcePath).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) throw new Error('Use a PNG, JPG or WebP image.');
    const directory = imageCategoryDirectory(category);
    await fs.mkdir(directory, { recursive: true });
    const destination = path.join(directory, `${crypto.randomUUID()}${extension}`);
    await fs.copyFile(sourcePath, destination);
    return pathToFileURL(destination).href;
  };
  ipcMain.handle('asset:choose-image', async (_event, category) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return saveProfileImage(result.filePaths[0], category);
  });
  ipcMain.handle('asset:store-image', (_event, sourcePath, category) => saveProfileImage(sourcePath, category));

  configureAutoUpdater();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (firebaseRetryTimer) clearInterval(firebaseRetryTimer);
});