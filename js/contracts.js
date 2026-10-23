// Contracts: fill a template from a job, and share/unshare it in the customer's portal.
(function () {
  function longDate(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  async function fill(ctx, jobId, templateBody) {
    var js = await ctx.bizRef.collection('jobs').doc(jobId).get();
    if (!js.exists) throw { code: 'vyro/no-job' };
    var job = js.data(), cust = {}, est = {};
    if (job.customerId) { var cs = await ctx.bizRef.collection('customers').doc(job.customerId).get(); if (cs.exists) cust = cs.data(); }
    var es = await ctx.bizRef.collection('estimates').doc(job.estimateId || jobId).get(); if (es.exists) est = es.data();
    var b = ctx.biz || {};
    var scope = (est.lineItems || []).map(function (it) {
      return '  - ' + (it.description || '') + ' (qty ' + it.qty + ', ' + vutil.fmt(Math.round(it.qty * it.unitCents)) + ')';
    }).join('\n');
    var dep = job.depositPct ? Math.round((job.contractCents || 0) * job.depositPct / 100) : 0;
    // The contractor is the person on the team account making the document.
    var me = ctx.me || {};
    var roleLabel = { owner: 'Owner', supervisor: 'Supervisor', employee: 'Team member' }[ctx.role] || '';
    var map = {
      contractor_name: me.name, contractor_title: roleLabel,
      contract_date: longDate(vutil.todayStr()), estimate_number: job.estimateNumber || '',
      business_name: b.name, business_address: b.address || b.businessAddress, business_phone: b.phone, business_email: b.email,
      license_number: b.licenseNumber || b.license,
      customer_name: job.customerName || cust.name, customer_address: cust.address || job.address,
      customer_phone: job.customerPhone || cust.phone, customer_email: job.customerEmail || cust.email,
      job_address: job.address, project_title: job.title,
      scope: scope, contract_total: job.contractCents ? vutil.fmt(job.contractCents) : '',
      deposit_amount: dep ? vutil.fmt(dep) : '[down payment amount]',
      start_date: longDate(job.startDate), target_end_date: longDate(job.targetEndDate)
    };
    // Templates saved before this change: fill the contractor's printed name and title in too.
    if (map.contractor_name && templateBody.indexOf('{{contractor_name}}') < 0) {
      templateBody = templateBody
        .replace('Contractor: {{business_name}},', 'Contractor: {{business_name}}, represented by {{contractor_name}}, {{contractor_title}},')
        .replace(/Printed name and title: _+/, 'Printed name and title: {{contractor_name}}, {{contractor_title}}');
    }
    var text = templateBody.replace(/\{\{(\w+)\}\}/g, function (m, k) {
      var v = map[k]; return (v !== undefined && v !== null && String(v).trim()) ? String(v) : '[' + k.replace(/_/g, ' ') + ']';
    });
    var cap = Math.min(100000, Math.round((job.contractCents || 0) * 0.10));
    return { text: text, job: job, depositCents: dep, californiaCapCents: cap };
  }

  function blanks(text) { return (text.match(/\[[^\]]+\]/g) || []).length; }

  async function share(ctx, contractId, c) {
    var pref = vyro.db.collection('portals').doc(c.jobId);
    await pref.collection('documents').doc(contractId).set({
      title: c.title || 'Contract', body: c.body, businessName: ctx.biz.name || '', sharedAt: vyro.stamp()
    });
  }
  async function unshare(contractId, jobId) {
    try { await vyro.db.collection('portals').doc(jobId).collection('documents').doc(contractId).delete(); } catch (e) { /* may not exist */ }
  }

  window.vcontract = { fill: fill, blanks: blanks, share: share, unshare: unshare, longDate: longDate };
})();
