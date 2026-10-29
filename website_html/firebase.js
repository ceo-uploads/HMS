import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getDatabase, onValue, ref } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

export const ALLOWED_EMAIL = "privatehospitalkabirhat@gmail.com";

export function isAuthorizedAccount(user) {
  return typeof user?.email === "string" && user.email.trim().toLowerCase() === ALLOWED_EMAIL;
}

export const DATASETS = Object.freeze({
  labOrders: Object.freeze({ label: "Clinical tests", project: "A", path: "hmss/v1/clinicalTests/labOrders", route: "tests", icon: "✚", color: "mint" }),
  bookings: Object.freeze({ label: "Bookings & cabins", project: "B", path: "hmss/v1/cabinBookings/bookings", route: "bookings", icon: "▣", color: "blue" }),
  claims: Object.freeze({ label: "Room bills", project: "C", path: "hmss/v1/roomBills/claims", route: "bills", icon: "▤", color: "amber" }),
  appointments: Object.freeze({ label: "Appointments", project: "D", path: "hmss/v1/otherRecords/appointments", route: "activity", icon: "◷", color: "blue" }),
  doctors: Object.freeze({ label: "Doctors", project: "D", path: "hmss/v1/otherRecords/doctors", route: "doctors", icon: "♙", color: "mint" }),
  referrals: Object.freeze({ label: "Referrals & leads", project: "D", path: "hmss/v1/otherRecords/referrals", route: "referrals", icon: "↗", color: "purple" }),
});

const configFiles = Object.freeze({
  A: "../Firebase_sdks/project-a.js",
  B: "../Firebase_sdks/project-b.js",
  C: "../Firebase_sdks/project-c.js",
  D: "../Firebase_sdks/project-d.js",
});
const projectNames = Object.freeze({ A: "Clinical tests", B: "Bookings & cabins", C: "Room bills", D: "Other records" });
const services = new Map();
const verifiedProjectUsers = new Map();
let initialized = false;

function decodeConfigString(value) {
  if (value.startsWith('"')) return JSON.parse(value);
  return value.slice(1, -1).replace(/\\(['"\\])/g, "$1").replace(/\\n/g, "\n").replace(/\\r/g, "\r");
}

function parseFirebaseConfig(source) {
  const objectMatch = source.match(/const\s+firebaseConfig\s*=\s*\{([\s\S]*?)\};/);
  if (!objectMatch) throw new Error("The project configuration could not be read.");

  const config = {};
  const propertyPattern = /([A-Za-z_$][\w$]*)\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
  let match;
  while ((match = propertyPattern.exec(objectMatch[1])) !== null) {
    config[match[1]] = decodeConfigString(match[2]);
  }
  if (!config.apiKey || !config.authDomain || !config.databaseURL || !config.projectId) {
    throw new Error("A project configuration is missing required Firebase settings.");
  }
  return config;
}

async function loadProjectConfig(project) {
  const url = new URL(configFiles[project], import.meta.url);
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error(`${projectNames[project]} configuration is unavailable.`);
  return parseFirebaseConfig(await response.text());
}

function waitForInitialAuth(auth) {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    }, (error) => {
      unsubscribe();
      reject(error);
    });
  });
}

export async function initializeFirebase() {
  if (initialized) return;
  const configs = await Promise.all(Object.keys(configFiles).map(async (project) => [project, await loadProjectConfig(project)]));

  for (const [project, config] of configs) {
    const app = initializeApp(config, `hmss-monitor-${project.toLowerCase()}`);
    const auth = getAuth(app);
    const database = getDatabase(app);
    services.set(project, { app, auth, database });
  }
  initialized = true;
}

export function watchPrimaryAuth(callback, onError) {
  const primary = services.get("A");
  if (!primary) throw new Error("Firebase is not initialized.");
  return onAuthStateChanged(primary.auth, callback, onError);
}

export async function getSessionStatus() {
  if (!initialized) return { signedIn: false, ready: false, missing: Object.keys(configFiles), unauthorized: [], authErrors: [] };
  const authErrors = [];
  const unauthorized = [];
  const missing = [];
  const states = await Promise.all([...services].map(async ([project, service]) => {
    verifiedProjectUsers.delete(project);
    let user;
    try {
      user = await waitForInitialAuth(service.auth);
    } catch (error) {
      authErrors.push({ project, code: error?.code ?? "auth/state-check-failed" });
      return [project, null];
    }

    if (!user) {
      missing.push(project);
      return [project, null];
    }
    if (!isAuthorizedAccount(user)) {
      unauthorized.push(project);
      return [project, user];
    }

    try {
      const token = await user.getIdToken();
      if (!token || service.auth.currentUser?.uid !== user.uid || !isAuthorizedAccount(service.auth.currentUser)) {
        throw Object.assign(new Error("Project authentication changed during token verification."), {
          code: "auth/session-changed",
        });
      }
      verifiedProjectUsers.set(project, user.uid);
    } catch (error) {
      authErrors.push({ project, code: error?.code ?? "auth/id-token-failed" });
    }
    return [project, user];
  }));
  const signedIn = new Map(states);
  const primaryUser = signedIn.get("A");
  return {
    user: primaryUser ?? null,
    signedIn: Boolean(primaryUser),
    ready: Boolean(primaryUser) && missing.length === 0 && unauthorized.length === 0 && authErrors.length === 0,
    missing,
    unauthorized,
    authErrors,
  };
}

export async function signInWithGoogle() {
  const primary = services.get("A");
  if (!primary) throw new Error("Firebase is not initialized.");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(primary.auth, provider);
  if (!isAuthorizedAccount(result.user)) {
    await Promise.all([...services.values()].map(({ auth }) => signOut(auth).catch(() => undefined)));
    throw Object.assign(new Error("This Google account is not authorized to view the monitoring site."), {
      code: "auth/unauthorized-email",
    });
  }
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential) {
    await Promise.all([...services.values()].map(({ auth }) => signOut(auth).catch(() => undefined)));
    throw new Error("Google sign-in did not return a usable credential.");
  }

  const secondary = [...services].filter(([project]) => project !== "A");
  const results = await Promise.allSettled(secondary.map(([, service]) => signInWithCredential(service.auth, credential)));
  const failedIndex = results.findIndex((entry) => entry.status === "rejected");
  if (failedIndex !== -1) {
    await Promise.all([...services.values()].map(({ auth }) => signOut(auth).catch(() => undefined)));
    const failedProject = secondary[failedIndex][0];
    const failure = results[failedIndex];
    throw Object.assign(new Error(`${projectNames[failedProject]} could not complete Google sign-in.`), {
      code: failure.status === "rejected" ? failure.reason?.code : "auth/unknown",
      project: failedProject,
    });
  }

  const status = await getSessionStatus();
  if (status.unauthorized.length) {
    await Promise.all([...services.values()].map(({ auth }) => signOut(auth).catch(() => undefined)));
    throw Object.assign(new Error("This Google account is not authorized to view the monitoring site."), {
      code: "auth/unauthorized-email",
    });
  }
  if (!status.ready) {
    await signOutEverywhere().catch(() => undefined);
    const failedProject = status.authErrors[0]?.project ?? status.missing[0] ?? "A";
    const failureCode = status.authErrors.find((entry) => entry.project === failedProject)?.code;
    throw Object.assign(
      new Error(`${projectNames[failedProject]} could not obtain a Firebase ID token for the signed-in Google account.`),
      { code: failureCode ?? "auth/project-session-missing", project: failedProject },
    );
  }

  return result.user;
}

export async function signOutEverywhere() {
  verifiedProjectUsers.clear();
  const results = await Promise.allSettled([...services.values()].map(({ auth }) => signOut(auth)));
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw new Error("One or more project sessions could not be signed out.");
}

export function listenToDataset(datasetKey, onUpdate, onError) {
  const dataset = DATASETS[datasetKey];
  if (!dataset) throw new Error("Unknown monitoring data source.");
  const service = services.get(dataset.project);
  const user = service?.auth.currentUser;
  if (!isAuthorizedAccount(user) || verifiedProjectUsers.get(dataset.project) !== user.uid) {
    throw Object.assign(new Error("A verified, authorized Firebase session for this project is required before reading monitoring data."), {
      code: "auth/unauthorized-email",
    });
  }
  return onValue(ref(service.database, dataset.path), (snapshot) => {
    onUpdate(snapshot.exists() ? snapshot.val() : null);
  }, onError);
}
