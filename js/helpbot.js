// Floating "Help" chat button. Set window.VYRO_HELP_URL in js/helpbot-config.js to your Worker address.
(function () {
  var URL_ = window.VYRO_HELP_URL;
  if (!URL_) return;
  var css = document.createElement('style');
  css.textContent = '#hbBtn{position:fixed;right:14px;bottom:14px;z-index:50;padding:12px 16px;border-radius:999px;border:0;background:#d4af37;color:#111;font-weight:700}' +
    '#hbBox{position:fixed;right:10px;left:10px;bottom:70px;max-width:420px;margin-left:auto;z-index:50;background:#0d1117;border:1px solid #2a3340;border-radius:14px;display:none;flex-direction:column;max-height:70vh}' +
    '#hbLog{padding:12px;overflow:auto;flex:1}#hbLog div{margin:6px 0;padding:8px 10px;border-radius:10px;white-space:pre-wrap;font-size:.9rem;line-height:1.4}' +
    '.hbu{background:#1b2431;margin-left:30px!important}.hba{background:#141a22;margin-right:30px!important}' +
    '#hbRow{display:flex;gap:6px;padding:8px;border-top:1px solid #2a3340}#hbRow input{flex:1;min-width:0}';
  document.head.appendChild(css);
  var btn = document.createElement('button'); btn.id = 'hbBtn'; btn.type = 'button'; btn.textContent = 'Help';
  var box = document.createElement('div'); box.id = 'hbBox';
  var log = document.createElement('div'); log.id = 'hbLog';
  var row = document.createElement('div'); row.id = 'hbRow';
  var inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 500; inp.placeholder = 'Ask how to do something...';
  var send = document.createElement('button'); send.type = 'button'; send.className = 'btn'; send.textContent = 'Send';
  row.appendChild(inp); row.appendChild(send); box.appendChild(log); box.appendChild(row);
  document.body.appendChild(btn); document.body.appendChild(box);
  var hist = [], busy = false;
  function add(cls, t) { var d = document.createElement('div'); d.className = cls; d.textContent = t; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
  add('hba', 'Hi! Ask me how to use the app. I am an AI assistant and can make mistakes.');
  btn.addEventListener('click', function () { box.style.display = box.style.display === 'flex' ? 'none' : 'flex'; });
  async function go() {
    var t = inp.value.trim(); if (!t || busy) return;
    busy = true; inp.value = ''; add('hbu', t); hist.push({ role: 'user', content: t });
    var wait = add('hba', '...');
    try {
      var r = await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: hist, page: location.pathname }) });
      var d = await r.json();
      if (!d.reply) throw new Error('x');
      wait.textContent = d.reply; hist.push({ role: 'assistant', content: d.reply });
    } catch (e) { wait.textContent = 'Sorry, help is unavailable right now. Please try again in a minute.'; hist.pop(); }
    busy = false;
  }
  send.addEventListener('click', go);
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
})();
  
