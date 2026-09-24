import React, { useState } from "react";
import { 
  LifeBuoy, 
  Send, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Tag, 
  MessageSquare, 
  User, 
  ShieldCheck,
  RefreshCw,
  Search,
  Filter
} from "lucide-react";
import { SupportTicket, SupportStatus, SupportPriority } from "../../../types.js";
import { safeFormatDateTime } from "../../../lib/dateUtils.js";

interface AdminSupportTabProps {
  tickets: SupportTicket[];
  onSendMessage: (ticketId: string, message: string) => Promise<void>;
  onUpdateStatus: (ticketId: string, status: SupportStatus, priority: SupportPriority, notes?: string) => Promise<void>;
  loading: boolean;
  lang: "ar" | "fr" | "en";
  theme: "dark" | "light";
}

export const AdminSupportTab: React.FC<AdminSupportTabProps> = ({
  tickets,
  onSendMessage,
  onUpdateStatus,
  loading,
  lang,
  theme
}) => {
  const isAr = lang === "ar";
  const isFr = lang === "fr";

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(tickets[0]?.id || null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const t = {
    title: isAr ? "تذاكر الدعم الفني والاستفسارات" : isFr ? "Support Technique" : "Customer Support Tickets",
    subtitle: isAr ? "متابعة استفسارات العملاء والرد الفوري وتحديث حالة التذاكر" : isFr ? "Suivi des demandes d'assistance et réponses en direct" : "Live client support desk & resolution management",
    filterAll: isAr ? "الكل" : isFr ? "Tous" : "All",
    filterOpen: isAr ? "مفتوحة" : isFr ? "Ouverts" : "Open",
    filterInProgress: isAr ? "قيد المعالجة" : isFr ? "En cours" : "In Progress",
    filterResolved: isAr ? "محلولة" : isFr ? "Résolus" : "Resolved",
    searchPlaceholder: isAr ? "بحث في التذاكر..." : isFr ? "Rechercher..." : "Search tickets...",
    noTickets: isAr ? "لا توجد تذاكر دعم تطابق البحث." : isFr ? "Aucun ticket trouvé." : "No support tickets found.",
    selectTicketPrompt: isAr ? "اختر تذكرة من القائمة لعرض المحادثة" : isFr ? "Sélectionnez un ticket pour afficher la conversation" : "Select a ticket to view conversation",
    replyPlaceholder: isAr ? "اكتب الرد الرسمي للمشرف هنا..." : isFr ? "Écrivez votre réponse ici..." : "Write administrative response...",
    sendBtn: isAr ? "إرسال الرد" : isFr ? "Envoyer" : "Send Reply",
    changeStatus: isAr ? "تغيير الحالة" : isFr ? "Changer statut" : "Change Status",
    changePriority: isAr ? "الأولوية" : isFr ? "Priorité" : "Priority",
    adminBadge: isAr ? "إدارة ZAKIR" : isFr ? "Équipe ZAKIR" : "ZAKIR Support Admin"
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const subject = (ticket.subject || "").toLowerCase();
      const email = (ticket.userEmail || "").toLowerCase();
      const name = (ticket.userName || "").toLowerCase();
      if (!subject.includes(q) && !email.includes(q) && !name.includes(q)) return false;
    }
    return true;
  });

  const activeTicket = tickets.find((t) => t.id === selectedTicketId) || filteredTickets[0] || null;

  const handleSendReply = async () => {
    if (!activeTicket || !replyText.trim() || sending) return;
    setSending(true);
    try {
      await onSendMessage(activeTicket.id, replyText.trim());
      setReplyText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t.subtitle}
        </p>
      </div>

      {/* Main Two-Pane Layout */}
      <div 
        className={`rounded-2xl border overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px] ${
          theme === "dark" ? "bg-[#090D16]/90 border-slate-800/80" : "bg-white border-slate-200"
        }`}
      >
        {/* Left Pane: Ticket List */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-e border-slate-200/80 dark:border-slate-800/80 flex flex-col">
          {/* Filters & Search */}
          <div className="p-3 border-b border-slate-200/80 dark:border-slate-800/80 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full ps-8 pe-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent outline-hidden"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
              {["all", "Open", "In Progress", "Resolved"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  type="button"
                  className={`px-2.5 py-1 rounded-md font-medium shrink-0 transition-colors ${
                    statusFilter === st
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {st === "all" ? t.filterAll : st}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket Items */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 overflow-y-auto max-h-[500px] custom-scrollbar flex-1">
            {filteredTickets.map((ticket) => {
              const isSelected = activeTicket?.id === ticket.id;
              return (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={`p-3.5 text-start transition-colors cursor-pointer ${
                    isSelected
                      ? theme === "dark"
                        ? "bg-blue-600/10 border-s-2 border-blue-500"
                        : "bg-blue-50/80 border-s-2 border-blue-600"
                      : "hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs truncate text-slate-900 dark:text-slate-100 max-w-[160px]">
                      {ticket.userName || ticket.userEmail}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                        ticket.status === "Open"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          : ticket.status === "In Progress"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
                    {ticket.subject}
                  </div>

                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {ticket.message}
                  </div>
                </div>
              );
            })}

            {filteredTickets.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                {t.noTickets}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Conversation & Reply */}
        <div className="lg:col-span-8 flex flex-col justify-between">
          {activeTicket ? (
            <>
              {/* Ticket Top Meta */}
              <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {activeTicket.subject}
                  </h3>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>{activeTicket.userName} ({activeTicket.userEmail})</span>
                    <span>•</span>
                    <span className="font-mono text-[10px]">{activeTicket.category}</span>
                  </div>
                </div>

                {/* Status and Priority Quick Controls */}
                <div className="flex items-center gap-2">
                  <select
                    value={activeTicket.status}
                    onChange={(e) => onUpdateStatus(activeTicket.id, e.target.value as any, activeTicket.priority)}
                    className="text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent font-medium"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>

                  <select
                    value={activeTicket.priority}
                    onChange={(e) => onUpdateStatus(activeTicket.id, activeTicket.status, e.target.value as any)}
                    className="text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent font-medium"
                  >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Chat Stream */}
              <div className="p-4 space-y-3 overflow-y-auto max-h-[380px] custom-scrollbar flex-1">
                {/* Original ticket inquiry */}
                <div className="flex gap-2.5 max-w-[85%]">
                  <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    {(activeTicket.userName || "U")[0].toUpperCase()}
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800/80 p-3 rounded-2xl rounded-ts-none text-xs space-y-1">
                    <div className="font-semibold text-[11px] text-slate-700 dark:text-slate-300">
                      {activeTicket.userName}
                    </div>
                    <div className="text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                      {activeTicket.message}
                    </div>
                    <div className="text-[10px] text-slate-400 pt-1 text-end">
                      {safeFormatDateTime(activeTicket.createdAt, isAr ? "ar" : "en")}
                    </div>
                  </div>
                </div>

                {/* Subsequent thread messages */}
                {(activeTicket.messages || []).map((msg) => {
                  const isAdmin = msg.senderType === "admin";
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 max-w-[85%] ${
                        isAdmin ? "ms-auto flex-row-reverse" : ""
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 ${
                          isAdmin 
                            ? "bg-blue-600 text-white" 
                            : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : (msg.senderName || "U")[0].toUpperCase()}
                      </div>
                      <div
                        className={`p-3 rounded-2xl text-xs space-y-1 ${
                          isAdmin
                            ? "bg-blue-600 text-white rounded-te-none"
                            : "bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 rounded-ts-none"
                        }`}
                      >
                        <div className={`font-semibold text-[11px] ${isAdmin ? "text-blue-100" : "text-slate-700 dark:text-slate-300"}`}>
                          {isAdmin ? t.adminBadge : msg.senderName}
                        </div>
                        <div className="whitespace-pre-wrap">{msg.message}</div>
                        <div className={`text-[10px] pt-1 text-end ${isAdmin ? "text-blue-200" : "text-slate-400"}`}>
                          {safeFormatDateTime(msg.createdAt, isAr ? "ar" : "en")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80">
                <div className="flex gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t.replyPlaceholder}
                    rows={2}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent outline-hidden resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        handleSendReply();
                      }
                    }}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || sending}
                    type="button"
                    className="px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{t.sendBtn}</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-xs text-slate-400">
              {t.selectTicketPrompt}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
