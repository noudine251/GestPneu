// Initialisation Firebase + couche de synchronisation temps réel (remplace l'ancien localStorage).
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Toutes les données métier sont regroupées dans la collection "kils",
// un document par type (même découpage que les anciennes clés localStorage).
async function saveC(key, data) {
  try {
    await db.collection("kils").doc(key).set({ items: data });
  } catch (e) {
    console.error("Erreur de sauvegarde Firestore", key, e);
  }
}

// Écoute les changements en temps réel (y compris depuis un autre navigateur/poste).
// On ignore les échos de nos propres écritures (même contenu) pour éviter une boucle
// écriture -> notification -> re-écriture.
function subscribeC(key, onChange) {
  let lastJSON = null;
  return db.collection("kils").doc(key).onSnapshot(
    (snap) => {
      const data = snap.exists && snap.data().items ? snap.data().items : [];
      const json = JSON.stringify(data);
      if (json === lastJSON) return;
      lastJSON = json;
      onChange(data);
    },
    (err) => console.error("Erreur de synchronisation Firestore", key, err)
  );
}
