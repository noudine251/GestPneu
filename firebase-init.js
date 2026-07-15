// Initialisation Firebase + couche de synchronisation temps réel (remplace l'ancien localStorage).
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Connexion anonyme obligatoire avant tout accès à Firestore : les règles de sécurité
// exigent un utilisateur authentifié (même anonyme au départ, remplacée par un vrai
// compte utilisateur après connexion), ce qui bloque l'accès direct à la base par
// quelqu'un qui n'a jamais chargé l'application.
const authReady = firebase
  .auth()
  .signInAnonymously()
  .catch((e) => console.error("Erreur d'authentification Firebase", e));

// Chaque catégorie de données (produits, factures, ventes...) est désormais une vraie
// collection Firestore avec un document par élément — plus un seul gros document
// contenant un tableau. Ça permet aux règles de sécurité de contrôler précisément
// qui a le droit de créer/modifier/supprimer CHAQUE élément.
//
// Pour ne rien changer au reste de l'application (qui manipule toujours de simples
// tableaux en mémoire), saveC/subscribeC traduisent en interne entre "tableau React"
// et "documents Firestore individuels". Un champ interne `_seq` (invisible pour le
// reste de l'appli) préserve l'ordre d'affichage (plus récent en premier).
const knownSeq = {}; // { [collection]: Map<id, seq> }

function subscribeC(collectionName, onChange) {
  let cancelled = false;
  let unsub = null;
  let gotServerSnapshot = false;
  let lastJSON = null;
  authReady.then(() => {
    if (cancelled) return;
    unsub = db.collection(collectionName).onSnapshot(
      (snap) => {
        if (snap.metadata.fromCache && !gotServerSnapshot) return;
        gotServerSnapshot = true;
        const docs = snap.docs.map((d) => d.data());
        docs.sort((a, b) => (b._seq || 0) - (a._seq || 0));
        knownSeq[collectionName] = new Map(docs.map((d) => [d.id, d._seq || 0]));
        const json = JSON.stringify(docs);
        if (json === lastJSON) return;
        lastJSON = json;
        onChange(docs);
      },
      (err) => console.error("Erreur de synchronisation Firestore", collectionName, err)
    );
  });
  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}

async function saveC(collectionName, items) {
  try {
    await authReady;
    const existing = knownSeq[collectionName] || new Map();
    let maxSeq = 0;
    existing.forEach((seq) => {
      if (seq > maxSeq) maxSeq = seq;
    });
    const batch = db.batch();
    const newIds = new Set();
    items.forEach((it) => {
      if (!it || !it.id) return;
      newIds.add(it.id);
      let seq = existing.get(it.id);
      if (seq === undefined) {
        maxSeq += 1;
        seq = maxSeq;
      }
      batch.set(db.collection(collectionName).doc(it.id), { ...it, _seq: seq });
    });
    existing.forEach((seq, id) => {
      if (!newIds.has(id)) batch.delete(db.collection(collectionName).doc(id));
    });
    await batch.commit();
  } catch (e) {
    console.error("Erreur de sauvegarde Firestore", collectionName, e);
  }
}

/* --------------------- Comptes Firebase par utilisateur ------------------- */
// Chaque utilisateur de la boutique a un vrai compte Firebase (email généré,
// invisible pour lui — il continue de ne taper que son code PIN). Ça permet aux
// règles Firestore de vérifier le vrai rôle (admin/vendeur) de la personne
// réellement connectée, au lieu de faire confiance à l'application seule.

// Instance Firebase secondaire utilisée uniquement pour créer des comptes : se
// connecter à Firebase avec un nouveau compte déconnecte automatiquement la
// session en cours sur l'instance où c'est fait, donc on isole cette opération.
const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = secondaryApp.auth();

// Firebase exige un mot de passe d'au moins 6 caractères, mais les codes PIN de
// l'appli peuvent faire seulement 4 chiffres — on dérive donc un mot de passe
// interne un peu plus long à partir du PIN, sans rien changer côté utilisateur.
function toAuthPassword(pin) {
  return `kils-${pin}`;
}

// Crée un compte Firebase pour un nouvel utilisateur (mot de passe dérivé de son
// code PIN) et enregistre son rôle dans kils_roles (lu par les règles de sécurité).
// Retourne l'identifiant Firebase (authUid) et l'email généré, à stocker sur la
// fiche utilisateur pour permettre la connexion plus tard.
async function createUserAccount(pin, role) {
  await authReady;
  const authEmail = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}@kils.internal`;
  const cred = await secondaryAuth.createUserWithEmailAndPassword(authEmail, toAuthPassword(pin));
  const authUid = cred.user.uid;
  await db.collection("kils_roles").doc(authUid).set({ role, active: true });
  await secondaryAuth.signOut();
  return { authUid, authEmail };
}

// Connexion avec le code PIN (mot de passe du compte Firebase de l'utilisateur).
async function loginUser(authEmail, pin) {
  await firebase.auth().signInWithEmailAndPassword(authEmail, toAuthPassword(pin));
}

// Déconnexion : on revient à une session anonyme pour que l'écran "Qui êtes-vous ?"
// puisse continuer à lire la liste des utilisateurs.
async function logoutUser() {
  try {
    await firebase.auth().signOut();
  } finally {
    await firebase.auth().signInAnonymously().catch((e) => console.error("Erreur d'authentification Firebase", e));
  }
}

// Retire les droits d'un utilisateur supprimé. Son compte Firebase existe toujours
// (impossible à supprimer depuis le navigateur sans serveur), mais sans entrée dans
// kils_roles il n'a plus aucune permission dans la base — ce qui revient au même.
async function revokeUserRole(authUid) {
  if (authUid) await db.collection("kils_roles").doc(authUid).delete();
}

// Met à jour le rôle/statut actif d'un utilisateur (pour les règles de sécurité).
async function updateUserRole(authUid, role, active) {
  if (authUid) await db.collection("kils_roles").doc(authUid).set({ role, active }, { merge: true });
}
