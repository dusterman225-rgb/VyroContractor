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
      'permission-denied': 'Permission denied. Check the Firestore rules were published, or you may not have access.',
      'vyro/bad-invite': 'That invite link is invalid or has already been used. Ask your owner for a new one.',
      'vyro/no-business': 'No business found for this account. You may have been removed from the team.'
    };
    return map[err && err.code] || 'Something went wrong. Please try again.';
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  async function signUp(email, password, businessName) {
    busy = true;
    try {
      var cred = await auth.createUserWithEmailAndPassword(email, password);
      try {
        var uid = cred.user.uid;
        var bizRef = db.collection('businesses').doc();
        var batch = db.batch();
        batch.set(bizRef, { name: businessName, ownerUid: uid, product: 'contractor', createdAt: stamp() });
        batch.set(bizRef.collection('members').doc(uid), { role: 'owner', email: email, createdAt: stamp() });
        batch.set(db.collection('users').doc(uid), { email: email, bizId: bizRef.id, createdAt: stamp() });
        await batch.commit();
      } catch (e) {
        try { await cred.user.delete(); } catch (_) {}
        throw e;
      }
      return cred.user;
    } finally { busy = false; }
  }

  async function joinTeam(email, password, name, code) {
    busy = true;
    try {
      code = (code || '').trim();
      var cred = await auth.createUserWithEmailAndPassword(email, password);
      try {
        var invRef = db.collection('invites').doc(code);
        var inv = await invRef.get();
        if (!inv.exists || inv.data().used) { throw { code: 'vyro/bad-invite' }; }
        var d = inv.data();
        var uid = cred.user.uid;
        var batch = db.batch();
        batch.set(db.collection('businesses').doc(d.bizId).collection('members').doc(uid),
          { role: d.role, email: email, name: name, inviteCode: code, createdAt: stamp() });
        batch.set(db.collection('users').doc(uid), { email: email, bizId: d.bizId, createdAt: stamp() });
        batch.update(invRef, { used: true, usedBy: uid });
        await batch.commit();
      } catch (e) {
        try { await cred.user.delete(); } catch (_) {}
        throw e;
      }
      return cred.user;
    } finally { busy = false; }
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

  async function loadContext(user) {
    var u = await db.collection('users').doc(user.uid).get();
    if (!u.exists || !u.data().bizId) { throw { code: 'vyro/no-business' }; }
    var bizRef = db.collection('businesses').doc(u.data().bizId);
    var res = await Promise.all([bizRef.get(), bizRef.collection('members').doc(user.uid).get()]);
    if (!res[0].exists || !res[1].exists) { throw { code: 'vyro/no-business' }; }
    return { user: user, bizId: bizRef.id, bizRef: bizRef, biz: res[0].data(), me: res[1].data(), role: res[1].data().role };
  }

  // Sign-in required, then loads the business. Errors show in the element with id="err".
  function start(cb) {
    requireAuth(async function (user) {
      try {
        var ctx = await loadContext(user);
        await cb(ctx);
      } catch (err) {
        var e = document.getElementById('err');
        if (e) { e.textContent = friendly(err); }
      }
    });
  }

  window.vyro = { auth: auth, db: db, stamp: stamp, friendly: friendly, el: el,
    signUp: signUp, joinTeam: joinTeam, signIn: signIn, resetPassword: resetPassword,
    signOut: signOut, requireAuth: requireAuth, redirectIfSignedIn: redirectIfSignedIn,
    loadContext: loadContext, start: start };
})();
