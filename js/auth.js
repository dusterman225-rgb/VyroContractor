(function () {
  firebase.initializeApp(window.VYRO_FIREBASE_CONFIG);
  var auth = firebase.auth();
  var db = firebase.firestore();
  var stamp = firebase.firestore.FieldValue.serverTimestamp;
  var busy = false;

  function friendly(err) {
    var map = {
      'auth/email-already-in-use': 'That email already has an account. Try signing in.',
      'auth/invalid-email': 'That email address does not look right.',
      'auth/weak-password': 'Choose a stronger password (at least 8 characters).',
      'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/wrong-password': 'Email or password is incorrect.',
      'auth/user-not-found': 'Email or password is incorrect.',
      'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
      'auth/network-request-failed': 'No connection. Check your internet and try again.',
      'permission-denied': 'Permission denied. Check the Firestore rules were published.'
    };
    return map[err && err.code] || 'Something went wrong. Please try again.';
  }

  async function signUp(email, password, businessName) {
    busy = true;
    try {
      var cred = await auth.createUserWithEmailAndPassword(email, password);
      var uid = cred.user.uid;
      var bizRef = db.collection('businesses').doc();
      var batch = db.batch();
      batch.set(bizRef, { name: businessName, ownerUid: uid, product: 'contractor', createdAt: stamp() });
      batch.set(bizRef.collection('members').doc(uid), { role: 'owner', email: email, createdAt: stamp() });
      batch.set(db.collection('users').doc(uid), { email: email, bizId: bizRef.id, createdAt: stamp() });
      await batch.commit();
      return cred.user;
    } finally {
      busy = false;
    }
  }

  function signIn(email, password) { return auth.signInWithEmailAndPassword(email, password); }
  function resetPassword(email) { return auth.sendPasswordResetEmail(email); }
  function signOut() { return auth.signOut(); }

  function requireAuth(cb) {
    auth.onAuthStateChanged(function (u) {
      if (!u) { location.replace('login.html'); } else { cb(u); }
    });
  }
  function redirectIfSignedIn() {
    auth.onAuthStateChanged(function (u) {
      if (u && !busy) { location.replace('app.html'); }
    });
  }

  window.vyro = { auth: auth, db: db, friendly: friendly, signUp: signUp, signIn: signIn,
    resetPassword: resetPassword, signOut: signOut, requireAuth: requireAuth,
    redirectIfSignedIn: redirectIfSignedIn };
})();
