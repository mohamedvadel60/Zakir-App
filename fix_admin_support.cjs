const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

if (!code.includes('const [supportFetchError, setSupportFetchError]')) {
  code = code.replace(
    'const [isUpdatingTicketStatus, setIsUpdatingTicketStatus] = useState(false);',
    'const [isUpdatingTicketStatus, setIsUpdatingTicketStatus] = useState(false);\n  const [supportFetchError, setSupportFetchError] = useState("");'
  );
  
  code = code.replace(
    `    fetchSupportTicketsApi(undefined, undefined, true).then((data) => {
      setSupportTickets(data);
      if (data.length > 0 && !selectedTicket) {
        setSelectedTicket(data[0]);
      }
    });`,
    `    setSupportFetchError("");
    fetchSupportTicketsApi(undefined, undefined, true).then((data) => {
      setSupportTickets(data);
      if (data.length > 0 && !selectedTicket) {
        setSelectedTicket(data[0]);
      }
    }).catch(err => {
      if (err.message === "UNAUTHORIZED" || err.message?.includes("Unauthorized")) {
        setSupportFetchError(lang === "ar" ? "انتهت صلاحية الجلسة. يرجى تسجيل الدخول كمسؤول مرة أخرى." : "Your session has expired. Please sign in as admin again.");
      } else {
        setSupportFetchError(lang === "ar" ? "تعذر تحميل طلبات الدعم." : "We couldn't load support requests.");
      }
    });`
  );
  
  // Add error rendering. In AdminDashboard it's line 976 {supportTickets...
  code = code.replace(
    `              {/* LIST CONTAINER */}
              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                {supportTickets`,
    `              {/* LIST CONTAINER */}
              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                {supportFetchError ? (
                  <div className="p-8 text-center bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-4 text-rose-400">
                    <h3 className="text-sm font-bold">{lang === "ar" ? "خطأ في التحميل" : "Loading Error"}</h3>
                    <p className="text-xs">{supportFetchError}</p>
                  </div>
                ) : supportTickets`
  );
}

fs.writeFileSync('src/components/AdminDashboard.tsx', code);
