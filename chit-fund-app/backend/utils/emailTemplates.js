/**
 * Builds the admin summary HTML email after group enrollment is finalized.
 * Includes cross-enrollment warnings for members in multiple groups.
 */
export const buildAdminSummaryEmail = (group, members, crossEnrollments = {}) => {
  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const rows = members.map((m, idx) => {
    const otherGroups = crossEnrollments[m.id] || [];
    const crossFlag = otherGroups.length > 0
      ? `<span style="color:#DC2626;font-weight:700;">⚠️ Also in: ${otherGroups.join(', ')}</span>`
      : `<span style="color:#10B981;font-weight:600;">—</span>`;

    return `
      <tr style="background:${idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF'};">
        <td style="padding:10px 8px;border-bottom:1px solid #E2E8F0;font-weight:700;color:#1E40AF;text-align:center;">${idx + 1}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #E2E8F0;font-weight:600;color:#1E293B;">${m.name}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #E2E8F0;color:#475569;font-size:12px;white-space:nowrap;">${m.mobile || '—'}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #E2E8F0;color:#475569;font-size:12px;word-break:break-all;">${m.email || '—'}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #E2E8F0;font-size:11px;">${crossFlag}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Group Enrollment Summary</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#F1F5F9;padding:15px 5px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
          
          <!-- Header (Flexible Flexbox alternative using table) -->
          <tr>
            <td style="background:linear-gradient(135deg,#0F172A 0%,#1E40AF 100%);padding:24px 20px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="55" valign="middle">
                    <div style="background:rgba(255,255,255,0.1);border-radius:12px;padding:8px;border:1px solid rgba(255,255,255,0.2);display:inline-block;width:36px;height:36px;text-align:center;">
                      <span style="font-weight:900;font-size:16px;color:#FFFFFF;line-height:36px;font-family:sans-serif;">VK</span>
                    </div>
                  </td>
                  <td valign="middle" style="padding-left:10px;">
                    <div style="color:#F59E0B;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;font-family:sans-serif;">Royal Chit Fund Services</div>
                    <div style="color:#FFFFFF;font-size:18px;font-weight:800;margin-top:2px;font-family:sans-serif;">Group Enrollment Summary</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Group Info Banner (CSS Grid alternative using Table) -->
          <tr>
            <td style="background:#EFF6FF;border-left:4px solid #1E40AF;padding:20px 20px;margin:0;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="50%" valign="top" style="padding-bottom:12px;padding-right:10px;">
                    <div style="font-size:9px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Group Code</div>
                    <div style="font-size:14px;font-weight:800;color:#1E40AF;margin-top:2px;">${group.id}</div>
                  </td>
                  <td width="50%" valign="top" style="padding-bottom:12px;">
                    <div style="font-size:9px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Group Name</div>
                    <div style="font-size:14px;font-weight:800;color:#1E293B;margin-top:2px;">${group.name}</div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" valign="top" style="padding-bottom:12px;padding-right:10px;">
                    <div style="font-size:9px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Chit Value</div>
                    <div style="font-size:14px;font-weight:800;color:#059669;margin-top:2px;">${formatCurrency(group.value)}</div>
                  </td>
                  <td width="50%" valign="top" style="padding-bottom:12px;">
                    <div style="font-size:9px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Monthly Contribution</div>
                    <div style="font-size:14px;font-weight:800;color:#059669;margin-top:2px;">${formatCurrency(group.monthly_contribution)} / member</div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" valign="top" style="padding-right:10px;">
                    <div style="font-size:9px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Tenure</div>
                    <div style="font-size:14px;font-weight:800;color:#1E293B;margin-top:2px;">${group.installments} Months</div>
                  </td>
                  <td width="50%" valign="top">
                    <div style="font-size:9px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Total Members Enrolled</div>
                    <div style="font-size:14px;font-weight:800;color:#1E40AF;margin-top:2px;">${members.length}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Members Section -->
          <tr>
            <td style="padding:24px 16px;">
              <div style="font-size:12px;font-weight:800;color:#1E293B;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">
                Enrolled Members
              </div>

              ${members.length === 0 ? `
                <div style="text-align:center;padding:32px;color:#94A3B8;font-size:13px;">No members enrolled yet.</div>
              ` : `
                <div style="width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;font-size:12px;min-width:480px;">
                    <thead>
                      <tr style="background:#1E40AF;">
                        <th width="35" style="padding:10px 8px;text-align:center;color:#FFFFFF;font-weight:700;font-size:10px;letter-spacing:0.5px;">#</th>
                        <th style="padding:10px 8px;text-align:left;color:#FFFFFF;font-weight:700;font-size:10px;letter-spacing:0.5px;">Member Name</th>
                        <th width="90" style="padding:10px 8px;text-align:left;color:#FFFFFF;font-weight:700;font-size:10px;letter-spacing:0.5px;">Mobile</th>
                        <th width="120" style="padding:10px 8px;text-align:left;color:#FFFFFF;font-weight:700;font-size:10px;letter-spacing:0.5px;">Email</th>
                        <th style="padding:10px 8px;text-align:left;color:#FFFFFF;font-weight:700;font-size:10px;letter-spacing:0.5px;">Other Groups</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rows}
                    </tbody>
                  </table>
                </div>
              `}

              ${Object.keys(crossEnrollments).length > 0 ? `
                <div style="margin-top:14px;padding:12px 14px;background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;font-size:11px;color:#DC2626;line-height:1.4;">
                  ⚠️ <strong>${Object.keys(crossEnrollments).length} member(s)</strong> are enrolled in multiple chit groups. Please review to avoid confusion during collection.
                </div>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;padding:20px;border-top:1px solid #E2E8F0;text-align:center;">
              <div style="font-size:10px;color:#94A3B8;font-family:sans-serif;">Generated on ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
              <div style="font-size:10px;color:#94A3B8;margin-top:4px;font-family:sans-serif;line-height:1.4;">This is a system-generated email from <strong>FinCore Chit Fund Management System</strong>.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};


/**
 * Builds the member welcome HTML email when they are enrolled in a chit group.
 */
export const buildMemberWelcomeEmail = (member, group) => {
  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const joinedDate = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to Chit Group</title></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:30px auto;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0F172A 0%,#1E40AF 100%);padding:32px 36px;text-align:center;">
      <div style="background:rgba(255,255,255,0.1);border-radius:12px;padding:12px;display:inline-block;border:1px solid rgba(255,255,255,0.2);margin-bottom:16px;">
        <div style="width:48px;height:48px;background:linear-gradient(135deg,#D97706,#F59E0B);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;color:#fff;">VK</div>
      </div>
      <div style="color:#F59E0B;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Royal Chit Fund Services</div>
      <div style="color:#FFFFFF;font-size:26px;font-weight:800;margin-top:8px;">Welcome, ${member.name}! 🎉</div>
      <div style="color:#93C5FD;font-size:14px;margin-top:6px;">You have been successfully enrolled in a Chit Group.</div>
    </div>

    <!-- Details Card -->
    <div style="padding:32px 36px;">
      <div style="background:#EFF6FF;border-radius:12px;padding:24px;border:1px solid #DBEAFE;">
        <div style="font-size:12px;font-weight:800;color:#1E40AF;text-transform:uppercase;letter-spacing:1px;margin-bottom:18px;">Your Chit Group Details</div>
        
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr>
            <td style="padding:8px 0;color:#64748B;font-weight:600;width:55%;">Group Name</td>
            <td style="padding:8px 0;color:#1E293B;font-weight:800;">${group.name}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748B;font-weight:600;border-top:1px dashed #E2E8F0;">Group Code</td>
            <td style="padding:8px 0;color:#1E40AF;font-weight:800;border-top:1px dashed #E2E8F0;">${group.id}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748B;font-weight:600;border-top:1px dashed #E2E8F0;">Chit Value</td>
            <td style="padding:8px 0;color:#059669;font-weight:800;border-top:1px dashed #E2E8F0;">${formatCurrency(group.value)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748B;font-weight:600;border-top:1px dashed #E2E8F0;">Monthly Contribution</td>
            <td style="padding:8px 0;color:#059669;font-weight:800;border-top:1px dashed #E2E8F0;">${formatCurrency(group.monthly_contribution)} / month</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748B;font-weight:600;border-top:1px dashed #E2E8F0;">Total Installments</td>
            <td style="padding:8px 0;color:#1E293B;font-weight:800;border-top:1px dashed #E2E8F0;">${group.installments} Months</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748B;font-weight:600;border-top:1px dashed #E2E8F0;">Enrollment Date</td>
            <td style="padding:8px 0;color:#1E293B;font-weight:800;border-top:1px dashed #E2E8F0;">${joinedDate}</td>
          </tr>
        </table>
      </div>

      <!-- Important Note -->
      <div style="margin-top:20px;padding:16px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;">
        <div style="font-size:13px;color:#92400E;font-weight:600;">
          📅 <strong>Important:</strong> Please ensure your monthly contribution of <strong>${formatCurrency(group.monthly_contribution)}</strong> is paid on time each month to avoid penalties.
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#F8FAFC;padding:20px 36px;border-top:1px solid #E2E8F0;text-align:center;">
      <div style="font-size:12px;color:#1E40AF;font-weight:700;">Royal Chit Fund Services</div>
      <div style="font-size:11px;color:#94A3B8;margin-top:4px;">For any queries, contact your chit fund manager directly.</div>
      <div style="font-size:11px;color:#94A3B8;margin-top:2px;">This is a system-generated email. Please do not reply.</div>
    </div>
  </div>
</body>
</html>
  `;
};
