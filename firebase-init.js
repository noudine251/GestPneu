// Initialisation Firebase + couche de synchronisation temps réel (remplace l'ancien localStorage).
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Connexion anonyme obligatoire avant tout accès à Firestore : les règles de sécurité
// exigent un utilisateur authentifié (même anonyme), ce qui bloque l'accès direct à la
// base par quelqu'un qui n'a jamais chargé l'application.
const authReady = firebase
  .auth()
  .signInAnonymously()
  .catch((e) => console.error("Erreur d'authentification Firebase", e));

// Toutes les données métier sont regroupées dans la collection "kils",
// un document par type (même découpage que les anciennes clés localStorage).
async function saveC(key, data) {
  try {
    await authReady;
    await db.collection("kils").doc(key).set({ items: data });
  } catch (e) {
    console.error("Erreur de sauvegarde Firestore", key, e);
  }
}

// Écoute les changements en temps réel (y compris depuis un autre navigateur/poste).
// On ignore les échos de nos propres écritures (même contenu) pour éviter une boucle
// écriture -> notification -> re-écriture.
// Important : on ignore aussi les tout premiers instantanés "depuis le cache local" tant
// qu'aucune confirmation serveur n'est arrivée, sinon un cache vide/obsolète au chargement
// peut être pris pour la vérité et écrasé (sauvegardé) par-dessus les vraies données serveur.
function subscribeC(key, onChange) {
  let lastJSON = null;
  let gotServerSnapshot = false;
  let unsub = null;
  let cancelled = false;
  authReady.then(() => {
    if (cancelled) return;
    unsub = db.collection("kils").doc(key).onSnapshot(
      (snap) => {
        if (snap.metadata.fromCache && !gotServerSnapshot) return;
        gotServerSnapshot = true;
        const data = snap.exists && snap.data().items ? snap.data().items : [];
        const json = JSON.stringify(data);
        if (json === lastJSON) return;
        lastJSON = json;
        onChange(data);
      },
      (err) => console.error("Erreur de synchronisation Firestore", key, err)
    );
  });
  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}
