const fs = require('fs');
let code = fs.readFileSync('src/components/CustomerSupport.tsx', 'utf8');

if (!code.includes('const [fetchError, setFetchError]')) {
  code = code.replace(
    'const [isLoadingTickets, setIsLoadingTickets] = useState(false);',
    'const [isLoadingTickets, setIsLoadingTickets] = useState(false);\n  const [fetchError, setFetchError] = useState("");'
  );
  
  code = code.replace(
    `    fetchSupportTicketsApi(currentUser.id, currentUser.email, false)
      .then(data => {
        setTickets(data);
        if (data.length > 0 && !selectedTicket) {
          setSelectedTicket(data[0]);
        }
      })
      .finally(() => setIsLoadingTickets(false));`,
    `    setFetchError("");
    fetchSupportTicketsApi(currentUser.id, currentUser.email, false)
      .then(data => {
        setTickets(data);
        if (data.length > 0 && !selectedTicket) {
          setSelectedTicket(data[0]);
        }
      })
      .catch(err => {
        if (err.message === "UNAUTHORIZED" || err.message?.includes("Unauthorized")) {
          setFetchError(lang === "ar" ? "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى." : "Your session has expired. Please sign in again.");
        } else {
          setFetchError(lang === "ar" ? "تعذر تحميل طلبات الدعم الخاصة بك." : "We couldn't load your support requests.");
        }
      })
      .finally(() => setIsLoadingTickets(false));`
  );
  
  // Add rendering for error
  code = code.replace(
    `            {isLoadingTickets ? (
              <div className="p-8 text-center text-slate-400 text-xs animate-pulse">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                <span>{lang === "ar" ? "جاري تحميل تذاكر الدعم..." : "Loading support tickets..."}</span>
              </div>
            ) : filteredTickets.length === 0 ? (`,
    `            {fetchError ? (
              <div className="p-8 sm:p-10 text-center bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-4 shadow-lg text-rose-400">
                <div className="space-y-1 max-w-md mx-auto">
                  <h3 className="text-sm sm:text-base font-bold">
                    {lang === "ar" ? "خطأ في التحميل" : "Loading Error"}
                  </h3>
                  <p className="text-xs leading-relaxed">
                    {fetchError}
                  </p>
                </div>
              </div>
            ) : isLoadingTickets ? (
              <div className="p-8 text-center text-slate-400 text-xs animate-pulse">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                <span>{lang === "ar" ? "جاري تحميل تذاكر الدعم..." : "Loading support tickets..."}</span>
              </div>
            ) : filteredTickets.length === 0 ? (`
  );
}
fs.writeFileSync('src/components/CustomerSupport.tsx', code);
